# Hyperblock Server Browser architecture

## Room types
1. Official: operator-managed instances, health-checked and listed only while available.
2. Community: player-created public rooms.
3. Private: invite-only rooms excluded from public listings and protected by a password.

## Data flow
- Frontend: `js/server-browser.js` is loaded by `js/app.js`; it calls REST snapshots and listens to Socket.IO list/count events.
- Control/presence API: `server/src/index.js` validates room requests, maintains socket-to-room membership, enforces capacity, and publishes room-list/stat updates.
- Game transport: each game must join the chosen room and use an authoritative game server or suitable real-time transport to synchronize gameplay. Presence by itself does not synchronize positions, physics, inventory, or game state.

## Live aggregate count
Count unique connected socket IDs across active rooms, with each socket assigned to at most one room. Do not add per-room counts if a player can join multiple rooms. For games that allow one player to use multiple sockets, add authenticated user IDs and deduplicate by user ID. Browser clients should display an em dash until connected, never pretend sample values are live.

## Scaling path
Single-process memory maps are the development MVP only. Production should use:
- Redis for distributed socket presence and Socket.IO's Redis adapter for broadcasts across instances.
- PostgreSQL for room metadata, ownership, moderation records, and audit trails.
- Heartbeats / TTLs for stale presence, rate limits, authentication, TLS, metrics, and abuse reporting.
- Operator-only credentials for official-server registration and health checks.
- A room allocator / orchestration service for launching and draining actual dedicated game servers.

## Default capacity
New rooms default to 20 players. The backend, not the UI, validates and enforces capacity. The current MVP accepts 1–100 players and refuses over-capacity joins.
