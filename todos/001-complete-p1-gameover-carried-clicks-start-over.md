---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, input, race, ux]
dependencies: []
---

# Clicks carried over from the buzzer can hit START OVER and wipe progress

## Problem Statement
The game-over screen accepts clicks after a fixed 0.4 s. A player still hammering a hoop in the same area as the START OVER button (x 802–1022, y 640–704) can land a carried-over click on it. That sends them back to Level 1 with score 0 before they've read the screen.

## Findings
- `src/game/state.js` handleClick `gameOver`: only checks `phaseT < 0.4`; no quiet gap. Same for handleKey (Space retries; that's not destructive).
- Reported by the race review of 3837ef7. The bug predates the commit, but the new `sinceInput` makes the fix one line.

## Proposed Solutions
1. **Require the quiet gap on game over** (`gap >= QUIET_GAP`) for both buttons. *Pros:* one line, matches the ready logic. *Cons:* a deliberate click within 0.45 s of the last throw is ignored, which is fine on a results screen. **Effort:** S. **Risk:** low.
2. Move START OVER away from the playfield's hot zones. *Cons:* layout churn; doesn't fix it in general.

## Recommended Action
Option 1, plus a test that spams clicks across the buzzer into game over and asserts the level/score are not reset.

## Technical Details
`src/game/state.js` (handleClick/handleKey `gameOver`), `tests/state.test.js`.

## Acceptance Criteria
- [ ] Clicking every 0.15–0.33 s through the buzzer never triggers START OVER or TRY AGAIN.
- [ ] After a ≥ 0.45 s pause, one click on either button works.

## Work Log
- 2026-11-24: found in ce:review (race reviewer).

## Resources
Commit 3837ef7; `docs/plans/2026-11-24-fix-forgiving-shots-low-entries-level-start-plan.md`.
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
