/**
 * Hyperblock restricted web proxy for Cloudflare Workers.
 *
 * Deploy as a Worker, then set <meta name="hyperblock-proxy-url"
 * content="https://YOUR-WORKER.workers.dev"> in index.html.
 *
 * This is NOT a VPN and is deliberately not an unrestricted open proxy.
 * Only GET/HEAD and explicitly allowlisted hosts are forwarded.
 */
const ALLOWED_HOSTS = new Set([
  "www.google.com", "google.com", "duckduckgo.com", "html.duckduckgo.com",
  "www.wikipedia.org", "en.wikipedia.org", "wikipedia.org",
  "poki.com", "www.poki.com", "crazygames.com", "www.crazygames.com"
]);
const MAX_URL_LENGTH = 4096;

function allowed(url) {
  return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}
function proxyUrl(workerOrigin, target) {
  return workerOrigin + "/proxy?url=" + encodeURIComponent(target);
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff"
  };
}
function rewriteHtml(html, baseUrl, workerOrigin) {
  const rewrite = (raw) => {
    const value = raw.trim();
    if (!value || value.startsWith("#") || /^(data:|blob:|javascript:|mailto:|tel:)/i.test(value)) return raw;
    try {
      const target = new URL(value, baseUrl);
      if (!allowed(target)) return raw;
      return proxyUrl(workerOrigin, target.href);
    } catch { return raw; }
  };
  // Rewrites common navigational/resource attributes. This is intentionally
  // conservative; complex sites may still require their own origin.
  return html.replace(/\b(href|src|action|poster)=(["'])(.*?)\2/gi,
    (whole, attr, quote, value) => attr + "=" + quote + rewrite(value) + quote);
}
export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const cors = corsHeaders();
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (requestUrl.pathname === "/health") {
      return Response.json({ ok: true, service: "Hyperblock restricted proxy", mode: "allowlist", active: true }, { headers: cors });
    }
    if (requestUrl.pathname !== "/proxy") return new Response("Hyperblock proxy is running. Use /proxy?url=https%3A%2F%2Fexample.com", { status: 200, headers: cors });
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Only GET and HEAD are supported.", { status: 405, headers: cors });
    const raw = requestUrl.searchParams.get("url");
    if (!raw || raw.length > MAX_URL_LENGTH) return new Response("Missing or oversized url parameter.", { status: 400, headers: cors });
    let target;
    try { target = new URL(raw); } catch { return new Response("Invalid URL.", { status: 400, headers: cors }); }
    if (!allowed(target)) return new Response("This destination is not enabled in the Hyperblock proxy allowlist.", { status: 403, headers: cors });
    let upstream;
    try {
      upstream = await fetch(target.href, {
        method: request.method,
        redirect: "manual",
        headers: { "User-Agent": "Hyperblock-WebWorkspace/1.0", "Accept": request.headers.get("Accept") || "*/*" }
      });
    } catch {
      return new Response("The destination could not be reached through the proxy.", { status: 502, headers: cors });
    }
    const location = upstream.headers.get("Location");
    if (location && upstream.status >= 300 && upstream.status < 400) {
      let redirectTarget;
      try { redirectTarget = new URL(location, target); } catch {}
      if (!redirectTarget || !allowed(redirectTarget)) {
        return new Response("The destination redirected outside the enabled allowlist. Open it directly if you trust it.", { status: 502, headers: cors });
      }
      return new Response(null, { status: upstream.status, headers: { ...cors, "Location": proxyUrl(requestUrl.origin, redirectTarget.href), "Cache-Control": "no-store" } });
    }
    const headers = new Headers(cors);
    for (const name of ["content-type", "cache-control", "last-modified", "etag", "content-language"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "no-store");
    // Upstream frame/CSP restrictions are not forwarded, but the proxy does not
    // bypass login, paywalls, or application-level restrictions.
    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("text/html") && request.method !== "HEAD") {
      const html = await upstream.text();
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(rewriteHtml(html, target.href, requestUrl.origin), { status: upstream.status, headers });
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  }
};
