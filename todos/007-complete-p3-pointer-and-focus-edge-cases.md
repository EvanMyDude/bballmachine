---
status: complete
priority: p3
issue_id: "007"
tags: [code-review, input]
dependencies: []
---

# Second-finger taps are dropped during play; a focused debug button keeps eating Space

## Problem Statement
- The `!e.isPrimary` filter drops a real throw from a second finger during play (e.g. a thumb resting on the screen).
- In debug, clicking the canvas leaves focus on the last panel button, so Space re-activates that button.

## Proposed Solutions
- Apply the `isPrimary` filter only outside 'playing'; keep the left-button check.
- On canvas pointerdown, blur `document.activeElement` if it isn't `body`.

**Effort:** XS.

## Work Log
- 2026-11-24: found in ce:review (race reviewer).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
