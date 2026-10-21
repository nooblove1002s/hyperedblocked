// Hyperblock in-page web search and embedded browser workspace.
// The optional Worker URL enables the restricted proxy for allowlisted hosts.
// GitHub Pages alone cannot run a proxy; configure the Worker URL in index.html.
const $ = (selector) => document.querySelector(selector);
export function setupWebSearch(){
  const form=$("#webSearchForm"), input=$("#webSearchQuery"), frame=$("#webBrowserFrame");
  const status=$("#webBrowserStatus"), openTab=$("#webBrowserNewTab"), home=$("#webBrowserHome"), engine=$("#webSearchEngine");
  if(!form || !input || !frame || !status) return;
  const configuredProxy = document.querySelector('meta[name="hyperblock-proxy-url"]')?.content?.trim().replace(/\/$/, "") || "";
  let currentUrl = "https://www.google.com/webhp?igu=1";
  const proxyableHosts = new Set(["www.google.com","google.com","duckduckgo.com","html.duckduckgo.com","www.wikipedia.org","en.wikipedia.org","wikipedia.org","poki.com","www.poki.com","crazygames.com","www.crazygames.com"]);
  const routeUrl = (url) => {
    if(!configuredProxy) return url;
    try {
      const parsed = new URL(url);
      if(parsed.protocol === "https:" && proxyableHosts.has(parsed.hostname.toLowerCase())) {
        return configuredProxy + "/proxy?url=" + encodeURIComponent(parsed.href);
      }
    } catch {}
    return url;
  };
  const setPage=(url,label)=>{
    currentUrl=url;
    status.textContent=label || "Loading page…";
    frame.src=routeUrl(url);
  };
  if(configuredProxy){
    fetch(configuredProxy + "/health", {mode:"cors"})
      .then(response=>response.ok ? response.json() : Promise.reject(new Error("health check failed")))
      .then(data=>{ status.textContent=data?.active ? "Proxy connected · restricted destinations" : "Proxy status unavailable"; })
      .catch(()=>{ status.textContent="Proxy unavailable · opening supported pages directly"; });
  } else {
    status.textContent="Proxy not configured · browser uses direct connections";
  }
  setPage(currentUrl, configuredProxy ? "Connecting to Hyperblock proxy…" : "Google search workspace ready");
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const query=input.value.trim();
    if(!query) return;
    const isUrl=/^(https?:\/\/|[\w-]+\.[a-z]{2,})(\/|$)/i.test(query);
    const selected=engine?.value || "google";
    const url=isUrl
      ? (/^https?:\/\//i.test(query)?query:"https://"+query)
      : selected === "duckduckgo"
        ? "https://duckduckgo.com/?q="+encodeURIComponent(query)+"&ia=web"
        : "https://www.google.com/search?igu=1&q="+encodeURIComponent(query);
    let label=isUrl?"Opening website…":`Opening ${selected === "duckduckgo" ? "DuckDuckGo" : "Google"} results…`;
    try {
      const parsed = new URL(url);
      if(configuredProxy && proxyableHosts.has(parsed.hostname.toLowerCase())) label = "Loading through Hyperblock proxy…";
      else if(configuredProxy) label = "Destination not allowlisted · opening directly";
    } catch {}
    setPage(url,label);
  });
  frame.addEventListener("load",()=>{
    status.textContent="Page response received — sites may still block embedding or require a direct tab.";
  });
  openTab.addEventListener("click",()=>window.open(routeUrl(currentUrl),"_blank","noopener,noreferrer"));
  home.addEventListener("click",()=>{input.value="";setPage("https://www.google.com/webhp?igu=1","Returning to browser home…");});
}
