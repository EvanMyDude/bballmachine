---
status: complete
priority: p3
issue_id: "006"
tags: [code-review, ux]
dependencies: []
---

# GO! covers the centre of the playfield for ~0.45 s while the clock runs

## Proposed Solutions
Shorten it (life ~0.55 s) and start fading at ~30%, so the first throw is never blocked. **Effort:** XS.

## Acceptance Criteria
- [ ] GO! is mostly transparent by 0.3 s after the start.

## Work Log
- 2026-11-24: found in ce:review (race reviewer).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
