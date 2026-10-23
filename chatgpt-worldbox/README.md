# ChatGPT-WorldBox — Foundation Prototype

This is the first playable foundation for ChatGPT-WorldBox, developed separately from the HYPERBLOCK portal on the `feature/chatgpt-worldbox-foundation` branch.

## Run it
Open `chatgpt-worldbox/index.html` in a browser, or serve the repository with GitHub Pages/a static web server and visit `/chatgpt-worldbox/`. It is a self-contained HTML file and has no build step or external dependencies.

## Working in this first build
- Procedurally generated tile maps in small, medium, and large sizes
- Editable terrain: grass, water, sand, forest, mountains, and snow
- Touch-friendly paint tools and adjustable brush size
- Place citizens and settlements; erase life from tiles
- Basic simulation clock, pause/play, single-step, and speed controls
- Starter food, aging, mortality, settlement population, and birth behaviors
- World overview, tile inspection, and a small chronological event log
- Save/load using this browser's local storage

## Current limits
This is a foundation prototype, not the complete master blueprint yet. Saves are local to the browser/device and are not cloud saves. Citizens and settlements use intentionally simple starter rules. It does not yet include full civilizations, families, kingdom diplomacy/conquest, advanced AI, historical Earth maps, or the full technology timeline. The game should be expanded in tested modules rather than presenting unfinished menu items as working systems.

## Development order
1. Make world generation, editing, time, and local saves reliable.
2. Add citizen needs, families, jobs, education, and settlements.
3. Add resources, trade, technology progression, and civilization formation.
4. Add governments, diplomacy, gradual conquest, vassals/puppet states, and collapse.
5. Add persistent history, scenario maps, advanced eras, disasters, and optimization.

The main HYPERBLOCK branch has not been changed by this prototype.
