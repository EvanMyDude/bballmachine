---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, input, race, ux, agent-native]
dependencies: []
---

# The start guard passes a steady 3/s click rhythm and gives no feedback when it refuses

## Problem Statement
`QUIET_GAP = 0.3` only stops clicking faster than about 3.3 per second. A steady rhythm of one click every 0.33 s passes LEVEL COMPLETE → preview → ready → running clock in about 1.3 s. Meanwhile a refused start press gives no feedback, so an impatient player clicks faster and stays refused. Automation hits the same wall (agent-native review): it can't tell when a click will be accepted.

## Findings
- `src/game/state.js` `READY_GUARD`/`QUIET_GAP`/`tryStart`; `src/render/hud.js` ready card always shows a bright pulsing CLICK TO START.

## Proposed Solutions
1. **Raise the guards** (READY_GUARD 0.5, QUIET_GAP 0.45) **and show an "armed" prompt.** CLICK TO START is bright and pulsing only when a click would start the round, and dim while the player is still clicking. Export `canStart(game)`, shared by the renderer and `status()`. **Effort:** S. **Risk:** low.
2. Hold-to-start. *Cons:* unfamiliar.

## Recommended Action
Option 1, plus a test clicking every 0.33 s.

## Acceptance Criteria
- [ ] Clicking at 0.33 s intervals never starts a round.
- [ ] The prompt is dim while guarded and bright when armed; one click when bright always starts.

## Work Log
- 2026-11-24: found in ce:review (race + agent-native reviewers).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
