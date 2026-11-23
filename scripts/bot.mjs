// Headless balance check: an "ideal" player that, every `interval` seconds,
// simulates throwing into each hoop and picks the shot with the longest
// chain. Reports points per level vs the target. A human will score less, so
// targets should sit comfortably below these numbers.
//
//   node scripts/bot.mjs [interval=0.6]

import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { createWorld, stepWorld, drainEvents, shoot } from '../src/game/world.js';
import { hoopPose } from '../src/game/hoop.js';

const interval = Number(process.argv[2] || 0.6);
const cfg = defaultConfig();
const DT = 1 / cfg.sim.hz;

function simulateShot(level, t, x, y) {
  const w = createWorld(level, cfg);
  w.t = t;
  for (const h of w.hoops) Object.assign(h, hoopPose(h, t));
  shoot(w, x, y);
  let chain = 0;
  for (let i = 0; i < 360 && w.balls.length; i++) {
    stepWorld(w, DT);
    for (const e of drainEvents(w)) if (e.type === 'basket') chain = Math.max(chain, e.chain);
  }
  return chain;
}

for (const level of LEVELS) {
  const w = createWorld(level, cfg);
  let pts = 0;
  let next = 0;
  const chains = { 1: 0, 2: 0, 3: 0 };
  const steps = Math.round((level.time ?? 60) / DT);
  for (let s = 0; s < steps; s++) {
    if (w.t >= next) {
      next += interval;
      let best = null;
      for (let i = 0; i < w.hoops.length; i++) {
        const p = hoopPose(w.hoops[i], w.t + cfg.flight.duration);
        const x = p.x;
        const y = p.y + cfg.hoop.rimOffsetY - 26;
        const c = simulateShot(level, w.t, x, y);
        if (!best || c > best.c) best = { c, x, y };
      }
      if (best && best.c > 0) shoot(w, best.x, best.y);
    }
    stepWorld(w, DT);
    for (const e of drainEvents(w)) {
      if (e.type === 'basket') {
        pts += e.points + e.bonus;
        if (e.chain <= 3) chains[e.chain]++;
      }
    }
  }
  const singles = chains[1] - chains[2];
  console.log(
    `L${level.id}  target ${String(level.target).padStart(3)}  ideal ${String(pts).padStart(4)}  ` +
      `(${singles} singles, ${chains[2] - chains[3]} doubles, ${chains[3]} triples)`,
  );
}
