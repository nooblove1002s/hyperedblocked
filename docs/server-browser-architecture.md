# Hyperblock Original Games and Multiplayer

## Original tab
The **Original** tab is reserved for games made specifically for Hyperblock. The first browser-playable prototype is Neon Block Dash, a touch- and keyboard-friendly arcade game. It stores the best score locally on the current device.

## Server browser and live presence
The Server Browser is initialized from `js/server-browser.js`. It supports public community rooms, private password-protected rooms, official-server listings managed by an operator, configurable room capacity (default 20), and aggregate presence counts when connected to the backend.

## Backend
The Node.js / Express / Socket.IO backend is in `server/`. GitHub Pages cannot run this Node service; deploy it separately and set the backend URL in the Server Browser page. Room state is currently in memory and resets on restart.

## Important distinction
The room service provides discovery and presence. It does **not yet synchronize player positions, physics, inventory, or other game state**, so it is not yet a complete Roblox-style multiplayer game. That requires game-specific real-time networking and an authoritative game loop. Treat this as the foundation, not a production launch.

## Local run
1. Use Node.js 20 or newer.
2. In `server/`, run `npm install`.
3. Copy `.env.example` to `.env` and configure `CORS_ORIGINS` for the exact frontend origin.
4. Run `npm run dev`.
5. In Hyperblock's Server Browser tab, enter the backend URL (for local development, `http://localhost:3000`).

The backend has not been deployed or runtime-tested as part of this branch yet.
