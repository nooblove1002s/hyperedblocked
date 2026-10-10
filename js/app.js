
import { resolveData } from "./data/resolve.js";
import { openPlayer, setupPlayer } from "./games/player.js";
// Safe localStorage: never throws (blocked storage, private mode, corrupt data)
const ls = {
  get(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } },
  set(key,val){ try{ localStorage.setItem(key,val); return true; }catch(e){ return false; } }
};
function readList(key){
  try{
    const v = JSON.parse(ls.get(key) || "[]");
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

const state = {
  page: "home",
  games: [],
  source: "All",
  favorites: readList("noobonly1-favorites"),
  recent: readList("noobonly1-recent"),
  customGames: readList("hyperblock-custom-games")
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function saveState(){
  ls.set("noobonly1-favorites", JSON.stringify(state.favorites));
  ls.set("noobonly1-recent", JSON.stringify(state.recent));
}

function showPage(page){
  state.page = page;
  if(page === "studio") import("./studio/studio.js").then(m => m.initStudio()).catch(err => {
    console.error(err); const r = document.getElementById("studioRoot");
    if(r) r.innerHTML = `<p class="empty-state">Studio failed to load: ${String(err.message).replace(/</g,"&lt;")}<br>The rest of HYPERBLOCK still works.</p>`;
  });
  $$(".page").forEach(el => el.classList.toggle("active", el.id === page));
  $$(".desktop-nav button").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $("#mobileMenu")?.classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}

function addRecent(game){
  state.recent = [game.id, ...state.recent.filter(id => id !== game.id)].slice(0,10);
  saveState();
  renderRecent();
}

function openGame(game){
  addRecent(game);
  if(game.embed === true && game.embedUrl){ openPlayer(game); return; }
  window.open(game.url, "_blank", "noopener,noreferrer");
}

function isFavorite(id){ return state.favorites.includes(id); }

function toggleFavorite(id){
  state.favorites = isFavorite(id)
    ? state.favorites.filter(x => x !== id)
    : [...state.favorites, id];
  saveState();
  renderGames();
  renderFeatured();
  renderRecent();
}

function makeCard(game){
  const card = document.createElement("article");
  card.className = "game-card";

  const fav = document.createElement("button");
  fav.className = "favorite-btn";
  fav.type = "button";
  fav.textContent = isFavorite(game.id) ? "★" : "☆";
  fav.title = "Favorite";
  fav.addEventListener("click", e => { e.stopPropagation(); toggleFavorite(game.id); });

  const icon = document.createElement("div");
  icon.className = "game-icon";
  icon.textContent = game.icon || "🎮";

  const title = document.createElement("h3");
  title.textContent = game.name;

  const source = document.createElement("div");
  source.className = "game-source";
  source.textContent = `Source: ${game.source}`;
  const badge = document.createElement("span");
  const inSite = game.embed === true && !!game.embedUrl;
  badge.className = "game-badge" + (inSite ? "" : " ext");
  badge.textContent = inSite ? "Plays here" : "External";
  source.append(badge);

  const category = document.createElement("p");
  category.textContent = game.category;

  const play = document.createElement("button");
  play.className = "play-btn";
  play.type = "button";
  play.textContent = "PLAY";
  play.addEventListener("click", () => openGame(game));

  card.append(fav, icon, title, source, category, play);
  return card;
}

function filteredGames(){
  const q = ($("#gameSearch")?.value || "").trim().toLowerCase();
  const cat = $("#categoryFilter")?.value || "All";
  return state.games.filter(g => {
    const text = `${g.name} ${g.category} ${g.source}`.toLowerCase();
    return (!q || text.includes(q))
      && (cat === "All" || g.category === cat)
      && (state.source === "All" || g.source === state.source)
      && (!$("#favoritesOnly")?.dataset.active || isFavorite(g.id));
  });
}

function renderGames(){
  const grid = $("#gameGrid");
  if(!grid) return;
  grid.replaceChildren();
  const list = filteredGames();
  if(!list.length){
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "No games match your filters.";
    grid.append(p);
    return;
  }
  list.forEach(g => grid.append(makeCard(g)));
}

function renderFeatured(){
  const grid = $("#featuredGrid");
  if(!grid) return;
  grid.replaceChildren();
  state.games.filter(g => g.featured).slice(0,8).forEach(g => grid.append(makeCard(g)));
}

function renderRecent(){
  const grid = $("#recentGrid");
  if(!grid) return;
  grid.replaceChildren();
  const list = state.recent.map(id => state.games.find(g => g.id === id)).filter(Boolean);
  if(!list.length){
    grid.innerHTML = '<p class="empty-state">Play a game and it will appear here.</p>';
    return;
  }
  list.slice(0,8).forEach(g => grid.append(makeCard(g)));
}

function setupFilters(){
  const select = $("#categoryFilter");
  const cats = [...new Set(state.games.map(g => g.category))].sort();
  select.replaceChildren(new Option("All categories","All"));
  cats.forEach(c => select.append(new Option(c,c)));

  const sources = [...new Set(state.games.map(g => g.source))].sort();
  const bar = $("#sourceBar");
  bar.replaceChildren();
  ["All",...sources].forEach(src => {
    const b = document.createElement("button");
    b.className = "chip" + (src === "All" ? " active" : "");
    b.textContent = src;
    b.addEventListener("click", () => {
      state.source = src;
      $$(".chip").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderGames();
    });
    bar.append(b);
  });
}

const isUrl = (u, httpsOnly) => { try{ const p = new URL(u).protocol; return httpsOnly ? p === "https:" : (p === "https:" || p === "http:"); }catch(e){ return false; } };
function cleanGames(list){
  const seen = new Set(), out = [], skipped = [];
  for(const g of Array.isArray(list) ? list : []){
    const valid = g && typeof g === "object" && ["id","name","category","url"].every(k => typeof g[k] === "string" && g[k].trim()) && isUrl(g.url) && !seen.has(g.id);
    if(!valid){ skipped.push((g && g.name) || "(invalid entry)"); continue; }
    seen.add(g.id);
    if(g.embed === true && !(typeof g.embedUrl === "string" && isUrl(g.embedUrl, true) && new URL(g.embedUrl).origin !== location.origin)) g.embed = false;   // same-origin embeds are never allowed
    g.source = typeof g.source === "string" && g.source ? g.source : "Other";
    out.push(g);
  }
  return {out, skipped};
}

async function loadGames(){
  const found = await resolveData(["games","catalog","data"], {validate:a=>a.length>0&&a[0]&&a[0].name&&a[0].url});
  const {out:data, skipped} = cleanGames(found.data);
  if(skipped.length) console.warn(`Skipped ${skipped.length} invalid, duplicate or unsafe catalog entries:`, skipped);
  console.info("Game data loaded from", found.url);
  if(!data.length) throw new Error("The game catalog has no valid games");
  const custom = cleanGames(state.customGames).out;
  const baseIds = new Set(data.map(g => g.id));
  state.games = [...data, ...custom.filter(g => !baseIds.has(g.id))];
  setupFilters();
  renderGames();
  renderFeatured();
  renderRecent();
  $("#gameCount").textContent = state.games.length;
  $("#categoryCount").textContent = new Set(state.games.map(g => g.category)).size;
}

function setupNavigation(){
  $$("[data-page]").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
  $("#menuBtn")?.addEventListener("click", () => $("#mobileMenu")?.classList.toggle("open"));
}

function normalizeHttpUrl(value){
  let raw = String(value || "").trim();
  if(!raw) return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw;
  try{
    const u = new URL(raw);
    if((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname || u.username || u.password) return null;
    return u.href;
  }catch(e){ return null; }
}

function setupAddGame(){
  const form = $("#addGameForm");
  if(!form) return;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const message = $("#addGameMessage");
    const name = $("#newGameName").value.trim();
    const url = normalizeHttpUrl($("#newGameUrl").value);
    const rawEmbed = $("#newGameEmbedUrl").value.trim();
    const embedUrl = rawEmbed ? normalizeHttpUrl(rawEmbed) : url;
    const mode = $("#newGameMode").value;
    if(!name || !url){ message.textContent = "Enter a game name and a valid http(s) website URL."; message.className = "form-message error"; return; }
    if(rawEmbed && !embedUrl){ message.textContent = "The embed URL must be a valid http(s) URL."; message.className = "form-message error"; return; }
    const idBase = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48) || "custom-game";
    let id = idBase, n = 2;
    while(state.games.some(g => g.id === id)) id = `${idBase}-${n++}`;
    const category = $("#newGameCategory").value || "Other";
    const shouldTryEmbed = mode === "auto" && !!embedUrl;
    const canEmbed = shouldTryEmbed && embedUrl.startsWith("https:") && new URL(embedUrl).origin !== location.origin;
    const game = {id, name, url, category, icon:"🎮", source:"Added by you", embed:!!canEmbed, embedUrl:canEmbed ? embedUrl : "", custom:true};
    const nextCustomGames = [...state.customGames, game];
    const saved = ls.set("hyperblock-custom-games", JSON.stringify(nextCustomGames));
    state.customGames = nextCustomGames;
    state.games.push(game);
    setupFilters(); renderGames(); renderFeatured();
    $("#gameCount").textContent = state.games.length;
    $("#categoryCount").textContent = new Set(state.games.map(g => g.category)).size;
    if(saved){
      form.reset();
      message.textContent = canEmbed ? `Added and saved “${name}”. Hyperblock will try to embed it; some providers block embedding.` : `Added and saved “${name}” as an external game. To embed it, use a valid HTTPS URL on another site.`;
      message.className = "form-message success";
    }else{
      message.textContent = `Added “${name}” for this session only. Browser storage is unavailable or full, so it may disappear when you refresh. Copy the game URL before leaving this page.`;
      message.className = "form-message error";
    }
  });
}

function setupGameControls(){
  setupAddGame();
  $("#gameSearch")?.addEventListener("input", renderGames);
  $("#categoryFilter")?.addEventListener("change", renderGames);
  $("#randomGame")?.addEventListener("click", () => {
    if(!state.games.length) return;
    openGame(state.games[Math.floor(Math.random() * state.games.length)]);
  });
  $("#favoritesOnly")?.addEventListener("click", () => {
    const b = $("#favoritesOnly");
    b.dataset.active = b.dataset.active ? "" : "1";
    b.textContent = b.dataset.active ? "★ Favorites Only" : "☆ Favorites";
    renderGames();
  });
}

function setupStudio(){
  $$("[data-studio]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-studio]").forEach(x => x.classList.remove("active"));
    $$(".studio-panel").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    $(`#${btn.dataset.studio === "blocks" ? "blocksPanel" : "scenePanel"}`).classList.add("active");
  }));

  $$("[data-block]").forEach(btn => btn.addEventListener("click", () => {
    const block = document.createElement("div");
    block.className = "script-block";
    const names = {
      event:"🟨 WHEN GAME STARTS",
      move:"🟦 MOVE PLAYER",
      rotate:"🟪 ROTATE OBJECT",
      wait:"🟧 WAIT 1 SECOND",
      if:"🟥 IF / THEN",
      sound:"🟩 PLAY SOUND",
      score:"⭐ CHANGE SCORE",
      repeat:"🔁 REPEAT"
    };
    block.textContent = names[btn.dataset.block] || "BLOCK";
    $("#blockCanvas").querySelector(".empty-state")?.remove();
    $("#blockCanvas").append(block);
  }));

  $("#objectScale")?.addEventListener("input", e => {
    const n = Number(e.target.value);
    $("#sceneCube").style.width = `${100*n}px`;
    $("#sceneCube").style.height = `${100*n}px`;
  });

  $("#objectRotation")?.addEventListener("input", e => {
    $("#sceneCube").style.transform = `translate(-50%,-50%) rotateX(25deg) rotateY(${e.target.value}deg)`;
  });

  $("#objectName")?.addEventListener("input", e => {
    e.target.setAttribute("aria-label", `Object name: ${e.target.value}`);
  });

  $("#addCube")?.addEventListener("click", () => {
    const cube = $("#sceneCube").cloneNode(true);
    cube.style.left = `${35 + Math.random()*30}%`;
    cube.style.top = `${30 + Math.random()*35}%`;
    cube.style.transform = "translate(-50%,-50%) rotateX(25deg) rotateY(35deg) scale(.7)";
    $("#sceneView").append(cube);
  });

  $("#runScene")?.addEventListener("click", () => {
    const cube = $("#sceneCube");
    cube.animate([
      {transform:"translate(-50%,-50%) rotateX(25deg) rotateY(0deg) scale(1)"},
      {transform:"translate(-50%,-65%) rotateX(70deg) rotateY(360deg) scale(1.08)"},
      {transform:"translate(-50%,-50%) rotateX(25deg) rotateY(720deg) scale(1)"}
    ], {duration:900,easing:"ease-in-out"});
  });
}

function setupJS(){
  $("#runJS")?.addEventListener("click", () => {
    const output = $("#output");
    output.textContent = "";
    try{
      const logs = [];
      const fakeConsole = {log:(...a)=>logs.push(a.map(String).join(" ")),error:(...a)=>logs.push("ERROR: "+a.map(String).join(" "))};
      const fn = new Function("console", $("#code").value);
      fn(fakeConsole);
      if(logs.length) output.textContent = logs.join("\n");
      if(!output.textContent) output.textContent = "Code ran successfully.";
    }catch(err){
      output.textContent = `Error: ${err.message}`;
    }
  });
}

function setupSettings(){
  const accent = $("#accentColor");
  const background = $("#backgroundColor");
  const glow = $("#glowToggle");
  const motion = $("#motionToggle");
  const savedA = ls.get("noobonly1-accent");
  const savedB = ls.get("noobonly1-background");
  if(savedA){ accent.value=savedA; document.documentElement.style.setProperty("--accent",savedA); }
  if(savedB){ background.value=savedB; document.documentElement.style.setProperty("--bg",savedB); }
  accent?.addEventListener("input",()=>{document.documentElement.style.setProperty("--accent",accent.value);ls.set("noobonly1-accent",accent.value)});
  background?.addEventListener("input",()=>{document.documentElement.style.setProperty("--bg",background.value);ls.set("noobonly1-background",background.value)});
  glow?.addEventListener("change",()=>document.body.classList.toggle("no-glow",!glow.checked));
  motion?.addEventListener("change",()=>document.body.classList.toggle("no-motion",!motion.checked));

  const input = $("#quickExitUrl");
  const saved = ls.get("noobonly1-quick-exit") || "";
  if(input) input.value = saved;
  $("#quickExit")?.addEventListener("click",()=>{
    let url = input.value.trim();
    if(!url) return;
    if(!/^https?:\/\//i.test(url)) url = "https://" + url;
    ls.set("noobonly1-quick-exit",url);
    window.location.href = url;
  });
}

async function diagnostics(){
  const box = $("#diagnostics");
  box.replaceChildren();
  const checks = [
    ["index.html","document structure",!!document.querySelector("main")],
    ["styles.css","stylesheet loaded",document.styleSheets.length > 0],
    ["app.js","JavaScript running",true],
    ["games.json","game data loaded",Array.isArray(state.games) && state.games.length > 0],
    ["navigation","navigation buttons",$$("[data-page]").length >= 5],
    ["mobile","responsive viewport",window.innerWidth > 0]
  ];
  checks.forEach(([name,desc,ok])=>{
    const d=document.createElement("div");
    d.className="diag " + (ok?"ok":"bad");
    d.textContent=`${ok?"✓":"✕"} ${name} — ${desc}`;
    box.append(d);
  });
}

function startLoader(){
  const bar=$("#loaderBar"), text=$("#loaderText");
  let progress=0;
  const timer=setInterval(()=>{
    progress=Math.min(progress+8,92);
    bar.style.width=progress+"%";
    if(progress<30) text.textContent="Loading interface…";
    else if(progress<60) text.textContent="Loading game library…";
    else text.textContent="Checking portal files…";
  },80);
  window.__loaderTimer = timer;
  return ()=>{clearInterval(timer);bar.style.width="100%";text.textContent="Ready!";setTimeout(()=>$("#loader")?.classList.add("hidden"),250)};
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const finish = startLoader();
  let failure = null;

  // One broken UI feature must not block the rest of the portal
  for(const step of [setupPlayer, setupNavigation, setupGameControls, setupStudio, setupJS, setupSettings]){
    try{ step(); }catch(e){ console.error(`${step.name} failed:`, e); }
  }

  try{
    await loadGames();
    await diagnostics();
  }catch(error){
    failure = error;
    console.error(error);
    const grid = $("#gameGrid");
    if(grid) grid.innerHTML = `<p class="empty-state">⚠️ ${String(error.message).replace(/</g,"&lt;")}<br>Check that <b>data/games.json</b> exists and the site is running through GitHub Pages.</p>`;
  }finally{
    if(failure){
      const t = $("#loaderText"), b = $("#loaderBar");
      if(t) t.textContent = `Portal error: ${failure.message}`;
      if(b) b.style.width = "100%";
      clearInterval(window.__loaderTimer);
      setTimeout(()=>$("#loader")?.classList.add("hidden"), 900);
    }else{
      finish();
    }
    window.__noobonly1Ready = true;
  }
});

// Opt-in Google-style prank Easter egg: animation stays inside the page and has a clear stop.
function setupGooglePrank(){
  const trigger = document.getElementById('fakeGoogleTrigger');
  const overlay = document.getElementById('prankOverlay');
  const stop = document.getElementById('prankStop');
  const soundButton = document.getElementById('prankSound');
  if(!trigger || !overlay || !stop || !soundButton) return;
  let audioCtx = null, soundTimer = null, soundOn = false;
  function stopSound(){
    soundOn = false;
    if(soundTimer) clearInterval(soundTimer);
    soundTimer = null;
    if(audioCtx){ audioCtx.close().catch(()=>{}); audioCtx = null; }
    soundButton.textContent = '🔊 SOUND: OFF — TAP TO PLAY';
  }
  function closePrank(){ stopSound(); overlay.hidden = true; trigger.focus(); }
  trigger.addEventListener('click',()=>{ overlay.hidden = false; stopSound(); stop.focus(); });
  stop.addEventListener('click',closePrank);
  soundButton.addEventListener('click',()=>{
    if(soundOn){ stopSound(); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if(!AudioContext){ soundButton.textContent='Audio is not supported in this browser'; return; }
    audioCtx = new AudioContext(); soundOn = true;
    soundButton.textContent = '🔇 STOP SOUND';
    const beep = ()=>{
      if(!audioCtx || audioCtx.state === 'closed') return;
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'square'; osc.frequency.value = 520 + Math.random()*1000;
      gain.gain.value = 0.12; // deliberately capped; browser/system volume remains in control
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    };
    beep(); soundTimer = setInterval(beep, 180);
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !overlay.hidden) closePrank(); });
}
setupGooglePrank();
