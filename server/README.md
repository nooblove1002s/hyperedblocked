# Hyperblock multiplayer server browser backend

This service powers the hybrid Server Browser in the main Hyperblock gaming repo. It supports public official-server listings, community rooms, password-protected private rooms, configurable capacity (default 20), and live presence counts from Socket.IO connections.

## Run locally

1. Install Node.js 20 or newer.
2. From this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `CORS_ORIGINS` to your exact local frontend origin.
4. Run `npm run dev`.
5. Open the Hyperblock site, choose **Servers**, enter `http://localhost:3000` as the backend URL, then connect.

Health check: `GET /health`. APIs: `GET /api/servers`, `GET /api/stats`. Socket.IO handles room create/join/leave and pushes server list and aggregate updates.

## Hybrid server model

- **Official servers:** provisioned by trusted server-side operator tooling. The public browser intentionally rejects client attempts to create an official server.
- **Community servers:** public, discoverable rooms created by connected players.
- **Private rooms:** join-by-ID rooms protected by a password; they are omitted from the public list and their room IDs should only be shared with invitees.
- **Capacity:** default 20; the server validates every requested capacity between 1 and 100 and enforces it atomically in the Node event loop.
- **Live totals:** aggregate the actual socket memberships across active rooms. A disconnected player is removed when their socket disconnects. Counts are not hard-coded.

## Important production limits

This first backend is a runnable single-process MVP: room state is in memory and resets on restart. It is not yet suitable for multiple backend replicas or as a complete game networking layer. Before production:
- Add Redis (Socket.IO Redis adapter and shared room/presence state) and a durable database for room metadata.
- Add authentication, ownership/host transfer, moderation/reporting, abuse protection, TLS, stricter request validation, and operational monitoring.
- Use a trusted control plane to provision official server processes and report their health.
- Connect each actual game client to its selected room transport; this browser currently manages discovery/presence, not game-state replication.
- Set `CORS_ORIGINS` to the exact deployed origin. Do not use wildcard CORS for credentialed production traffic.
- For durable private rooms, store password hashes with a deployment-managed secret/pepper and add expiry/attempt throttling.

GitHub Pages hosts only the static UI; deploy this Node service separately on a Node-compatible host. Configure the backend URL in the Server Browser UI after deployment.
