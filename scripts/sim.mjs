// Headless player simulator shared by the balance tools.
//
// A simulated player obeys the real rules (one ball at a time, a throw lands
// where you click). Each time a ball is available, it "imagines" a throw at
// every allowed hoop (aimed just above the rim, leading moving hoops),
// simulates each one, and takes the throw with the longest chain.
//
// Profiles:
//   ideal   instant reaction, perfect aim, always plans the best combo
//   skilled quick reaction, small aim and timing error, always plans combos
//   casual  slower, sloppier, and half the time just shoots at "a hoop"

import { createWorld, stepWorld, drainEvents, shoot, shotReady } from '../src/game/world.js';
import { hoopPose } from '../src/game/hoop.js';
import { rng } from './rng.mjs';

export const PROFILES = {
  ideal: null,
  skilled: { react: [0.3, 0.45], aim: 9, lead: 0.09, plan: 1.0 },
  casual: { react: [0.45, 0.8], aim: 14, lead: 0.2, plan: 0.5 },
};

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

export function makeSim(cfg) {
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

  let aimAbove = 26; // px above the rim the simulated player aims
  function aimAt(w, i) {
    const p = hoopPose(w.hoops[i], w.t + cfg.flight.duration);
    return { x: p.x, y: p.y + cfg.hoop.rimOffsetY - aimAbove, hoop: w.hoops[i], i };
  }

  function bestShot(level, w, allowed) {
    let best = null;
    for (const i of allowed) {
      const a = aimAt(w, i);
      const c = simulateShot(level, w.t, a.x, a.y);
      if (!best || c > best.c) best = { ...a, c };
    }
    return best;
  }

  // opts: { profile, seed, time, target, only: [hoop indices], minChain }
  function playLevel(level, opts = {}) {
    aimAbove = opts.aimAbove ?? 26;
    const look = opts.look ?? 0.05;
    const human = opts.profile ? PROFILES[opts.profile] : null;
    const r = rng(opts.seed ?? 1);
    const delay = () => (human ? human.react[0] + r() * (human.react[1] - human.react[0]) : 0);
    const time = opts.time ?? level.time ?? cfg.game.levelTime;
    const target = opts.target ?? level.target;
    const minChain = opts.minChain ?? 1;
    const w = createWorld(level, cfg);
    const allowed = opts.only ?? w.hoops.map((_, i) => i);
    let pts = 0;
    let shots = 0;
    let readyAt = 0;
    let nextLook = 0;
    let tHit = null;
    const timeline = []; // [t, cumulative points] after each basket
    const made = { 1: 0, 2: 0, 3: 0 };
    const steps = Math.round(time / DT);
    for (let s = 0; s < steps; s++) {
      if (shotReady(w) && w.t >= readyAt && w.t >= nextLook) {
        let b = bestShot(level, w, allowed);
        if (b && human && r() > human.plan) {
          b = aimAt(w, allowed[Math.floor(r() * allowed.length)]);
          b.c = minChain; // didn't plan: just throws
        }
        if (b && b.c >= minChain) {
          let { x, y } = b;
          if (human) {
            const v = hoopPose(b.hoop, w.t);
            const lead = gauss(r) * human.lead;
            x += gauss(r) * human.aim + v.vx * lead;
            y += gauss(r) * human.aim + v.vy * lead;
          }
          if (shoot(w, x, y)) shots++;
          readyAt = Infinity;
        } else {
          nextLook = w.t + look; // nothing worth throwing yet: look again shortly
        }
      }
      stepWorld(w, DT);
      for (const e of drainEvents(w)) {
        if (e.type === 'basket') {
          pts += e.points + e.bonus;
          timeline.push([w.t, pts]);
          made[Math.min(3, e.chain)]++;
          if (tHit === null && pts >= target) tHit = w.t;
        }
        if (e.type === 'ready') readyAt = w.t + delay();
      }
    }
    return {
      pts,
      shots,
      doubles: made[2] - made[3],
      triples: made[3],
      tHit,
      pass: pts >= target,
      timeline,
    };
  }

  return { playLevel, simulateShot };
}

// First time a run's score reached `target` (null if never).
export function hitTime(run, target) {
  for (const [t, p] of run.timeline) if (p >= target) return t;
  return null;
}

export function stats(runs) {
  const pts = runs.map((r) => r.pts).sort((a, b) => a - b);
  const q = (p) => pts[Math.min(pts.length - 1, Math.floor(p * pts.length))];
  const hits = runs.filter((r) => r.tHit !== null).map((r) => r.tHit);
  return {
    avg: Math.round(pts.reduce((a, b) => a + b, 0) / pts.length),
    p25: q(0.25),
    p50: q(0.5),
    passRate: runs.filter((r) => r.pass).length / runs.length,
    avgHit: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : null,
  };
}
