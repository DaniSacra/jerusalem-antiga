# Jerusalém Antiga

Isometric city builder for phone (landscape) and PC. Phaser 3 + TypeScript + Vite, tests with Vitest.

## Read first
- `docs/GAME_DESIGN.md` — the full game spec (rules, numbers, UI, controls, art, decisions, out of scope).
- `docs/TESTING.md` — unit tests, visual tests, dev hooks and how to add scenarios.

Keep both up to date: any change to a rule, number, control or test scenario must update the
matching doc in the same change.

## Commands
- `npm run dev` — dev server (also on the LAN for phones)
- `npm test` — unit tests for `src/core`
- `npm run test:visual` — Playwright scenarios with screenshots in `screenshots/` (`-- <name>` to filter)
- `npm run build` — typecheck + static build in `dist/`

## Definition of done
`npm test`, `npx tsc --noEmit` and `npm run test:visual` pass, and the screenshots affected by
the change have been looked at.

## Rules of the codebase
- `src/core`: the whole simulation in pure TypeScript. Never import Phaser here.
  The grid is square in the core; isometry exists only in `src/render`.
- `src/data`: balance numbers in JSON (costs, jobs, radii, house levels, goals, rules).
- `src/render` and `src/scenes`: drawing, animation and input only. Game rules belong in core.
- Every new or changed rule in core needs Vitest tests in `tests/`.
- Code, comments and commits in English; on-screen text in Portuguese (`src/render/strings.ts`).
- DRY and KISS. Do not add story, verses or mechanics that were not requested.

## Architecture notes
- State: `GameState` in `src/core/types.ts`. Buildings live in `buildings` (list) and `grid`
  (per-cell reference; the 3x3 temple fills 9 cells). Roads are `roads[]`; `network[]` is the
  set of road cells connected to the altar (BFS), recomputed by `refreshCity()` after any change.
- A building is `connected` when any cell next to its footprint is in the network. Disconnected
  workplaces do not produce or count jobs; disconnected services give no coverage.
- House needs are in `houses.json`: `road`, `well`, `market`, `sacred` (radius of altar or temple).
- Families (`families.ts`) are dispatched to empty plots and walk the network from the entrance;
  `step` advances `familyCellsPerMonth` per month. Render interpolates with the month fraction.
- `stepMonth()` returns events; the scene turns them into effects and toasts.
- Render: `iso.ts` (projection, depth = x + y of the footprint center), `textures.ts` (all art
  generated in code as named textures with anchors in `ORIGIN`/`HEIGHT`, swappable for sprites),
  `MapView.ts` (world), `Walkers.ts`, `CameraRig.ts`. The UI overlay is a separate `UIScene`
  so camera zoom does not affect it.
- In dev builds `window.game`, `window.state` and `window.core` are exposed for debugging.
