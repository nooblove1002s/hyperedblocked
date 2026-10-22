const STYLE = `
.admin-wrap{color:var(--text)}.ad-hero{padding:26px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(130deg,#122b43,#101725);margin-bottom:18px}
.ad-hero h2{margin:8px 0}.ad-muted{color:var(--muted);line-height:1.5}.ad-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.ad-input{min-width:0;flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:#ffffff09;color:var(--text)}.ad-panel{padding:18px;border:1px solid var(--border);border-radius:16px;background:#ffffff05;margin:14px 0}.ad-list{display:grid;gap:10px}.ad-person{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px;border:1px solid var(--border);border-radius:12px;background:#ffffff05}.ad-person strong{display:block}.ad-person small{color:var(--muted);overflow-wrap:anywhere}.ad-status{margin-top:12px;color:var(--muted);font-size:13px;min-height:20px}.ad-danger{background:#7b2635!important;color:#fff!important}.ad-switch{display:flex;align-items:center;gap:10px;padding:14px;border:1px solid #ff8c8c55;border-radius:12px}.ad-glitch-note{font-size:12px;color:var(--muted);line-height:1.5}
body.hb-corrupted{animation:hbColorShift 2.5s steps(2,end) infinite}body.hb-corrupted .topbar,body.hb-corrupted .hero-card,body.hb-corrupted .game-card{filter:hue-rotate(115deg) contrast(1.18)}body.hb-corrupted h1,body.hb-corrupted h2{animation:hbTextJitter .22s steps(2,end) infinite}
@keyframes hbColorShift{0%,100%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(35deg)}}@keyframes hbTextJitter{0%,100%{transform:translateX(0)}50%{transform:translateX(2px)}}
@media(prefers-reduced-motion:reduce){body.hb-corrupted,body.hb-corrupted h1,body.hb-corrupted h2{animation:none!important}}
`;
let adminSocket=null,refreshTimer=null;
const $=(root,selector)=>root.querySelector(selector);
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function backend(root){return ($(root,"#adBackend").value.trim()||localStorage.getItem("hyperblock-server-backend")||"").replace(/\/$/,"");}
function key(root){return $(root,"#adKey").value.trim();}
async function api(root,path,options={}){
 const base=backend(root);if(!base)throw new Error("Enter the deployed multiplayer backend URL first.");
 const response=await fetch(base+path,{...options,headers:{"Content-Type":"application/json","x-admin-key":key(root),...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"Request failed ("+response.status+").");
 return data;
}
function status(root,message){const el=$(root,"#adStatus");if(el)el.textContent=message;}
function renderPeople(root,people){
 const list=$(root,"#adPeople");list.replaceChildren();
 if(!people.length){list.innerHTML='<div class="sb-empty">No players are currently inside a room.</div>';return;}
 people.forEach(p=>{
  const item=document.createElement("article");item.className="ad-person";
  const details=document.createElement("div");
  details.innerHTML="<strong>("+Number(p.id||0)+") "+escapeHTML(p.name)+"</strong><small>Room: "+escapeHTML(p.roomName)+"<br>Client ID: "+escapeHTML(p.clientId||"Not registered")+"<br>Socket: "+escapeHTML(p.socketId)+"</small>";
  const actions=document.createElement("div");actions.className="ad-row";
  const ban=document.createElement("button");ban.className="secondary ad-danger";ban.textContent="Ban player";ban.disabled=!p.clientId;
  ban.title=p.clientId?"Ban this browser's multiplayer identity":"Player identity not registered yet";
  ban.addEventListener("click",async()=>{
   if(!p.clientId)return;
   const reason=prompt("Reason for banning this player:","Banned by an administrator");
   if(reason===null)return;
   try{await api(root,"/api/admin/ban",{method:"POST",body:JSON.stringify({clientId:p.clientId,reason,action:"ban"})});status(root,"Ban recorded for "+p.name+".");await refresh(root);}
   catch(e){status(root,e.message);}
  });
  actions.append(ban);item.append(details,actions);list.append(item);
 });
}
function renderRegisteredPeople(root,people){
 const list=$(root,"#adRegisteredPeople");if(!list)return;list.replaceChildren();
 if(!people.length){list.innerHTML='<div class="sb-empty">No registered player profiles yet.</div>';return;}
 people.forEach(p=>{
  const item=document.createElement("article");item.className="ad-person";
  const details=document.createElement("div");
  details.innerHTML="<strong>("+Number(p.id)+") "+escapeHTML(p.name)+"</strong><small>Registered: "+escapeHTML(p.createdAt?new Date(p.createdAt).toLocaleDateString():"date unavailable")+"</small>";
  item.append(details);list.append(item);
 });
}
async function refresh(root){
 try{
  const data=await api(root,"/api/admin/people");
  renderPeople(root,data.people||[]);\n   renderRegisteredPeople(root,data.registeredPeople||[]);
  $(root,"#adOnline").textContent=String((data.people||[]).length);\n   const registered=$(root,"#adRegisteredCount");if(registered)registered.textContent=String((data.registeredPeople||[]).length);
  $(root,"#adCorrupt").textContent=data.corruptionEnabled?"ON":"OFF";
  document.body.classList.toggle("hb-corrupted",!!data.corruptionEnabled);
  status(root,"Admin authenticated · refreshed "+new Date().toLocaleTimeString());
 }catch(e){status(root,e.message);}
}
async function setCorruption(root,enabled){
 try{
  const data=await api(root,"/api/admin/corruption",{method:"POST",body:JSON.stringify({enabled})});
  document.body.classList.toggle("hb-corrupted",!!data.enabled);
  $(root,"#adCorrupt").textContent=data.enabled?"ON":"OFF";
  status(root,data.enabled?"Corruption Mode enabled for connected site visitors.":"Corruption Mode disabled.");
 }catch(e){status(root,e.message);}
}
async function loadSocket(){
 if(window.io)return;
 if(!window.__hyperblockSocketClientPromise)window.__hyperblockSocketClientPromise=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.socket.io/4.8.1/socket.io.min.js";script.onload=resolve;script.onerror=()=>reject(new Error("Socket.IO client failed to load."));document.head.append(script);
 });
 return window.__hyperblockSocketClientPromise;
}
async function watchCorruption(root){
 try{
  await loadSocket();
  if(adminSocket)adminSocket.disconnect();
  adminSocket=window.io(backend(root),{transports:["websocket","polling"],timeout:6000,reconnection:true});
  adminSocket.on("corruption:update",data=>{document.body.classList.toggle("hb-corrupted",!!data.enabled);if($(root,"#adCorrupt"))$(root,"#adCorrupt").textContent=data.enabled?"ON":"OFF";});
  adminSocket.on("connect_error",()=>status(root,"Admin API works, but live corruption updates could not connect."));
 }catch(e){status(root,e.message);}
}
export function initAdmin(){
 if(document.getElementById("adminCenter"))return;
 const style=document.createElement("style");style.textContent=STYLE;document.head.append(style);
 const nav=document.querySelector(".desktop-nav");
 if(nav){const b=document.createElement("button");b.dataset.page="admin";b.textContent="Admin";nav.insertBefore(b,nav.querySelector('[data-page="settings"]'));}
 const menu=document.getElementById("mobileMenu");
 if(menu){const b=document.createElement("button");b.dataset.page="admin";b.textContent="🔐 Admin Control Center";menu.insertBefore(b,menu.querySelector('[data-page="settings"]'));}
 const section=document.createElement("section");section.id="adminCenter";section.className="page admin-wrap";
 section.innerHTML='<div class="ad-hero"><p class="eyebrow">RESTRICTED CONTROL PLANE</p><h2>Admin Control Center</h2><p class="ad-muted">Manage multiplayer presence, moderation, and reversible visual chaos. This panel requires the backend admin secret; hiding this page is not security.</p><div class="ad-row"><input id="adBackend" class="ad-input" placeholder="Backend URL (https://your-server.example)"><input id="adKey" class="ad-input" type="password" autocomplete="current-password" placeholder="Admin API secret"><button id="adLogin" class="primary">Authenticate</button></div><div id="adStatus" class="ad-status" role="status">Not authenticated.</div></div>'+
 '<div class="ad-panel"><div class="section-head"><div><p class="eyebrow">LIVE MODERATION</p><h2>Players in rooms</h2></div><div class="ad-row"><strong><span id="adOnline">—</span> players</strong><button id="adRefresh" class="secondary">Refresh</button></div></div><p class="ad-muted">Shows players currently registered in multiplayer rooms. This is not a list of every person visiting the static website.</p><div id="adPeople" class="ad-list"><div class="sb-empty">Authenticate to load player list.</div></div></div>'+
 '<div class="ad-panel"><div class="section-head"><div><p class="eyebrow">PRIVATE REGISTRY VIEW</p><h2>All registered names and IDs</h2></div><strong><span id="adRegisteredCount">—</span> profiles</strong></div><p class="ad-muted">Loaded only after admin authentication. The private registry file is stored on the backend, not in the public website files.</p><div id="adRegisteredPeople" class="ad-list"><div class="sb-empty">Authenticate to load registered profiles.</div></div></div>'+
 '<div class="ad-panel"><p class="eyebrow">SITE-WIDE EFFECTS</p><h2>Corruption Mode <span id="adCorrupt">—</span></h2><p class="ad-muted">A reversible visual glitch effect. It does not delete files, damage data, or secretly alter visitors\u2019 devices.</p><div class="ad-switch"><div style="flex:1"><strong>Enable visual corruption</strong><div class="ad-glitch-note">Applies glitch colors and subtle text jitter to connected visitors. Turn it off to restore the normal appearance.</div></div><button id="adCorruptOn" class="primary">Enable</button><button id="adCorruptOff" class="secondary">Disable</button></div></div>'+
 '<div class="ad-panel"><p class="eyebrow">ADMIN SAFETY</p><h2>Control responsibly</h2><p class="ad-muted">Bans and corruption settings currently live in backend memory and reset when the backend restarts. Without accounts or durable storage, a user can potentially evade a browser-ID ban by clearing site data or changing browsers.</p></div>';
 document.querySelector("main")?.append(section);
 document.querySelectorAll('[data-page="admin"]').forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="adminCenter"));document.querySelectorAll(".desktop-nav button").forEach(x=>x.classList.toggle("active",x===b));document.getElementById("mobileMenu")?.classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});}));
 const root=section;
 $(root,"#adBackend").value=localStorage.getItem("hyperblock-server-backend")||"";
 $(root,"#adLogin").addEventListener("click",async()=>{if(!key(root)){status(root,"Enter the admin secret configured on the backend.");return;}try{await api(root,"/api/admin/people");localStorage.setItem("hyperblock-server-backend",backend(root));status(root,"Admin authentication successful.");await watchCorruption(root);await refresh(root);}catch(e){status(root,e.message);}});
 $(root,"#adRefresh").addEventListener("click",()=>refresh(root));
 $(root,"#adCorruptOn").addEventListener("click",()=>setCorruption(root,true));
 $(root,"#adCorruptOff").addEventListener("click",()=>setCorruption(root,false));
 refreshTimer=setInterval(()=>{if(document.getElementById("adminCenter")?.classList.contains("active")&&key(root))refresh(root);},20000);
}
