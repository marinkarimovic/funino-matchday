/* Matchday Hallenturnier v4.6 — local-first; no automatic external fetching. */
(()=>{'use strict';
const KEY='matchday_hall_v3';
const SYNC_ENDPOINT='https://axvcoxhjxdyvktqbjznp.supabase.co/functions/v1/meinturnierplan-sync';
const schedule=[
['2026-11-14','Union Babenberg · AHS Solar City','6+1'],
['2026-11-21','JAZ Linz Süd · Sporthalle Solar City','6+1'],
['2026-11-29','Fußballschule OÖ · Sporthalle Vöcklabruck','4+1'],
['2026-12-06','Stahl Linz · BRG Solar City','6+1'],
['2026-12-12','Fußballschule OÖ · Sporthalle Wolfsegg','4+1'],
['2026-12-20','Viktoria Marchtrenk · Großturnhalle Marchtrenk','6+1'],
['2027-01-02','Union Leonding · Rundhalle Leonding','6+1'],
['2027-01-10','Sternstein Juniors · Sporthalle Bad Leonfeld','4+1'],
['2027-01-17','Fußballschule OÖ · Sporthalle Rohrbach','4+1'],
['2027-01-24','SC Marchtrenk · Dreifachturnhalle Marchtrenk','6+1'],
['2027-02-21','Union Bad Kreuzen · Sportmittelschule Bad Kreuzen','4+1'],
['2027-02-27','ASK St. Valentin · IMS Langenhart','5+1'],
['2027-03-06','Fußballschule OÖ · Sporthalle Schärding','4+1']
].map(([date,title,format])=>({id:date,date,title,format}));
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clean=s=>String(s??'').trim().replace(/\s+/g,' ').slice(0,90);
const unique=ls=>[...new Set(ls.map(clean).filter(Boolean))];
const parseLines=s=>unique(String(s).split(/\r?\n/));
const formatClock=sec=>`${String(Math.floor(Math.max(0,sec)/60)).padStart(2,'0')}:${String(Math.max(0,sec)%60).padStart(2,'0')}`;
function freshEvent(){return {groups:{A:[],B:[]},fixtures:[],ko:[],url:'',liveId:null,seconds:600,duration:null,running:false,startedAt:null};}
function defaults(){return {active:'',team:'Unsere Kids',roster:['Spieler 1','Spieler 2','Spieler 3','Spieler 4','Spieler 5','Spieler 6'],duration:10,events:{},tournaments:[]};}
let app=defaults();try{const stored=JSON.parse(localStorage.getItem(KEY)||'null');if(stored&&stored.events&&typeof stored.events==='object'){app={...app,...stored};if(!Array.isArray(stored.tournaments))app.tournaments=null;}}catch{}
// V3 migration: only tournaments with actual saved data are migrated.
function migrateLegacy(){if(!Array.isArray(app.tournaments)){app.tournaments=Object.keys(app.events||{}).map(id=>{const entry=schedule.find(x=>x.id===id);return entry?{...entry,venue:''}:{id,date:/^\d{4}-\d\d-\d\d$/.test(id)?id:'',title:'Übernommenes Turnier',format:'Andere',venue:''};});}
app.tournaments=app.tournaments.filter(x=>x&&x.id&&app.events[x.id]);
if(!app.tournaments.some(x=>x.id===app.active))app.active=app.tournaments[0]?.id||'';
for(const e of Object.values(app.events||{})){if(e&&typeof e==='object'&&(!Number.isInteger(e.duration)||e.duration<1||e.duration>90))e.duration=Math.max(1,Math.min(90,Math.round(Number(app.duration)||10)));}
}
migrateLegacy();
for(const k of Object.keys(app.events)){const e=app.events[k];if(e&&typeof e==='object'){e.running=false;e.startedAt=null;}}
for(const e of Object.values(app.events||{})){if(e&&typeof e==='object'&&!e.syncTournamentId&&/\/c\/ad7xc9po\//i.test(String(e.url||'')))e.syncTournamentId='axy2scxq1t';}
let event=()=>app.events[app.active]??(app.events[app.active]=freshEvent());
function matchDuration(e=event()){const x=Number(e?.duration);return Number.isInteger(x)&&x>=1&&x<=90?x:Math.max(1,Math.min(90,Math.round(Number(app.duration)||10)));}
let view='plan',mainView='data',editingEventId=null,pendingImport=null,pendingImage=null,importMetaSelection=false,lastTick=Date.now();
function save(){try{localStorage.setItem(KEY,JSON.stringify(app));}catch{}};
function label(ev){const d=String(ev.date||'').split('-');return d.length===3?`${d[2]}.${d[1]}.${d[0]}`:'Ohne Datum';}
function setMessage(msg){$('importPreview').textContent=msg;}
function showMain(target,{scrollTop=true}={}){mainView=target==='live'&&app.active?'live':'data';$('managePane').classList.toggle('hidden',mainView!=='data');$('panel-live').classList.toggle('hidden',mainView!=='live');document.querySelectorAll('[data-main]').forEach(b=>b.classList.toggle('active',b.dataset.main===mainView));if(mainView==='live')renderLive();if(scrollTop)window.scrollTo({top:0,behavior:'smooth'});}
function showTab(tab){if(tab==='live'){showMain('live');return;}if(tab==='import'){openImportSheet();return;}const keepY=window.scrollY;view=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));['plan','groups','ko','stats'].forEach(t=>$('panel-'+t).classList.toggle('hidden',t!==tab));showMain('data',{scrollTop:false});render();requestAnimationFrame(()=>window.scrollTo(0,Math.min(keepY,Math.max(0,document.documentElement.scrollHeight-window.innerHeight))));}
function openImportSheet(){if(mainView!=='data')showMain('data');$('importSheet').classList.remove('hidden');document.body.style.overflow='hidden';$('closeImportSheet').focus({preventScroll:true});}
function closeImportSheet(){$('importSheet').classList.add('hidden');document.body.style.overflow='';}
function openSettings(){const active=app.active&&app.tournaments.some(t=>t.id===app.active);$('teamName').value=app.team;$('matchLength').value=app.duration;$('roster').value=app.roster.join('\n');$('eventDurationField').classList.toggle('hidden',!active);if(active){const current=app.tournaments.find(t=>t.id===app.active);$('eventDuration').value=matchDuration();$('selectedEventHint').textContent='Gilt nur für: '+current.title;}document.body.style.overflow='hidden';$('settingsSheet').classList.remove('hidden');}
function closeSettings(){$('settingsSheet').classList.add('hidden');if($('importSheet').classList.contains('hidden'))document.body.style.overflow='';}
function match(home,away,group,stage='group',time='',field=''){return {id:uid(),home,away,group,stage,time,field,homeGoals:null,awayGoals:null,events:[],winner:'',completed:false};}
function scoreReady(f){return Number.isInteger(f.homeGoals)&&Number.isInteger(f.awayGoals);}
function getMatch(id){return [...event().fixtures,...event().ko].find(f=>f.id===id);}
function teamKey(v){return clean(v).toLocaleLowerCase('de');}function ourMatch(f){return f&&(teamKey(f.home)===teamKey(app.team)||teamKey(f.away)===teamKey(app.team));}
function scoreOwn(f){const ours=teamKey(f.home)===teamKey(app.team);return ours?f.homeGoals:f.awayGoals;}
function scoreOpp(f){const ours=teamKey(f.home)===teamKey(app.team);return ours?f.awayGoals:f.homeGoals;}
function validURL(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u:null;}catch{return null;}}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
let dialogState=null;
function setupDialog(){const root=$('appModal');if(!root)return;root.addEventListener('click',e=>{if(e.target===root&&dialogState?.dismissible!==false)closeDialog(null);});$('modalClose').onclick=()=>closeDialog(null);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialogState)closeDialog(null);});}
function openDialogShell({title='Hinweis',message='',eyebrow='MATCHDAY',dismissible=true,showClose=true}={}){const root=$('appModal'),body=$('modalBody'),actions=$('modalActions'),msg=$('modalMessage');$('modalTitle').textContent=title;$('modalEyebrow').textContent=eyebrow;$('modalClose').classList.toggle('hidden',!showClose);msg.textContent=message||'';msg.classList.toggle('hidden',!message);body.innerHTML='';actions.innerHTML='';root.classList.remove('hidden');return {root,body,actions,msg,dismissible};}
function closeDialog(value){if(!dialogState)return;const state=dialogState;dialogState=null;$('appModal').classList.add('hidden');$('modalBody').innerHTML='';$('modalActions').innerHTML='';$('modalMessage').textContent='';if(state.restoreFocus&&state.restoreFocus.focus)try{state.restoreFocus.focus();}catch{}state.resolve(value);}
function appAlert(message,title='Hinweis'){return new Promise(resolve=>{const prev=document.activeElement;const {actions,dismissible}=openDialogShell({title,message});const ok=document.createElement('button');ok.type='button';ok.className='btn primary';ok.textContent='OK';ok.onclick=()=>closeDialog(true);actions.append(ok);dialogState={resolve,dismissible,restoreFocus:prev};requestAnimationFrame(()=>ok.focus());});}
function appConfirm(message,title='Bitte bestätigen',okLabel='OK'){return new Promise(resolve=>{const prev=document.activeElement;const {actions,dismissible}=openDialogShell({title,message});const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Abbrechen';cancel.onclick=()=>closeDialog(false);const ok=document.createElement('button');ok.type='button';ok.className='btn primary';ok.textContent=okLabel;ok.onclick=()=>closeDialog(true);actions.append(cancel,ok);dialogState={resolve,dismissible,restoreFocus:prev};requestAnimationFrame(()=>ok.focus());});}
function appPrompt({title='Eingabe',message='',defaultValue='',placeholder='',okLabel='Übernehmen',cancelLabel='Abbrechen',multiline=false,inputType='text'}={}){return new Promise(resolve=>{const prev=document.activeElement;const {body,actions,dismissible}=openDialogShell({title,message});const wrap=document.createElement('div');wrap.className='modal-field';let input;if(multiline){input=document.createElement('textarea');input.rows=4;}else{input=document.createElement('input');input.type=inputType;}input.value=defaultValue??'';input.placeholder=placeholder||'';wrap.append(input);body.append(wrap);const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent=cancelLabel;cancel.onclick=()=>closeDialog(null);const ok=document.createElement('button');ok.type='button';ok.className='btn primary';ok.textContent=okLabel;ok.onclick=()=>closeDialog(input.value);actions.append(cancel,ok);dialogState={resolve,dismissible,restoreFocus:prev};requestAnimationFrame(()=>input.focus());input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!multiline){e.preventDefault();closeDialog(input.value);}});});}
function appForm({title='Eingabe',message='',fields=[],okLabel='Speichern',cancelLabel='Abbrechen'}={}){return new Promise(resolve=>{const prev=document.activeElement;const {body,actions,dismissible}=openDialogShell({title,message});const inputs={};for(const field of fields){const wrap=document.createElement('div');wrap.className='modal-field';if(field.label){const label=document.createElement('label');label.textContent=field.label;wrap.append(label);}let input;if(field.type==='textarea'){input=document.createElement('textarea');input.rows=field.rows||4;}else if(field.type==='select'){input=document.createElement('select');for(const opt of field.options||[]){const option=document.createElement('option');if(typeof opt==='string'){option.value=opt;option.textContent=opt;}else{option.value=opt.value;option.textContent=opt.label;}input.append(option);}}else{input=document.createElement('input');input.type=field.type||'text';if(field.min!=null)input.min=field.min;if(field.max!=null)input.max=field.max;if(field.step!=null)input.step=field.step;}input.value=field.value??'';if(field.placeholder)input.placeholder=field.placeholder;wrap.append(input);if(field.hint){const hint=document.createElement('div');hint.className='modal-inline-hint';hint.textContent=field.hint;wrap.append(hint);}body.append(wrap);inputs[field.name]=input;}const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent=cancelLabel;cancel.onclick=()=>closeDialog(null);const ok=document.createElement('button');ok.type='button';ok.className='btn primary';ok.textContent=okLabel;ok.onclick=()=>{const result={};for(const field of fields)result[field.name]=inputs[field.name].value;closeDialog(result);};actions.append(cancel,ok);dialogState={resolve,dismissible,restoreFocus:prev};const first=inputs[fields[0]?.name];requestAnimationFrame(()=>first?.focus?.());});}
function chooseScorer(players){return new Promise(resolve=>{const prev=document.activeElement;const {body,actions,dismissible}=openDialogShell({title:'Torschütze wählen',message:'Tippe auf einen Namen oder gib unten einen eigenen ein.'});const options=document.createElement('div');options.className='modal-options';for(const name of players){const btn=document.createElement('button');btn.type='button';btn.className='btn wide modal-option-btn';btn.textContent=name;btn.onclick=()=>closeDialog(name);options.append(btn);}body.append(options);const customWrap=document.createElement('div');customWrap.className='modal-field';const customLabel=document.createElement('label');customLabel.textContent='Eigener Name / Korrektur';const input=document.createElement('input');input.placeholder='z. B. Samuel';customWrap.append(customLabel,input);body.append(customWrap);const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Abbrechen';cancel.onclick=()=>closeDialog(null);const custom=document.createElement('button');custom.type='button';custom.className='btn primary';custom.textContent='Namen übernehmen';custom.onclick=()=>closeDialog(clean(input.value)||'Unbekannt');actions.append(cancel,custom);dialogState={resolve,dismissible,restoreFocus:prev};requestAnimationFrame(()=>options.querySelector('button')?.focus());});}
function renderEvents(){const list=[...app.tournaments].sort((a,b)=>String(a.date).localeCompare(String(b.date)));$('eventCount').textContent=list.length+' Turniere';$('events').innerHTML=list.length?list.map(e=>`<div class="event-wrap ${e.id===app.active?'active':''}"><button type="button" class="event" data-event="${escapeHTML(e.id)}"><time>${escapeHTML(label(e))} · ${escapeHTML(e.format||'Andere')} · ${matchDuration(app.events[e.id])} min</time><strong>${escapeHTML(e.title)}</strong>${e.venue?`<small class="location">${escapeHTML(e.venue)}</small>`:''}<small>${(app.events[e.id]?.fixtures?.length||0)+(app.events[e.id]?.ko?.length||0)} Begegnungen erfasst</small></button><div class="event-actions"><button class="btn" data-event-edit="${escapeHTML(e.id)}" type="button">✎ Bearbeiten</button><button class="btn danger" data-event-delete="${escapeHTML(e.id)}" type="button">✕ Löschen</button></div></div>`).join(''):'';}
async function openEventEditor(id=null){editingEventId=id;const selected=app.tournaments.find(t=>t.id===id);const result=await appForm({title:selected?'Turnier bearbeiten':'Neues Turnier',message:'Pflege Datum, Veranstalter, Ort und Spielstärke direkt im Popup.',fields:[{name:'date',label:'Datum',type:'date',value:selected?.date||''},{name:'title',label:'Turnier / Veranstalter',value:selected?.title||'',placeholder:'z. B. Union Babenberg'},{name:'venue',label:'Sporthalle / Ort (optional)',value:selected?.venue||'',placeholder:'z. B. Solar City'},{name:'format',label:'Spielstärke',type:'select',value:selected?.format||'6+1',options:['4+1','5+1','6+1','3+1','Andere']}],okLabel:'✓ Turnier speichern'});if(result===null){editingEventId=null;return;}const title=clean(result.title);const date=result.date;const venue=clean(result.venue);const format=result.format;if(!title||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)){await appAlert('Bitte Turniername und Datum angeben.','Turnier speichern');return openEventEditor(id);}const existing=app.tournaments.find(t=>t.id===editingEventId);if(existing){Object.assign(existing,{title,date,venue,format});}else{const newId=uid();app.tournaments.push({id:newId,title,date,venue,format});app.events[newId]=freshEvent();app.events[newId].duration=app.duration;app.events[newId].seconds=app.duration*60;app.active=newId;}editingEventId=null;$('groupA').value=(event().groups.A||[]).join('\n');$('groupB').value=(event().groups.B||[]).join('\n');save();render();}
function closeEventEditor(){editingEventId=null;}
function activateEvent(id){if(!app.tournaments.some(t=>t.id===id))return;tick();app.active=id;const ev=event();ev.running=false;$('groupA').value=(ev.groups.A||[]).join('\n');$('groupB').value=(ev.groups.B||[]).join('\n');pendingImport=null;$('applyPreview').disabled=true;render();}
async function saveEvent(){return;}
async function deleteEvent(id){const e=app.tournaments.find(x=>x.id===id);if(!e)return;const ok=await appConfirm('Turnier „'+e.title+'“ einschließlich seiner Ergebnisse und Torschützen unwiderruflich löschen? Bitte vorher JSON-Sicherung anlegen.','Turnier löschen','Löschen');if(!ok)return;delete app.events[id];app.tournaments=app.tournaments.filter(x=>x.id!==id);if(app.active===id)app.active=app.tournaments[0]?.id||'';closeEventEditor();if(app.active){$('groupA').value=(event().groups.A||[]).join('\n');$('groupB').value=(event().groups.B||[]).join('\n');}if(!app.active)showMain('data');save();render();}
async function importPresetEvents(){const missing=schedule.filter(e=>!app.tournaments.some(t=>t.date===e.date&&t.title===e.title));if(!missing.length){await appAlert('Alle 13 Saisontermine sind bereits vorhanden.','Saisontermine');return;}if(!await appConfirm(missing.length+' Saisontermine ergänzen? Bestehende Turniere und Ergebnisse bleiben erhalten.','Saisontermine übernehmen','Übernehmen'))return;for(const x of missing){const id=uid();app.tournaments.push({...x,id,venue:''});app.events[id]=freshEvent();app.events[id].duration=app.duration;app.events[id].seconds=app.duration*60;}if(!app.active)app.active=app.tournaments[0].id;$('groupA').value=(event().groups.A||[]).join('\n');$('groupB').value=(event().groups.B||[]).join('\n');save();render();}
function renderGuide(){$('statusTournament').textContent='✓ '+(app.tournaments.find(x=>x.id===app.active)?.title||'');$('statusRoster').textContent=app.team==='Unsere Kids'?'Teamname prüfen':'✓ '+app.team;$('statusFixtures').textContent=event().fixtures.length+' Begegnungen';const ready=[...event().fixtures,...event().ko].some(ourMatch);$('statusLive').textContent=ready?'✓ Bereit':'Spiel fehlt';document.querySelectorAll('.guide-step').forEach((el,i)=>el.classList.toggle('complete',i===0||i===1&&app.team!=='Unsere Kids'||i===2&&event().fixtures.length>0||i===3&&ready));}

function rankings(group){const teams=event().groups[group]||[];const rows=teams.map(name=>({name,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}));const map=new Map(rows.map(r=>[r.name,r]));event().fixtures.filter(f=>f.group===group&&f.stage==='group'&&scoreReady(f)).forEach(f=>{const h=map.get(f.home),a=map.get(f.away);if(!h||!a)return;h.p++;a.p++;h.gf+=f.homeGoals;h.ga+=f.awayGoals;a.gf+=f.awayGoals;a.ga+=f.homeGoals;if(f.homeGoals>f.awayGoals){h.w++;a.l++;h.pts+=3;}else if(f.homeGoals<f.awayGoals){a.w++;h.l++;a.pts+=3;}else {h.d++;a.d++;h.pts++;a.pts++;}});rows.forEach(x=>x.gd=x.gf-x.ga);return rows.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'de'));}
function renderTables(){let html='';for(const g of ['A','B']){let rows=rankings(g);if(!rows.length)continue;html+=`<h3>Gruppe ${g}</h3><div class="scroll"><table class="table"><thead><tr><th>#</th><th>Team</th><th>Sp.</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff.</th><th>Pkt.</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.name===app.team?'ours':''}"><td>${i+1}</td><td>${escapeHTML(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}:${r.ga}</td><td class="num">${r.gd>0?'+':''}${r.gd}</td><td class="num"><strong>${r.pts}</strong></td></tr>`).join('')}</tbody></table></div>`;} $('tables').innerHTML=html||'<div class="muted">Noch keine Gruppen angelegt.</div>';}
function matchMarkup(f){const isOurs=ourMatch(f);const result=scoreReady(f)?`${f.homeGoals}:${f.awayGoals}`:'– : –';return `<div class="matchline"><div class="match"><div class="name">${escapeHTML(f.home||'Offen')}<small>${escapeHTML(f.group==='A'||f.group==='B'?'Gruppe '+f.group:f.stage==='semi'?'Halbfinale':f.stage==='final'?'Finale':'Freies Spiel')}${f.time?' · '+escapeHTML(f.time):''}</small></div><div class="score">${result}</div><div class="name">${escapeHTML(f.away||'Offen')}<small>${escapeHTML(f.field)}</small></div></div><button class="btn" data-edit="${f.id}">${isOurs?'Live':'Ergebnis'}</button>${event().fixtures.some(x=>x.id===f.id)?`<button class="btn danger" data-fixture-delete="${f.id}" aria-label="Spiel ${escapeHTML(f.home)} gegen ${escapeHTML(f.away)} löschen">✕</button>`:''}</div>`;}
function renderFixtures(){const fixtures=[...event().fixtures,...event().ko];$('fixtures').innerHTML=fixtures.length?fixtures.map(matchMarkup).join(''):'<p>Hier erscheinen Begegnungen nach dem Import oder nach Erstellen der Gruppenrunde.</p>';}
function isMeinTurnierplanUrl(value){const u=validURL(value);return Boolean(u&&u.protocol==='https:'&&u.hostname==='www.meinturnierplan.de'&&/^\/c\/[a-z0-9]+\/[a-z0-9-]+\/?$/i.test(u.pathname));}
function normalizeTournamentId(value){
 const raw=clean(value);
 if(/^[a-z0-9]+$/i.test(raw))return raw;
 const u=validURL(raw);
 if(u&&u.hostname==='www.meinturnierplan.de'){
  if(/^\/pdf\.php$/i.test(u.pathname)){
   const id=u.searchParams.get('id')||'';return /^[a-z0-9]+$/i.test(id)?id:'';
  }
  if(/^\/c\/ad7xc9po\//i.test(u.pathname))return 'axy2scxq1t';
 }
 return '';
}
function renderSyncStatus(){
 const ev=event();
 const tid=normalizeTournamentId(ev.syncTournamentId||ev.url||'');
 if(tid&&!ev.syncTournamentId){ev.syncTournamentId=tid;save();}
 if($('syncTournamentId'))$('syncTournamentId').value=ev.syncTournamentId||tid||'';
 $('syncTournament').disabled=!tid;
 if(!tid){$('syncStatus').textContent='Noch keine echte MeinTurnierplan-Turnier-ID gespeichert.';return;}
 if(ev.lastSyncAt){const when=new Date(ev.lastSyncAt);$('syncStatus').textContent='ID '+tid+' · zuletzt synchronisiert '+when.toLocaleString('de-AT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(ev.lastSyncSummary?' · '+ev.lastSyncSummary:'');}
 else $('syncStatus').textContent='ID '+tid+' · bereit zur Synchronisierung.';
}
function syncMatchKey(f){return [f.group||'',f.time||'',teamKey(f.home),teamKey(f.away)].join('|');}
function findSyncFixture(remote){
 const fixtures=event().fixtures;
 if(Number.isInteger(Number(remote.sourceNo))&&Number(remote.sourceNo)>0){
  const byNo=fixtures.find(f=>Number(f.sourceNo)===Number(remote.sourceNo));if(byNo)return byNo;
 }
 const exact=fixtures.find(f=>syncMatchKey(f)===syncMatchKey(remote));if(exact)return exact;
 return fixtures.find(f=>(teamKey(f.home)===teamKey(remote.home)&&teamKey(f.away)===teamKey(remote.away))||(teamKey(f.home)===teamKey(remote.away)&&teamKey(f.away)===teamKey(remote.home)))||null;
}
async function syncOnlineTournament(){
 const ev=event(),url=validURL(ev.url);
 const tournamentId=normalizeTournamentId(ev.syncTournamentId||ev.url||'');
 if(!tournamentId){await appAlert('Bitte einmal die echte MeinTurnierplan-Turnier-ID oder den PDF-Link speichern.','Live-Sync');return;}
 const button=$('syncTournament'),oldText=button.textContent;button.disabled=true;button.textContent='↻ Synchronisiere …';$('syncStatus').textContent='MeinTurnierplan wird gelesen …';
 try{
  const response=await fetch(SYNC_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url?.href||'',tournamentId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.ok)throw Error(data?.error||('HTTP '+response.status));
  if(!Array.isArray(data.fixtures)||!data.fixtures.length)throw Error('Keine Begegnungen auf der offiziellen Seite gefunden.');

  let added=0,updatedMeta=0,officialResults=0;const conflicts=[];
  for(const remote of data.fixtures){
   if(!remote?.home||!remote?.away)continue;
   let local=findSyncFixture(remote);
   if(!local){
    local=match(clean(remote.home),clean(remote.away),['A','B'].includes(remote.group)?remote.group:'A','group',clean(remote.time),clean(remote.field));
    if(Number.isInteger(Number(remote.sourceNo))&&Number(remote.sourceNo)>0)local.sourceNo=Number(remote.sourceNo);
    if(Number.isInteger(remote.homeGoals)&&Number.isInteger(remote.awayGoals)){local.homeGoals=remote.homeGoals;local.awayGoals=remote.awayGoals;local.completed=Boolean(remote.completed);officialResults++;}
    ev.fixtures.push(local);added++;continue;
   }

   if(Number.isInteger(Number(remote.sourceNo))&&Number(remote.sourceNo)>0)local.sourceNo=Number(remote.sourceNo);
   if(remote.time&&local.time!==remote.time){local.time=clean(remote.time);updatedMeta++;}
   if(remote.field&&local.field!==remote.field){local.field=clean(remote.field);updatedMeta++;}
   if(['A','B'].includes(remote.group)&&local.group!==remote.group){local.group=remote.group;updatedMeta++;}
   local.home=clean(remote.home);local.away=clean(remote.away);

   if(Number.isInteger(remote.homeGoals)&&Number.isInteger(remote.awayGoals)){
    if(!scoreReady(local)){local.homeGoals=remote.homeGoals;local.awayGoals=remote.awayGoals;local.completed=Boolean(remote.completed);officialResults++;}
    else if(local.homeGoals!==remote.homeGoals||local.awayGoals!==remote.awayGoals){conflicts.push({local,remote});}
    else if(remote.completed)local.completed=true;
   }
  }

  if(Array.isArray(data.groups?.A)&&data.groups.A.length)ev.groups.A=unique(data.groups.A);
  if(Array.isArray(data.groups?.B))ev.groups.B=unique(data.groups.B);
  $('groupA').value=(ev.groups.A||[]).join('\n');$('groupB').value=(ev.groups.B||[]).join('\n');

  let conflictApplied=0;
  if(conflicts.length){
   const accept=await appConfirm(conflicts.length+' offizielle Ergebnisse unterscheiden sich von lokal gespeicherten Spielständen. Offizielle Ergebnisse übernehmen? Eure Torschützen-Ereignisse bleiben erhalten.','Live-Sync: Ergebnis-Konflikt','Offizielle Ergebnisse übernehmen');
   if(accept){for(const {local,remote} of conflicts){local.homeGoals=remote.homeGoals;local.awayGoals=remote.awayGoals;local.completed=Boolean(remote.completed);conflictApplied++;officialResults++;}}
  }

  ev.lastSyncAt=data.syncedAt||new Date().toISOString();
  ev.lastSyncSummary=(data.summary?.completed??officialResults)+' offizielle Ergebnisse';
  save();render();
  await appAlert('Synchronisierung abgeschlossen. '+(data.summary?.fixtures??data.fixtures.length)+' Begegnungen geprüft, '+added+' neu ergänzt, '+officialResults+' Ergebnisse aktualisiert'+(conflicts.length&&!conflictApplied?', '+conflicts.length+' Konflikte lokal beibehalten':'')+'.','MeinTurnierplan Live-Sync');
 }catch(error){
  $('syncStatus').textContent='Sync fehlgeschlagen: '+(error?.message||error);
  await appAlert('Die offizielle Turnierseite konnte nicht synchronisiert werden. '+(error?.message||error),'Live-Sync');
 }finally{button.textContent=oldText;renderSyncStatus();}
}

function winner(f){if(!f||!scoreReady(f)||!f.home||!f.away)return '';if(f.homeGoals>f.awayGoals)return f.home;if(f.homeGoals<f.awayGoals)return f.away;return f.winner===f.home||f.winner===f.away?f.winner:'';}
function syncFinal(){const ko=event().ko; if(ko.length!==3)return;const x=winner(ko[0]),y=winner(ko[1]);const final=ko[2];if(final.home!==x||final.away!==y){final.home=x;final.away=y;final.homeGoals=null;final.awayGoals=null;final.events=[];final.winner='';if(event().liveId===final.id){event().running=false;event().liveId=null;}}}
function renderKO(){syncFinal();const ko=event().ko;if(ko.length!==3){$('bracket').innerHTML='<p>Halbfinale noch nicht angelegt. Gruppenstände oder manuelle Team-Auswahl verwenden.</p>';return;}
$('bracket').innerHTML=`<div><h3>Halbfinale</h3>${ko.slice(0,2).map((f,i)=>`<div class="slot"><small>HF ${i+1}</small><strong>${escapeHTML(f.home||'Offen')} ${scoreReady(f)?f.homeGoals:'–'} : ${scoreReady(f)?f.awayGoals:'–'} ${escapeHTML(f.away||'Offen')}</strong><small>${winner(f)?'Sieger: '+escapeHTML(winner(f)):'Sieger offen'}</small><button class="btn" style="margin-top:7px" data-edit="${f.id}">Ergebnis</button></div>`).join('')}</div><div><h3>Finale</h3><div class="slot"><small>Finale</small><strong>${escapeHTML(ko[2].home||'HF 1 Sieger')} ${scoreReady(ko[2])?ko[2].homeGoals:'–'} : ${scoreReady(ko[2])?ko[2].awayGoals:'–'} ${escapeHTML(ko[2].away||'HF 2 Sieger')}</strong><small>${winner(ko[2])?'🏆 '+escapeHTML(winner(ko[2])):'Noch offen'}</small><button class="btn" style="margin-top:7px" data-edit="${ko[2].id}" ${ko[2].home&&ko[2].away?'':'disabled'}>Ergebnis</button></div></div>`;}
function liveSelect(){syncFinal();const options=[...event().fixtures,...event().ko].filter(ourMatch).filter(f=>f.home&&f.away);let id=event().liveId;if(!options.some(f=>f.id===id)){id=options.find(f=>!f.completed&&!scoreReady(f))?.id||options.find(f=>!f.completed)?.id||options.at(-1)?.id||null;event().liveId=id;event().running=false;event().seconds=matchDuration()*60;}
$('liveChoice').innerHTML=options.length?options.map(f=>`<option value="${f.id}">${escapeHTML(f.group?'Gruppe '+f.group:f.stage==='semi'?'Halbfinale':f.stage==='final'?'Finale':'Freies Spiel')} · ${escapeHTML(f.home)} – ${escapeHTML(f.away)} ${scoreReady(f)?'('+f.homeGoals+':'+f.awayGoals+')':''}</option>`).join(''):'<option value="">Noch kein Spiel mit eurem Team</option>';$('liveChoice').value=id||'';return getMatch(id);}
function renderLive(){const f=liveSelect();if(!f){$('quickStart').classList.remove('hidden');$('liveContent').innerHTML='';return;}$('quickStart').classList.add('hidden');
let a=f.homeGoals??0,b=f.awayGoals??0;let oursHome=teamKey(f.home)===teamKey(app.team);const ourScore=oursHome?a:b,otherScore=oursHome?b:a;const opponent=oursHome?f.away:f.home;
$('liveContent').innerHTML=`<div class="muted" style="text-align:center;margin-top:14px">${escapeHTML(f.group?'Gruppe '+f.group:f.stage==='semi'?'Halbfinale':f.stage==='final'?'Finale':'Freies Spiel')} ${escapeHTML(f.time?'· '+f.time:'')} ${escapeHTML(f.field?'· '+f.field:'')}</div><div class="hero"><div class="side"><small>UNSER TEAM</small><h3>${escapeHTML(app.team)}</h3><div class="digits">${ourScore}</div></div><div class="colon">:</div><div class="side"><small>GEGNER</small><h3>${escapeHTML(opponent)}</h3><div class="digits">${otherScore}</div></div></div><div class="goalbuttons"><button id="goalOurs">⚽ Tor für uns +</button><button id="goalOther">⚽ Gegentor +</button></div><div class="row"><button class="btn" id="undoGoal" ${!f.events.length?'disabled':''}>↶ Letztes Tor zurück</button><button class="btn" id="correctScore">✎ Ergebnis korrigieren</button>${event().fixtures.some(x=>x.id===f.id)?'<button class="btn danger" id="deleteLiveMatch">✕ Spiel löschen</button>':''}</div><div class="clock" id="hallClock">${formatClock(event().seconds)}</div><div class="row" style="justify-content:center"><button class="btn primary" id="hallStart">${event().running?'⏸ Pause':'▶ Start'}</button><button class="btn" id="hallTimerReset">↺ Timer</button><button class="btn" id="hallTimerPlus">+ 1 min</button></div><h3>⚽ Tore</h3><div class="stack">${f.events.length?f.events.map(g=>`<div class="muted">${g.side==='ours'?'🟢':'🔵'} ${escapeHTML(g.player)} · ${escapeHTML(g.time)}</div>`).join(''):'<p>Dieses Spiel hat noch keine erfassten Treffer.</p>'}</div><div class="row" style="margin-top:16px"><button class="btn primary" id="hallComplete">✓ Spiel abschließen</button></div><p class="hint">Nach der Spielzeit automatisch angezeigte Uhrzeit ist kein offizieller Schlusspfiff. Du kannst jedes Resultat später ändern.</p>`;
$('goalOurs').onclick=async()=>{const players=unique(app.roster);const name=await chooseScorer(players);if(name===null)return;addGoal(f,'ours',name);};
$('goalOther').onclick=()=>addGoal(f,'theirs','Gegner');$('undoGoal').onclick=()=>{const g=f.events.pop();if(!g)return;const home=(g.side==='ours')===oursHome;let key=home?'homeGoals':'awayGoals';f[key]=Math.max(0,(f[key]??0)-1);afterScore();};
$('correctScore').onclick=()=>editScore(f.id);if($('deleteLiveMatch'))$('deleteLiveMatch').onclick=()=>deleteFixture(f.id);$('hallStart').onclick=()=>{tick();event().running=!event().running;lastTick=Date.now();save();renderLive();};$('hallTimerReset').onclick=()=>{event().running=false;event().seconds=matchDuration()*60;save();renderLive();};$('hallTimerPlus').onclick=()=>{event().seconds+=60;save();renderLive();};$('hallComplete').onclick=async()=>{tick();event().running=false;save();if(await appConfirm(`Spiel ${app.team} gegen ${opponent} mit ${ourScore}:${otherScore} abschließen?`,'Match abschließen','Abschließen')){f.homeGoals??=0;f.awayGoals??=0;f.completed=true;event().liveId=null;save();showTab('plan');}else renderLive();};}
function addGoal(f,side,player){tick();let home=(side==='ours')===(teamKey(f.home)===teamKey(app.team));const key=home?'homeGoals':'awayGoals';f.homeGoals=(f.homeGoals??0)+(home?1:0);f.awayGoals=(f.awayGoals??0)+(home?0:1);f.events.push({side,player,time:formatClock(matchDuration()*60-event().seconds)});afterScore();}
function afterScore(){syncFinal();save();render();}
function tick(){const e=event();if(!e.running)return;const now=Date.now(),seconds=Math.floor((now-lastTick)/1000);if(seconds<=0)return;lastTick+=seconds*1000;e.seconds=Math.max(0,e.seconds-seconds);if(!e.seconds){e.running=false;if(navigator.vibrate)navigator.vibrate([150,100,150]);}const clock=$('hallClock');if(clock)clock.textContent=formatClock(e.seconds);save();}
setInterval(tick,300);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
async function deleteFixture(id){
  const ev=event();
  const f=ev.fixtures.find(x=>x.id===id);
  if(!f)return;
  const result=scoreReady(f)?` (Ergebnis ${f.homeGoals}:${f.awayGoals})`:'';
  const goals=f.events?.length||0;
  const message=`Spiel „${f.home} – ${f.away}“${result} löschen? ${goals?`${goals} zugeordnete Torereignisse werden ebenfalls entfernt. `:''}Andere Spiele und das Turnier bleiben erhalten.`;
  if(!await appConfirm(message,'Spiel löschen','Spiel löschen'))return;
  // Re-check after asynchronous confirmation, e.g. if the tournament changed.
  if(!ev.fixtures.some(x=>x.id===id))return;
  ev.fixtures=ev.fixtures.filter(x=>x.id!==id);
  if(ev.liveId===id){ev.liveId=null;ev.running=false;ev.startedAt=null;ev.seconds=matchDuration(ev)*60;}
  // When the group's matchlist changes, keep any final round from being
  // silently re-seeded; existing fixtures and stats are recomputed by render.
  save();render();
}
async function editScore(id){const f=getMatch(id);if(!f)return;if(ourMatch(f)&&f.id!==event().liveId){event().running=false;event().liveId=f.id;event().seconds=matchDuration()*60;}const values=await appForm({title:'Ergebnis eintragen',message:`${f.home||'Offen'} gegen ${f.away||'Offen'}`,fields:[{name:'home',label:`${f.home||'Offen'}: Tore`,type:'number',min:0,max:99,step:1,value:f.homeGoals??'',placeholder:'leer = nicht gespielt'},{name:'away',label:`${f.away||'Offen'}: Tore`,type:'number',min:0,max:99,step:1,value:f.awayGoals??'',placeholder:'leer = nicht gespielt'}],okLabel:'Übernehmen'});if(values===null)return;const h=String(values.home).trim(),a=String(values.away).trim();if((h!==''&&!/^\d{1,2}$/.test(h))||(a!==''&&!/^\d{1,2}$/.test(a))){await appAlert('Bitte 0 bis 99 oder beide Felder leer eingeben.','Ergebnis eintragen');return;}if((h==='')!==(a==='')){await appAlert('Beide Werte eingeben oder beide leer lassen.','Ergebnis eintragen');return;}f.homeGoals=h===''?null:Number(h);f.awayGoals=a===''?null:Number(a);f.events=[];f.winner='';if(scoreReady(f)&&f.homeGoals===f.awayGoals&&f.stage!=='group'){const winnerChoice=await appForm({title:'Sieger festlegen',message:'Unentschieden nach regulärer Zeit – wer gewann im Entscheidungsschießen?',fields:[{name:'winner',label:'Sieger',type:'select',value:'',options:[{label:'Noch offen',value:''},{label:f.home,value:'1'},{label:f.away,value:'2'}]}],okLabel:'Übernehmen'});if(winnerChoice?.winner==='1')f.winner=f.home;else if(winnerChoice?.winner==='2')f.winner=f.away;}afterScore();}
function renderStats(){const fs=[...event().fixtures,...event().ko].filter(ourMatch).filter(scoreReady),wins=fs.filter(f=>scoreOwn(f)>scoreOpp(f)).length,draws=fs.filter(f=>scoreOwn(f)===scoreOpp(f)).length,losses=fs.filter(f=>scoreOwn(f)<scoreOpp(f)).length,goals=fs.reduce((n,f)=>n+scoreOwn(f),0),conceded=fs.reduce((n,f)=>n+scoreOpp(f),0);
$('stats').innerHTML=[['Spiele',fs.length],['Siege',wins],['Remis',draws],['Niederlagen',losses],['Tore',goals],['Gegentore',conceded]].map(([l,v])=>`<div class="statbox"><b>${v}</b><small>${l}</small></div>`).join('');const names={};for(const f of [...event().fixtures,...event().ko].filter(ourMatch))for(const g of f.events||[])if(g.side==='ours')names[g.player]=(names[g.player]||0)+1;const sorted=Object.entries(names).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));$('scorers').innerHTML=sorted.length?sorted.map(([n,c],i)=>`<div class="match"><span>${i+1}. ${escapeHTML(n)}</span><span class="pill">${c} ⚽</span><span></span></div>`).join(''):'<p class="muted">Noch keine Torschützen erfasst.</p>';}
function render(){renderEvents();const ready=Boolean(app.active);$('workspace').classList.toggle('hidden',!ready);$('emptyView').classList.toggle('hidden',ready);if(!ready){$('liveContent').innerHTML='';save();return;}renderGuide();renderTables();renderFixtures();renderSyncStatus();renderKO();renderStats();renderLive();$('onlineUrl').value=event().url||'';save();}
function teamsForKO(){const a=rankings('A').map(x=>x.name),b=rankings('B').map(x=>x.name);if(a.length>=2&&b.length>=2)return [a[0],b[1],b[0],a[1]];if(a.length>=4&&!b.length)return [a[0],a[3],a[1],a[2]];return null;}
async function groupMake(){const e=event();const groups={A:parseLines($('groupA').value),B:parseLines($('groupB').value)};if(!groups.A.length&&!groups.B.length){await appAlert('Bitte mindestens eine Mannschaft erfassen.','Gruppenphase');return false;}if(new Set([...groups.A,...groups.B]).size!==groups.A.length+groups.B.length){await appAlert('Ein Team darf nicht in beiden Gruppen vorkommen.','Gruppenphase');return false;}e.groups=groups;save();render();return true;}
async function generate(){if(!await groupMake())return;const e=event();const old=e.fixtures.filter(f=>f.stage==='group');if(old.length&&!await appConfirm('Vorhandene Gruppenspiele und Ergebnisse ersetzen?','Gruppenspiele erzeugen','Ersetzen'))return;
const other=e.fixtures.filter(f=>f.stage!=='group');const fs=[];for(const group of ['A','B']){const ts=e.groups[group];for(let round=0;round<ts.length-1;round++)for(let col=round+1;col<ts.length;col++)fs.push(match(ts[round],ts[col],group));}e.fixtures=[...other,...fs];e.running=false;e.liveId=null;render();showTab('plan');}
async function createKO(){const ts=teamsForKO();let teams=ts;if(ts&&[...event().fixtures].some(f=>f.stage==='group'&&!scoreReady(f))&&!await appConfirm('Nicht alle Gruppenspiele haben Ergebnisse. Die Halbfinalpaarungen basieren auf dem momentanen Tabellenstand. Trotzdem fortfahren?','Finalrunde erstellen','Trotzdem fortfahren'))return;if(!teams){const all=unique([...event().groups.A,...event().groups.B,...event().fixtures.flatMap(f=>[f.home,f.away])]);if(all.length<4){await appAlert('Bitte mindestens 4 Mannschaften anlegen.','Finalrunde erstellen');return;}const input=await appPrompt({title:'Halbfinalteams festlegen',message:'Vier Halbfinalteams mit Semikolon getrennt eingeben. Beispiel: Team 1; Team 2; Team 3; Team 4',defaultValue:all.slice(0,4).join('; '),placeholder:'Team 1; Team 2; Team 3; Team 4'});if(input===null)return;teams=input.split(';').map(clean);if(teams.length!==4||teams.some(x=>!x)||new Set(teams).size!==4){await appAlert('Genau vier verschiedene Teams angeben.','Finalrunde erstellen');return;}}
if(event().ko.length&&!await appConfirm('Vorhandene K.-o.-Ergebnisse ersetzen?','Finalrunde erstellen','Ersetzen'))return;event().ko=[match(teams[0],teams[1],'','semi'),match(teams[2],teams[3],'','semi'),match('','','','final')];event().running=false;event().liveId=null;render();}
async function addFixture(){const values=await appForm({title:'Begegnung anlegen',message:'Neue Begegnung oder freies Match erfassen.',fields:[{name:'group',label:'Gruppe',type:'select',value:'A',options:[{label:'Gruppe A',value:'A'},{label:'Gruppe B',value:'B'},{label:'Freies Spiel',value:'F'}]},{name:'home',label:'Heimmannschaft',value:''},{name:'away',label:'Gastmannschaft',value:''},{name:'time',label:'Uhrzeit (optional)',value:'',placeholder:'z. B. 10:30'},{name:'field',label:'Spielfeld (optional)',value:'',placeholder:'z. B. Feld 2'}],okLabel:'Begegnung speichern'});if(values===null)return;const g=String(values.group).trim().toUpperCase();if(!['A','B','F'].includes(g)){await appAlert('A, B oder F verwenden.','Begegnung anlegen');return;}const home=clean(values.home??'');const away=clean(values.away??'');if(!home||!away||home===away){await appAlert('Bitte zwei unterschiedliche Teams eingeben.','Begegnung anlegen');return;}const time=clean(values.time??'');const field=clean(values.field??'');const f=match(home,away,g==='F'?'':g,g==='F'?'friendly':'group',time,field);event().fixtures.push(f);if(g!=='F'){for(const n of [home,away])if(!event().groups[g].includes(n))event().groups[g].push(n);}render();}
// Geometry-based import for MeinTurnierplan's selectable-text PDF exports.
// Each item carries the PDF text and its PDF.js text transform coordinates.
function parseTournamentPdfPages(pages){
 const groups={A:[],B:[]},fixtures=[],messages=[];
 const linesFor=records=>{
  const lines=[];
  for(const raw of records){
   const text=String(raw.text||'').trim();if(!text)continue;
   const item={text,x:Number(raw.x)||0,y:Number(raw.y)||0};
   let line=lines.find(l=>Math.abs(l.y-item.y)<=2.3);
   if(!line){line={y:item.y,items:[]};lines.push(line);}
   line.items.push(item);
  }
  return lines.sort((a,b)=>b.y-a.y).map(l=>({y:l.y,items:l.items.sort((a,b)=>a.x-b.x),text:l.items.map(i=>i.text).join(' ').replace(/\s+/g,' ').trim()}));
 };
 const pagesLines=pages.map(linesFor);
 const first=pagesLines[0]||[];
 const dateRow=first.find(l=>/\bDatum\s*:/i.test(l.text))?.text||'';
 const durationRow=first.find(l=>/\bSpieldauer\s*:/i.test(l.text))?.text||'';
 const venueRow=first.find(l=>/\bVeranstaltungsort\s*:/i.test(l.text))?.text||'';
 const organizerRow=first.find(l=>/\bVeranstalter\s*:/i.test(l.text))?.text||'';
 const dm=dateRow.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
 const date=dm?`${dm[3]}-${dm[2]}-${dm[1]}`:'';
 const durationMatch=durationRow.match(/Spieldauer(?:\s+in\s+Gruppenphase)?\s*:\s*(\d{1,2})\s*Minuten/i);
 const duration=durationMatch?Number(durationMatch[1]):null;
 const organizer=organizerRow.replace(/^.*?Veranstalter\s*:\s*/i,'').trim();
 const venue=venueRow.replace(/^.*?Veranstaltungsort\s*:\s*/i,'').trim();
 const titleRows=first.filter(l=>l.y>first.find(v=>/^Veranstalter\s*:/i.test(v.text))?.y).map(l=>l.text).filter(t=>t&&!/(?:Powered|MeinTurnierplan|Ergebnisse live|Veranstalter|TuS Holzkirchen FC)/i.test(t));
 const title=titleRows.slice(0,2).join(' ').trim().slice(0,90);
 // In a MeinTurnierplan PDF the participant table has two parallel lists,
 // preceded by two distinct "Gruppe" column headings. Limit extraction
 // to that region; ranking tables elsewhere must never become team lists.
 for(const lines of pagesLines){
  const groupHeadIndex=lines.findIndex(l=>l.items.some(i=>/^Gruppe\s+A$/i.test(i.text))&&l.items.some(i=>/^Gruppe\s+B$/i.test(i.text)));
  if(groupHeadIndex<0)continue;
  const headings=lines[groupHeadIndex].items;
  const aHead=headings.find(i=>/^Gruppe\s+A$/i.test(i.text));
  const bHead=headings.find(i=>/^Gruppe\s+B$/i.test(i.text));
  const boundary=(aHead.x+bHead.x)/2;
  for(let i=groupHeadIndex+1;i<lines.length;i++){
   const line=lines[i];
   if(line.items.some(item=>/^Nr\.?$/i.test(item.text))||line.items.some(item=>/^Beginn$/i.test(item.text)))break;
   for(const g of ['A','B']){
    const text=line.items.filter(item=>g==='A'?item.x<boundary:item.x>=boundary).map(item=>item.text).join(' ').trim();
    const m=text.match(/^\s*\d{1,2}\s+(.+)$/);
    if(!m)continue;
    const team=clean(m[1]);
    if(team&&/\p{L}/u.test(team)&&!/^Gruppe\b/i.test(team))groups[g].push(team);
   }
  }
 }
 groups.A=unique(groups.A);groups.B=unique(groups.B);
 let seenRows=0;
 for(const lines of pagesLines){
  for(const row of lines){
   const items=row.items;
   const timeIndex=items.findIndex(i=>/^\d{1,2}:\d{2}$/.test(i.text));
   if(timeIndex<0)continue;
   const time=items[timeIndex];
   const numberItems=items.slice(0,timeIndex).filter(i=>/^\d{1,3}$/.test(i.text));
   if(numberItems.length<1)continue;
   const number=Number(numberItems[0].text),pitch=numberItems.length>=2?Number(numberItems[1].text):null;
   const gIndex=items.findIndex((item,i)=>i>timeIndex&&item.x>time.x&&/^[AB]$/i.test(item.text));
   if(gIndex<0)continue;
   const gr=items[gIndex],group=gr.text.toUpperCase();
   const score=items.find((item,i)=>i>gIndex&&item.x>gr.x+80&&/^\s*(?:\d{1,2}\s*)?:\s*(?:\d{1,2})?\s*$/.test(item.text));
   // The score column is two team-columns to the right of "Gr".
   // Midpoint between Gr and score divides the home/away names.
   const scoreX=score?.x??gr.x+215;
   const awayStart=(gr.x+scoreX)/2;
   const names=items.filter((item,i)=>i>gIndex&&item.x>gr.x+6&&item.x<scoreX-2);
   const home=clean(names.filter(i=>i.x<awayStart).map(i=>i.text).join(' '));
   const away=clean(names.filter(i=>i.x>=awayStart).map(i=>i.text).join(' '));
   if(!Number.isInteger(number)||number<1||number>999||(pitch!==null&&(!Number.isInteger(pitch)||pitch<1||pitch>40)))continue;
   seenRows++;
   if(!home||!away||home===away||!/\p{L}/u.test(home)||!/\p{L}/u.test(away)){
    messages.push(`Spiel ${number}: Mannschaften konnten nicht getrennt gelesen werden.`);continue;
   }
   if(groups[group].length&&(!groups[group].includes(home)||!groups[group].includes(away))){
    messages.push(`Spiel ${number}: Begegnung passt nicht zur erkannten Gruppe ${group}.`);continue;
   }
   const f=match(home,away,group,'group',time.text,pitch===null?'':`Feld ${pitch}`);
   f.sourceNo=number;
   fixtures.push(f);
  }
 }
 fixtures.sort((a,b)=>(a.sourceNo||0)-(b.sourceNo||0));
 if(!groups.A.length&&!groups.B.length&&fixtures.length){for(const f of fixtures){groups[f.group].push(f.home,f.away);}groups.A=unique(groups.A);groups.B=unique(groups.B);}
 if(!fixtures.length&&!groups.A.length&&!groups.B.length)throw Error('In diesem PDF wurden weder eine lesbare Teilnehmerliste noch gültige Spielpaarungen gefunden. Bitte einen offiziellen Text-PDF-Spielplan verwenden.');
 if(seenRows!==fixtures.length)messages.push(`${seenRows-fixtures.length} mögliche Begegnungen konnten nicht sicher übernommen werden.`);
 if(fixtures.length>0){const numbers=fixtures.map(f=>f.sourceNo);const missing=[];for(let n=numbers[0];n<=numbers.at(-1);n++){if(!numbers.includes(n))missing.push(n);}if(missing.length)messages.push(`Fehlende Spielnummern: ${missing.slice(0,12).join(', ')}${missing.length>12?' …':''}`);}
 return {groups,fixtures,meta:{kind:'pdf-structured',title,date,organizer,venue,duration,seenRows,notes:messages,pages:pages.length}};
}

function parseCSV(src){const lines=String(src).replace(/^\ufeff/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)throw Error('Datei leer');const head=lines[0];const sep=[';',',','\t'].sort((a,b)=>(head.split(b).length-head.split(a).length))[0];function parseRow(row){const res=[];let cur='',quoted=false;for(let i=0;i<row.length;i++){const c=row[i];if(c==='"'){if(quoted&&row[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){res.push(cur.trim());cur='';}else cur+=c;}res.push(cur.trim());return res;}
const headers=parseRow(lines[0]).map(x=>x.toLowerCase().replace(/[ _\-]/g,''));const field=(names)=>headers.findIndex(h=>names.includes(h));let gi=field(['gruppe','group','pool']),ti=field(['mannschaft','team','verein']),hi=field(['heim','home','team1','heimmannschaft']),ai=field(['gast','away','team2','gastmannschaft']),time=field(['uhrzeit','zeit','time','anpfiff']),pitch=field(['feld','court','field','spielfeld']);const groupRows={A:[],B:[]},fs=[];
if(hi<0||ai<0){if(ti<0)throw Error('CSV benötigt „Gruppe;Mannschaft“ oder „Gruppe;Heim;Gast“ als Spalten.');}
for(let i=1;i<lines.length;i++){const cells=parseRow(lines[i]);const g=(gi<0?'A':clean(cells[gi]).replace(/^gruppe\s*/i,'').toUpperCase());if(!['A','B'].includes(g))continue;if(hi>=0&&ai>=0){const home=clean(cells[hi]),away=clean(cells[ai]);if(!home||!away||home===away)continue;fs.push(match(home,away,g,'group',time<0?'':clean(cells[time]),pitch<0?'':clean(cells[pitch])));groupRows[g].push(home,away);}else{const n=clean(cells[ti]);if(n)groupRows[g].push(n);}}
return {groups:{A:unique(groupRows.A),B:unique(groupRows.B)},fixtures:fs};}
function parseJSON(s){
 const obj=JSON.parse(s);
 if(!obj||typeof obj!=='object'||!obj.groups)throw Error('JSON benötigt „groups“ und optional „fixtures“.');
 const groups={A:unique(obj.groups.A||[]),B:unique(obj.groups.B||[])};
 const fixtures=(obj.fixtures||[]).slice(0,500).map(f=>{
  const gr=['A','B'].includes(f.group)?f.group:'A';
  const m=match(clean(f.home),clean(f.away),gr,'group',clean(f.time),clean(f.field));
  if(Number.isInteger(Number(f.sourceNo))&&Number(f.sourceNo)>0)m.sourceNo=Number(f.sourceNo);
  return m;
 }).filter(f=>f.home&&f.away&&f.home!==f.away);
 return {groups,fixtures,meta:obj.meta&&typeof obj.meta==='object'?{...obj.meta,kind:'pdf-structured'}:null};
}
function ocrTeamKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replace(/0/g,'o').replace(/[^a-z0-9]/g,'');}
function ocrDistance(a,b){a=ocrTeamKey(a);b=ocrTeamKey(b);if(a===b)return 0;if(!a||!b)return Math.max(a.length,b.length);const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
function ocrSimilar(a,b){const x=ocrTeamKey(a),y=ocrTeamKey(b);if(!x||!y)return false;if(x===y)return true;const min=Math.min(x.length,y.length),max=Math.max(x.length,y.length);if(min>=6&&(x.includes(y)||y.includes(x))&&min/max>=0.72)return true;return ocrDistance(x,y)/max<=0.36;}
function cleanOcrTeam(value){let v=String(value||'').replace(/[\[\]{}]/g,' ').replace(/[|_]+/g,' ').replace(/[—–]+/g,' ').replace(/(?<=\p{L})0(?=\p{L})/gu,'o').replace(/\s+/g,' ').trim();v=v.replace(/^[^\p{L}]+/u,'').replace(/[^\p{L}\p{N}.&/ +\-]+$/u,'').trim();v=v.replace(/([a-zäöüß])([A-ZÄÖÜ])/g,'$1 $2');return clean(v);}
function parseOcrClock(value){const digits=String(value||'').replace(/[^0-9]/g,'');if(digits.length!==3&&digits.length!==4)return null;const h=Number(digits.length===3?digits[0]:digits.slice(0,2)),m=Number(digits.length===3?digits.slice(1):digits.slice(2));if(h>23||m>59)return null;return h*60+m;}
function fmtMinutes(value){const v=((value%1440)+1440)%1440;return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;}
function parseMeinTurnierplanScreenshotText(metaText,scheduleText){
 const meta=String(metaText||'').replace(/\r/g,'');
 const schedule=String(scheduleText||'').replace(/\r/g,'');
 const dateMatch=meta.match(/(?:Datum\s*:\s*)?(\d{2})\.(\d{2})\.(\d{4})/i);
 const durationMatch=meta.match(/Spieldauer[^\n:]*:?\s*(\d{1,2})\s*Minuten/i);
 const organizer=(meta.match(/Veranstalter\s*:\s*([^\n]+)/i)?.[1]||'').trim();
 const venue=(meta.match(/Veranstaltungsort\s*:\s*([^\n]+)/i)?.[1]||'').trim();
 const titleLines=meta.split(/\n+/).map(clean).filter(Boolean).filter(x=>!/^(?:Veranstalter|Datum|Veranstaltungsort|Spieldauer|Platzierungsmodus)/i.test(x));
 const title=titleLines.slice(0,2).join(' ').slice(0,90);
 const rows=[];
 const groupFromToken=value=>{const v=String(value||'').replace(/[^A-Za-z0-9@]/g,'').toLowerCase();if(v==='a'||v==='x'||v==='4')return'A';if(v==='b'||v==='8'||v==='e'||v==='o'||v==='@'||v==='6')return'B';return'';};
 for(const raw of schedule.split(/\n+/)){
  if(!/\p{L}/u.test(raw))continue;
  const line=raw.replace(/[\[\]{}]/g,'|').replace(/¦/g,'|').replace(/\|{2,}/g,'|');
  const parts=line.split('|').map(v=>v.trim()).filter(Boolean);if(parts.length<4)continue;
  let timeIdx=-1,timeMin=null;
  for(let i=0;i<parts.length;i++){const t=parseOcrClock(parts[i]);if(t!==null){timeIdx=i;timeMin=t;break;}}
  if(timeIdx<0){timeIdx=parts.findIndex(v=>{const d=v.replace(/[^0-9]/g,'');return d.length===3||d.length===4;});}
  if(timeIdx<0){const gidx=parts.findIndex(v=>groupFromToken(v));if(gidx<=0)continue;timeIdx=gidx-1;}
  let cursor=timeIdx+1,group='';
  if(parts[cursor]){group=groupFromToken(parts[cursor]);if(parts[cursor].length<=4||group)cursor++;}
  const teamParts=parts.slice(cursor).map(cleanOcrTeam).filter(v=>v&&v.length>=3&&/\p{L}/u.test(v)&&!/^ergebnis$/i.test(v));
  if(teamParts.length<2)continue;
  const home=teamParts[0],away=teamParts[1];if(ocrTeamKey(home)===ocrTeamKey(away))continue;
  rows.push({no:rows.length+1,timeMin,group,home,away});
 }
 if(rows.length<3)throw Error('Im Spielplanbereich wurden zu wenige verlässliche Begegnungen gelesen.');
 // Cluster OCR spelling variants separately per group so A/B variants such as "Union Puchenau A/B" never merge.
 const buckets={A:[],B:[],X:[]};
 const chooseCanonical=(bucket,value)=>{let found=bucket.find(x=>ocrSimilar(x,value));if(!found){bucket.push(value);return value;}const score=v=>(v.match(/\s/g)||[]).length*3+v.length;if(score(value)>score(found)){const idx=bucket.indexOf(found);bucket[idx]=value;return value;}return found;};
 // First pass: safely read groups establish canonical buckets.
 for(const r of rows){const b=['A','B'].includes(r.group)?r.group:'X';r.home=chooseCanonical(buckets[b],r.home);r.away=chooseCanonical(buckets[b],r.away);}
 // Re-resolve within each bucket after better spellings replaced earlier representatives.
 for(const r of rows){const b=['A','B'].includes(r.group)?r.group:'X';const h=buckets[b].find(x=>ocrSimilar(x,r.home));const a=buckets[b].find(x=>ocrSimilar(x,r.away));if(h)r.home=h;if(a)r.away=a;}
 // Unknown group rows can usually be assigned from a team already seen in a reliable A/B row.
 for(const r of rows){if(['A','B'].includes(r.group))continue;for(const g of ['A','B']){const known=buckets[g];if(known.some(x=>ocrSimilar(x,r.home)||ocrSimilar(x,r.away))){r.group=g;break;}}}
 // Merge unknown spellings into the now-known group buckets.
 for(const r of rows){if(!['A','B'].includes(r.group))continue;const b=buckets[r.group];r.home=chooseCanonical(b,r.home);r.away=chooseCanonical(b,r.away);}
 for(const r of rows){if(!['A','B'].includes(r.group))continue;const b=buckets[r.group],h=b.find(x=>ocrSimilar(x,r.home)),a=b.find(x=>ocrSimilar(x,r.away));if(h)r.home=h;if(a)r.away=a;}
 // If one or two rows remain unlabeled but their opponents form one connected set, assign the opposite of the other group only when unambiguous.
 for(const r of rows){if(['A','B'].includes(r.group))continue;const possible=['A','B'].filter(g=>buckets[g].some(x=>ocrSimilar(x,r.home)||ocrSimilar(x,r.away)));if(possible.length===1)r.group=possible[0];}
 const known=rows.filter(r=>r.timeMin!==null).sort((a,b)=>a.no-b.no),steps=[];for(let i=1;i<known.length;i++){const dn=known[i].no-known[i-1].no,dt=known[i].timeMin-known[i-1].timeMin;if(dn>0&&dt>0&&dt/dn>=3&&dt/dn<=30)steps.push(Math.round(dt/dn));}steps.sort((a,b)=>a-b);const step=steps.length?steps[Math.floor(steps.length/2)]:null,anchor=known[0];if(step&&anchor)for(const r of rows)if(r.timeMin===null)r.timeMin=anchor.timeMin+(r.no-anchor.no)*step;
 const groups={A:[],B:[]};for(const r of rows){if(!['A','B'].includes(r.group))continue;groups[r.group].push(r.home,r.away);}groups.A=unique(groups.A);groups.B=unique(groups.B);
 const fixtures=rows.filter(r=>['A','B'].includes(r.group)).map(r=>{const f=match(r.home,r.away,r.group,'group',r.timeMin===null?'':fmtMinutes(r.timeMin),'');f.sourceNo=r.no;return f;});
 if(!groups.A.length&&!groups.B.length)throw Error('Gruppen konnten aus den erkannten Begegnungen nicht sicher abgeleitet werden.');
 const notes=['Fotoimport ist OCR-basiert: Teamnamen und Uhrzeiten bitte kontrollieren.'];
 if(rows.length!==fixtures.length)notes.push(`${rows.length-fixtures.length} erkannte Zeilen konnten keiner Gruppe sicher zugeordnet werden.`);
 if(/Finalrunde/i.test(schedule))notes.push('Finalrunde aus dem Foto nicht automatisch übernommen; dafür bitte den offiziellen PDF-Spielplan verwenden.');
 return {groups,fixtures,meta:{kind:'ocr-structured',title,date:dateMatch?`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`:'',organizer,venue,duration:durationMatch?Number(durationMatch[1]):null,notes}};
}
function extractOcrParticipantCandidates(text){const out=[];const club=/\b(?:FC|SC|SV|TSV|TuS|MSW|SF|SPG|Union|ASK[ÖO]?|ASKO|NSG|SKN|First)\b/i;for(const raw of String(text||'').split(/\n+/)){let line=raw.replace(/[\[\]{}]/g,'|').replace(/¦/g,'|');const segments=line.split('|').flatMap(seg=>{const starts=[...seg.matchAll(/\b(?:FC|SC|SV|TSV|TuS|MSW|SF|SPG|Union|ASK[ÖO]?|ASKO|NSG|SKN|First)\b/gi)].map(m=>m.index);if(starts.length<=1)return[seg];const parts=[];for(let i=0;i<starts.length;i++)parts.push(seg.slice(starts[i],starts[i+1]??seg.length));return parts;});for(let seg of segments){seg=seg.replace(/^\s*\d{1,2}[.)\]]?\s*/,'');const m=seg.match(club);if(m&&m.index>0)seg=seg.slice(m.index);const v=cleanOcrTeam(seg);if(v.length>=4&&v.length<=60&&/\p{L}/u.test(v)&&!/(Teilnehmer|Gruppe|Vorrunde|Platzierungsmodus)/i.test(v))out.push(v);}}return unique(out);}
function improveStructuredOcrNames(parsed,candidates){if(!parsed||!candidates?.length)return parsed;const suffix=v=>String(v||'').match(/\b([AB])\s*$/i)?.[1]?.toUpperCase()||'';for(const group of ['A','B']){for(let i=0;i<parsed.groups[group].length;i++){const before=parsed.groups[group][i],bs=suffix(before);const matches=candidates.filter(c=>{const cs=suffix(c);if(bs&&cs&&bs!==cs)return false;return ocrSimilar(c,before);});if(!matches.length)continue;matches.sort((a,b)=>{const score=v=>(v.match(/\s/g)||[]).length*4+v.length;return score(b)-score(a);});const after=matches[0];parsed.groups[group][i]=after;for(const f of parsed.fixtures){if(f.group!==group)continue;if(f.home===before)f.home=after;if(f.away===before)f.away=after;}}}return parsed;}
async function loadImageBitmapForOcr(file){if('createImageBitmap' in window)return createImageBitmap(file);return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Bild konnte nicht geöffnet werden'));};img.src=url;});}
function ocrCropCanvas(image,left,top,right,bottom,scale=3){const sw=image.width*(right-left),sh=image.height*(bottom-top);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.filter='grayscale(1) contrast(1.9)';ctx.drawImage(image,image.width*left,image.height*top,sw,sh,0,0,canvas.width,canvas.height);return canvas;}
async function recognizeMeinTurnierplanScreenshot(worker,file){const image=await loadImageBitmapForOcr(file);await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});const metaCanvas=ocrCropCanvas(image,0.015,0.015,0.78,0.22,3);const participantCanvas=ocrCropCanvas(image,0.015,0.19,0.75,0.36,3);const scheduleCanvas=ocrCropCanvas(image,0.015,0.32,0.62,0.66,3);const metaResult=await worker.recognize(metaCanvas),participantResult=await worker.recognize(participantCanvas),scheduleResult=await worker.recognize(scheduleCanvas);const parsed=improveStructuredOcrNames(parseMeinTurnierplanScreenshotText(metaResult.data.text,scheduleResult.data.text),extractOcrParticipantCandidates(participantResult.data.text));return {parsed,raw:`${metaResult.data.text}\n\nTeilnehmer\n${participantResult.data.text}\n\nVorrunde\n${scheduleResult.data.text}`};}
function meinturnierplanPdfUrl(url){if(!url||!/(^|\.)meinturnierplan\.de$/i.test(url.hostname))return null;const directId=url.pathname.match(/^\/pdf\.php$/i)&&url.searchParams.get('id');if(directId)return `https://www.meinturnierplan.de/pdf.php?id=${encodeURIComponent(directId)}`;const id=url.pathname.match(/^\/c\/([^/]+)/i)?.[1];return id?`https://www.meinturnierplan.de/pdf.php?id=${encodeURIComponent(id)}`:null;}

// Only rows inside identified group tables are considered team names when processing OCR.
// Ordinary text under explicit "Gruppe A/B" headings is also supported for manual input.
function parsePhotoText(input){
 const lines=String(input||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const groups={A:[],B:[]};let current=null,table=false,ignored=0,hadRanking=false,seenGroup=false;
 const rowGroup=/^(?:(?:[v∧›▲▼\-]\s*|[A-Z]\s+)?gr(?:uppe|\.)\s*([A-Z])\s*:?\s*)$/i;
 const noise=/\b(?:werbung|meinturnierplan|menü|menu|filter|ranglisten|teilnehmer\s+sp|tordifferenz|platzierung|tabellen|weitere infos|neu laden|datenschutz|sponsor|cookies|impressum|ergebnisse live|presse|copyright|spielen filtern|gruppen auswählen)\b/i;
 const sanitize=(value)=>{
   let v=String(value).replace(/^\s*(?:[+•*]|\d{1,2}[.)]|[-–—])\s+/,'').trim();
   v=v.replace(/\s+[—–]\s+(?=[—–\d:])/g,'  --  ');
   v=v.split(/\s+(?:--|[—–])\s+|\s{3,}(?=[\d—–-])/)[0].trim();
   // OCR frequently attaches blank score columns, but a number in "FC Hausham 2" belongs to the team.
   v=v.replace(/(?:\s+[-–—.:|_]){2,}.*$/,'').trim();
   v=v.replace(/[|·\-—–_\s]+$/g,'').replace(/^[-–—|·\s]+/,'').trim();
   return clean(v);
 };
 for(const raw of lines){
   const line=raw.replace(/[\u200e\u200f]/g,'').trim();
   const m=line.match(rowGroup);
   if(m){current=m[1].toUpperCase();table=false;seenGroup=true;if(current!=='A'&&current!=='B')ignored++;continue;}
   if(/^ranglisten\b/i.test(line)){hadRanking=true;table=false;continue;}
   if(!current||!['A','B'].includes(current))continue;
   if(/^(?:pl\.?\s*teilnehmer|teilnehmer\s+(?:sp|spiele)|rang\s+mannschaft|pl\s+teilnehmer|platz\s+team)/i.test(line)){table=true;continue;}
   if(/^(?:vorrunde|spielplan|finalrunde|halbfinale|finale|begegnungen|spiel\s*nr|nr\s+beginn|datum\b)/i.test(line)){current=null;table=false;continue;}
   if(noise.test(line)||line.length>100){ignored++;continue;}
   if(/^\d{1,2}[:.]\d{2}\b|^\d+\s*[:|]\s*\d+\b/.test(line)){ignored++;continue;}
   if(hadRanking&&!table){ignored++;continue;}
   if(table&&!/^\s*(?:[-–—•*]|\d{1,2}(?:[.)]|(?=\s{2,})))\s+/.test(line)){ignored++;continue;}
   const v=sanitize(line);
   if(!v||v.length<4||v.length>60||!/\p{L}/u.test(v)||noise.test(v)||/^(?:pl|sp|td|pkt|tore|rang|ergebnis|gruppe)\b/i.test(v)||/[<>]=?|[©®×✓]/.test(v)||/\b(?:https?|www\.)\b/i.test(v)){ignored++;continue;}
   // Reject OCR garbage made of punctuation, score columns, and UI snippets.
   const letters=(v.match(/\p{L}/gu)||[]).length;
   if(letters<3||letters/v.length<0.55||v.split(/\s+/).length>7){ignored++;continue;}
   groups[current].push(v);
 }
 groups.A=unique(groups.A);groups.B=unique(groups.B);
 if(!groups.A.length&&!groups.B.length)throw Error('Keine verlässlichen Teamnamen erkannt. Bitte nur die Gruppentabelle fotografieren, das PDF verwenden oder Teams manuell unter „Gruppe A“ / „Gruppe B“ eintragen.');
 return {groups,fixtures:[],meta:{kind:'ocr',ignored,seenGroup,uncertain:true}};
}
function preview(parsed,source){
 pendingImport=parsed;
 const total=(parsed.groups.A||[]).length+(parsed.groups.B||[]).length;
 const count=parsed.fixtures?.length||0;
 $('applyPreview').disabled=!total&&!count;
 const isPDF=parsed.meta?.kind==='pdf-structured';
 const isStructuredOCR=parsed.meta?.kind==='ocr-structured';
 const status=parsed.meta?.kind==='ocr'?'<p class="hint">Fotoerkennung: Bitte jeden Teamnamen kontrollieren. Es werden keine Spielpaarungen aus einem einfachen Tabellenfoto erfunden.</p>':isStructuredOCR?'<p class="hint">📸 MeinTurnierplan-Screenshot erkannt. Begegnungen wurden per OCR gelesen – bitte Teamnamen und Uhrzeiten besonders sorgfältig prüfen.</p>':'';
 const groupsHTML=['A','B'].map(group=>{
  const teams=parsed.groups[group]||[];
  if(!teams.length)return '';
  return `<div class="import-group"><h3>Gruppe ${group} · ${teams.length} Teams</h3>${teams.map((team,i)=>`<div class="import-team-row"><input aria-label="Team ${i+1} in Gruppe ${group}" data-team-group="${group}" data-team-index="${i}" value="${escapeHTML(team)}" maxlength="90"/><button class="btn danger" type="button" data-remove-team="${group}:${i}" aria-label="${escapeHTML(team)} entfernen">✕</button></div>`).join('')}</div>`;
 }).join('');
 const meta=parsed.meta||{};
 const metaFields=[meta.title,meta.date?meta.date.split('-').reverse().join('.'):null,meta.duration?meta.duration+' Minuten':null].filter(Boolean);
 const metaHTML=(isPDF||isStructuredOCR)?`<div class="import-summary"><strong>${isPDF?'📄 Offizieller PDF-Spielplan erkannt':'📸 Strukturierter Screenshot erkannt'}</strong><div>${escapeHTML(metaFields.join(' · '))}</div><div>${parsed.groups.A.length} Teams in Gruppe A · ${parsed.groups.B.length} Teams in Gruppe B · ${count} Begegnungen</div><label class="import-metadata-option"><input id="importMetadata" type="checkbox" ${importMetaSelection?'checked':''}/> <span>Auch Turniername, Datum, Ort und Spielzeit aus ${isPDF?'dem PDF':'dem Screenshot'} übernehmen</span></label><p class="hint">Standardmäßig bleiben deine vorhandenen Turnierdaten unverändert. Aktiviere die Option nur, wenn die Quelle zum ausgewählten Turnier gehört.</p></div>`:'';
 const warnings=(meta.notes||[]).length?`<div class="import-warning">⚠️ ${escapeHTML(meta.notes.join(' · '))}. Bitte die fehlenden Spiele manuell ergänzen.</div>`:'';
 const matches=count?`<details class="import-fixtures"><summary>📋 Alle ${count} erkannten Begegnungen prüfen</summary><div class="import-fixture-list">${parsed.fixtures.map((f,i)=>`<div class="import-fixture"><span class="import-fixture-meta">#${f.sourceNo||i+1} · ${escapeHTML(f.time||'Zeit offen')} · ${escapeHTML(f.field||'Feld offen')} · Gr. ${escapeHTML(f.group||'–')}</span><span>${escapeHTML(f.home)} <b>–</b> ${escapeHTML(f.away)}</span></div>`).join('')}</div></details>`:'<p class="hint">0 Paarungen erkannt. Gruppenteams allein ergeben noch keinen offiziellen Spielplan.</p>';
 $('importPreview').innerHTML=`<strong>${escapeHTML(source)} · ${total} Teams</strong>${status}${metaHTML}${warnings}${groupsHTML}${matches}<p class="hint">Erkannte Teams bitte prüfen. Bei Tippfehlern Namen oben ändern; Änderungen werden für die betroffenen Paarungen mitübernommen. Danach „Geprüfte Daten übernehmen“.</p>`;
 const checkbox=$('importMetadata');if(checkbox)checkbox.onchange=e=>{importMetaSelection=e.target.checked;};
}
async function updateImportTeam(e){
 if(!pendingImport)return;
 const input=e.target.closest('[data-team-group]');
 if(input){
  const group=input.dataset.teamGroup,idx=Number(input.dataset.teamIndex),before=pendingImport.groups[group]?.[idx];
  if(before===undefined)return;
  const renamed=clean(input.value);if(!renamed)return;
  pendingImport.groups[group][idx]=renamed;
  for(const f of pendingImport.fixtures||[]){if(f.group!==group)continue;if(f.home===before)f.home=renamed;if(f.away===before)f.away=renamed;}
  preview(pendingImport,'Bearbeitete Vorschau');return;
 }
 const b=e.target.closest('[data-remove-team]');if(!b)return;
 const [group,rawIndex]=b.dataset.removeTeam.split(':'),idx=Number(rawIndex);
 const name=pendingImport.groups[group]?.[idx];if(!name)return;
 const affected=(pendingImport.fixtures||[]).filter(f=>f.group===group&&(f.home===name||f.away===name));
 if(affected.length&&!await appConfirm(`Wenn du „${name}“ entfernst, entfallen auch ${affected.length} Begegnungen dieses Teams. Wirklich entfernen?`,'Team aus Import entfernen','Entfernen'))return;
 pendingImport.groups[group].splice(idx,1);
 if(affected.length)pendingImport.fixtures=pendingImport.fixtures.filter(f=>!affected.includes(f));
 preview(pendingImport,'Bearbeitete Vorschau');
}
async function applyImport(){
 if(!pendingImport)return;
 pendingImport.groups={A:unique(pendingImport.groups.A||[]),B:unique(pendingImport.groups.B||[])};
 const rows=[...pendingImport.groups.A,...pendingImport.groups.B];
 if(!rows.length&&!pendingImport.fixtures.length){await appAlert('Bitte mindestens ein plausibles Team oder eine Begegnung erfassen.','Import prüfen');return;}
 if(new Set(rows.map(v=>v.toLocaleLowerCase('de'))).size!==rows.length){await appAlert('Teamnamen dürfen nicht doppelt oder in beiden Gruppen vorkommen.','Import prüfen');return;}
 const bad=(pendingImport.fixtures||[]).filter(f=>!pendingImport.groups[f.group]?.includes(f.home)||!pendingImport.groups[f.group]?.includes(f.away));
 if(bad.length){await appAlert(`${bad.length} Begegnungen enthalten Mannschaften, die nicht in der jeweiligen Gruppe stehen. Bitte die Vorschau kontrollieren.`,'Import prüfen');return;}
 if((event().fixtures.length||event().ko.length)&&!await appConfirm('Gruppen und Gruppenspielplan ersetzen? Vorhandene Gruppenergebnisse werden gelöscht, die Finalrunde bleibt bestehen.','Import übernehmen','Ersetzen'))return;
 const pdfMeta=importMetaSelection&&['pdf-structured','ocr-structured'].includes(pendingImport.meta?.kind)?pendingImport.meta:null;
 event().groups={...pendingImport.groups};event().fixtures=pendingImport.fixtures;
 if(pdfMeta){
  const selected=app.tournaments.find(t=>t.id===app.active);
  if(selected){if(pdfMeta.title)selected.title=clean(pdfMeta.title);if(pdfMeta.date)selected.date=pdfMeta.date;if(pdfMeta.venue)selected.venue=clean(pdfMeta.venue);}
  if(Number.isInteger(pdfMeta.duration)&&pdfMeta.duration>=1&&pdfMeta.duration<=90){event().duration=pdfMeta.duration;event().seconds=pdfMeta.duration*60;}
 }
 $('groupA').value=event().groups.A.join('\n');$('groupB').value=event().groups.B.join('\n');
 event().liveId=null;event().running=false;pendingImport=null;importMetaSelection=false;$('applyPreview').disabled=true;
 closeImportSheet();render();showTab(event().fixtures.length?'plan':'groups');
}
async function recognize(){
 if(!pendingImage){$('ocrStatus').textContent='Bitte zuerst ein Bild auswählen.';return;}
 $('readPhoto').disabled=true;$('ocrStatus').textContent='OCR wird geladen – Internetverbindung erforderlich …';
 try{
  if(!window.Tesseract){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('OCR-Bibliothek nicht geladen'));document.head.append(script);});}
  const worker=await Tesseract.createWorker('deu+eng',1,{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`Lese Bild: ${Math.round(m.progress*100)} %`;}});
  try{
   let structured=null;
   try{structured=await recognizeMeinTurnierplanScreenshot(worker,pendingImage);}catch{}
   if(structured?.parsed?.fixtures?.length>=3){$('rawImport').value=structured.raw.slice(0,50000);if($('advancedImportText'))$('advancedImportText').open=false;$('ocrStatus').textContent=`Screenshot gelesen: ${structured.parsed.groups.A.length+structured.parsed.groups.B.length} Teams und ${structured.parsed.fixtures.length} Vorrundenspiele erkannt. Bitte alles kontrollieren.`;preview(structured.parsed,'MeinTurnierplan-Screenshot');return;}
   await worker.setParameters({tessedit_pageseg_mode:'11'});const result=await worker.recognize(pendingImage);$('rawImport').value=result.data.text;if($('advancedImportText'))$('advancedImportText').open=true;
   try{const parsed=parsePhotoText(result.data.text);$('ocrStatus').textContent=`${parsed.groups.A.length+parsed.groups.B.length} mögliche Teams erkannt. Bitte jeden Namen kontrollieren.`;preview(parsed,'Foto (ungeprüfte OCR)');}
   catch(e){pendingImport=null;$('applyPreview').disabled=true;setMessage('Keine zuverlässige Gruppe erkannt. '+e.message);$('ocrStatus').textContent='Bei kompletten MeinTurnierplan-Seiten bitte einen möglichst geraden Screenshot verwenden; alternativ das offizielle PDF hochladen.';}
  }finally{await worker.terminate();}
 }catch(error){$('ocrStatus').textContent='Fotoerkennung derzeit nicht verfügbar: '+error.message+'. Das Foto bleibt sichtbar; bitte Teamnamen im Textfeld eingeben.';}
 finally{$('readPhoto').disabled=false;}
}
async function parsePdfBuffer(bytes,label='PDF'){
 $('ocrStatus').textContent='PDF wird gelesen … (erstmaliges Laden benötigt Internet)';
 if(!window.pdfjsLib){
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.onload=resolve;script.onerror=()=>reject(Error('PDF-Bibliothek konnte nicht geladen werden'));document.head.append(script);});
 }
 const pdf=window.pdfjsLib;pdf.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 if(bytes.byteLength>12000000)throw Error('PDF ist zu groß (maximal 12 MB)');
 const doc=await pdf.getDocument({data:new Uint8Array(bytes)}).promise;
 const pages=[];
 for(let p=1;p<=Math.min(doc.numPages,15);p++){
  const page=await doc.getPage(p),txt=await page.getTextContent();
  pages.push((txt.items||[]).filter(x=>x.str?.trim()).map(x=>({text:x.str,x:x.transform?.[4]??0,y:x.transform?.[5]??0})));
 }
 const result=parseTournamentPdfPages(pages);
 $('rawImport').value=JSON.stringify({groups:result.groups,fixtures:result.fixtures.map(({id,events,homeGoals,awayGoals,completed,winner,...row})=>row),meta:result.meta},null,2).slice(0,50000);
 preview(result,label);
 if($('advancedImportText'))$('advancedImportText').open=false;
 $('ocrStatus').textContent=`PDF gelesen: ${result.groups.A.length+result.groups.B.length} Mannschaften und ${result.fixtures.length} Begegnungen aus ${pages.length} Seite(n). Bitte die Vorschau prüfen.`;
 return result;
}
async function loadPdfFile(file){const bytes=await file.arrayBuffer();return parsePdfBuffer(bytes,'PDF '+file.name);}
function csvQuote(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
function exportCSV(){const ev=event();let result=['Phase;Gruppe;Heim;Gast;Tore Heim;Tore Gast;Uhrzeit;Feld;Sieger'];for(const f of [...ev.fixtures,...ev.ko])result.push([f.stage,f.group,f.home,f.away,f.homeGoals??'',f.awayGoals??'',f.time,f.field,winner(f)].map(csvQuote).join(';'));result.push('');result.push('Torschütze;Tore');const names={};for(const f of [...ev.fixtures,...ev.ko])for(const g of f.events||[])if(g.side==='ours')names[g.player]=(names[g.player]||0)+1;for(const [name,total] of Object.entries(names).sort((a,b)=>b[1]-a[1]))result.push([name,total].map(csvQuote).join(';'));download('hallenturnier-'+app.active+'.csv','\ufeff'+result.join('\r\n'),'text/csv;charset=utf-8');}
function init(){setupDialog();$('settingsOpen').onclick=openSettings;$('settingsClose').onclick=closeSettings;$('settingsCancel').onclick=closeSettings;$('settingsSheet').onclick=e=>{if(e.target.id==='settingsSheet')closeSettings();};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('settingsSheet').classList.contains('hidden'))closeSettings();});const prev=app.events[app.active];$('teamName').value=app.team;$('roster').value=app.roster.join('\n');$('matchLength').value=app.duration;$('groupA').value=(prev?.groups.A||[]).join('\n');$('groupB').value=(prev?.groups.B||[]).join('\n');render();
$('events').onclick=e=>{const del=e.target.closest('[data-event-delete]');if(del){deleteEvent(del.dataset.eventDelete);return;}const edit=e.target.closest('[data-event-edit]');if(edit){openEventEditor(edit.dataset.eventEdit);return;}const b=e.target.closest('[data-event]');if(b)activateEvent(b.dataset.event);};
$('tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)showTab(b.dataset.tab);};
$('mainTabs').onclick=e=>{const b=e.target.closest('[data-main]');if(b)showMain(b.dataset.main);};
$('closeImportSheet').onclick=closeImportSheet;$('closeImportSheetBottom').onclick=closeImportSheet;$('importSheet').onclick=e=>{if(e.target.id==='importSheet')closeImportSheet();};
$('createEvent').onclick=()=>openEventEditor();$('cancelEvent').onclick=closeEventEditor;if($('saveEvent'))$('saveEvent').onclick=()=>saveEvent();$('importPresets').onclick=()=>importPresetEvents();
$('setupGuide').onclick=e=>{const jump=e.target.closest('[data-jump]');if(!jump)return;if(jump.dataset.jump==='import-popup')openImportSheet();else showTab(jump.dataset.jump);};
$('quickStartButton').onclick=async()=>{if(!app.active)return;const opp=clean($('quickOpponent').value);if(!opp||teamKey(opp)===teamKey(app.team)){await appAlert('Bitte einen gültigen Gegnernamen eingeben.','Live-Match');return;}const f=match(app.team,opp,'','friendly');event().fixtures.push(f);event().liveId=f.id;event().running=false;event().seconds=matchDuration()*60;$('quickOpponent').value='';save();renderLive();render();};
$('saveTeam').onclick=async()=>{const previousTeam=app.team;const defaultLength=Math.round(Number($('matchLength').value));if(!Number.isInteger(defaultLength)||defaultLength<1||defaultLength>90){await appAlert('Die Standard-Spielzeit muss zwischen 1 und 90 Minuten liegen.','Setup');return;}const active=Boolean(app.active&&app.tournaments.some(x=>x.id===app.active));const eventLength=active?Math.round(Number($('eventDuration').value)):null;if(active&&(!Number.isInteger(eventLength)||eventLength<1||eventLength>90)){await appAlert('Die Turnier-Spielzeit muss zwischen 1 und 90 Minuten liegen.','Setup');return;}app.team=clean($('teamName').value)||'Unsere Kids';app.roster=parseLines($('roster').value).slice(0,40);app.duration=defaultLength;if(active){const ev=event(),before=matchDuration(ev);ev.duration=eventLength;if(!ev.running&&ev.seconds===before*60)ev.seconds=eventLength*60;}save();closeSettings();render();if(previousTeam!==app.team){await appAlert('Teamname geändert. Bereits erfasste Begegnungen werden nicht automatisch umbenannt. Bitte prüfe die Namen deiner bisherigen Spiele.','Teamname geändert');}};
$('saveGroups').onclick=()=>groupMake();$('generateGroups').onclick=()=>generate();$('buildKO').onclick=()=>createKO();$('clearKO').onclick=async()=>{if(event().ko.length&&await appConfirm('Finalrunde und ihre Ergebnisse löschen?','Finalrunde entfernen','Löschen')){event().ko=[];event().liveId=null;render();}};
$('addFixture').onclick=()=>addFixture();$('syncTournament').onclick=syncOnlineTournament;$('saveSyncId').onclick=async()=>{const id=normalizeTournamentId($('syncTournamentId').value);if(!id){await appAlert('Bitte eine gültige Turnier-ID oder einen MeinTurnierplan-PDF-Link eingeben.','Live-Sync');return;}event().syncTournamentId=id;save();renderSyncStatus();await appAlert('Turnier-ID '+id+' gespeichert. Künftig reicht „Synchronisieren“.','Live-Sync');};$('fixtures').onclick=e=>{const del=e.target.closest('[data-fixture-delete]');if(del){deleteFixture(del.dataset.fixtureDelete);return;}const b=e.target.closest('[data-edit]');if(!b)return;const f=getMatch(b.dataset.edit);if(ourMatch(f)){event().liveId=f.id;event().running=false;event().seconds=matchDuration()*60;showTab('live');}else editScore(f.id);};$('bracket').onclick=e=>{const b=e.target.closest('[data-edit]');if(b)editScore(b.dataset.edit);};
$('liveChoice').onchange=e=>{event().running=false;event().seconds=matchDuration()*60;event().liveId=e.target.value;renderLive();save();};
async function importFileHandler(e){const file=e.target.files[0];if(!file)return;importMetaSelection=false;pendingImport=null;$('applyPreview').disabled=true;pendingImage=null;$('photoPreview').classList.add('hidden');$('rawImport').value='';$('ocrStatus').textContent='';if($('advancedImportText'))$('advancedImportText').open=false;try{if(file.type.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(file.name)){pendingImage=file;$('photoPreview').src=URL.createObjectURL(file);$('photoPreview').classList.remove('hidden');setMessage('Foto geladen. „Text aus Foto erkennen“ tippen oder Mannschaften manuell eintragen.');if($('advancedImportText'))$('advancedImportText').open=true;return;}if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){await loadPdfFile(file);return;}const text=await file.text();$('rawImport').value=text.slice(0,50000);const parsed=/\.json$/i.test(file.name)?parseJSON(text):parseCSV(text);preview(parsed,'Datei '+file.name);}catch(err){setMessage('Importfehler: '+err.message);}finally{e.target.value='';}}
$('importFile').onchange=importFileHandler;$('cameraPhoto').onchange=importFileHandler;
$('importPreview').addEventListener('change',updateImportTeam);$('importPreview').addEventListener('click',updateImportTeam);$('readPhoto').onclick=recognize;$('previewText').onclick=()=>{try{const raw=$('rawImport').value.trim();if(!raw)throw Error('Textfeld leer');let parsed;if(raw.startsWith('{'))parsed=parseJSON(raw);else if(/^\s*(gruppe|group)\s*[;,\t]/i.test(raw)||/\b(heim|home|mannschaft|team)\b\s*[;,\t]/i.test(raw.split('\n')[0]))parsed=parseCSV(raw);else parsed=parsePhotoText(raw);preview(parsed,'Textvorschau');}catch(err){pendingImport=null;$('applyPreview').disabled=true;setMessage(err.message);}};$('applyPreview').onclick=applyImport;
$('saveUrl').onclick=async()=>{const val=$('onlineUrl').value.trim();if(val&&!validURL(val)){await appAlert('Bitte eine gültige http(s)-Adresse eingeben.','Online-Tabelle');return;}event().url=val;const tid=normalizeTournamentId(val);if(tid)event().syncTournamentId=tid;save();renderSyncStatus();await appAlert(tid?'Link gespeichert und Turnier-ID '+tid+' erkannt.':'Link gespeichert.','Online-Tabelle');};$('openUrl').onclick=async()=>{const u=validURL($('onlineUrl').value.trim());if(!u){await appAlert('Zuerst einen gültigen Link eingeben.','Online-Tabelle');return;}window.open(u.href,'_blank','noopener,noreferrer');};$('importUrl').onclick=async()=>{
 const url=validURL($('onlineUrl').value.trim());
 if(!url){await appAlert('Bitte einen gültigen Link eingeben.','Online-Spielplan');return;}
 if(!/\.(csv|json)$/i.test(url.pathname)){
  const pdfUrl=meinturnierplanPdfUrl(url),mtp=Boolean(pdfUrl),directPdf=mtp&&/^\/pdf\.php$/i.test(url.pathname);
  event().url=url.href;save();
  if(directPdf){
   setMessage('Direkter MeinTurnierplan-PDF-Link erkannt. Ich versuche den Plan jetzt direkt einzulesen …');
   try{
    const response=await fetch(pdfUrl,{mode:'cors',credentials:'omit'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    await parsePdfBuffer(bytes,'MeinTurnierplan PDF');
    return;
   }catch(err){
    setMessage('Direkter PDF-Import wurde vom Anbieter/Browser blockiert ('+err.message+'). Ich öffne das offizielle PDF. Speichere es in „Dateien“ und wähle es anschließend oben aus.');
    window.open(pdfUrl,'_blank','noopener,noreferrer');
    return;
   }
  }
  if(mtp){setMessage('MeinTurnierplan erkannt. Die HTML-Seite selbst darf von GitHub Pages nicht ausgelesen werden. Ich öffne deshalb die offizielle PDF-Druckansicht. Speichere das PDF in „Dateien“ und wähle es oben aus – daraus kann Matchday Teams, Gruppen und Begegnungen strukturiert lesen.');window.open(pdfUrl,'_blank','noopener,noreferrer');}
  else setMessage('Website-Link gespeichert. Eine normale HTML-Seite ist keine CSV-/JSON-Datei. Bitte einen direkten Datei-Link verwenden oder den offiziellen Spielplan als PDF, CSV, JSON bzw. Foto hochladen.');
  return;
 }
 if(!await appConfirm('Öffentliche CSV-/JSON-Datei von dieser URL abrufen?','Datei importieren','Abrufen'))return;
 setMessage('Rufe Daten ab …');
 try{const response=await fetch(url.href,{mode:'cors',credentials:'omit'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.text();if(data.length>500000)throw Error('Datei zu groß');preview(url.pathname.toLowerCase().endsWith('.json')?parseJSON(data):parseCSV(data),'Online-Datei');event().url=url.href;save();}
 catch(err){setMessage('Der Anbieter erlaubt keinen Browserimport dieser Datei oder die Antwort war ungültig. Bitte die Datei manuell herunterladen und oben auswählen. Details: '+err.message);}
};
$('backup').onclick=()=>download('matchday-hall-sicherung.json',JSON.stringify(app,null,2),'application/json');$('restore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj.events||typeof obj.events!=='object')throw Error('Keine passende Matchday-Sicherung');if(!await appConfirm('Die gespeicherte Hallensaison vollständig durch diese Sicherung ersetzen?','Sicherung laden','Wiederherstellen'))return;app={...defaults(),...obj};if(!Array.isArray(obj.tournaments))app.tournaments=null;for(const ev of Object.values(app.events)){ev.running=false;ev.startedAt=null;}migrateLegacy();$('teamName').value=app.team;$('roster').value=app.roster.join('\n');$('matchLength').value=app.duration;$('groupA').value=event().groups.A.join('\n');$('groupB').value=event().groups.B.join('\n');render();await appAlert('Sicherung wiederhergestellt.','Sicherung laden');}catch(err){await appAlert('Fehler beim Laden: '+err.message,'Sicherung laden');}finally{e.target.value='';}};
$('csvExport').onclick=exportCSV;$('resetEvent').onclick=async()=>{if(await appConfirm('Alle Daten nur für dieses Hallenturnier löschen? Vorher JSON sichern.','Turnier zurücksetzen','Zurücksetzen')){const length=matchDuration();app.events[app.active]=freshEvent();app.events[app.active].duration=length;app.events[app.active].seconds=length*60;$('groupA').value='';$('groupB').value='';render();}};
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
init();
showMain('data');
})();