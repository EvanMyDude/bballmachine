// Headless balance check. Two simulated players obey the real shot rule
// (one ball at a time):
//   ideal : throws the instant a ball is available, at the best hoop, perfectly
//   human : reacts after a delay, picks a hoop the same way, but with aim error
//           and timing error on moving hoops; averaged over several seeds
// Prints points per level vs the target. Targets should sit well under
// "human" so passing is reachable and score-chasing is the fun.
//
//   node scripts/bot.mjs            (both players)
//   node scripts/bot.mjs --ci       (exit 1 if the ideal player fails a level)

import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { createWorld, stepWorld, drainEvents, shoot, shotReady } from '../src/game/world.js';
import { hoopPose } from '../src/game/hoop.js';
import { rng } from './rng.mjs';

const CI = process.argv.includes('--ci');
const argNum = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
const cfg = defaultConfig();
cfg.movers.speedScale = argNum('speed', cfg.movers.speedScale);
// casual player: slower, sloppier, and often just shoots at "a hoop"
const PROFILES = {
  ideal: null,
  skilled: { react: [0.3, 0.45], aim: 9, lead: 0.09, plan: 1.0 },
  casual: { react: [0.45, 0.8], aim: 14, lead: 0.2, plan: 0.5 },
};
const DT = 1 / cfg.sim.hz;

// How many baskets would a throw at (x, y), made at time t, chain?
function simulateShot(level, t, x, y) {
  const w = createWorld(level, cfg);
  w.t = t;
  for (const h of w.hoops) Object.assign(h, hoopPose(h, t));
  shoot(w, x, y);
  let chain = 0;
  for (let i = 0; i < 480 && w.balls.length; i++) {
    stepWorld(w, DT);
    for (const e of drainEvents(w)) if (e.type === 'basket') chain = Math.max(chain, e.chain);
  }
  return chain;
}

function bestShot(level, w) {
  let best = null;
  for (let i = 0; i < w.hoops.length; i++) {
    const p = hoopPose(w.hoops[i], w.t + cfg.flight.duration);
    const x = p.x;
    const y = p.y + cfg.hoop.rimOffsetY - 26;
    const c = simulateShot(level, w.t, x, y);
    if (!best || c > best.c) best = { c, x, y, hoop: w.hoops[i] };
  }
  return best;
}

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

function play(level, human, seed) {
  const r = rng(seed);
  const delay = () => (human ? human.react[0] + r() * (human.react[1] - human.react[0]) : 0);
  const w = createWorld(level, cfg);
  let pts = 0;
  let shots = 0;
  let readyAt = 0;
  let wasReady = true;
  const chains = [0, 0, 0, 0];
  const steps = Math.round((level.time ?? 60) / DT);
  for (let s = 0; s < steps; s++) {
    const ready = shotReady(w);
    if (ready && !wasReady) readyAt = w.t + delay();
    wasReady = ready;
    if (ready && w.t >= readyAt) {
      let b = bestShot(level, w);
      if (b && human && r() > human.plan) {
        // didn't plan a combo: just pick a hoop
        const hoop = w.hoops[Math.floor(r() * w.hoops.length)];
        const p = hoopPose(hoop, w.t + cfg.flight.duration);
        b = { x: p.x, y: p.y + cfg.hoop.rimOffsetY - 26, hoop };
      }
      if (b) {
        let { x, y } = b;
        if (human) {
          const v = hoopPose(b.hoop, w.t);
          const lead = gauss(r) * human.lead; // seconds of timing error
          x += gauss(r) * human.aim + v.vx * lead;
          y += gauss(r) * human.aim + v.vy * lead;
        }
        if (shoot(w, x, y)) shots++;
      }
      readyAt = Infinity;
    }
    stepWorld(w, DT);
    for (const e of drainEvents(w)) {
      if (e.type === 'basket') {
        pts += e.points + e.bonus;
        chains[Math.min(3, e.chain)]++;
      }
      if (e.type === 'ready') readyAt = w.t + delay();
    }
  }
  return { pts, shots, doubles: chains[2] - chains[3], triples: chains[3] };
}

let failed = false;
const avgOf = (level, prof) => {
  const runs = [11, 22, 33, 44, 55, 66].map((s) => play(level, PROFILES[prof], s).pts);
  return { avg: Math.round(runs.reduce((a, b) => a + b, 0) / runs.length), min: Math.min(...runs), max: Math.max(...runs) };
};
console.log(`speedScale ${cfg.movers.speedScale}`);
console.log('level  target   ideal (shots,dbl,tri)   skilled avg        casual avg (min..max)');
for (const level of LEVELS) {
  const ideal = play(level, null, 1);
  if (ideal.pts < level.target) failed = true;
  let line =
    `L${level.id}     ${String(level.target).padStart(4)}   ${String(ideal.pts).padStart(5)} ` +
    `(${ideal.shots},${ideal.doubles},${ideal.triples})`.padEnd(14);
  if (!CI) {
    const sk = avgOf(level, 'skilled');
    const ca = avgOf(level, 'casual');
    line += `   ${String(sk.avg).padStart(5)}            ${String(ca.avg).padStart(5)} (${ca.min}..${ca.max})`;
  }
  console.log(line);
}
if (CI && failed) {
  console.error('An ideal player cannot reach a level target.');
  process.exit(1);
}
