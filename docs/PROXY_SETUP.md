# Hyperblock restricted proxy setup

Hyperblock's GitHub Pages site cannot run a server-side proxy by itself. This Worker provides a **restricted web-fetch proxy**, not a VPN and not a universal browser tunnel.

## Deploy on Cloudflare

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named `hyperblock-proxy`.
3. Paste the contents of `proxy-worker.js` into the Worker editor and deploy it.
4. Open `https://YOUR-WORKER.workers.dev/health`. It should return JSON with `"active": true`.
5. Copy the Worker URL. In `index.html`, add this inside `<head>` (replace the example URL):
   ```html
   <meta name="hyperblock-proxy-url" content="https://YOUR-WORKER.workers.dev">
   ```
6. Commit the updated `index.html` to the test branch and test before merging.

## Current safety and compatibility limits

- The Worker accepts only HTTPS URLs on the explicit `ALLOWED_HOSTS` list, and only GET/HEAD requests. This prevents it from becoming an unrestricted public relay.
- Add a hostname to that list only when you have a reason to support it. Redirects to hosts outside the list are rejected.
- The proxy does not use your device's VPN, does not route all device traffic, and does not hide traffic from the hosting provider.
- Many websites use complex JavaScript, authentication, cookies, anti-bot systems, or content-security rules and may not function correctly when proxied. The rewrite covers common HTML navigation/resource attributes only.
- This Worker has no user authentication or per-user rate limit. Keep the allowlist narrow; before making it broadly public, add rate limiting and abuse monitoring in Cloudflare.
- Do not forward passwords, session cookies, or private information through this service.

## Extend supported destinations

Edit `ALLOWED_HOSTS` in `proxy-worker.js` to add exact hostnames. Prefer exact hosts rather than wildcard matching. Deploy the Worker again after changes.
