import { BACKEND_URL } from "./config.js";

const css = `
.hb-social{color:var(--text);display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.hb-social-hero{padding:22px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(130deg,#102d43,#101725)}
.hb-social-hero h2{margin:4px 0 8px;font-size:clamp(26px,4vw,38px)}
.hb-social-muted{color:var(--muted);line-height:1.5}
.hb-social-tabs{display:flex;gap:8px;flex-wrap:wrap}
.hb-social-tabs button{padding:10px 14px;border-radius:11px;background:#ffffff0a;border:1px solid var(--border)}
.hb-social-tabs button.active{background:var(--accent);color:#061522;font-weight:900}
.hb-social-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.36fr);gap:14px}
.hb-social-panel{min-width:0;border:1px solid var(--border);border-radius:16px;background:#ffffff05;padding:14px}
.hb-social-messages{height:min(54vh,560px);min-height:280px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:4px}
.hb-chat-msg{padding:10px 12px;border:1px solid #ffffff12;border-radius:12px;background:#071827;overflow-wrap:anywhere}
.hb-chat-meta{font-size:12px;color:var(--muted);margin-bottom:5px}
.hb-chat-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}
.hb-chat-size-1{font-size:11px}.hb-chat-size-2{font-size:13px}.hb-chat-size-3{font-size:16px}.hb-chat-size-4{font-size:21px;font-weight:750}.hb-chat-size-5{font-size:clamp(25px,4vw,38px);font-weight:950;line-height:1.12}
.hb-chat-admin{color:#ffb55e;font-weight:900}.hb-chat-badge{display:inline-block;padding:2px 6px;border-radius:6px;background:#20d7ee22;color:#20d7ee;font-size:10px;font-weight:900;margin-right:5px}
.hb-chat-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:12px}
.hb-chat-compose input,.hb-chat-compose textarea,.hb-chat-compose select,.hb-social-side input,.hb-social-side select{box-sizing:border-box;min-width:0;width:100%;padding:11px;border-radius:10px;border:1px solid var(--border);background:#071827;color:var(--text)}
.hb-chat-compose button,.hb-social-side button{padding:11px 14px;border-radius:10px;background:var(--accent);color:#061522;font-weight:900}
.hb-chat-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.hb-chat-tools label{font-size:12px;color:var(--muted);display:flex;gap:7px;align-items:center}
.hb-social-side{display:grid;gap:10px;align-content:start}
.hb-social-status{font-size:12px;color:var(--muted);min-height:18px}
.hb-social-empty{color:var(--muted);text-align:center;padding:28px 10px}
.hb-social-announcement{position:fixed;inset:10% 5% auto;z-index:100001;display:none;text-align:center;padding:clamp(22px,5vw,48px);border:2px solid #20d7ee;border-radius:20px;background:#061522f5;box-shadow:0 0 80px #20d7ee55}
.hb-social-announcement.open{display:block;animation:hbAnnIn .35s ease-out}
.hb-social-announcement h2{font-size:clamp(28px,7vw,64px);margin:8px 0}.hb-social-announcement p{font-size:clamp(16px,3vw,24px);overflow-wrap:anywhere}
.hb-social-announcement.glitch{border-color:#ff6938;animation:hbAnnGlitch .16s steps(2,end) infinite}
.hb-social-announcement.horror{background:#160711;border-color:#ff244d;color:#ffdce5;box-shadow:0 0 80px #ff244d55}
.hb-social-announcement.neon{box-shadow:0 0 90px #20d7ee99,inset 0 0 35px #20d7ee22}
.hb-social-announcement button{padding:10px 18px;border-radius:10px;background:#ffffff18;border:1px solid #ffffff2b;color:inherit}
@keyframes hbAnnIn{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}
@keyframes hbAnnGlitch{0%,100%{transform:translateX(0)}50%{transform:translateX(2px)}}
@media(max-width:760px){.hb-social-layout{grid-template-columns:1fr}.hb-social-messages{height:45vh}.hb-chat-compose{grid-template-columns:1fr}.hb-chat-compose button{width:100%}}
@media(prefers-reduced-motion:reduce){.hb-social-announcement,.hb-social-announcement.glitch{animation:none}}
`;

let socket = null, root = null, currentMode = "global", currentTarget = "", soundEnabled = false, audioContext = null;
const history = {global:[],room:[],dm:[]};
const $ = (s, r=document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function loadSocketClient(){
  if(window.io)return Promise.resolve();
  if(window.__hyperblockSocketClientPromise)return window.__hyperblockSocketClientPromise;
  window.__hyperblockSocketClientPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.socket.io/4.8.1/socket.io.min.js";s.onload=resolve;s.onerror=()=>reject(new Error("Could not load the chat networking client."));document.head.append(s);});
  return window.__hyperblockSocketClientPromise;
}
function getBlockedPlayers(){try{const v=JSON.parse(localStorage.getItem('hyperblock-chat-blocked')||'[]');return Array.isArray(v)?v.map(Number).filter(Number.isFinite):[]}catch{return[]}}
function saveBlockedPlayers(ids){try{localStorage.setItem('hyperblock-chat-blocked',JSON.stringify([...new Set(ids)]));return true}catch{return false}}
function setStatus(text){const el=$("#hbSocialStatus",root);if(el)el.textContent=text;}
function setMode(mode){
  currentMode=mode;
  root.querySelectorAll("[data-chat-mode]").forEach(b=>b.classList.toggle("active",b.dataset.chatMode===mode));
  $("#hbDmTargetWrap",root).hidden=mode!=="dm";
  $("#hbAnnouncePanel",root).hidden=!(mode==="global"&&window.HyperblockIdentity?.isAdmin===true);
  $("#hbChatTitle",root).textContent=mode==="global"?"Global Chat":mode==="dm"?"Private Messages":"Chat";
  renderMessages();
}
function displayName(message){return message.alias||message.name||"Player";}
function renderMessages(){
  const box=$("#hbSocialMessages",root);if(!box)return;
  const blocked=getBlockedPlayers();
  const list=(history[currentMode]||[]).filter(m=>!blocked.includes(Number(m.playerId)));
  box.replaceChildren();
  if(!list.length){const p=document.createElement("p");p.className="hb-social-empty";p.textContent=currentMode==="dm"?"Your private messages will appear here. Enter a player ID or name to start.":"No messages yet. Say hello to everyone online.";box.append(p);return;}
  for(const m of list){
    const card=document.createElement("article");card.className="hb-chat-msg";
    const meta=document.createElement("div");meta.className="hb-chat-meta";
    if(m.isAdmin){const badge=document.createElement("span");badge.className="hb-chat-admin";badge.textContent="(Admin) ";meta.append(badge);}
    const name=document.createElement("strong");name.textContent=displayName(m);meta.append(name);
    if(m.badge){const badge=document.createElement("span");badge.className="hb-chat-badge";badge.textContent=m.badge;const colors={cyan:"#20d7ee",orange:"#ff9c45",purple:"#c59bff",green:"#5ee6a8",pink:"#ff83c4",white:"#effaff"};badge.style.color=colors[m.badgeColor]||colors.cyan;badge.style.backgroundColor=(colors[m.badgeColor]||colors.cyan)+"22";meta.append(badge);}
    if(currentMode==="dm"&&m.toName){const to=document.createElement("span");to.textContent=" → "+m.toName;meta.append(to);}
    const body=document.createElement("div");body.className="hb-chat-body hb-chat-size-"+Math.max(1,Math.min(5,Number(m.size)||3));body.textContent=m.text||"";
    card.append(meta,body);
    const ownId=Number(window.HyperblockIdentity?.id);
    if(m.playerId&&Number(m.playerId)!==ownId){
      const actions=document.createElement("div");actions.className="hb-chat-actions";
      const block=document.createElement("button");block.type="button";block.textContent=blocked.includes(Number(m.playerId))?"Unblock":"Block";
      block.addEventListener("click",()=>{const ids=getBlockedPlayers();const next=ids.includes(Number(m.playerId))?ids.filter(id=>id!==Number(m.playerId)):[...ids,Number(m.playerId)];if(saveBlockedPlayers(next)){setStatus(next.includes(Number(m.playerId))?"Player blocked on this device.":"Player unblocked.");renderMessages();}});
      const report=document.createElement("button");report.type="button";report.textContent="Report";
      report.addEventListener("click",()=>{const reason=window.prompt("Why are you reporting this message?","Spam or inappropriate message");if(reason===null)return;if(!socket?.connected)return setStatus("Connect to the server before reporting.");socket.emit("chat:report:send",{messageId:m.id,reason},res=>setStatus(res?.ok?"Report sent to Hyperblock moderation.":res?.error||"Report failed."));});
      actions.append(block,report);card.append(actions);
    }
    box.append(card);
  }
  box.scrollTop=box.scrollHeight;
}
function receiveGlobal(m){history.global.push(m);if(history.global.length>100)history.global.shift();if(currentMode==="global")renderMessages();}
function receiveDm(m){history.dm.push(m);if(history.dm.length>100)history.dm.shift();if(currentMode==="dm")renderMessages();}
function sendMessage(){
  const input=$("#hbChatInput",root),text=input.value.trim();if(!text)return;
  if(!socket?.connected){setStatus("Chat is offline. Reconnect to the multiplayer server to send messages.");return;}
  if(currentMode==="dm"){
    const target=$("#hbDmTarget",root).value.trim();
    if(!target){setStatus("Enter a player ID or exact username first.");return;}
    socket.emit("chat:dm:send",{target,text},res=>{if(!res?.ok)setStatus(res?.error||"Message could not be sent.");else{setStatus("Private message sent.");input.value="";}});
  }else if(currentMode==="room"){
    socket.emit("chat:room:send",{text},res=>{if(!res?.ok)setStatus(res?.error||"Room chat could not send.");else{input.value="";setStatus("Room chat · messages are silent by default.");}});
  }else{
    socket.emit("chat:global:send",{text},res=>{if(!res?.ok)setStatus(res?.error||"Message could not be sent.");else{input.value="";setStatus("Connected · messages are silent by default.");}});
  }
}
function playAnnouncementSound(kind){
  if(!soundEnabled)return;
  try{
    audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const now=audioContext.currentTime;
    osc.type=kind==="horror"?"sawtooth":kind==="glitch"?"square":"sine";
    osc.frequency.setValueAtTime(kind==="horror"?110:kind==="glitch"?880:660,now);
    osc.frequency.exponentialRampToValueAtTime(kind==="horror"?55:kind==="glitch"?220:880,now+.45);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.04);gain.gain.exponentialRampToValueAtTime(.0001,now+.7);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.72);
  }catch{}
}
function showAnnouncement(m){
  const overlay=$("#hbAnnouncement");if(!overlay)return;
  overlay.className="hb-social-announcement open "+(["glitch","horror","neon"].includes(m.style)?m.style:"");
  $("#hbAnnouncementTitle").textContent=m.title||"HYPERBLOCK ANNOUNCEMENT";
  $("#hbAnnouncementBody").textContent=m.text||"";
  $("#hbAnnouncementBy").textContent="From "+(m.name||"Hyperblock Admin");
  playAnnouncementSound(m.sound||"futuristic");
}
async function startConnection(){
  for(let n=0;n<120&&!window.HyperblockIdentity;n++)await new Promise(resolve=>setTimeout(resolve,250));
  const identity=window.HyperblockIdentity;
  if(!identity){setStatus("Choose a Hyperblock player profile to connect chat.");return;}
  if(identity.offline||!identity.id){setStatus("You are offline. Re-enter Hyperblock online to use live chat.");return;}
  for(let n=0;n<120&&!window.HyperblockSocket;n++)await new Promise(resolve=>setTimeout(resolve,250));
  socket=window.HyperblockSocket;
  if(!socket){setStatus("The multiplayer connection did not start. Open Servers and try again.");return;}
  const authenticate=()=>{
    const id=window.HyperblockIdentity||identity;
    if(id.offline||!id.id)return;
    socket.emit("profile:set",{clientId:id.clientId,name:id.name},response=>{
      if(response?.ok){
        id.id=response.id;id.isAdmin=response.isAdmin===true;window.HyperblockIdentity=id;
        $("#hbAnnouncePanel",root).hidden=!(currentMode==="global"&&id.isAdmin);
        setStatus("Connected as "+response.name+" · Global Chat is silent by default.");
        socket.emit("chat:global:history:get");
      }else setStatus(response?.error||"Chat profile authentication failed.");
    });
  };
  socket.on("connect",authenticate);
  socket.on("disconnect",()=>setStatus("Disconnected · trying to reconnect…"));
  socket.on("connect_error",()=>setStatus("Could not connect to live chat. Check the multiplayer server."));
  socket.on("chat:global:history",payload=>{history.global=Array.isArray(payload?.messages)?payload.messages.slice(-100):[];if(currentMode==="global")renderMessages();});
  socket.on("chat:global:message",receiveGlobal);
  socket.on("chat:room:message",m=>{history.room.push(m);if(history.room.length>100)history.room.shift();if(currentMode==="room")renderMessages();});
  socket.on("chat:dm:message",receiveDm);
  socket.on("chat:system",receiveGlobal);
  socket.on("chat:announcement",showAnnouncement);
  if(socket.connected)authenticate();
}
export function initSocial(){
  if($("#hbSocial"))return;
  const style=document.createElement("style");style.id="hbSocialStyles";style.textContent=css;document.head.append(style);
  const nav=$(".desktop-nav"),menu=$("#mobileMenu");
  const addNav=(parent,mobile=false)=>{if(!parent)return;const b=document.createElement("button");b.dataset.socialPage="1";b.textContent=mobile?"💬 Chat":"Chat";if(mobile)b.classList.add("hb-social-mobile");parent.insertBefore(b,parent.querySelector('[data-page="studio"]'));b.addEventListener("click",()=>openPage());};
  addNav(nav);addNav(menu,true);
  const section=document.createElement("section");section.id="hbSocial";section.className="page hb-social";
  section.innerHTML=`<div class="hb-social-hero"><p class="eyebrow">HYPERBLOCK SOCIAL</p><h2 id="hbChatTitle">Global Chat</h2><p class="hb-social-muted">Talk across game rooms. Public and private messages are silent by default; admin announcements are separate overlays.</p><div class="hb-social-status" id="hbSocialStatus">Connecting to live chat…</div></div>
  <div class="hb-social-tabs"><button type="button" data-chat-mode="global" class="active">🌐 Global Chat</button><button type="button" data-chat-mode="room">🎮 Room Chat</button><button type="button" data-chat-mode="dm">✉ Private Messages</button></div>
  <div class="hb-social-layout"><div class="hb-social-panel"><div class="hb-social-messages" id="hbSocialMessages" aria-live="polite"></div>
  <div id="hbDmTargetWrap" class="hb-chat-tools" hidden><label for="hbDmTarget">Player ID or exact username</label><input id="hbDmTarget" placeholder="e.g. 2 or player2" maxlength="80"></div>
  <form class="hb-chat-compose" id="hbChatForm"><input id="hbChatInput" maxlength="500" autocomplete="off" placeholder="Write a message… (##5 makes it huge)" required><button type="submit">Send</button></form>
  <div class="hb-chat-tools"><label>Text size<select id="hbChatSize"><option value="3">Normal</option><option value="1">##1 Small</option><option value="2">##2 Medium-small</option><option value="4">##4 Large</option><option value="5">##5 Extra large</option></select></label><span class="hb-social-muted">Commands: ##1–##5 · alias: *#player2</span></div></div>
  <aside class="hb-social-panel hb-social-side"><h3>Chat settings</h3><label><input id="hbAnnounceSounds" type="checkbox"> Enable admin announcement sounds</label><p class="hb-social-muted">Sounds only apply to admin announcements. Your browser may require a tap before audio can play.</p>
  <div id="hbAnnouncePanel" hidden><hr><h3>Admin announcement</h3><label>Title<input id="hbAnnTitle" maxlength="80" value="HYPERBLOCK ANNOUNCEMENT"></label><label>Message<input id="hbAnnText" maxlength="280" placeholder="Announcement text"></label><label>Style<select id="hbAnnStyle"><option value="futuristic">Futuristic</option><option value="neon">Neon</option><option value="glitch">Glitch</option><option value="horror">Horror</option><option value="custom">Custom / clean</option></select></label><label>Sound<select id="hbAnnSound"><option value="futuristic">Futuristic tone</option><option value="glitch">Glitch tone</option><option value="horror">Horror tone</option><option value="silent">Silent</option></select></label><button type="button" id="hbAnnSend">Send global announcement</button><hr><h3>Assign player badge</h3><label>Player ID or exact username<input id="hbBadgeTarget" maxlength="80" placeholder="e.g. 67istheworst or 2"></label><label>Badge text (blank clears)<input id="hbBadgeText" maxlength="16" placeholder="TUFF"></label><label>Badge color<select id="hbBadgeColor"><option value="cyan">Cyan</option><option value="orange">Orange</option><option value="purple">Purple</option><option value="green">Green</option><option value="pink">Pink</option><option value="white">White</option></select></label><button type="button" id="hbBadgeAssign">Save player badge</button><hr><h3>Chat reports</h3><button type="button" id="hbReportsRefresh">Load reports</button><div id="hbReportsList" class="hb-social-muted">No reports loaded.</div></div>
  </aside></div>`;
  document.querySelector("main")?.append(section);
  const overlay=document.createElement("div");overlay.id="hbAnnouncement";overlay.className="hb-social-announcement";overlay.innerHTML='<p id="hbAnnouncementBy"></p><h2 id="hbAnnouncementTitle"></h2><p id="hbAnnouncementBody"></p><button id="hbAnnouncementClose" type="button">Dismiss</button>';document.body.append(overlay);
  root=section;
  root.querySelectorAll("[data-chat-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.chatMode)));
  $("#hbChatForm",root).addEventListener("submit",e=>{e.preventDefault();sendMessage();});
  $("#hbChatSize",root).addEventListener("change",e=>{const input=$("#hbChatInput",root);if(!input.value.trim())input.value="##"+e.target.value+" ";else input.value="##"+e.target.value+" "+input.value.replace(/^##[1-5]\s*/,"");input.focus();});
  $("#hbAnnounceSounds",root).addEventListener("change",e=>{soundEnabled=e.target.checked;if(soundEnabled){try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}}});
  $("#hbBadgeAssign",root).addEventListener("click",()=>{const target=$("#hbBadgeTarget",root).value.trim();if(!target)return setStatus("Enter a player ID or exact username.");if(!socket?.connected)return setStatus("Connect to the server before changing badges.");socket.emit("chat:badge:assign",{target,badge:$("#hbBadgeText",root).value,color:$("#hbBadgeColor",root).value},res=>setStatus(res?.ok?(res.badge?"Badge "+res.badge+" saved for "+res.name+".":"Badge cleared for "+res.name+"."):res?.error||"Badge update failed."));});
  $("#hbAnnSend",root).addEventListener("click",()=>{const text=$("#hbAnnText",root).value.trim();if(!text)return setStatus("Enter an announcement message first.");if(!socket?.connected)return setStatus("Connect to the server before announcing.");socket.emit("chat:announcement:send",{title:$("#hbAnnTitle",root).value,text,style:$("#hbAnnStyle",root).value,sound:$("#hbAnnSound",root).value},res=>setStatus(res?.ok?"Announcement sent.":res?.error||"Announcement failed."));});
  $("#hbAnnouncementClose").addEventListener("click",()=>$("#hbAnnouncement").classList.remove("open"));
  setMode("global");startConnection();
}
function openPage(){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="hbSocial"));
  document.querySelectorAll(".desktop-nav button").forEach(b=>b.classList.toggle("active",b.dataset.socialPage==="1"));
  $("#mobileMenu")?.classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}
