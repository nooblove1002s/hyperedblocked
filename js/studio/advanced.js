import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let started = false;
let renderer, scene, camera, controls, raycaster, pointer, frame = 0;
let objects = [], selected = null, playing = false, serial = 0;
const $ = (id) => document.getElementById(id);
const STORE = "hyperblock-advanced-studio-v1";

function say(message){ const el=$("advMessage"); if(el) el.textContent=message; }
function geometryFor(type){
  if(type==="sphere") return new THREE.SphereGeometry(.7,32,20);
  if(type==="cone") return new THREE.ConeGeometry(.7,1.4,32);
  if(type==="plane") return new THREE.BoxGeometry(8,.12,8);
  return new THREE.BoxGeometry(1.2,1.2,1.2);
}
function labelFor(type){ return ({box:"Box",sphere:"Sphere",cone:"Cone",plane:"Ground"})[type]||"Object"; }
function addObject(type, data={}){
  const material = new THREE.MeshStandardMaterial({color:data.color|| (type==="plane"?"#29465a":"#16c8e8"),roughness:.58,metalness:.12});
  const mesh = new THREE.Mesh(geometryFor(type),material);
  mesh.userData.type=type;
  mesh.userData.label=data.name||labelFor(type)+" "+(++serial);
  mesh.position.fromArray(data.position||[0,type==="plane"?-0.12:0.7,0]);
  mesh.rotation.fromArray(data.rotation||[0,0,0]);
  mesh.scale.fromArray(data.scale||[1,1,1]);
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh); objects.push(mesh); choose(mesh); renderHierarchy();
  say("Added "+mesh.userData.label+".");
  return mesh;
}
function choose(mesh){
  selected=mesh||null;
  for(const obj of objects){
    const mat=obj.material;
    mat.emissive.set(obj===selected?0x073747:0x000000);
    mat.emissiveIntensity=obj===selected?.65:0;
  }
  renderHierarchy(); renderInspector();
}
function renderHierarchy(){
  const root=$("advHierarchy"); root.replaceChildren();
  $("advObjectCount").textContent=objects.length+" object"+(objects.length===1?"":"s");
  for(const obj of [...objects].reverse()){
    const row=document.createElement("button");
    row.type="button"; row.className="adv-object-row"+(obj===selected?" selected":"");
    const glyph=document.createElement("span"); glyph.textContent=({box:"▣",sphere:"●",cone:"▲",plane:"▱"})[obj.userData.type]||"◆";
    const name=document.createElement("span"); name.textContent=obj.userData.label;
    row.append(glyph,name); row.addEventListener("click",()=>choose(obj)); root.append(row);
  }
}
function addField(label,value,onChange,type="text"){
  const wrap=document.createElement("label"); wrap.className="adv-field-label"; wrap.textContent=label;
  const input=document.createElement("input"); input.type=type; input.value=value;
  input.addEventListener("change",()=>onChange(input.value)); wrap.append(input); $("advInspector").append(wrap);
}
function vectorField(label,vector,callback){
  const title=document.createElement("div"); title.className="adv-vector-label"; title.textContent=label; $("advInspector").append(title);
  const row=document.createElement("div"); row.className="adv-vector-row";
  ["X","Y","Z"].forEach((axis,i)=>{
    const input=document.createElement("input"); input.type="number"; input.step=".1"; input.value=Number(vector[i].toFixed(2)); input.setAttribute("aria-label",label+" "+axis);
    input.addEventListener("change",()=>{const n=Number(input.value);if(Number.isFinite(n)){callback(i,n);say(label+" updated.");}});
    row.append(input);
  });
  $("advInspector").append(row);
}
function renderInspector(){
  const root=$("advInspector"); root.replaceChildren();
  $("advSelectedName").textContent=selected?selected.userData.label:"Nothing selected";
  if(!selected){root.innerHTML='<p class="muted">Select an object to edit its properties.</p>';return;}
  addField("Object name",selected.userData.label,v=>{selected.userData.label=v.trim().slice(0,60)||labelFor(selected.userData.type);renderHierarchy();$("advSelectedName").textContent=selected.userData.label;say("Object renamed.");});
  vectorField("POSITION",selected.position,(i,v)=>{selected.position.setComponent(i,v);});
  vectorField("ROTATION (radians)",selected.rotation.toArray().slice(0,3),(i,v)=>{selected.rotation.setComponent(i,v);});
  vectorField("SCALE",selected.scale.toArray(),(i,v)=>{selected.scale.setComponent(i,Math.max(.05,Math.min(100,v)));});
  addField("Color", "#"+selected.material.color.getHexString(),v=>{if(/^#[0-9a-f]{6}$/i.test(v))selected.material.color.set(v);else say("Use a six-digit hex color like #16c8e8.");},"color");
}
function snapshot(){
  return {version:1,project:$("advProjectName").value.trim()||"My First Game",objects:objects.map(o=>({type:o.userData.type,name:o.userData.label,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3),scale:o.scale.toArray(),color:"#"+o.material.color.getHexString()}))};
}
function loadProject(data){
  if(!data||!Array.isArray(data.objects))throw new Error("This is not an Advanced Studio project file.");
  if(data.objects.length>500)throw new Error("Project has too many objects (maximum 500).");
  const allowed=["box","sphere","cone","plane"];
  objects.forEach(o=>{scene.remove(o);o.geometry.dispose();o.material.dispose();}); objects=[]; selected=null;
  $("advProjectName").value=String(data.project||"My First Game").slice(0,80);
  for(const item of data.objects){
    if(!item||!allowed.includes(item.type))continue;
    addObject(item.type,{name:String(item.name||labelFor(item.type)).slice(0,60),position:validVec(item.position,[0,.7,0]),rotation:validVec(item.rotation,[0,0,0]),scale:validScale(item.scale),color:/^#[0-9a-f]{6}$/i.test(item.color||"")?item.color:"#16c8e8"});
  }
  choose(null); say("Project loaded.");
}
function validVec(a,defaults){return Array.isArray(a)&&a.length>=3&&a.slice(0,3).every(Number.isFinite)?a.slice(0,3):defaults;}
function validScale(a){return validVec(a,[1,1,1]).map(v=>Math.max(.05,Math.min(100,v)));}
function save(){
  try{localStorage.setItem(STORE,JSON.stringify(snapshot()));say("Saved on this device. Use Export for a backup file.");}
  catch(e){say("Could not save in browser storage. Use Export to download your project.");}
}
function exportProject(){
  const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=(snapshot().project.replace(/[^a-z0-9_-]+/gi,"_")||"hyperblock-project")+".hyperblock.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);say("Project exported as JSON.");
}
function resize(){
  const host=$("advViewport"); if(!renderer||!host)return;
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function renderLoop(){
  frame=requestAnimationFrame(renderLoop);
  if(playing)objects.forEach(o=>{if(o!==selected&&o.userData.type!=="plane")o.rotation.y+=.006;});
  controls?.update();renderer?.render(scene,camera);
}
function pick(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(objects,false);
  choose(hits.length?hits[0].object:null);
}
export function initAdvancedStudio(){
  if(started){resize();return;} started=true;
  const host=$("advViewport"); if(!host)throw new Error("Advanced Studio viewport is missing.");
  scene=new THREE.Scene();scene.background=new THREE.Color("#07131f");
  scene.fog=new THREE.Fog("#07131f",18,45);
  camera=new THREE.PerspectiveCamera(55,1,.1,200);camera.position.set(7,6,9);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.5,0);controls.maxPolarAngle=Math.PI*.48;controls.minDistance=2;controls.maxDistance=50;
  scene.add(new THREE.HemisphereLight(0xb9eaff,0x102030,2));
  const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(5,10,6);sun.castShadow=true;scene.add(sun);
  const grid=new THREE.GridHelper(24,24,"#24738a","#173344");grid.position.y=-.19;scene.add(grid);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown",e=>{if(e.button===0)pick(e);});
  renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
  document.querySelectorAll("[data-adv-add]").forEach(btn=>btn.addEventListener("click",()=>{if(!playing)addObject(btn.dataset.advAdd);else say("Stop Preview before editing objects.");}));
  $("advDelete").addEventListener("click",()=>{if(!selected)return;if(playing){say("Stop Preview before deleting objects.");return;}scene.remove(selected);selected.geometry.dispose();selected.material.dispose();objects=objects.filter(o=>o!==selected);selected=null;renderHierarchy();renderInspector();say("Object deleted.");});
  $("advSave").addEventListener("click",save);
  $("advPlay").addEventListener("click",()=>{playing=!playing;$("advPlay").textContent=playing?"■ Stop Preview":"▶ Preview";$("advViewportStatus").textContent=playing?"PREVIEW MODE":"EDIT MODE";say(playing?"Preview running. Tap Stop Preview to edit again.":"Preview stopped.");});
  $("advExport").addEventListener("click",exportProject);
  $("advBackClassic").addEventListener("click",()=>document.querySelector('[data-page="studio"]')?.click());
  $("advImport").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5e6)throw new Error("File is larger than 5 MB.");loadProject(JSON.parse(await file.text()));}catch(err){say("Import failed: "+err.message);}e.target.value="";});
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  try{const saved=localStorage.getItem(STORE);if(saved)loadProject(JSON.parse(saved));else{addObject("plane",{name:"Ground"});addObject("box",{name:"Starter Box"});addObject("sphere",{name:"Sphere"});}}
  catch(e){addObject("plane",{name:"Ground"});addObject("box",{name:"Starter Box"});say("Started a fresh scene because the saved project could not be loaded.");}
  renderHierarchy();renderInspector();renderLoop();
}
