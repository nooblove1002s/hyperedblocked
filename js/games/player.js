// Internal game player: iframe overlay with loading, timeout and error states.
const $ = (s) => document.querySelector(s);
let timer = null, current = null, wired = false;

function fail(msg){
  clearTimeout(timer);
  const s = $("#playerStatus");
  s.hidden = false; s.className = "player-status error";
  s.replaceChildren(Object.assign(document.createElement("p"), {textContent: msg}));
  const b = Object.assign(document.createElement("button"), {className:"primary", textContent:"Open in new tab"});
  b.onclick = () => current && window.open(current.url, "_blank", "noopener,noreferrer");
  s.append(b);
}

export function closePlayer(){
  clearTimeout(timer); current = null;
  const f = $("#playerFrame"); f.onload = null; f.src = "about:blank";
  $("#player").hidden = true;
  document.body.classList.remove("playing");
}

export function openPlayer(game){
  current = game;
  const f = $("#playerFrame"), s = $("#playerStatus");
  $("#playerTitle").textContent = game.name;
  $("#player").hidden = false; document.body.classList.add("playing");
  s.hidden = false; s.className = "player-status"; s.textContent = "Loading game…";
  let valid = false;
  try{ const u = new URL(game.embedUrl, location.href); valid = u.protocol === "https:" && u.origin !== location.origin; }catch(e){}
  if(!valid){ f.onload = null; f.src = "about:blank"; return fail("This game's embed link isn't valid (it must be an https link on another site)."); }
  f.onload = () => { clearTimeout(timer); s.hidden = true; };
  // Some sites block framing without firing an error, so a timeout is the fallback.
  timer = setTimeout(() => fail("This game didn't load. The provider may block embedding."), 12000);
  f.src = game.embedUrl;
}

export function setupPlayer(){
  if(wired) return; wired = true;
  $("#playerBack").addEventListener("click", closePlayer);
  $("#playerFull").addEventListener("click", () => $("#playerStage").requestFullscreen?.().catch(()=>{}));
  $("#playerExternal").addEventListener("click", () => current && window.open(current.url, "_blank", "noopener,noreferrer"));
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("#player").hidden) closePlayer(); });
}
