---
title: "fix: Forgiving shots, low-entry baskets, retuned L3/L5, level start preview + click to start"
type: fix
status: completed
date: 2026-11-24
deepened: 2026-11-24
---

# 🐛✨ Forgiving shots, low-entry baskets, retuned L3/L5, level start preview + click-to-start

## Enhancement Summary

**Deepened on:** 2026-11-24
**Sections enhanced:** A, B, C, E, F, flows, acceptance criteria, files
**Research agents used:**
- `julik-frontend-races-reviewer`: input and phase races
- `code-simplicity-reviewer`: scope and complexity
- a general-purpose adversarial physics analyst: built sims against the real physics code; scratch sims in `scratchpad/nz/`

Not used: Rails, Python, TypeScript and database reviewers, which don't apply to this no-framework canvas game. There are no `docs/solutions` learnings yet.

### Key Improvements
1. **The net-zone credit runs once, at landing, not on every physics substep.** The per-substep version had real false positives in simulation:
   - balls rising into a net from below (credited at the top of their rise, where relative speed passes through 0);
   - balls deflected under a rim end;
   - a hoop descending over a rising ball.

   The landing-only version had 0 false positives across a 4,000-throw sweep, and every landing 0–40 px below the upper rim gives a DOUBLE.
2. **The zone tapers with the drawn net:** `0 ≤ relY ≤ 40`, `|dx| ≤ 47.5 − 0.25·relY`.
3. **Input races fixed:**
   - only one phase transition per step;
   - the round only starts after a quiet gap in input;
   - auto-repeat keys are ignored, and only the primary pointer counts;
   - frozen frames render without interpolation shimmer.
4. **The preview counts whole steps and snaps to exactly t = 0.** That keeps rounds bit-identical to the balance sims.
5. **Scope trimmed:** no mid-round pause, no new sound, no second catch pass, and fewer config knobs.

### New Considerations Discovered
- **Existing bug:** two clicks landing in one frame chain through phases. Two fast clicks on the title already skip the intro.
- **Existing bug:** a ball credited deep in a net can be slung sideways out of the bottom by the centring spring's overshoot, ruining stacked combos. Fix by easing sideways speed in the bottom 20 px of the net (simulated: 93 → 118 of 121 DOUBLEs on a 340 px stack).
- **Implementation trap:** a shared credit function must re-read `ball.scored`, not a cached `scoredHere`. Otherwise a clean drop is credited twice and labelled "DOUBLE!".

## Overview

Playtest feedback from Evan after the rebalance:

1. Throws that land just **over the top of a backboard** sail behind the machine as misses. That's too harsh.
2. Retune targets: **Level 3 → 300**, **Level 5 → 400**.
3. Balls that **go in low** sometimes don't register. It's worst mid-combo, where the DOUBLE silently disappears and it feels unfair.
4. Each level should open with a **brief preview of the hoops in motion**, then **freeze** with **"click to start"**, so players can take breaks between levels.

Then polish, run the full test, balance and browser checks, and push live to `main`.

## Problem Statement (with evidence)

### 3. Low entries: reproduced and root-caused

A basket only counts when the ball's centre crosses the rim line **downward** (`src/game/physics.js`). The only allowance for landing below the line is `flight.arrivalRimGrace = 12` px, which teleports the ball (`src/game/world.js` `land()`). Clicking on the hoop itself (rim or net) lands below the line, the ball drops visibly through the net, and it isn't credited. Reproduced on the L2 left stack (scratch `repro.mjs`):

```
land   8px below upper rim -> hoop0(c1) hoop1(c2)     ✔ DOUBLE
land  14px below upper rim -> hoop1(c1)                ✘ upper hoop lost, no DOUBLE
land  30px below upper rim -> hoop1(c1)                ✘
```

**Ruled out:** moving hoops sliding sideways onto a falling ball. A 2,904-throw sweep of all 8 real levels (`repro2.mjs`) found 0 cases.

**Visual illusion:** every plane ball is drawn behind every net, so a ball passing just outside a rim looks like it went in.

### 1. "Misses flying over the backboard"

`boardAt()` only catches a landing point inside a board rect + 4 px. Aiming slightly high lands above the board's top edge, and the ball is scored as a miss behind the machine.

### 4. No break between levels

`intro` runs 1.5 s with the hoops moving, then auto-starts the clock.

## Proposed Solution

### A. Landing-in-the-hoop credit (fixes #3)

When a thrown ball **lands**, check every hoop's basket zone at landing time. If the landing point is inside one, credit that basket immediately and let the net funnel carry the ball out the bottom. Remove the `arrivalRimGrace` teleport.

#### Research Insights (adversarial sims)
- **Check only at landing; never in later substeps.** A per-substep check credited rising balls, under-rim bounces and descending hoops in sims. Landing is the only situation where a ball legitimately appears inside a net without crossing the rim. (Speeds at landing: the ball moves down at 361 px/s or more and hoops at 185 px/s at most, so a velocity test adds nothing.)
- **Tapered zone matching the drawn net:** `0 ≤ relY ≤ hoop.netCatchDepth (40)` and `|dx| ≤ (rimHalfWidth − rimEndRadius) − 0.25·relY`, i.e. 47.5 px at the rim narrowing to 37.5 px at 40 px deep. Check against the landing point at landing time; the depth then really is 40, not ~37.
- **One shared `creditBasket(ball, hoop, rimY, emit)`** in `physics.js`, used by both the crossing test and the landing check. It must re-check `ball.scored.includes(hoop.id)` itself (double-credit trap).
- **Bottom-of-net easing:** in the bottom 20 px of a scored net, ease `vx` toward the net's carry speed at 80/s so a deep credit doesn't sling the ball sideways (93 → 118 of 121 DOUBLEs on a 340 px stack; the existing exits-centred test still lands within 1.7 px).
- **Config:** rename `flight.arrivalRimGrace` → `hoop.netCatchDepth = 40`. Width comes from the existing rim geometry, so there's no new knob.

**Unit tests to add** (hoop at (500,400), rim line 402):

| Case | Expected |
|---|---|
| `shoot(500,442)` | 1 basket |
| `shoot(500,444)` | 0 |
| `shoot(542,422)` | 1 |
| `shoot(546,422)` | 0 |
| Stack (500,400) + (500,570); `shoot(520,416)` and `shoot(470,442)` | hoops [0,1], chains [1,2], "DOUBLE!" |
| `dropBall(500,520,0,-v)` for v = 560…760 step 10, and `dropBall(525,520,0,-800)` | 0 baskets |
| `dropBall(650,448,-900,-200)` | 0 |
| Vertical pingpong `[[500,300],[500,950]]` @185, start [500,300]; `dropBall(500,372,0,-200)` | 0 |

Also keep "clean drop scores exactly once", and add a no-repeat-hoop check over a grid of landings.

### B. Draw order matches the physics

A plane ball is drawn behind the nets only while it's inside a net it has scored; otherwise it's drawn in front of the nets and rims.

#### Research Insights (simplicity)
Don't add a geometry helper. The net-funnel branch in `physics.js` already knows when the ball is inside a scored net. Set `ball.inNet = false` at the start of each step and `true` in that branch; render reads `b.inNet`.

### C. Over-the-board forgiveness (fixes #1)

Extend each board's catch rect **upward** by `flight.topCatchGrace` (60 px) in `boardAt()`, in a single pass. A ball landing up to 60 px above a board top (and horizontally over the board) is caught, enters the plane at its landing point, and falls: it drops in if lined up with the rim, otherwise it falls past.

#### Research Insights (simplicity)
- One pass is enough. Which board "catches" the ball only affects the cosmetic `board` event (`hoopId`); the landing point and physics are identical. "Front-most wins" stays.
- `boardCatchMargin` stays at 4. Side forgiveness wasn't requested and would shift balance.

### D. Targets (#2)

`src/levels.js`: L3 `target: 300`, L5 `target: 400`. Update the README table.

### E. Level start: preview → freeze → click to start (#4)

Rewind trick: the preview plays the machine from `t = −preview` up to its real starting arrangement, then freezes exactly at `t = 0`, the screenshot-measured start state the balance sims also use. Each attempt starts from the identical frozen state.

```
startLevel → 'intro'  (preview, hoops moving; LEVEL card as a top ribbon so the machine stays visible)
           → 'ready'  (frozen at exactly t = 0; "CLICK TO START" card; waits indefinitely = break)
           → quiet click / Space → 'playing' + 'roundStart' ("GO!")
```

#### Research Insights (races + simplicity)
- **Reuse `game.introTime`** (1.5 → 2.4 s) as the preview length; there's no new config knob.
- **Count whole steps and snap; don't compare accumulated floats.** In `startLevel`:
  ```js
  game.previewSteps = Math.round(cfg.game.introTime * cfg.sim.hz);
  world.t = -game.previewSteps / cfg.sim.hz;
  for (const h of world.hoops) setHoopTime(h, world.t);
  ```
  In each intro step: `stepWorld(...)`, then `if (--game.previewSteps <= 0) freeze(game)`.
  `freeze()` sets `world.t = 0`, calls `setHoopTime(h, 0)` for every hoop, enters `'ready'`, and emits `machineFreeze` exactly once, from both the natural end and a skip.
- **One phase transition per update.** In `update()`, stop handling queued inputs after the phase changes, and drop the rest. This also fixes an existing bug where two clicks in one frame chain title → intro → playing.
- **Quiet-gap start guard.** In `'ready'`, a press only starts the round if `phaseT ≥ 0.25` **and** at least 0.3 s has passed since the previous press. Every press re-arms the gap (`game.sinceInput`). That way a frantic buzzer-clicker can't chain into a running clock.
- **A preview click → `freeze()` (ready), never straight to playing.**
- **`beginRound(game)`** with three callers: click, key, and `jumpLevel`. `jumpLevel` also clears `inputQueue`.
- **Freeze rendering:** in `'ready'`, render with `alpha = 1` so frozen hoops don't shimmer from interpolation.
- **Freeze sound:** reuse `sfx.board()` (a thunk); no new synth. "GO!" uses the existing start blip plus a popup.

### F. Polish (trimmed)

- **GO!** popup at round start (keep).
- **Input hygiene:**
  - ignore `keydown` with `e.repeat`;
  - ignore non-primary pointers and non-left buttons (`e.button !== 0 || !e.isPrimary`);
  - debug keys ignore focused panel buttons;
  - while debug-paused, drop queued inputs instead of letting them pile up.
- **README:** round table, forgiveness rules, start flow.
- **Balance:** re-run `scripts/bot.mjs` and confirm the CI gate (perfect play needs ≥ 45% of the clock; R2 rule intact).
- **Cut:** P/Esc mid-round pause. Not requested; E already gives a break before every round; it conflicts with the debug P key and adds a phase.

## Flow and edge-case analysis

| Flow | Expected |
|---|---|
| Title → click | L1 preview (2.4 s, moving) → freeze → "CLICK TO START" → click → GO!, timer runs |
| Click during preview | Freezes immediately at t = 0 (ready); does not start |
| Frantic clicking from the buzzer through LEVEL COMPLETE | Lands in ready; the round only starts after a ≥ 0.3 s pause in clicking |
| Two or more clicks in one frame | Only the first transition applies; the rest are dropped |
| Game over → TRY AGAIN / Space | Same level: preview → freeze → wait |
| Ready left idle | Waits forever; HUD TIME full; frozen frame doesn't shimmer |
| Held Space / R | Auto-repeat ignored; one action per physical press |
| Right-click / second finger | Ignored |
| Landing in the upper net of any hoop | Credited at landing; never again for that ball |
| Ball rising into a net from below / deflected under a rim / a hoop descending onto it | Never credited |

## Technical Considerations

- **Determinism:** the preview uses fixed steps and snaps to exactly 0, so rounds match `scripts/sim.mjs` bit for bit. `tests/determinism.test.js` gets a start helper.
- **Tests:** `state.test.js` assumes intro → playing happens on its own. Add a `startRound(game)` helper and use it everywhere.

## Acceptance Criteria

- [x] Landing 0–40 px below a rim inside the tapered zone credits that hoop exactly once. The L2-stack repro gives DOUBLE for landings 0–40 px below the upper rim.
- [x] None of the adversarial cases in A credits a basket. "Clean drop scores exactly once" still passes.
- [x] A ball passing outside a rim is drawn in front of that net; a credited ball is drawn behind it.
- [x] Landing ≤ 60 px above a board top (over the board) is caught and drops; landing higher is a miss.
- [x] L3 target 300, L5 target 400; README updated.
- [x] Each level: preview ~2.4 s, freeze exactly at the t = 0 start state, CLICK TO START, wait indefinitely. The round starts only on a quiet click or Space, shows GO!, and that input never throws a ball.
- [x] Multiple clicks in one frame cause only one transition; key repeat is ignored; non-primary pointers are ignored.
- [x] `npm test` passes (new tests for A, C, E and races). `node scripts/bot.mjs --ci` passes.
- [x] Browser (Playwright): preview → freeze → start, a low-entry DOUBLE, an over-the-board catch, rapid-click race, no console errors.
- [x] Pushed to `main`; Pages workflow green; live site serves the new build.

## Success Metrics
- No "went in but didn't count" moments in Evan's next playtest.
- A break is available before every round.
- Rounds 3 and 5 feel winnable without becoming trivial.

## Dependencies & Risks
- **Balance shift:** forgiveness raises human scores slightly. Re-run the bot; keep Evan's targets.
- **Over-generous credit:** constrained to landing-time only, the upper 40 px, and a tapered width, with adversarial tests.
- **Input races:** one transition per step, the quiet-gap guard, and key-repeat and pointer filtering.

## Files
- `src/config.js`: `hoop.netCatchDepth` (replaces `flight.arrivalRimGrace`), `flight.topCatchGrace`, `game.introTime` 2.4
- `src/game/physics.js`: `creditBasket()`, landing-zone helper, `ball.inNet`, bottom-of-net easing
- `src/game/world.js`: `land()` credits zone landings (no teleport); `boardAt()` top grace
- `src/game/state.js`: preview step counting, `freeze()`, `'ready'`, `beginRound()`, one-transition-per-step, quiet-gap guard
- `src/main.js`: draw order by `b.inNet`; alpha = 1 when frozen; input hygiene; `jumpLevel` via `beginRound`
- `src/render/hud.js`: preview ribbon + ready card; `src/render/fx.js`: GO! popup; `src/audio/sfx.js`: map `machineFreeze` / `roundStart`
- `src/debug/panel.js`: sliders for `netCatchDepth` and `topCatchGrace`
- `src/levels.js`: targets
- `tests/physics.test.js`, `tests/state.test.js`, `tests/determinism.test.js`, `README.md`

## Sources & References
- Repro scripts: `scratchpad/repro.mjs`, `scratchpad/repro2.mjs`
- Adversarial sims: `scratchpad/nz/e1–e11`
- Crossing test and net funnel: `src/game/physics.js`
- Landing and catching: `src/game/world.js` `land()`, `boardAt()`
- Flow: `src/game/state.js` `startLevel()`, `update()`
- Render order and interpolation: `src/main.js` `render()`
