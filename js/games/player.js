
// Internal game player: iframe overlay with loading, timeout and error states.
const $ = (s) => document.querySelector(s);
let timer = null, current = null, wired = false;

function showStatus(msg, isError = false){
  const s = $("#playerStatus");
  s.hidden = false;
  s.className = isError ? "player-status error" : "player-status";
  s.replaceChildren(Object.assign(document.createElement("p"), {textContent: msg}));
  // Browsers cannot reliably reveal whether a cross-origin iframe was blocked.
  // Keep an explicit external fallback available even after the iframe fires load.
  const b = Object.assign(document.createElement("button"), {
    className: "primary",
    textContent: "Open game in new tab"
  });
  b.type = "button";
  b.addEventListener("click", () => {
    if(current) window.open(current.url, "_blank", "noopener,noreferrer");
  });
  s.append(b);
}

function fail(msg){
  clearTimeout(timer);
  showStatus(msg, true);
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
  f.onload = () => {
    clearTimeout(timer);
    // A cross-origin iframe load event does not prove the game rendered.
    // Keep the external fallback visible in case framing was blocked.
    showStatus("If the game area is blank or stuck, open it in a new tab.");
  };
  // Some sites block framing without firing an error, so a timeout is an extra hint.
  timer = setTimeout(() => fail("This game is taking a while. The provider may block embedding."), 12000);
  f.src = game.embedUrl;
}

export function setupPlayer(){
  if(wired) return; wired = true;
  $("#playerBack").addEventListener("click", closePlayer);
  $("#playerFull").addEventListener("click", () => $("#playerStage").requestFullscreen?.().catch(()=>{}));
  $("#playerExternal").addEventListener("click", () => current && window.open(current.url, "_blank", "noopener,noreferrer"));
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("#player").hidden) closePlayer(); });
}
