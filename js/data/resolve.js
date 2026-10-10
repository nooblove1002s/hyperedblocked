// Finds a data file under many names/folders/extensions (.json, .js, .mjs) and capitalizations.
const EXT = [".json", ".js", ".mjs"];
const pick = a => Array.isArray(a) ? a : (a && typeof a === "object"
  ? (Array.isArray(a.games) ? a.games : Array.isArray(a.default) ? a.default : Object.values(a).find(Array.isArray)) : null);

async function tryOne(url, timeout = 4000){
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  try{
    if(/\.json$/i.test(url)){
      const r = await fetch(url, {cache:"no-store", signal:ctrl.signal});
      return r.ok ? await r.json() : null;
    }
    const h = await fetch(url, {cache:"no-store", signal:ctrl.signal, method:"HEAD"});
    if(!h.ok) return null;
    const m = await import(new URL(url, document.baseURI).href);
    return m.default ?? m.games ?? m.GAMES ?? m.catalog ?? m ?? window.GAMES ?? window.games;
  }catch(e){ return null; }
  finally{ clearTimeout(t); }
}

export async function resolveData(names, {dirs = ["data/", "", "js/data/", "assets/data/"], validate} = {}){
  const variants = [...new Set(names.flatMap(n => [n, n.toLowerCase(), n[0].toUpperCase() + n.slice(1)]))];
  const tried = [];
  for(const d of dirs) for(const n of variants) for(const e of EXT){
    const url = d + n + e; tried.push(url);
    const arr = pick(await tryOne(url));
    if(arr && (!validate || validate(arr))) return {data: arr, url, tried};
  }
  throw new Error(`No usable game data file found (tried ${tried.length} paths, e.g. ${tried.slice(0,3).join(", ")}).`);
}
