---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, agent-native, testing]
dependencies: ["002"]
---

# The test/automation API lags the new flow

## Problem Statement
`window.__game` lets an agent click, but:
- it can't start a frozen round deterministically (it ends up fighting the quiet gap);
- it can't read transient events (targetReached, machineFreeze, roundStart, dud);
- it can't ask where a throw will land;
- `shootAt` can throw during intro/ready (a ball then lives on into play and breaks the identical-start guarantee);
- `status().ready` means "a throw is available", which is confusing next to the 'ready' phase.

## Proposed Solutions
Add to `src/main.js` `window.__game`:
- `start()` → `beginRound(game)`;
- `status().canStart` and `status().shotReady` (keep `ready` as an alias);
- `events()` → a capped buffer of recent game events;
- `predict(x, y)` → at arrival time, `{ board: hoopId|null, net: hoopId|null }`;
- `shootAt` refused unless phase is playing.

**Effort:** S. **Risk:** none (debug/test surface only).

## Acceptance Criteria
- [ ] Playwright can go title → start → read a `roundStart` event without timing hacks.
- [ ] `predict` agrees with the actual outcome for an over-the-board landing and a net landing.

## Work Log
- 2026-11-24: found in ce:review (agent-native reviewer).
- 2026-11-24: resolved in the review follow-up commit (see git log); covered by tests in tests/state.test.js / tests/physics.test.js.
