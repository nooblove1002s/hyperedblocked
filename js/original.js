const $ = (s) => document.querySelector(s);
export function initOriginalGame(){
  const canvas = $("#originalGameCanvas");
  if(!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = "1";
  const ctx = canvas.getContext("2d");
  if(!ctx) return;
  const W = 900, H = 420, ground = 350;
  let raf = 0, running = false, paused = false, last = 0, score = 0, lives = 3, spawn = 0, orbSpawn = 0;
  let player, hazards = [], orbs = [];
  const keys = {left:false,right:false};
  const bestKey = "hyperblock-neon-block-dash-best";
  let best = 0; try{best = Number(localStorage.getItem(bestKey)||0)||0;}catch(e){}
  $("#obBest").textContent = best;
  function reset(){
    score = 0; lives = 3; spawn = 0; orbSpawn = 0; hazards = []; orbs = [];
    player = {x:100,y:ground-34,w:30,h:34,vy:0,onGround:true};
    $("#obScore").textContent=score;$("#obLives").textContent=lives;
    $("#obStatus").textContent="Go! Collect cyan orbs and avoid red blocks.";
  }
  function jump(){ if(running && !paused && player.onGround){player.vy=-520;player.onGround=false;} }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,"#0b2134");grad.addColorStop(1,"#06101a");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#16c8e81c";ctx.lineWidth=1;
    for(let x=0;x<W;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle="#102d40";ctx.fillRect(0,ground,W,H-ground);ctx.fillStyle="#16c8e8";ctx.fillRect(0,ground,W,3);
    hazards.forEach(h=>{ctx.fillStyle="#ff553d";ctx.shadowColor="#ff553d";ctx.shadowBlur=15;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.shadowBlur=0;});
    orbs.forEach(o=>{ctx.beginPath();ctx.fillStyle="#60f4ff";ctx.shadowColor="#60f4ff";ctx.shadowBlur=18;ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
    if(player){ctx.fillStyle="#ff8a45";ctx.shadowColor="#ff6938";ctx.shadowBlur=18;ctx.fillRect(player.x,player.y,player.w,player.h);ctx.shadowBlur=0;ctx.fillStyle="#fff4e8";ctx.fillRect(player.x+18,player.y+8,5,5);}
    ctx.fillStyle="#c8f8ff";ctx.font="bold 14px system-ui";ctx.fillText("NEON BLOCK DASH",18,28);
    if(!running || paused){ctx.fillStyle="#03101bdc";ctx.fillRect(0,0,W,H);ctx.textAlign="center";ctx.fillStyle="#eafaff";ctx.font="bold 34px system-ui";ctx.fillText(paused?"PAUSED":(lives<=0?"RUN OVER":"READY?"),W/2,H/2-5);ctx.font="16px system-ui";ctx.fillStyle="#9bd9e6";ctx.fillText(lives<=0?"Press Start to try again":"Press Start to begin",W/2,H/2+28);ctx.textAlign="left";}
  }
  function collide(a,b){return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;}
  function frame(t){
    raf=0;if(!running||paused){draw();return;}
    const dt=Math.min((t-last)/1000||0,0.035);last=t;
    const speed=250+Math.min(score*0.35,220);
    if(keys.left)player.x-=300*dt;if(keys.right)player.x+=300*dt;player.x=Math.max(0,Math.min(W-player.w,player.x));
    player.vy+=1350*dt;player.y+=player.vy*dt;if(player.y+player.h>=ground){player.y=ground-player.h;player.vy=0;player.onGround=true;}
    spawn-=dt;orbSpawn-=dt;
    if(spawn<=0){const h=24+Math.random()*24;hazards.push({x:W+20,y:ground-h,w:22+Math.random()*20,h});spawn=0.8+Math.random()*0.9-Math.min(score/1200,0.35);}
    if(orbSpawn<=0){orbs.push({x:W+15,y:ground-65-Math.random()*130,r:9,w:18,h:18});orbSpawn=0.65+Math.random()*0.8;}
    hazards.forEach(h=>h.x-=speed*dt);orbs.forEach(o=>o.x-=speed*dt);
    hazards=hazards.filter(h=>h.x+h.w>-5);orbs=orbs.filter(o=>o.x+o.r>-5);
    for(let i=hazards.length-1;i>=0;i--){if(collide(player,hazards[i])){hazards.splice(i,1);lives--;$("#obLives").textContent=lives;if(lives<=0){running=false;$("#obStatus").textContent="Run over! Final score: "+score+". Press Start to play again.";break;}}}
    for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];if(collide(player,{x:o.x-o.r,y:o.y-o.r,w:o.r*2,h:o.r*2})){orbs.splice(i,1);score+=10;$("#obScore").textContent=score;if(score>best){best=score;$("#obBest").textContent=best;try{localStorage.setItem(bestKey,String(best));}catch(e){}}}}
    if(running)draw();
    if(running)raf=requestAnimationFrame(frame);else draw();
  }
  function start(){cancelAnimationFrame(raf);reset();running=true;paused=false;last=performance.now();draw();raf=requestAnimationFrame(frame);}
  function pause(){if(!running)return;paused=!paused;if(paused){cancelAnimationFrame(raf);raf=0;draw();$("#obStatus").textContent="Paused. Tap Pause to continue.";}else{last=performance.now();raf=requestAnimationFrame(frame);$("#obStatus").textContent="Back in the game!";}}
  $("#obStart").addEventListener("click",start);$("#obPause").addEventListener("click",pause);
  window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight"," "].includes(e.key)&&$("#original").classList.contains("active"))e.preventDefault();if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=true;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=true;if(e.key===" "||e.key==="ArrowUp"||e.key.toLowerCase()==="w")jump();});
  window.addEventListener("keyup",e=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")keys.left=false;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")keys.right=false;});
  canvas.addEventListener("pointerdown",e=>{if(!running)start();else if(e.clientX<canvas.getBoundingClientRect().left+canvas.getBoundingClientRect().width/2)keys.left=true;else jump();});
  canvas.addEventListener("pointerup",()=>{keys.left=false;});
  document.querySelectorAll("[data-ob-control]").forEach(b=>{
    const c=b.dataset.obControl;
    const down=e=>{e.preventDefault();if(!running)start();if(c==="jump")jump();else keys[c]=true;};
    const up=e=>{e.preventDefault();if(c!=="jump")keys[c]=false;};
    b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up);
  });
  reset();draw();
}
