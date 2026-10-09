# HYPERBLOCK v4: bug-fix release (changes from v3)

Changed: js/app.js, js/games/player.js, js/studio/studio.js. Everything else is identical to v3.

1. Catalog: one bad entry no longer blanks the catalog; duplicate ids, non-http(s) urls and non-https embed urls are skipped (console warns).
2. Player: embedUrl must be https and on another origin (blocks javascript: URLs and sandbox escape); handlers cleaned up; wired once.
3. Studio import/load: all saved or imported data is sanitized (types, numbers, colors, names, limits) and loading is atomic.
4. Studio Play mode: edits made while playing are no longer saved or added to undo history.
5. Studio undo: no-op changes (e.g. clicking a gizmo without moving) no longer create undo steps.
6. Studio keyboard: Space no longer triggers Play while a toolbar button has focus.
7. Studio Pause/Resume: a single guarded animation loop (rapid toggling used to triple the frame work).
8. Scene names: trimmed, length-limited, reserved names rejected; rename blocked during Play.

# v4.1 (changes from v4, from an outside code review)

- Catalog: an embed link on the same site as HYPERBLOCK is now marked External in the catalog instead of "Plays here" (the player already refused it).
- Studio import: scene names that are identical after trimming to 40 characters no longer overwrite each other; later ones get " (2)", " (3)", etc.
- view3d.js: the grid and axes helpers are added in two separate calls, and the transform gizmo is added via getHelper() when the library provides it (r169+), otherwise directly (r160). Defensive; see notes.

# v4.2 (changes from v4.1, from an outside code review)

- Studio import: when the project's selected scene is one of several whose names collide after trimming to 40 characters, the intended scene is now selected (previously the first one was).
