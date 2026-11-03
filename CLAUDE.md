# Jerusalém Antiga

Isometric city builder for phone (landscape) and PC. Phaser 3 + TypeScript + Vite, tests with Vitest.

## Read first
- `docs/GAME_DESIGN.md` — the full game spec (rules, numbers, UI, controls, art, decisions, out of scope).
- `docs/design.md` — game direction: current state, decisions and next candidates (game-director).
- `docs/TESTING.md` — unit tests, visual tests, dev hooks and how to add scenarios.

Keep these docs up to date: any change to a rule, number, control or test scenario must update the
matching doc in the same change.

## Commands
- `npm run dev` — dev server (also on the LAN for phones)
- `npm test` — unit tests for `src/core`
- `npm run test:visual` — Playwright scenarios with screenshots in `screenshots/` (`-- <name>` to filter)
- `npm run build` — typecheck + static build in `dist/`
- `npm run test:pwa` — after a build: the app is installable and opens offline (PWA)

## Git
- Only the main agent commits or pushes, and only when the user explicitly asks.
  Subagents never commit or push; they leave changes in the working tree.

## Agents
Defined in `.claude/agents/`. None of them commit or push (see Git).

Before building:
- `game-director` — guards the game vision and pillars. Use before any new feature to scope the
  package, and to decide which recommendations from other agents go in. Keeps `docs/design.md`.

While building:
- `sprite-artist` — code-drawn art in `src/render`: buildings, terrain, roads, walkers, effects
  and animations. Use for any visual work.
- `ui-designer` — top bar, tools, info line, balloons, toasts, stats panel, title/victory
  screens, camera and touch controls. Use for UI/UX work or reviews (phone first).
- `map-designer` — map generation and starting layout (terrain, river, rocks, vegetation,
  altar, starting road, entrance). Use when touching any of these.
- `test-reviewer` — makes sure every `src/core` rule has good, seeded tests; may write missing
  tests, never production code. Use after creating or changing a game rule.
- `copywriter` — on-screen texts only (goals, tool hints, info line, balloons, toasts, alerts,
  title/victory/defeat screens) in `src/render/strings.ts` and `goals.json`. No story or verses.
- `code-reviewer` — reviews architecture rules, DRY/KISS, typing, strings/palette and per-frame
  cost; runs typecheck, tests and build. Use before every commit.

After building:
- `playtester` — finds bugs, confusion, bad controls and broken pacing (sim + Playwright).
  Use when a feature is done and before each delivery. Reports only.
- `sim-tester` — measures game length and economy balance with fast seeded simulations
  (scripts in `tools/sim`). Use after changing costs, production, goals or house rules, and
  after each tuning package. Proposes `src/data` changes; the game-director approves.
- `fun-critic` — plays as the target audience (ages 12–17) and rates fun and challenge;
  suggests improvements and balance tweaks for the sim-tester to measure. Use after each
  feature package or when the game feels dull. Does not hunt bugs or measure pacing.

Command `/revisao [foco]` (`.claude/commands/revisao.md`): full read-only review. It runs every
evaluation agent in parallel, saves their reports in `docs/revisoes/<date>/` and asks the
game-director for a `plano.md` with Pacote 1–3. It commits only that folder (running the command
is the user's order to commit it), implements nothing and asks the user to approve Pacote 1.

Not created yet: `storyteller` (story later), on hold by the user's decision. On-screen texts
belong to the `copywriter`.

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
