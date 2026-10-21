// Hyperblock in-page web search and embedded browser workspace.
// Google may refuse to render in an iframe; never pretend that a blocked page loaded.
const $ = (selector) => document.querySelector(selector);
export function setupWebSearch(){
  const form=$("#webSearchForm"), input=$("#webSearchQuery"), frame=$("#webBrowserFrame");
  const status=$("#webBrowserStatus"), openTab=$("#webBrowserNewTab"), home=$("#webBrowserHome");
  if(!form || !input || !frame || !status) return;
  let currentUrl="https://www.google.com/webhp?igu=1";
  const setPage=(url,label)=>{
    currentUrl=url;
    status.textContent=label || "Trying to load inside Hyperblock…";
    frame.src=url;
  };
  setPage(currentUrl,"Google search workspace ready");
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const query=input.value.trim();
    if(!query) return;
    const isUrl=/^(https?:\/\/|[\w-]+\.[a-z]{2,})(\/|$)/i.test(query);
    const url=isUrl
      ? (/^https?:\/\//i.test(query)?query:"https://"+query)
      : "https://www.google.com/search?igu=1&q="+encodeURIComponent(query);
    setPage(url,isUrl?"Trying to open website inside Hyperblock…":"Trying to show Google results inside Hyperblock…");
  });
  frame.addEventListener("load",()=>{
    // Cross-origin security prevents us from checking the actual document content.
    status.textContent="Page response received — if blank or blocked, open it in a new tab.";
  });
  openTab.addEventListener("click",()=>window.open(currentUrl,"_blank","noopener,noreferrer"));
  home.addEventListener("click",()=>{input.value="";setPage("https://www.google.com/webhp?igu=1","Google search workspace ready");});
}