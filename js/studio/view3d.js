// WebGL viewport (Three.js, pinned in index.html import map). Loaded only when the Studio opens.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const D = Math.PI / 180;

export function createView(host, S, api){
  const renderer = new THREE.WebGLRenderer({antialias:true});
  if(!renderer.getContext()) throw new Error("WebGL not available");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const el = renderer.domElement;
  el.id = "edGL"; el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
  host.prepend(el);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0b12);
  const cam = new THREE.PerspectiveCamera(50, 1, .1, 500); cam.position.set(7, 5.5, 8);
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(5, 10, 3); scene.add(sun);
  scene.add(new THREE.GridHelper(20, 20, 0x2c3042, 0x1b1e2c));
  scene.add(new THREE.AxesHelper(4));

  const orbit = new OrbitControls(cam, el);          // 1-finger orbit, 2-finger pan/zoom on touch
  orbit.target.set(0, .5, 0); orbit.update();
  const tc = new TransformControls(cam, el); tc.setSize(1.3); scene.add(tc.getHelper ? tc.getHelper() : tc);  // r160: add the controls directly; r169+ use getHelper()
  const box = new THREE.BoxHelper(new THREE.Object3D(), 0x22d3ee); box.visible = false; scene.add(box);

  const geo = {cube:new THREE.BoxGeometry(2,2,2), sphere:new THREE.SphereGeometry(1,32,20), plane:new THREE.PlaneGeometry(6,6).rotateX(-Math.PI/2)};
  const meshes = new Map();
  let queued = false;
  const paint = () => { if(queued) return; queued = true; requestAnimationFrame(() => { queued = false; renderer.render(scene, cam); }); };

  function sync(){
    const ids = new Set();
    for(const o of S.objs){
      ids.add(o.id);
      let m = meshes.get(o.id);
      if(!m){
        m = new THREE.Mesh(geo[o.type], new THREE.MeshStandardMaterial({color:o.color, roughness:.6, side:o.type === "plane" ? THREE.DoubleSide : THREE.FrontSide}));
        m.userData.id = o.id; scene.add(m); meshes.set(o.id, m);
      }
      if(!(tc.dragging && S.sel === o.id)){     // don't fight the gizmo mid-drag
        m.position.fromArray(o.pos); m.rotation.set(o.rot[0]*D, o.rot[1]*D, o.rot[2]*D, "ZYX"); m.scale.fromArray(o.scale);
      }
      m.material.color.set(o.color); m.visible = o.visible;
    }
    for(const [id, m] of meshes) if(!ids.has(id)){ scene.remove(m); m.material.dispose(); meshes.delete(id); }
    const sel = S.playing ? null : meshes.get(S.sel);
    if(sel && sel.visible){ if(tc.object !== sel) tc.attach(sel); box.setFromObject(sel); box.visible = true; }
    else{ tc.detach(); box.visible = false; }
    const hud = host.querySelector("#edHud");
    if(hud) hud.textContent = `${S.playing ? (S.paused ? "⏸ Paused" : "▶ Playing") : "Edit mode"} • ${S.objs.length} objects • WebGL (Three.js r160)`;
    paint();
  }

  orbit.addEventListener("change", paint);
  tc.addEventListener("change", () => { if(tc.object) box.setFromObject(tc.object); paint(); });
  tc.addEventListener("dragging-changed", e => { orbit.enabled = !e.value; if(!e.value) api.commit(); });
  tc.addEventListener("objectChange", () => {          // gizmo -> data -> Inspector
    const m = tc.object, o = m && S.objs.find(x => x.id === m.userData.id); if(!o) return;
    o.pos = m.position.toArray(); o.rot = [m.rotation.x/D, m.rotation.y/D, m.rotation.z/D]; o.scale = m.scale.toArray();
    api.live();
  });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  el.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY, !!tc.axis]; });
  el.addEventListener("pointerup", e => {
    if(!down) return; const [x, y, onGizmo] = down; down = null;
    if(onGizmo || tc.dragging || Math.hypot(e.clientX - x, e.clientY - y) > 5) return;
    const r = el.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects([...meshes.values()].filter(m => m.visible), false)[0];
    api.select(hit ? hit.object.userData.id : null);
  });

  function resize(){
    const w = host.clientWidth, h = host.clientHeight; if(!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); paint();
  }
  function dispose(){
    tc.dispose(); orbit.dispose();
    meshes.forEach(m => m.material.dispose()); Object.values(geo).forEach(g => g.dispose());
    renderer.dispose(); el.remove();
  }
  el.addEventListener("webglcontextlost", e => { e.preventDefault(); dispose(); api.lost(); });
  resize();
  return {sync, resize, dispose,
    setMode:m => tc.setMode(m),
    focus:p => { orbit.target.set(p[0], p[1], p[2]); orbit.update(); paint(); }};
}
