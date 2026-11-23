# HOOPWORKS

A faithful, from-scratch recreation of an early-2000s browser game: Nick.com's **Basketball Machine** (a Shockwave game). It's a head-on basketball shooting gallery where hoops ride chrome rails, and one ball dropping through stacked hoops scores **DOUBLE** and **TRIPLE** bonuses.

**Play:** https://evanmydude.github.io/bballmachine/

All art, sound and code here are new. Backgrounds, wood, gears, pipes and the logo are drawn procedurally in code, and every sound is synthesized with Web Audio. No original assets or branding are used. Reference screenshots stay on the developer's machine (`reference/`, git-ignored) and are only used for the local comparison overlay.

## How to play

- **Click a backboard to shoot.** The ball flies *into* the screen and lands exactly where you clicked.
  - Land it just above a rim and it drops through.
  - Land it on empty background and it sails behind the machine.
- **One ball at a time.** Your next throw unlocks the instant the current ball is completely out of view (dropped out the bottom, knocked off a side, or a miss faded away behind the machine). The **READY** lamp at the bottom left lights up the moment you can throw. Clicking early flashes it red and does nothing.
- **Moving hoops:** lead them. The throw takes ~0.6 s. Hoops move a little faster on each new machine.
- **Stacked hoops:** after a basket the ball falls straight down. A hoop lined up underneath gives **DOUBLE! +50**, and a third gives **TRIPLE! +100**.
- Each basket is worth 2 points. Get **NEEDED** to 0 before **TIME** runs out. The level always plays out its full timer, and the score carries over between levels.
- `M` toggles sound (or use the speaker icon at the bottom right).

## Reconstruction notes

Nothing about the original's mechanics survives online beyond a Cutting Room Floor listing that confirms it was a Nick.com Shockwave game. So this is reverse-engineered from 9 gameplay screenshots of levels 1–8.

**Clearly visible in the screenshots**
- **View**: head-on. Wooden backboards with orange rims and white nets ride white/chrome pipe rails, which end in striped yellow/black stops.
- **Ball size**: the thrown ball is huge (~205 px) at the cursor right after release, even overlapping the HUD. It's ~155 px mid-flight above the cursor, and ~68 px at the hoops. That means it's thrown into depth and lands at the click point.
- **Misses**: they appear as a greyed ball behind the machine. More than one ball can be in play at once.
- **Bonuses**: a ball through a hoop falls straight into the hoop below. "DOUBLE! +50" pops over the second hoop immediately. Levels 1 and 2 show a chrome panel: "Go for Double Baskets! (50 points)" and "Go for Triple Baskets! (100 points)".
- **HUD**: LEVEL | SCORE | NEEDED (orange bar = needed ÷ target) | TIME (yellow-green bar).

**Inferred from the HUD numbers**
- **NEEDED is points remaining.** L1: score 54 + needed 96 = 150, and the bar is 64% full.
- **Score is cumulative.** L2 starts at 384.
- **A basket is 2 points.** Every score is even, and L5 goes 1548→1602 = one double (50) + 2 baskets.
- **The timer always runs out.** L7 shows NEEDED 0 with ~60% of the time left.
- **Targets**: L1 150 and L2 400 are solid. L3 100, L4–L7 50 and L8 56 come from partly blurred digits and are tunable in `src/levels.js`.

**Unknown, so chosen and kept tunable**
- Level length: 60 s.
- Hoop speeds (ramped up each level) and loop directions.
- Throw pacing. A design choice, not from the screenshots: one ball at a time, the next unlocked the moment the last is out of view (`flight.oneBallAtATime`).
- Whether a triple pays 50+100 or 100 total. Default: cumulative; switch with `scoring.bonusMode`.
- Failure flow: Try Again / Start Over.
- What follows level 8: a victory screen.
- L8 has four rails with no visible hoop. They are left empty, as in the screenshot.

## Physics model

- **The throw** (`src/game/world.js`): a scripted arc. Inverse scale is linear in time (constant-speed recession under perspective), and the ball rises `arcHeight` and lands at the click point.
- **Landing**: the front-most backboard under the point catches the ball. If none does, it's a miss.
- **Plane physics** (`src/game/physics.js`):
  - Fixed 120 Hz steps, each split into sub-steps so the ball moves at most r/4 per sub-step (no tunnelling).
  - Each rim is two small circular colliders that move with the hoop.
  - A basket counts only when the ball's centre crosses the rim line *downward relative to the hoop*, inside the opening.
  - Each hoop scores at most once per ball, and a ball that came up through a hoop can never score in it.
  - A net funnel centres a scored ball so it exits straight down, which is what makes stacked hoops chain.
- **One ball at a time** (`shotBlocker` in `src/game/world.js`): a throw is refused while any ball is still in the world. A ball is removed in the exact physics sub-step where it is fully out of view, so the next throw is available on the very next step. A ball balanced dead-centre on a rim end is tipped off, and a lifetime cap guarantees a ball can never lock you out.
- **Movers** (`src/game/paths.js`): pure functions of level time along polyline tracks, in `loop` or `pingpong` mode with end pauses. They are exactly reproducible at any framerate.

## Tuning

Open the game with `?debug=1`, or press `` ` `` (backtick) in game, for:
- sliders for every constant in `src/config.js` (ball, throw, rim, net, machine speed, scoring);
- a level jump (1–8), pause (`P`), slow motion, and an FPS cap (30/60/144);
- a collider / scoring-line / net-zone / track overlay;
- an aim preview showing where moving boards will be when your ball arrives;
- a reference-screenshot overlay (local only);
- "Copy JSON" to export tuned values.

`node scripts/bot.mjs` plays every level under the real rules with three simulated players and reports points per level vs the target: *ideal* (perfect and instant), *skilled*, and *casual* (reaction delay, aim and timing error, doesn't always plan combos). `--speed=1.5` scales every hoop speed, and `--ci` only checks that the ideal player clears every level (this runs in CI). Use it as a quick balance check after changing speeds or targets.

## Development

```sh
npm test            # node --test: physics, one-ball rule, scoring, game flow, framerate determinism
npm run serve       # no-cache dev server -> http://localhost:8123/?debug=1
```

There are no dependencies and no build step: plain ES modules + Canvas 2D + Web Audio. Levels are data in `src/levels.js`, with coordinates in the 1584×1080 stage space of the reference screenshots.

```
src/config.js        every tunable
src/levels.js        the eight machines (rails, stops, tracks, hoops, targets)
src/game/            pure simulation: paths, hoops, throw + physics, scoring, game flow, fixed-step loop
src/render/          procedural textures, machine parts, HUD/screens, popups
src/audio/sfx.js     synthesized sound effects
src/debug/           overlay + tuning panel
tests/               node:test suites
```

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`: unit tests, then the bot balance check (`--ci`), then a deploy of `index.html`, `styles.css` and `src/` to GitHub Pages. (Repo setting: *Settings → Pages → Source: GitHub Actions*.)
