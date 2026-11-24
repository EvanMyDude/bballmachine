---
status: complete
priority: p3
issue_id: "008"
tags: [code-review, simplicity]
dependencies: []
---

# Small simplifications in the shipped code (~12–15 lines)

## Findings (simplicity reviewer)
1. `state.js` `case 'title'` duplicates `default`: delete it.
2. `previewSteps` isn't needed: `world.t = -introTime`, and freeze when `phaseT >= introTime`. The snap to 0 makes any one-step drift harmless.
3. `main.js`: the two plane-ball loops differ only by the `inNet` filter; use a helper.
4. `creditBasket`'s return value is unused; `land()` sets `inNet` directly.
5. `fx.js`: `readyPop` on `levelStart` is a no-op; delete it.
6. Trivial:
   - `beginRound` can call `freeze` unconditionally;
   - remove the unused `gap = Infinity` defaults;
   - remove the impossible `?? 0` and `?? 0.25` config fallbacks.

## Acceptance Criteria
- [ ] Behaviour unchanged; all tests pass.

## Work Log
- 2026-11-24: found in ce:review (simplicity reviewer).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
