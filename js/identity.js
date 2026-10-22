const IDENTITY_KEY="hyperblock-identity";
const BACKEND_KEY="hyperblock-server-backend";
const safeGet=k=>{try{return localStorage.getItem(k)||""}catch{return ""}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch{return false}};
function clientIdentity(){
  let id=safeGet("hyperblock-client-id");
  if(!id){id=window.crypto?.randomUUID?.()||("hb-"+Math.random().toString(36).slice(2)+Date.now().toString(36));safeSet("hyperblock-client-id",id)}
  return id;
}
function injectStyles(){
  if(document.getElementById("hbIdentityStyles"))return;
  const style=document.createElement("style");style.id="hbIdentityStyles";
  style.textContent=`
  .hb-id-badge{display:inline-flex;align-items:center;gap:7px;margin-left:auto;margin-right:10px;padding:7px 10px;border:1px solid #16c8e855;border-radius:99px;background:#16c8e811;color:var(--text);font-size:12px;font-weight:800;white-space:nowrap}
  .hb-id-badge span{color:var(--accent)}
  .hb-identity-gate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(3,10,20,.96);backdrop-filter:blur(16px);color:#f3f8ff}
  .hb-identity-card{width:min(100%,460px);padding:25px;border:1px solid #16c8e855;border-radius:22px;background:linear-gradient(145deg,#10283b,#0b1421);box-shadow:0 24px 90px #0009}
  .hb-identity-card h1{margin:6px 0 10px;font-size:clamp(27px,6vw,38px)}.hb-identity-card p{color:#b6c7d8;line-height:1.55}
  .hb-identity-card label{display:grid;gap:7px;margin:14px 0;color:#d9e5f2;font-size:13px}
  .hb-identity-card input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #ffffff2a;border-radius:11px;background:#071827;color:#fff;font:inherit}
  .hb-identity-card button{width:100%;padding:13px;border:0;border-radius:11px;background:#16c8e8;color:#071827;font-weight:900;font-size:15px;cursor:pointer}
  .hb-identity-error{min-height:20px;color:#ff9d9d!important;font-size:13px}.hb-identity-small{font-size:12px!important}
  @media(max-width:600px){.hb-id-badge{max-width:110px;overflow:hidden;text-overflow:ellipsis;margin-right:6px;font-size:11px}.topbar{gap:5px}}
  `;
  document.head.append(style);
}
function paintBadge(identity){
  const header=document.querySelector(".topbar");if(!header)return;
  let badge=document.getElementById("hbIdentityBadge");
  if(!badge){badge=document.createElement("div");badge.id="hbIdentityBadge";badge.className="hb-id-badge";header.insertBefore(badge,document.getElementById("menuBtn"))}
  badge.innerHTML='<span>('+Number(identity.id)+')</span> '+String(identity.name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  badge.title="Your Hyperblock ID: ("+identity.id+")";
}
function showGate(saved={},message=""){
  return new Promise(resolve=>{
    document.getElementById("hbIdentityGate")?.remove();
    const gate=document.createElement("div");gate.id="hbIdentityGate";gate.className="hb-identity-gate";
    gate.innerHTML='<form class="hb-identity-card" id="hbIdentityForm"><p style="letter-spacing:.18em;font-weight:900;color:#16c8e8;font-size:11px">HYPERBLOCK PLAYER PROFILE</p><h1>Choose your player name</h1><p>Your name and player ID are used across Hyperblock multiplayer. Your ID is assigned in order, like (1), (2), (3), and remembered on this browser.</p><label>Player name<input id="hbIdentityName" maxlength="24" minlength="2" required autocomplete="nickname" placeholder="Enter a name"></label><label>Multiplayer backend URL<input id="hbIdentityBackend" type="url" required placeholder="https://your-hyperblock-server.example.com"></label><p class="hb-identity-small">The backend saves the private ID/name registry. A deployed backend with persistent storage is required; GitHub Pages alone cannot store a shared private registry.</p><p id="hbIdentityError" class="hb-identity-error" role="status"></p><button type="submit">Enter Hyperblock</button></form>';
    document.body.append(gate);
    const name=gate.querySelector("#hbIdentityName"),backend=gate.querySelector("#hbIdentityBackend");
    name.value=saved.name||"";backend.value=safeGet(BACKEND_KEY)||saved.backend||"";
    gate.querySelector("#hbIdentityError").textContent=message;
    gate.querySelector("form").addEventListener("submit",async e=>{
      e.preventDefault();
      const chosenName=name.value.trim(),base=backend.value.trim().replace(/\/$/,""),clientId=clientIdentity();
      const err=gate.querySelector("#hbIdentityError");
      if(chosenName.length<2){err.textContent="Please use at least 2 characters for your name.";return}
      if(!/^https?:\/\//i.test(base)){err.textContent="Enter the full backend URL, starting with https://.";return}
      const submit=gate.querySelector("button");submit.disabled=true;submit.textContent="Registering…";err.textContent="";
      try{
        const response=await fetch(base+"/api/identity/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:chosenName,clientId})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||"Registration failed ("+response.status+").");
        const identity={id:data.id,name:data.name,clientId:data.clientId,backend:base};
        if(!safeSet(IDENTITY_KEY,JSON.stringify(identity))||!safeSet(BACKEND_KEY,base))throw new Error("This browser could not save your profile. Check browser storage settings.");
        window.HyperblockIdentity=identity;paintBadge(identity);gate.remove();resolve(identity);
      }catch(error){err.textContent=error.message+" Check the URL, backend deployment, and CORS settings.";submit.disabled=false;submit.textContent="Enter Hyperblock"}
    });
  });
}
export async function requireIdentity(){
  injectStyles();
  const raw=safeGet(IDENTITY_KEY);let saved={};
  try{saved=JSON.parse(raw)||{}}catch{}
  const clientId=clientIdentity();
  const base=(safeGet(BACKEND_KEY)||saved.backend||"").replace(/\/$/,"");
  if(saved.id&&saved.name&&base){
    try{
      const response=await fetch(base+"/api/identity/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:saved.name,clientId:saved.clientId||clientId})});
      const data=await response.json();
      if(response.ok){
        const identity={id:data.id,name:data.name,clientId:data.clientId,backend:base};
        safeSet(IDENTITY_KEY,JSON.stringify(identity));safeSet(BACKEND_KEY,base);window.HyperblockIdentity=identity;paintBadge(identity);return identity;
      }
      return await showGate(saved,data.error||"Please register your profile again.");
    }catch{
      return await showGate(saved,"Could not reach the multiplayer backend. Reconnect to enter Hyperblock.");
    }
  }
  return await showGate(saved);
}
