/* Private file transfer: SpielfeldIQ ↔ FUNiño Matchday */
(()=>{'use strict';
const KEY='matchday-bridge-minutes-v1',host=()=>window.MatchdayBridgeHost,element=id=>document.getElementById(id);
let pending=null,teamChoice='',gameChoice=1,logs={},locked=false;
try{const raw=localStorage.getItem(KEY);if(raw){logs=JSON.parse(raw);if(!logs||typeof logs!=='object'||Array.isArray(logs))throw Error('invalid')}}catch(e){locked=true}
const snapshot=()=>host()?.snapshot?.(),evkey=s=>s?.bridgeEvent?.eventId;
const record=s=>logs[evkey(s)]||{eventId:evkey(s),rosterId:s.bridgeEvent?.rosterId||'',eventName:s.bridgeEvent?.eventName||'',date:s.bridgeEvent?.date||'',players:s.playerRefs||[],games:[]};
function create(tag,text,parent,props){const e=document.createElement(tag);if(text!==null&&text!==undefined)e.textContent=text;for(const [k,v] of Object.entries(props||{}))if(k==='className')e.className=v;else if(k==='value')e.value=v;else if(k==='type')e.type=v;else if(k==='disabled')e.disabled=v;else if(k==='min'||k==='max'||k==='step'||k==='accept'||k==='inputmode')e.setAttribute(k,v);if(parent)parent.append(e);return e}
function msg(text){const e=element('mb-notice');if(e){e.textContent=text;e.hidden=!text}}
function checkedFile(raw){
 if(raw?.schema!=='sport-coach-bridge-v1'||raw.kind!=='lineup'||typeof raw.eventId!=='string'||!raw.eventId.trim()||raw.eventId.length>130||typeof raw.rosterId!=='string'||!raw.rosterId.trim()||raw.rosterId.length>130||!Array.isArray(raw.teams)||!raw.teams.length||raw.teams.length>16)throw Error('Keine gültige Matchday-Aufstellung');
 const ids=new Set(),teams=raw.teams.map(t=>{
   if(typeof t?.id!=='string'||typeof t?.name!=='string'||!Array.isArray(t.players)||!t.players.length||t.players.length>30)throw Error('Ungültige Mannschaft');
   const players=t.players.map(p=>{if(typeof p?.id!=='string'||typeof p?.name!=='string'||!p.id.trim()||!p.name.trim()||p.id.length>128||p.name.length>100||ids.has(p.id))throw Error('Ungültige oder doppelte Spieler-ID');ids.add(p.id);return{id:p.id,name:p.name.trim()}});
   if(new Set(players.map(p=>p.name.toLocaleLowerCase())).size!==players.length)throw Error('Gleiche Spielernamen in einer Mannschaft. Bitte vor dem Export unterscheiden.');
   return{id:t.id,name:t.name.slice(0,70),players};
 });
 return{eventId:raw.eventId,rosterId:raw.rosterId,eventName:String(raw.eventName||'Spieltag').slice(0,100),date:String(raw.date||'').slice(0,10),teams};
}
function download(doc){const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),link=create('a',null,document.body);link.href=url;link.download='Matchday-Spielzeiten-'+doc.date+'.json';link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2200)}
function rebuild(note){
 const previous=element('mb-panel'),open=previous?.open||false;
 const panel=create('details',null,null,{className:'mb-panel'});panel.id='mb-panel';
 const summary=create('summary','🔄 SpielfeldIQ ↔ Matchday',panel),s=snapshot();if(!s)return;
 create('span',s.bridgeEvent?' Verbunden':' Import / Minuten',summary);
 const box=create('div',null,panel,{className:'mb-content'});
 if(s.bridgeEvent){create('strong',s.name+' · '+(s.playerRefs?.length||0)+' Kinder',box);create('p','Spieltag: '+s.bridgeEvent.eventName,box,{className:'mb-help'})}
 else create('p','Aufstellung aus SpielfeldIQ im Teamgenerator exportieren und hier als JSON auswählen.',box,{className:'mb-help'});
 const fileLabel=create('label','↑ Matchday-Aufstellung auswählen',box,{className:'mb-upload'});
 const upload=create('input',null,fileLabel,{type:'file',accept:'.json,application/json'});upload.id='mb-file';
 if(pending){
  const prev=create('div',null,box,{className:'mb-card'});create('strong',pending.eventName+' · '+pending.date,prev);
  create('p','Mannschaft auf diesem Gerät:',prev,{className:'mb-help'});
  const dropdown=create('select',null,prev);dropdown.id='mb-team';
  for(const team of pending.teams){const option=create('option',team.name+' ('+team.players.length+' Kinder)',dropdown,{value:team.id});if(team.id===teamChoice)option.selected=true}
  const team=pending.teams.find(x=>x.id===teamChoice)||pending.teams[0];create('p',team.players.map(x=>x.name).join(' · '),prev,{className:'mb-help'});
  const button=create('button','Mannschaft übernehmen',prev,{className:'mb-btn mb-primary'});button.id='mb-import';
  create('small','Ein bereits begonnenes Turnier wird nicht überschrieben.',prev);
 }
 if(s.bridgeEvent&&s.history?.length){
  const log=record(s),block=create('div',null,box,{className:'mb-card'});
  create('h3','Spielminuten dokumentieren',block);create('p','Nur tatsächliche Einsatzzeit eingeben. Leer bedeutet unbekannt, 0 bedeutet ausdrücklich nicht eingesetzt.',block,{className:'mb-help'});
  const select=create('select',null,block);select.id='mb-game';
  if(!s.history.some(x=>x.game===gameChoice))gameChoice=s.history.at(-1).game;
  for(const match of s.history){const option=create('option','Spiel '+match.game+' · '+(match.opponent||'Gegner'),select,{value:match.game});if(match.game===gameChoice)option.selected=true}
  const existing=log.games?.find(x=>x.game===gameChoice),players=create('div',null,block,{className:'mb-players'});
  for(const p of s.playerRefs||[]){
   const row=create('label',null,players,{className:'mb-player'});create('span',p.name,row);
   const input=create('input',null,row,{type:'number',min:'0',max:String(s.duration),step:'1',inputmode:'numeric'});input.dataset.playerId=p.id;input.placeholder='–';
   if(Number.isInteger(existing?.minutes?.[p.id]))input.value=String(existing.minutes[p.id]);create('small','min',row);
  }
  const save=create('button','Spielminuten bestätigen',block,{className:'mb-btn mb-primary'});save.id='mb-save';
  const exportButton=create('button','↓ Nach SpielfeldIQ exportieren ('+(log.games?.length||0)+' Spiele)',block,{className:'mb-btn'});exportButton.id='mb-export';exportButton.disabled=!log.games?.length;
 }
 const status=create('p',note||'',box,{className:'mb-message'});status.id='mb-notice';status.hidden=!note;
 create('p','Nur manuelle JSON-Dateien; keine automatische Datenübertragung. Kinderdaten privat aufbewahren.',box,{className:'mb-help'});
 previous?.remove();const nav=document.querySelector('main nav')||document.querySelector('main .top');if(nav)nav.insertAdjacentElement('afterend',panel);else document.querySelector('main')?.insertAdjacentElement('afterbegin',panel);panel.open=open;
}
function announce(s){rebuild(s);element('mb-panel').open=true}
async function read(file){if(!file||file.size>200000){msg('JSON-Datei fehlt oder ist zu groß (max. 200 KB).');return}try{pending=checkedFile(JSON.parse(await file.text()));teamChoice=pending.teams[0].id;announce('Aufstellung eingelesen. Bitte Mannschaft auswählen und bestätigen.')}catch(e){pending=null;msg('Import fehlgeschlagen: '+e.message)}}
function importTeam(){
 const team=pending?.teams.find(x=>x.id===teamChoice),s=snapshot();if(!team)return;
 if(s.game!==1||s.history.length||s.goals.length||s.finished||s.running){msg('Das aktuelle Turnier hat bereits Spieldaten. Zuerst CSV exportieren und ein neues Turnier starten; nichts wurde verändert.');return}
 if(!confirm(team.name+' mit '+team.players.length+' Spielern übernehmen? Nur der Matchday-Kader wird geändert.'))return;
 try{host().importTeam(team.players,{eventId:pending.eventId+'::'+team.id,rosterId:pending.rosterId,eventName:pending.eventName,date:pending.date,teamName:team.name});pending=null;announce('Kader übernommen. Die Spieler-IDs bleiben für den Ergebnisexport erhalten.')}catch(e){msg('Import abgelehnt: '+e.message)}
}
function saveMinutes(){
 if(locked){msg('Spielzeit-Speicher ist beschädigt; kein Überschreiben.');return}
 const s=snapshot();if(!s.bridgeEvent||!s.history.some(x=>x.game===gameChoice))return;
 const mins={},inputs=document.querySelectorAll('#mb-panel [data-player-id]');let total=0;
 for(const el of inputs){if(el.value.trim()==='')continue;const n=Number(el.value);if(!Number.isInteger(n)||n<0||n>s.duration){msg('Minuten müssen ganze Zahlen zwischen 0 und '+s.duration+' sein.');return}mins[el.dataset.playerId]=n;total++}
 if(!total){msg('Mindestens einen tatsächlichen Spielerwert angeben.');return}
 if(!confirm(total+' Spieler-Minutenwerte für Spiel '+gameChoice+' bestätigen? Nicht ausgefüllte Werte bleiben unbekannt.'))return;
 const r=record(s),game={game:gameChoice,minutes:mins,loggedAt:new Date().toISOString()},next={...r,players:s.playerRefs.slice(),games:r.games.filter(x=>x.game!==gameChoice).concat(game).sort((a,b)=>a.game-b.game)};
 try{localStorage.setItem(KEY,JSON.stringify({...logs,[evkey(s)]:next}));logs[evkey(s)]=next;announce('Spielminuten gespeichert.')}catch(e){msg('Speichern nicht möglich – Browser-Speicher prüfen.')}
}
function exportMinutes(){
 const s=snapshot(),r=record(s);if(!r.games.length)return;
 if(!confirm('Spielminuten für SpielfeldIQ als private JSON-Datei exportieren?'))return;
 download({schema:'sport-coach-matchday-results-v1',eventId:r.eventId,rosterId:r.rosterId,eventName:r.eventName,date:r.date,createdAt:new Date().toISOString(),games:r.games.map(g=>({game:g.game,minutes:{...g.minutes},loggedAt:g.loggedAt}))});
 msg('JSON-Bericht heruntergeladen. Import in SpielfeldIQ → Teamgenerator → Spielzeit & faire Teams.');
}
document.addEventListener('change',e=>{
 if(e.target.id==='mb-file'){const file=e.target.files?.[0];e.target.value='';if(file)void read(file)}
 else if(e.target.id==='mb-team'){teamChoice=e.target.value;announce('Mannschaft ausgewählt.')}
 else if(e.target.id==='mb-game'){gameChoice=Number(e.target.value);announce('Spiel '+gameChoice+' ausgewählt.')}
});
document.addEventListener('click',e=>{if(e.target.id==='mb-import')importTeam();else if(e.target.id==='mb-save')saveMinutes();else if(e.target.id==='mb-export')exportMinutes()});
window.addEventListener('matchday-game-finished',()=>{const state=snapshot();if(state?.history?.length)gameChoice=state.history.at(-1).game;const pane=element('mb-panel');if(pane?.open)rebuild('Spiel abgeschlossen. Tatsächliche Einsatzzeiten bitte ausdrücklich eintragen.');});
const css=document.createElement('style');css.textContent='.mb-panel{margin:13px 0 16px;border:1px solid #46715c;background:#122e30;border-radius:16px;overflow:hidden;color:#effbf1}.mb-panel>summary{display:flex;justify-content:space-between;gap:9px;cursor:pointer;padding:14px;font-weight:800}.mb-panel>summary span{font-size:11px;color:#b5ff65}.mb-content{padding:10px 14px 17px;display:grid;gap:12px}.mb-content .mb-help{font-size:12px;line-height:1.45;color:#b6cbbf;margin:0}.mb-upload,.mb-card{display:grid;gap:10px;padding:12px;border-radius:12px;background:#193e3a;border:1px solid #496e5c}.mb-upload{font-weight:750;color:#c9f89c}.mb-upload input{font-size:12px;max-width:100%}.mb-card h3{font-size:16px;margin:0}.mb-card select,.mb-player input{width:100%;min-width:0;max-width:100%;font-size:16px;border:1px solid #5a796c;background:#0c2326;color:#effbef;border-radius:10px;padding:9px}.mb-btn{min-height:44px;border-radius:11px;background:#244b41;border:1px solid #60806d;color:#f4ffec;padding:12px;font-weight:750}.mb-btn.mb-primary{background:#b5ff65;color:#14241c}.mb-btn:disabled{opacity:.4}.mb-players{display:grid}.mb-player{display:grid;grid-template-columns:minmax(0,1fr) 80px 28px;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #36544e;font-size:13px}.mb-message{color:#e1ffc7;background:#244332;border-radius:10px;padding:10px;overflow-wrap:anywhere;font-size:12px}.mb-card small{color:#b9d0c4}';document.head.append(css);
const init=()=>{if(!host())return;const s=snapshot();if(s?.history?.length)gameChoice=s.history.at(-1).game;rebuild(locked?'Der lokale Spielzeit-Speicher ist beschädigt; er bleibt unverändert.':'')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.MatchdayFileBridge=Object.freeze({inspect:()=>({linked:!!snapshot()?.bridgeEvent,reports:locked?null:Object.keys(logs).length})});
})();