---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, input, ux]
dependencies: []
---

# A double-click instantly skips the level preview

## Problem Statement
Double-clicking TRY AGAIN, START OVER, the title or LEVEL COMPLETE starts the preview and then skips it on the next frame, so the player never sees the machine run. That defeats the purpose of the preview.

## Findings
`src/game/state.js` handleClick/handleKey `intro` → `freeze(game)` with no time guard.

## Proposed Solutions
1. **Only accept a skip after 0.35 s of preview** (`phaseT >= 0.35`). **Effort:** XS. **Risk:** none (the existing skip test clicks at 0.4 s).

## Acceptance Criteria
- [ ] Two clicks 1–5 frames apart from the title leave the game in `intro`, still previewing.
- [ ] A click after 0.35 s still skips to ready.

## Work Log
- 2026-11-24: found in ce:review (race reviewer).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
