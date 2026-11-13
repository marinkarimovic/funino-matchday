(()=>{'use strict';
const VERSION_URL='./version.json';
const SW_URL='./sw.js';
const PAGE_VERSION=document.documentElement.dataset.appVersion||'0';
const RELOAD_KEY='matchday-update-reload-version';
let registration=null,checking=false;
async function latestVersion(){try{const r=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return'';const d=await r.json();return String(d.version||'');}catch{return'';}}
function hardReload(version){if(!version||version===PAGE_VERSION)return;try{if(sessionStorage.getItem(RELOAD_KEY)===version)return;sessionStorage.setItem(RELOAD_KEY,version);}catch{}const u=new URL(location.href);u.searchParams.set('appv',version);location.replace(u.href);}
async function checkForUpdate(){if(checking)return;checking=true;try{const latest=await latestVersion();if(registration)try{await registration.update();}catch{}if(latest&&latest!==PAGE_VERSION)hardReload(latest);}finally{checking=false;}}
async function register(){if(!('serviceWorker'in navigator)||!(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))return;try{navigator.serviceWorker.addEventListener('controllerchange',()=>{latestVersion().then(v=>{if(v&&v!==PAGE_VERSION)hardReload(v);else{try{const k=`controller-${PAGE_VERSION}`;if(sessionStorage.getItem(RELOAD_KEY)!==k){sessionStorage.setItem(RELOAD_KEY,k);location.reload();}}catch{location.reload();}}});});registration=await navigator.serviceWorker.register(SW_URL,{updateViaCache:'none'});if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});registration.addEventListener('updatefound',()=>{const w=registration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)w.postMessage({type:'SKIP_WAITING'});});});await checkForUpdate();}catch{}}
window.addEventListener('pageshow',()=>checkForUpdate());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate();});register();
})();