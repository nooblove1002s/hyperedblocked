// HYPERBLOCK Studio: scene editor with a self-contained perspective renderer (Canvas 2D, real 3D math).
const $ = s => document.querySelector(s);
const KEY = "hyperblock-studio-v1";
let S = null;
const V = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm(a){const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];}
};
const rad = d => d*Math.PI/180;

function buildMesh(type){
  if(type==="cube") return {v:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
    f:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]};
  if(type==="plane") return {v:[[-3,0,-3],[3,0,-3],[3,0,3],[-3,0,3]], f:[[0,3,2,1]]};
  const R=8, G=14, v=[], f=[];
  for(let r=0;r<=R;r++)for(let s=0;s<G;s++){const t=Math.PI*r/R,p=2*Math.PI*s/G;v.push([Math.sin(t)*Math.cos(p),Math.cos(t),Math.sin(t)*Math.sin(p)]);}
  for(let r=0;r<R;r++)for(let s=0;s<G;s++){const a=r*G+s,b=r*G+(s+1)%G;f.push([a,b,b+G,a+G]);}
  return {v,f};
}
const MESH = {cube:buildMesh("cube"), sphere:buildMesh("sphere"), plane:buildMesh("plane")};

function worldVerts(o){
  const [sx,sy,sz]=o.scale,[rx,ry,rz]=o.rot.map(rad);
  return MESH[o.type].v.map(p=>{
    let [x,y,z]=[p[0]*sx,p[1]*sy,p[2]*sz], t;
    t=y*Math.cos(rx)-z*Math.sin(rx); z=y*Math.sin(rx)+z*Math.cos(rx); y=t;
    t=x*Math.cos(ry)+z*Math.sin(ry); z=-x*Math.sin(ry)+z*Math.cos(ry); x=t;
    t=x*Math.cos(rz)-y*Math.sin(rz); y=x*Math.sin(rz)+y*Math.cos(rz); x=t;
    return [x+o.pos[0],y+o.pos[1],z+o.pos[2]];
  });
}

const log = (level,msg) => { S.logs.push({level,msg,t:new Date().toLocaleTimeString()}); drawConsole(); };
const snap = () => JSON.stringify(S.objs);
const mk = (type,i) => ({id:"o"+Date.now().toString(36)+Math.floor(Math.random()*1e4),name:type[0].toUpperCase()+type.slice(1)+" "+i,type,
  pos:[0,type==="plane"?0:1,0],rot:[0,0,0],scale:[1,1,1],color:type==="plane"?"#3a3f4b":"#8b5cf6",visible:true,spin:false});

function status(t){ $("#edStatus").textContent = t; }
function persist(){
  try{
    S.scenes[S.scene] = S.objs;
    localStorage.setItem(KEY, JSON.stringify({project:S.project,scene:S.scene,scenes:S.scenes}));
    status("Saved"); return true;
  }catch(e){ status("Not saved (storage unavailable)"); log("warn","Browser storage unavailable; use Export to keep your work."); return false; }
}
function commit(){
  if(S.playing){ log("warn","Changes made during Play mode are discarded when you stop."); refresh(); return; }
  const s=snap();
  if(s!==S.hist[S.hi]){ S.hist.splice(S.hi+1); S.hist.push(s); if(S.hist.length>100) S.hist.shift(); S.hi=S.hist.length-1; }  // skip no-op steps
  persist(); refresh();
}
function restore(i){
  S.hi=i; S.objs=JSON.parse(S.hist[i]); if(!S.objs.find(o=>o.id===S.sel)) S.sel=null; persist(); refresh();
}

// ---------- rendering ----------
let raf=0;
const redraw = () => S.view ? S.view.sync() : draw();
function render(){ if(!raf) raf=requestAnimationFrame(()=>{raf=0;redraw();}); }
function project(c,w,h){
  const {yaw,pitch,dist,target}=S.cam;
  const eye=[target[0]+dist*Math.cos(pitch)*Math.sin(yaw),target[1]+dist*Math.sin(pitch),target[2]+dist*Math.cos(pitch)*Math.cos(yaw)];
  const f=V.norm(V.sub(target,eye)), r=V.norm(V.cross(f,[0,1,0])), u=V.cross(r,f), fl=h*1.07;
  return {eye, cam:p=>{const d=V.sub(p,eye);const z=V.dot(d,f);return [w/2+V.dot(d,r)/z*fl, h/2-V.dot(d,u)/z*fl, z];}};
}
function draw(){
  const cv=$("#edCanvas"), ctx=cv.getContext("2d"), dpr=cv.width/(cv.clientWidth||1), w=cv.clientWidth, h=cv.clientHeight;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,"#121420"); g.addColorStop(1,"#0a0b12");
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  const {eye,cam}=project(S.cam,w,h);
  const line=(a,b,col,wd)=>{const p=cam(a),q=cam(b); if(p[2]<.1||q[2]<.1) return; ctx.strokeStyle=col; ctx.lineWidth=wd; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();};
  for(let i=-10;i<=10;i++){const c=i===0?"#2c3042":"#1b1e2c"; line([i,0,-10],[i,0,10],c,1); line([-10,0,i],[10,0,i],c,1);}
  line([0,0,0],[4,0,0],"#ef4444",2); line([0,0,0],[0,4,0],"#22c55e",2); line([0,0,0],[0,0,4],"#3b82f6",2);
  const L=V.norm([.5,1,.3]), faces=[];
  for(const o of S.objs){ if(!o.visible) continue;
    const wv=worldVerts(o);
    for(const fi of MESH[o.type].f){
      const p=fi.map(i=>wv[i]); let n=V.norm(V.cross(V.sub(p[1],p[0]),V.sub(p[2],p[0])));
      const c=[0,1,2].map(k=>p.reduce((s,q)=>s+q[k],0)/p.length);
      if(o.type!=="plane" && V.dot(n,V.sub(c,o.pos))<0) n=n.map(x=>-x);
      const toC=V.sub(c,eye); if(V.dot(n,toC)>0){ if(o.type==="plane") n=n.map(x=>-x); else continue; }
      const pr=p.map(cam); if(pr.some(q=>q[2]<.1)) continue;
      faces.push({o,pr,z:pr.reduce((s,q)=>s+q[2],0)/pr.length,sh:.3+.7*Math.max(0,V.dot(n,L))});
    }
  }
  faces.sort((a,b)=>b.z-a.z); S.hits=faces;
  for(const f of faces){
    const [r,gc,b]=[1,3,5].map(i=>parseInt(f.o.color.slice(i,i+2),16));
    ctx.fillStyle=`rgb(${r*f.sh|0},${gc*f.sh|0},${b*f.sh|0})`;
    ctx.strokeStyle=f.o.id===S.sel?"#22d3ee":"rgba(255,255,255,.12)"; ctx.lineWidth=f.o.id===S.sel?2:1;
    ctx.beginPath(); f.pr.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  $("#edHud").textContent = `${S.playing?(S.paused?"⏸ Paused":"▶ Playing"):"Edit mode"} • ${S.objs.length} objects • perspective camera`;
}
function inPoly(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0]) c=!c;}return c;}

// ---------- UI ----------
function drawHier(){
  const box=$("#hierList"); box.replaceChildren();
  if(!S.objs.length){ box.append(Object.assign(document.createElement("p"),{className:"empty-state",textContent:"Scene is empty. Add an object from the toolbar."})); return; }
  for(const o of S.objs){
    const row=document.createElement("div"); row.className="h-row"+(o.id===S.sel?" sel":"");
    const eye=Object.assign(document.createElement("button"),{textContent:o.visible?"👁":"▫",title:"Toggle visibility"});
    eye.onclick=e=>{e.stopPropagation(); o.visible=!o.visible; commit();};
    const nm=Object.assign(document.createElement("span"),{textContent:({cube:"▣ ",sphere:"● ",plane:"▭ "})[o.type]+o.name});
    row.onclick=()=>{S.sel=o.id;refresh();};
    row.ondblclick=()=>{const n=prompt("Rename object",o.name); if(n&&n.trim()){o.name=n.trim().slice(0,60);commit();}};
    row.append(eye,nm); box.append(row);
  }
}
function field(label,arr,idx,step){
  const i=Object.assign(document.createElement("input"),{type:"number",step,value:+arr[idx].toFixed(3)});
  i.setAttribute("aria-label",label);
  i.oninput=()=>{const v=parseFloat(i.value); if(!isNaN(v)){arr[idx]=v;render();status("Unsaved");}};
  i.onchange=()=>commit(); return i;
}
function drawInsp(){
  const b=$("#inspBody"), o=S.objs.find(x=>x.id===S.sel); b.replaceChildren();
  if(!o){ b.append(Object.assign(document.createElement("p"),{className:"empty-state",textContent:"Select an object to edit it."})); return; }
  const nm=Object.assign(document.createElement("input"),{value:o.name}); nm.onchange=()=>{o.name=(nm.value||o.name).slice(0,60);commit();};
  b.append(Object.assign(document.createElement("label"),{textContent:"Name"}),nm);
  for(const [t,k,st] of [["Position","pos",.1],["Rotation (°)","rot",1],["Scale","scale",.1]]){
    const row=document.createElement("div"); row.className="vec3";
    row.append(...[0,1,2].map(i=>field(t+" "+"XYZ"[i],o[k],i,st)));
    b.append(Object.assign(document.createElement("label"),{textContent:t}),row);
  }
  const col=Object.assign(document.createElement("input"),{type:"color",value:o.color}); col.oninput=()=>{o.color=col.value;render();}; col.onchange=()=>commit();
  const sp=Object.assign(document.createElement("input"),{type:"checkbox",checked:o.spin}); sp.onchange=()=>{o.spin=sp.checked;commit();};
  const l2=document.createElement("label"); l2.className="switch"; l2.append(sp," Spin in Play mode");
  b.append(Object.assign(document.createElement("label"),{textContent:"Color"}),col,l2);
}
function drawConsole(){
  const f=$("#conFilter").value, out=$("#conOut"); out.replaceChildren();
  S.logs.filter(l=>f==="all"||l.level===f).slice(-200).forEach(l=>{const d=document.createElement("div");d.className="log "+l.level;d.textContent=`[${l.t}] ${l.level.toUpperCase()}  ${l.msg}`;out.append(d);});
  out.scrollTop=out.scrollHeight;
}
function refresh(){
  drawHier(); drawInsp(); render();
  $("#edUndo").disabled=S.hi<=0; $("#edRedo").disabled=S.hi>=S.hist.length-1;
  const sc=$("#edScene"); sc.replaceChildren(...Object.keys(S.scenes).map(n=>new Option(n,n))); sc.value=S.scene;
}
function add(type){
  if(S.playing) return log("warn","Stop Play mode before editing the scene.");
  const o=mk(type,S.objs.filter(x=>x.type===type).length+1); S.objs.push(o); S.sel=o.id; log("info",`Added ${o.name}`); commit();
}
function del(){
  if(S.playing||!S.sel) return; const o=S.objs.find(x=>x.id===S.sel);
  S.objs=S.objs.filter(x=>x.id!==S.sel); S.sel=null; log("info",`Deleted ${o.name}`); commit();
}
function dup(){
  const o=S.objs.find(x=>x.id===S.sel); if(!o||S.playing) return;
  const c=JSON.parse(JSON.stringify(o)); c.id=mk("cube",0).id; c.name=o.name+" copy"; c.pos[0]+=1.5; S.objs.push(c); S.sel=c.id; commit();
}
function play(){
  if(S.playing){ if(S.paused){S.paused=false;S.last=performance.now();loop();} return; }
  S.before=snap(); S.playing=true; S.paused=false; S.last=performance.now(); log("info","Play mode started"); status("Playing"); loop();
}
function loop(){ if(!S.raf) S.raf=requestAnimationFrame(tick); }   // single guarded chain: pause/resume can't stack loops
function tick(){
  S.raf=0; if(!S.playing||S.paused) return;
  const now=performance.now(), dt=Math.min(.1,(now-S.last)/1000); S.last=now;
  S.objs.forEach(o=>{ if(o.spin) o.rot[1]=(o.rot[1]+60*dt)%360; });
  redraw(); loop();
}
function stop(){
  if(!S.playing) return; S.playing=false; S.paused=false; S.objs=JSON.parse(S.before); log("info","Play mode stopped; scene restored"); status("Saved"); refresh();
}
const TYPES=["cube","sphere","plane"];
const vec=(a,d)=>d.map((x,i)=>{const v=Array.isArray(a)?a[i]:NaN;return typeof v==="number"&&Number.isFinite(v)?Math.max(-1e4,Math.min(1e4,v)):x;});
function cleanObj(o,i,seen){          // never trust saved or imported data
  if(!o||typeof o!=="object"||!TYPES.includes(o.type)) return null;
  const id=typeof o.id==="string"&&/^[\w-]{1,40}$/.test(o.id)&&!seen.has(o.id)?o.id:"i"+i+Math.random().toString(36).slice(2,8); seen.add(id);
  return {id,name:String(o.name??o.type).slice(0,60)||o.type,type:o.type,pos:vec(o.pos,[0,0,0]),rot:vec(o.rot,[0,0,0]),
    scale:vec(o.scale,[1,1,1]).map(v=>Math.abs(v)<.01?.01:v),color:typeof o.color==="string"&&/^#[0-9a-f]{6}$/i.test(o.color)?o.color:"#8b5cf6",
    visible:o.visible!==false,spin:o.spin===true};
}
function cleanState(d){
  if(!d||typeof d!=="object"||!d.scenes||typeof d.scenes!=="object") throw new Error("not a HYPERBLOCK project file");
  const scenes={}, keyOf=new Map(); let n=0;
  for(const [name,list] of Object.entries(d.scenes)){
    if(!Array.isArray(list)||name==="__proto__"||++n>50) continue;
    let key=name.trim().slice(0,40)||"Scene"; for(let k=2;Object.hasOwn(scenes,key);k++) key=key.slice(0,36)+" ("+k+")";   // never overwrite a scene
    keyOf.set(name,key);   // remember where each original name ended up
    const seen=new Set(); scenes[key]=list.slice(0,2000).map((o,i)=>cleanObj(o,i,seen)).filter(Boolean);
  }
  const names=Object.keys(scenes); if(!names.length) throw new Error("no valid scenes found in file");
  return {project:String(d.project||"Untitled Project").slice(0,80),scenes,scene:keyOf.get(d.scene)??names[0]};
}
function loadState(d){                 // atomic: throws before touching the current scene
  const c=cleanState(d); S.project=c.project; S.scenes=c.scenes; S.scene=c.scene; S.objs=S.scenes[S.scene];
  S.sel=null; S.hist=[snap()]; S.hi=0; $("#edProject").value=S.project;
}

export function initStudio(){
  if(S){ requestAnimationFrame(()=>{fit();render();}); return; }
  const root=$("#studioRoot"); if(!root) throw new Error("Studio markup missing");
  S={objs:[],sel:null,project:"Untitled Project",scene:"Scene 1",scenes:{},hist:[],hi:0,logs:[],playing:false,paused:false,hits:[],
     cam:{yaw:.8,pitch:.45,dist:12,target:[0,.5,0]}};
  let restored=false;
  try{ const raw=localStorage.getItem(KEY); if(raw){ loadState(JSON.parse(raw)); restored=true; } }catch(e){ log("warn","Could not read saved project; starting fresh."); }
  if(!restored){ S.scenes={"Scene 1":[]}; S.objs=S.scenes["Scene 1"]; S.objs.push(mk("plane",1),mk("cube",1)); S.hist=[snap()]; $("#edProject").value=S.project; }
  log("info",restored?"Restored saved project":"New project created");

  const cv=$("#edCanvas");
  window.fit=()=>{const d=window.devicePixelRatio||1; cv.width=cv.clientWidth*d; cv.height=cv.clientHeight*d;};
  const fit=window.fit; new ResizeObserver(()=>{fit();S.view?.resize();render();}).observe(cv.parentElement); fit();

  const ptrs=new Map(); let moved=0, pinch=0;
  cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,e);moved=0;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}});
  cv.addEventListener("pointermove",e=>{
    const p=ptrs.get(e.pointerId); if(!p) return;
    const dx=e.clientX-p.clientX, dy=e.clientY-p.clientY; ptrs.set(e.pointerId,e); moved+=Math.abs(dx)+Math.abs(dy);
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);S.cam.dist=Math.min(60,Math.max(3,S.cam.dist*pinch/d));pinch=d;}
    else if(e.shiftKey||e.buttons===2||e.buttons===4){const k=S.cam.dist*.0018,y=S.cam.yaw;S.cam.target[0]-=(Math.cos(y)*dx)*k;S.cam.target[2]+=(Math.sin(y)*dx)*k;S.cam.target[1]+=dy*k;}
    else{S.cam.yaw-=dx*.008;S.cam.pitch=Math.max(-1.4,Math.min(1.4,S.cam.pitch+dy*.008));}
    render();
  });
  cv.addEventListener("pointerup",e=>{
    ptrs.delete(e.pointerId);
    if(moved<5&&ptrs.size===0){const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      const hit=[...S.hits].reverse().find(f=>inPoly(x,y,f.pr)); S.sel=hit?hit.o.id:null; refresh();}
  });
  cv.addEventListener("pointercancel",e=>ptrs.delete(e.pointerId));
  cv.addEventListener("contextmenu",e=>e.preventDefault());
  cv.addEventListener("wheel",e=>{e.preventDefault();S.cam.dist=Math.min(60,Math.max(3,S.cam.dist*(1+Math.sign(e.deltaY)*.1)));render();},{passive:false});

  $("#edAdd").addEventListener("click",e=>{const t=e.target.dataset.add; if(t) add(t);});
  $("#edDel").onclick=del; $("#edDup").onclick=dup;
  $("#edUndo").onclick=()=>S.hi>0&&!S.playing&&restore(S.hi-1); $("#edRedo").onclick=()=>S.hi<S.hist.length-1&&!S.playing&&restore(S.hi+1);
  $("#edPlay").onclick=play; $("#edPause").onclick=()=>{if(S.playing){S.paused=!S.paused;if(!S.paused){S.last=performance.now();loop();}render();}}; $("#edStop").onclick=stop;
  $("#edFocus").onclick=()=>{const o=S.objs.find(x=>x.id===S.sel); S.cam.target=o?[...o.pos]:[0,.5,0]; S.view?.focus(S.cam.target); render();};
  $("#edProject").onchange=e=>{S.project=e.target.value||"Untitled Project";persist();};
  $("#edScene").onchange=e=>{if(S.playing)return;S.scenes[S.scene]=S.objs;S.scene=e.target.value;S.objs=S.scenes[S.scene];S.sel=null;S.hist=[snap()];S.hi=0;persist();refresh();};
  $("#edNewScene").onclick=()=>{let n=prompt("New scene name",`Scene ${Object.keys(S.scenes).length+1}`); if(!n||!n.trim()||S.playing) return; n=n.trim().slice(0,40); if(Object.hasOwn(S.scenes,n)||n==="__proto__") return;
    S.scenes[S.scene]=S.objs; S.scene=n; S.scenes[n]=S.objs=[mk("plane",1)]; S.sel=null; S.hist=[snap()]; S.hi=0; persist(); refresh();};
  $("#edRenameScene").onclick=()=>{let n=prompt("Rename scene",S.scene); if(!n||!n.trim()||S.playing) return; n=n.trim().slice(0,40); if(Object.hasOwn(S.scenes,n)||n==="__proto__") return; S.scenes[n]=S.objs; delete S.scenes[S.scene]; S.scene=n; persist(); refresh();};
  $("#edExport").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({project:S.project,scene:S.scene,scenes:{...S.scenes,[S.scene]:S.objs}},null,2)],{type:"application/json"}));a.download=S.project.replace(/\W+/g,"_")+".hyperblock.json";a.click();log("info","Exported project");};
  $("#edImport").onchange=async e=>{const f=e.target.files[0]; if(!f) return;
    try{if(f.size>5e6) throw new Error("file is larger than 5 MB"); const d=JSON.parse(await f.text()); if(!d.scenes||typeof d.scenes!=="object") throw new Error("not a HYPERBLOCK project file"); loadState(d); persist(); refresh(); log("info",`Imported ${f.name}`);}
    catch(err){log("error","Import failed: "+err.message);} e.target.value="";};
  $("#conFilter").onchange=drawConsole; $("#conClear").onclick=()=>{S.logs=[];drawConsole();};
  window.addEventListener("error",e=>S&&log("error",e.message));

  document.addEventListener("keydown",e=>{
    if(!$("#studio").classList.contains("active")||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const m=e.ctrlKey||e.metaKey, k=e.key.toLowerCase();
    if(k===" "&&/^(BUTTON|A)$/.test(e.target.tagName)) return;   // let Space activate the focused button
    if(k==="delete"||k==="backspace"){e.preventDefault();del();}
    else if(m&&k==="z"){e.preventDefault();(e.shiftKey?$("#edRedo"):$("#edUndo")).click();}
    else if(m&&k==="y"){e.preventDefault();$("#edRedo").click();}
    else if(m&&k==="d"){e.preventDefault();dup();}
    else if(k==="f"){$("#edFocus").click();}
    else if(S.view&&"wer".includes(k)&&k.length===1&&!m){$(`[data-mode=${{w:"translate",e:"rotate",r:"scale"}[k]}]`).click();}
    else if(k===" "){e.preventDefault();S.playing?stop():play();}
  });
  // Resizable side panels
  document.querySelectorAll(".rz").forEach(h=>h.addEventListener("pointerdown",e=>{
    h.setPointerCapture(e.pointerId); const main=$(".ed-main"), left=h.dataset.side==="l";
    const mv=ev=>{const r=main.getBoundingClientRect(); const v=left?ev.clientX-r.left:r.right-ev.clientX; main.style.setProperty(left?"--lw":"--rw",Math.max(150,Math.min(460,v))+"px");};
    h.addEventListener("pointermove",mv); h.addEventListener("pointerup",()=>h.removeEventListener("pointermove",mv),{once:true});
  }));
  $("#edMode").onclick=e=>{const m=e.target.dataset.mode; if(m&&S.view){S.view.setMode(m);document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b===e.target));}};
  drawConsole(); refresh(); status(restored?"Saved":"New project");
  upgradeToWebGL();
}

// Try to replace the canvas viewport with a Three.js/WebGL one. Any failure keeps the canvas viewport.
async function upgradeToWebGL(){
  try{
    const m = await Promise.race([import("./view3d.js"), new Promise((_, rej) => setTimeout(() => rej(new Error("Three.js took too long to load")), 8000))]);
    S.view = m.createView($(".ed-view"), S, {
      select:id => { S.sel = id; refresh(); },
      live:() => { drawInsp(); status("Unsaved"); },
      commit,
      lost:() => { S.view = null; $("#edCanvas").style.display = ""; document.querySelectorAll("[data-mode]").forEach(b => b.hidden = true);
        log("warn", "WebGL context lost; switched to the canvas viewport."); window.fit(); render(); }
    });
    $("#edCanvas").style.display = "none";
    document.querySelectorAll("[data-mode]").forEach(b => b.hidden = false);
    log("info", "WebGL viewport active (Three.js r160): gizmos W=Move E=Rotate R=Scale");
    refresh();
  }catch(e){
    S.view = null;
    log("warn", `WebGL viewport unavailable (${e.message}). Using the canvas viewport; editing still works.`);
  }
}
