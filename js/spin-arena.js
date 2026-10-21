const $ = (s, root=document) => root.querySelector(s);

export function initSpinArena(){
  const canvas=$("#spinArenaCanvas");
  if(!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready="1";
  const ctx=canvas.getContext("2d");
  if(!ctx) return;
  const drawCanvas=$("#weaponDrawCanvas");
  const dctx=drawCanvas?.getContext("2d");
  const scriptBox=$("#weaponScript");
  const status=$("#spinStatus");
  const W=960,H=520;
  let fighters=[], raf=0, running=false, last=0, elapsed=0, round=0, winner="";
  let weaponPoints=[];
  const colors=["#28d7f2","#ff9c45","#bd83ff","#9df36a","#ff668b","#ffe66b"];
  const savedKey="hyperblock-spin-arena-weapon-v1";
  const savedScriptKey="hyperblock-spin-arena-script-v1";
  const savedPointsKey="hyperblock-spin-arena-drawing-v1";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const defaultWeapon={name:"Orbit Blade",orbit:39,speed:4.6,damage:13,length:29,color:"#20d7ee",style:"blade"};
  let weapon={...defaultWeapon,...read(savedKey,{})};
  if(!scriptBox.value) scriptBox.value=localStorage.getItem(savedScriptKey)||"orbit 39\nspeed 4.6\ndamage 13\nlength 29\ncolor #20d7ee\nshape blade";
  const parseScript=()=>{
    const out={...defaultWeapon,...weapon};
    const lines=(scriptBox.value||"").split(/\n|;/).map(s=>s.trim()).filter(Boolean);
    for(const line of lines){
      const m=line.match(/^(orbit|speed|damage|length|color|shape)\s*(?:=|\s)\s*(.+)$/i);
      if(!m) continue;
      const key=m[1].toLowerCase(), val=m[2].trim();
      if(key==="color" && /^#[0-9a-f]{6}$/i.test(val)) out.color=val;
      else if(key==="shape" && ["blade","orb","hammer","star"].includes(val.toLowerCase())) out.style=val.toLowerCase();
      else if(["orbit","speed","damage","length"].includes(key) && Number.isFinite(Number(val))){
        const limits={orbit:[18,80],speed:[0.8,12],damage:[4,35],length:[12,48]};
        out[key]=clamp(Number(val),...limits[key]);
      }
    }
    out.orbit=clamp(Number(out.orbit)||39,18,80);
    out.speed=clamp(Number(out.speed)||4.6,.8,12);
    out.damage=clamp(Number(out.damage)||13,4,35);
    out.length=clamp(Number(out.length)||29,12,48);
    return out;
  };
  function readDrawing(){
    const points=read(savedPointsKey,[]);
    return Array.isArray(points)?points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,120):[];
  }
  weaponPoints=readDrawing();
  function paintWeaponPreview(){
    if(!dctx||!drawCanvas)return;
    const w=drawCanvas.width,h=drawCanvas.height;
    dctx.clearRect(0,0,w,h);dctx.fillStyle="#071522";dctx.fillRect(0,0,w,h);
    dctx.strokeStyle="#ffffff12";dctx.lineWidth=1;
    for(let x=0;x<w;x+=20){dctx.beginPath();dctx.moveTo(x,0);dctx.lineTo(x,h);dctx.stroke()}
    for(let y=0;y<h;y+=20){dctx.beginPath();dctx.moveTo(0,y);dctx.lineTo(w,y);dctx.stroke()}
    if(weaponPoints.length>1){
      dctx.strokeStyle=weapon.color;dctx.lineWidth=5;dctx.lineCap="round";dctx.lineJoin="round";dctx.beginPath();
      weaponPoints.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?dctx.lineTo(x,y):dctx.moveTo(x,y)});dctx.stroke();
    }else{
      dctx.strokeStyle=weapon.color;dctx.lineWidth=4;dctx.beginPath();dctx.moveTo(28,h/2);dctx.lineTo(w-28,h/2);dctx.stroke();
      dctx.fillStyle=weapon.color;dctx.beginPath();dctx.moveTo(w-35,h/2-12);dctx.lineTo(w-13,h/2);dctx.lineTo(w-35,h/2+12);dctx.closePath();dctx.fill();
    }
  }
  function newRound(){
    cancelAnimationFrame(raf);running=true;last=0;elapsed=0;winner="";
    const custom=parseScript();weapon=custom;
    write(savedKey,weapon);try{localStorage.setItem(savedScriptKey,scriptBox.value)}catch{}
    const names=["YOU","BOT-1","BOT-2","BOT-3","BOT-4","BOT-5"];
    fighters=names.map((name,i)=>{
      const angle=(Math.PI*2*i/names.length)-Math.PI/2;
      return {name,x:W/2+Math.cos(angle)*155,y:H/2+Math.sin(angle)*155,r:i===0?21:19,hp:100,maxHp:100,color:colors[i],angle:Math.random()*6.28,orbit:i===0?custom.orbit:25+Math.random()*22,speed:i===0?custom.speed:2.5+Math.random()*2,damage:i===0?custom.damage:8+Math.random()*8,length:i===0?custom.length:20+Math.random()*17,style:i===0?custom.style:["blade","orb","hammer","star"][i%4],cool:0,stun:0,alive:true,dx:0,dy:0};
    });
    round++;$("#spinRound").textContent=round;$("#spinAlive").textContent=fighters.length;
    status.textContent="Battle started! Fighters move automatically; last circle standing wins.";
    loop(0);
  }
  function drawWeapon(f){
    const a=f.angle, ox=f.x+Math.cos(a)*f.orbit, oy=f.y+Math.sin(a)*f.orbit;
    ctx.save();ctx.translate(ox,oy);ctx.rotate(a+Math.PI/2);ctx.fillStyle=f.color;ctx.strokeStyle="#ffffffcc";ctx.lineWidth=1.5;
    const len=f.length;
    if(f.style==="orb"){ctx.beginPath();ctx.arc(0,0,Math.max(8,len*.42),0,Math.PI*2);ctx.fill();ctx.stroke()}
    else if(f.style==="hammer"){ctx.fillRect(-5,-len/2,10,len*.65);ctx.fillRect(-len*.65,-len/2-5,len*1.3,12)}
    else if(f.style==="star"){ctx.beginPath();for(let j=0;j<10;j++){const r=j%2?len*.28:len*.58,ang=j*Math.PI/5-Math.PI/2;const x=Math.cos(ang)*r,y=Math.sin(ang)*r;j?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke()}
    else{ctx.beginPath();ctx.moveTo(-5,7);ctx.lineTo(-3,-len*.35);ctx.lineTo(0,-len);ctx.lineTo(4,-len*.35);ctx.lineTo(5,7);ctx.closePath();ctx.fill();ctx.stroke()}
    ctx.restore();
    return {x:ox,y:oy,r:f.style==="orb"?len*.4:Math.max(7,len*.22)};
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle="#071522";ctx.fillRect(0,0,W,H);
    for(let x=0;x<W;x+=32){ctx.strokeStyle="#b8efff0a";ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=0;y<H;y+=32){ctx.strokeStyle="#b8efff0a";ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    ctx.strokeStyle="#20d7ee40";ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H/2,Math.min(W,H)*.43,0,Math.PI*2);ctx.stroke();
    fighters.forEach(f=>{
      if(!f.alive)return;
      const w=drawWeapon(f);
      ctx.fillStyle=f.color+"28";ctx.beginPath();ctx.arc(f.x,f.y,f.r+8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle="#061522";ctx.beginPath();ctx.arc(f.x-5,f.y-2,2.5,0,Math.PI*2);ctx.arc(f.x+5,f.y-2,2.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#071522";ctx.fillRect(f.x-22,f.y-f.r-13,44,5);ctx.fillStyle=f.hp>35?"#9df36a":"#ff668b";ctx.fillRect(f.x-22,f.y-f.r-13,44*clamp(f.hp/f.maxHp,0,1),5);
      ctx.font="bold 12px system-ui";ctx.textAlign="center";ctx.fillStyle="#effaff";ctx.fillText(f.name,f.x,f.y+f.r+15);
    });
    if(!running && winner){ctx.fillStyle="#061522cc";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#20d7ee";ctx.font="900 44px system-ui";ctx.fillText(winner+" WINS!",W/2,H/2-4);ctx.fillStyle="#effaff";ctx.font="18px system-ui";ctx.fillText("Press Start Battle for a rematch",W/2,H/2+32)}
    if(!running&&!winner){ctx.textAlign="center";ctx.fillStyle="#b6cedc";ctx.font="18px system-ui";ctx.fillText("Press Start Battle to watch the arena fight",W/2,H/2)}
  }
  function loop(ts){
    if(!running){draw();return}
    const dt=Math.min(.034,(ts-(last||ts))/1000);last=ts;elapsed+=dt;
    const alive=fighters.filter(f=>f.alive);
    if(alive.length<=1||elapsed>90){
      running=false;winner=alive[0]?.name||(fighters.sort((a,b)=>b.hp-a.hp)[0]?.name||"NO ONE");
      $("#spinAlive").textContent=alive.length;status.textContent=winner+" wins!";draw();return;
    }
    for(const f of alive){
      f.angle+=f.speed*dt;f.cool=Math.max(0,f.cool-dt);f.stun=Math.max(0,f.stun-dt);
      let target=null,best=Infinity;
      for(const other of alive){if(other===f)continue;const d=Math.hypot(other.x-f.x,other.y-f.y);if(d<best){best=d;target=other}}
      if(target&&f.stun<=0){
        const dx=target.x-f.x,dy=target.y-f.y,d=Math.hypot(dx,dy)||1;
        f.x+=dx/d*(26+f.speed*3)*dt;f.y+=dy/d*(26+f.speed*3)*dt;
        f.x=clamp(f.x,35,W-35);f.y=clamp(f.y,35,H-35);
      }
      const wx=f.x+Math.cos(f.angle)*f.orbit,wy=f.y+Math.sin(f.angle)*f.orbit;
      for(const other of alive){if(other===f||f.cool>0)continue;const ox=other.x+Math.cos(other.angle)*other.orbit,oy=other.y+Math.sin(other.angle)*other.orbit;const hitDist=(f.length+other.r)*.55;if(Math.hypot(wx-other.x,wy-other.y)<hitDist||Math.hypot(wx-ox,wy-oy)<(f.length+other.length)*.24){other.hp-=f.damage;other.stun=.12;f.cool=.18;if(other.hp<=0){other.hp=0;other.alive=false;$("#spinAlive").textContent=fighters.filter(q=>q.alive).length}break}}
    }
    draw();raf=requestAnimationFrame(loop);
  }
  function pointFromEvent(e,el){const r=el.getBoundingClientRect();return {x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)}}
  let drawing=false;
  if(drawCanvas){
    drawCanvas.addEventListener("pointerdown",e=>{drawing=true;drawCanvas.setPointerCapture?.(e.pointerId);weaponPoints=[pointFromEvent(e,drawCanvas)];paintWeaponPreview()});
    drawCanvas.addEventListener("pointermove",e=>{if(!drawing)return;if(weaponPoints.length<120)weaponPoints.push(pointFromEvent(e,drawCanvas));paintWeaponPreview()});
    ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>drawCanvas.addEventListener(ev,()=>{if(!drawing)return;drawing=false;write(savedPointsKey,weaponPoints)}));
  }
  $("#spinStart")?.addEventListener("click",newRound);
  $("#spinStop")?.addEventListener("click",()=>{running=false;cancelAnimationFrame(raf);status.textContent="Battle paused. Press Start Battle to begin a new round.";draw()});
  $("#weaponClear")?.addEventListener("click",()=>{weaponPoints=[];write(savedPointsKey,weaponPoints);paintWeaponPreview()});
  $("#weaponSave")?.addEventListener("click",()=>{weapon=parseScript();write(savedKey,weapon);write(savedPointsKey,weaponPoints);try{localStorage.setItem(savedScriptKey,scriptBox.value)}catch{}status.textContent="Weapon saved on this device. Start a new battle to use it.";paintWeaponPreview()});
  $("#weaponReset")?.addEventListener("click",()=>{scriptBox.value="orbit 39\nspeed 4.6\ndamage 13\nlength 29\ncolor #20d7ee\nshape blade";weapon={...defaultWeapon};weaponPoints=[];write(savedKey,weapon);write(savedPointsKey,weaponPoints);paintWeaponPreview();status.textContent="Weapon reset to Orbit Blade."});
  draw();
  paintWeaponPreview();
}
