import { BACKEND_URL } from "./config.js";
const STYLE = `
.server-browser{--sb-panel:#111d2c;--sb-border:#ffffff1a;color:var(--text)}
.sb-hero{padding:clamp(20px,4vw,36px);border:1px solid var(--sb-border);border-radius:22px;background:linear-gradient(135deg,#10283a,#111827 70%);margin-bottom:20px}
.sb-kicker{font-size:11px;letter-spacing:.16em;font-weight:900;color:var(--accent)}
.sb-hero h2{margin:8px 0 10px;font-size:clamp(30px,5vw,48px)}
.sb-muted{color:var(--muted);line-height:1.5}.sb-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px}
.sb-stat{padding:16px;border:1px solid var(--sb-border);border-radius:14px;background:#ffffff07}.sb-stat strong{display:block;font-size:clamp(22px,4vw,32px)}.sb-stat span{font-size:12px;color:var(--muted)}
.sb-controls{display:grid;grid-template-columns:minmax(0,1fr) 190px 190px;gap:10px;margin:16px 0}
.sb-input,.sb-select{width:100%;min-width:0;padding:12px 13px;border-radius:11px;border:1px solid var(--sb-border);background:#ffffff08;color:var(--text)}
.sb-select option{background:#111d2c}.sb-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}
.sb-tab{padding:9px 13px;border:1px solid var(--sb-border);border-radius:99px;background:#ffffff08}.sb-tab.active{background:var(--accent);color:#071827;font-weight:900}
.sb-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.sb-card{padding:17px;border:1px solid var(--sb-border);border-radius:17px;background:linear-gradient(145deg,#ffffff0a,#ffffff03);min-width:0}
.sb-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.sb-card h3{font-size:16px;margin:0 0 6px;overflow-wrap:anywhere}
.sb-tag{font-size:10px;letter-spacing:.06em;font-weight:900;padding:5px 8px;border-radius:99px;background:#16c8e822;color:var(--accent);white-space:nowrap}.sb-tag.private{background:#c48cff22;color:#d9b5ff}.sb-tag.full{background:#ff693826;color:#ff9a78}
.sb-meta{font-size:12px;color:var(--muted);margin:8px 0 13px;line-height:1.6}.sb-meter{height:6px;border-radius:99px;background:#ffffff12;overflow:hidden;margin:10px 0}.sb-meter i{display:block;height:100%;background:var(--accent);border-radius:99px}
.sb-card-actions{display:flex;gap:8px}.sb-card-actions button{flex:1}.sb-empty{grid-column:1/-1;padding:30px;text-align:center;border:1px dashed var(--sb-border);border-radius:14px;color:var(--muted)}
.sb-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--sb-border);border-radius:16px;background:#ffffff05;margin:16px 0}
.sb-form label{display:grid;gap:7px;color:var(--muted);font-size:12px}.sb-form .wide{grid-column:1/-1}.sb-form .sb-check{display:flex;align-items:center;gap:8px}.sb-form button{min-height:44px}
.sb-status{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted);margin-top:12px}.sb-dot{width:8px;height:8px;border-radius:50%;background:#ff9a78}.sb-dot.online{background:#57e38c;box-shadow:0 0 10px #57e38c66}
.sb-note{font-size:12px;color:var(--muted);line-height:1.6;margin-top:18px}
@media(max-width:720px){.sb-controls{grid-template-columns:1fr}.sb-list{grid-template-columns:1fr}.sb-form{grid-template-columns:1fr}.sb-form .wide{grid-column:auto}.sb-stats{gap:7px}.sb-stat{padding:11px}}
`;
let socket = null, servers = [], activeKind = "all", connected = false, refreshTimer = null;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = (root, selector) => root.querySelector(selector);
function loadSocketClient(){
  if(window.io) return Promise.resolve();
  if(window.__hyperblockSocketClientPromise) return window.__hyperblockSocketClientPromise;
  window.__hyperblockSocketClientPromise = new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.socket.io/4.8.1/socket.io.min.js";
    script.onload=resolve; script.onerror=()=>reject(new Error("Could not load the Socket.IO client."));
    document.head.append(script);
  });
  return window.__hyperblockSocketClientPromise;
}
function apiBase(){ return BACKEND_URL.replace(/\/$/,""); }
function showStatus(root,message,online=connected){
  const status=$(root,"#sbStatus"); if(!status) return;
  status.innerHTML='<i class="sb-dot '+(online?"online":"")+'"></i><span>'+esc(message)+'</span>';
}
function render(root){
  const query=($(root,"#sbSearch").value||"").trim().toLowerCase();
  const kind=$(root,"#sbKind").value;
  const list=servers.filter(s=>(activeKind==="all"||s.visibility===activeKind)&&(!kind||kind==="all"||s.kind===kind)&&(!query||[s.name,s.region,s.ownerName,s.description,s.id].join(" ").toLowerCase().includes(query)));
  const grid=$(root,"#sbServerList"); grid.replaceChildren();
  if(!list.length){const empty=document.createElement("div");empty.className="sb-empty";empty.textContent=connected?"No servers match. Create one or change your filters.":"Hyperblock multiplayer is temporarily unavailable.";grid.append(empty);}
  list.forEach(s=>{
    const count=Number(s.playerCount)||0;
    const maxText=String(s.maxPlayers ?? 20);
    const max=Math.max(1,Number(s.maxPlayers)||20);
    const full=count>=max;
    let openText=String(Math.max(0,max-count));
    // Preserve every digit for the Global Server's intentionally enormous capacity.
    try{if(/^\d+$/.test(maxText))openText=(BigInt(maxText)-BigInt(count)).toString();}catch{}
    const card=document.createElement("article");card.className="sb-card";
    const tag=s.visibility==="private"?"Private room":s.kind==="official"?"Official server":"Community server";
    card.innerHTML='<div class="sb-card-head"><div><h3>'+esc(s.name)+'</h3><div class="sb-meta">'+esc(s.region||"Region not set")+' · '+esc(s.ownerName||"Hyperblock")+'</div></div><span class="sb-tag '+(s.visibility==="private"?"private":full?"full":"")+'">'+tag+'</span></div>'+
      '<div class="sb-meter"><i style="width:'+Math.min(100,count/max*100)+'%"></i></div>'+
      '<div class="sb-meta"><b>'+count+' / '+esc(maxText)+' players</b> · '+(full?"Full":openText+" spots open")+'<br>'+esc(s.description||"Jump in and play.")+'</div>'+
      '<div class="sb-card-actions"><button class="primary" '+(full?'disabled':'')+' data-join="'+esc(s.id)+'">'+(full?"Server Full":"Join")+'</button><button class="secondary" data-copy="'+esc(s.id)+'">Copy ID</button></div>';
    grid.append(card);
  });
  const total=servers.reduce((sum,s)=>sum+(Number(s.playerCount)||0),0);
  $(root,"#sbPlayers").textContent=connected?total.toLocaleString():"—";
  $(root,"#sbServers").textContent=connected?servers.length.toLocaleString():"—";
  $(root,"#sbCapacity").textContent=connected?servers.reduce((sum,s)=>sum+Math.max(0,(Number(s.maxPlayers)||20)-(Number(s.playerCount)||0)),0).toLocaleString():"—";
}
async function fetchServers(root){
  const base=apiBase();
  try{
    const [serverRes,statsRes]=await Promise.all([fetch(base+"/api/servers"),fetch(base+"/api/stats")]);
    if(!serverRes.ok||!statsRes.ok) throw new Error("Backend returned HTTP "+(!serverRes.ok?serverRes.status:statsRes.status));
    const data=await serverRes.json(); await statsRes.json();
    servers=Array.isArray(data.servers)?data.servers:[];
    connected=true;showStatus(root,"Connected to live server backend",true);render(root);
  }catch(err){
    connected=false;showStatus(root,"Backend offline · please try again later",false);render(root);
  }
}
async function connect(root){
  const base=apiBase(root);
  if(socket){socket.disconnect();socket=null;}
  try{
    await loadSocketClient();
    socket=window.io(base,{transports:["websocket","polling"],timeout:6000,reconnection:true});
    window.HyperblockSocket=socket;
    socket.on("connect",()=>{
      connected=true;showStatus(root,"Connected · live updates enabled",true);
      let clientId=localStorage.getItem("hyperblock-client-id");
      if(!clientId){clientId=window.crypto?.randomUUID?.()||("hb-"+Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem("hyperblock-client-id",clientId);}
      const identity=window.HyperblockIdentity||{};
      if(!identity.offline) socket.emit("profile:set",{clientId:identity.clientId||clientId,name:identity.name||"Player-"+clientId.slice(0,6)},response=>{if(response?.ok&&response.id){identity.id=response.id;identity.isAdmin=response.isAdmin===true;window.HyperblockIdentity=identity;}});
      fetchServers(root);
    });
    socket.on("disconnect",()=>{connected=false;showStatus(root,"Disconnected · retrying",false);});
    socket.on("corruption:update",payload=>{document.body.classList.toggle("hb-corrupted",!!payload?.enabled);});
    socket.on("server:list",payload=>{servers=Array.isArray(payload.servers)?payload.servers:[];connected=true;render(root);});
    socket.on("stats:update",()=>fetchServers(root));
    socket.on("connect_error",()=>{connected=false;showStatus(root,"Could not connect. Check backend URL and CORS.",false);});
    showStatus(root,"Connecting…",false);
  }catch(err){showStatus(root,err.message,false);}
}
function createRoom(root){
  if(!socket||!socket.connected){showStatus(root,"Connect to the backend before creating a room.",false);return;}
  const name=$(root,"#sbNewName").value.trim()||"Community Room";
  const description=$(root,"#sbDescription").value.trim();
  const maxPlayers=Number($(root,"#sbMax").value)||20;
  const kind=$(root,"#sbCreateKind").value;
  const visibility=$(root,"#sbVisibility").value;
  const password=$(root,"#sbPassword").value;
  socket.emit("room:create",{name,description,maxPlayers,kind,visibility,password,region:"Auto"},response=>{
    if(!response?.ok){showStatus(root,response?.error||"Could not create room.",true);return;}
    showStatus(root,"Room created · ID "+response.room.id,true);
    if(response.room.visibility==="private") alert("Private room created. Share this room ID and password only with people you trust. Room ID: "+response.room.id);
    socket.emit("room:join",{roomId:response.room.id,password},joinResponse=>{
      if(joinResponse?.ok) showStatus(root,"Joined "+response.room.name,true);
      else showStatus(root,"Room created, but joining failed: "+(joinResponse?.error||"unknown error"),true);
      fetchServers(root);
    });
    $(root,"#sbNewName").value="";$(root,"#sbDescription").value="";$(root,"#sbPassword").value="";
  });
}
function joinRoom(root,id){
  if(!socket||!socket.connected){showStatus(root,"Connect to the backend before joining.",false);return;}
  const server=servers.find(s=>s.id===id);
  if(!server)return;
  const password=server.visibility==="private"?prompt("Private room password:"):"";
  if(password===null)return;
  socket.emit("room:join",{roomId:id,password},response=>{
    showStatus(root,response?.ok?"Joined "+server.name:(response?.error||"Could not join room."),!!response?.ok);
    fetchServers(root);
  });
}
export function initServerBrowser(){
  if(document.getElementById("serverBrowser"))return;
  const style=document.createElement("style");style.textContent=STYLE;document.head.append(style);
  const nav=document.querySelector(".desktop-nav");
  if(nav){const b=document.createElement("button");b.dataset.page="servers";b.textContent="Servers";nav.insertBefore(b,nav.querySelector('[data-page="studio"]'));}
  const menu=document.getElementById("mobileMenu");
  if(menu){const b=document.createElement("button");b.dataset.page="servers";b.textContent="🌐 Server Browser";menu.insertBefore(b,menu.querySelector('[data-page="studio"]'));}
  const section=document.createElement("section");section.id="servers";section.className="page server-browser";
  section.innerHTML='<div class="sb-hero"><div class="sb-kicker">HYPERBLOCK MULTIPLAYER</div><h2>Find your next server.</h2><p class="sb-muted">Official servers, community worlds, and private rooms. Player totals are aggregated from connected room members when a backend is connected.</p><div class="sb-stats"><div class="sb-stat"><strong id="sbPlayers">—</strong><span>PLAYERS ONLINE</span></div><div class="sb-stat"><strong id="sbServers">—</strong><span>ACTIVE SERVERS</span></div><div class="sb-stat"><strong id="sbCapacity">—</strong><span>OPEN SLOTS</span></div></div><div id="sbStatus" class="sb-status"><i class="sb-dot"></i><span>Backend not connected</span></div></div>'+
  '<div class="section-head"><div><p class="eyebrow">SERVER LIST</p><h2>Browse rooms</h2></div><button id="sbRefresh" class="secondary">↻ Refresh</button></div>'+
  '<div class="sb-controls"><input id="sbSearch" class="sb-input" placeholder="Search server, owner, or region"><select id="sbKind" class="sb-select"><option value="all">All server types</option><option value="official">Official</option><option value="community">Community</option></select></div>'+
  '<div class="sb-tabs"><button class="sb-tab active" data-sb-kind="all">All rooms</button><button class="sb-tab" data-sb-kind="public">Public rooms</button><button class="sb-tab" data-sb-kind="private">Private rooms</button></div><div id="sbServerList" class="sb-list"><div class="sb-empty">Connect to a deployed backend to see live servers.</div></div>'+
  '<div class="section-head"><div><p class="eyebrow">HOST A ROOM</p><h2>Create a server</h2></div></div><form id="sbCreateForm" class="sb-form"><label>Room name<input id="sbNewName" class="sb-input" maxlength="64" placeholder="My world"></label><label>Server type<select id="sbCreateKind" class="sb-select"><option value="community">Community server</option><option value="official">Official server (admin only in production)</option></select></label><label>Maximum players<select id="sbMax" class="sb-select"><option>20</option><option>4</option><option>8</option><option>12</option><option>16</option><option>24</option><option>32</option><option>50</option><option>100</option></select></label><label>Visibility<select id="sbVisibility" class="sb-select"><option value="public">Public</option><option value="private">Private room</option></select></label><label class="wide">Description<input id="sbDescription" class="sb-input" maxlength="180" placeholder="What are we playing?"></label><label class="wide">Room password (private rooms only)<input id="sbPassword" class="sb-input" type="password" maxlength="100" autocomplete="new-password" placeholder="Leave blank for public rooms"></label><button class="primary wide" type="submit">＋ Create and Join Room</button></form>'+
  '<p class="sb-note">Counts are real only when connected to your backend; this page does not invent live players. Room limits default to 20 and are enforced by the server. A server browser handles room discovery and presence; the actual game must also connect to the room transport to synchronize gameplay.</p>';
  document.querySelector("main")?.append(section);
  document.querySelectorAll("[data-page='servers']").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="servers"));document.querySelectorAll(".desktop-nav button").forEach(x=>x.classList.toggle("active",x===b));document.getElementById("mobileMenu")?.classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});}));
  const root=section;
  $(root,"#sbRefresh").addEventListener("click",()=>{if(socket?.connected)socket.emit("server:refresh");fetchServers(root);});
  $(root,"#sbSearch").addEventListener("input",()=>render(root));
  $(root,"#sbKind").addEventListener("change",()=>render(root));
  root.querySelectorAll("[data-sb-kind]").forEach(b=>b.addEventListener("click",()=>{activeKind=b.dataset.sbKind;root.querySelectorAll("[data-sb-kind]").forEach(x=>x.classList.toggle("active",x===b));render(root);}));
  $(root,"#sbCreateForm").addEventListener("submit",e=>{e.preventDefault();createRoom(root);});
  $(root,"#sbServerList").addEventListener("click",e=>{
    const join=e.target.closest("[data-join]");if(join)joinRoom(root,join.dataset.join);
    const copy=e.target.closest("[data-copy]");if(copy){const id=copy.dataset.copy;navigator.clipboard?.writeText(id).then(()=>showStatus(root,"Copied room ID "+id,connected)).catch(()=>prompt("Copy room ID:",id));}
  });
  fetchServers(root);
  connect(root);
  refreshTimer=setInterval(()=>{if(socket?.connected)fetchServers(root);},15000);
}
