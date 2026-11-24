---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, quality]
dependencies: []
---

# A ball scoring after the round has ended still shows DOUBLE and plays sounds

## Problem Statement
`collectWorldEvents` forwards `basket` events in levelEnd/gameOver/victory, so a ball still falling after the buzzer grace shows "DOUBLE! +50" and plays the basket sound with no points added. It's misleading.

## Proposed Solutions
Only forward `basket` events while the round is live (playing/buzzer). **Effort:** XS.

## Acceptance Criteria
- [ ] No basket popup or sound once the round is over; the existing scoring tests still pass.

## Work Log
- 2026-11-24: found in ce:review (bug reviewer, P3).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
