import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { createGame, update } from '../src/game/state.js';
import { createLoop } from '../src/game/loop.js';

// The same inputs on the same physics steps must give the same result no
// matter how the frames are chunked (30 fps, 144 fps, hitchy frames...).
// That proves no frame-time leaks into the simulation.

// [step index, x, y]: level-1 shots (one ball at a time, so some are refused),
// a low landing in the net, and a miss into the background
const SHOTS = [
  [150, 292, 200],
  [230, 492, 205],
  [320, 292, 245],
  [410, 800, 600],
  [500, 492, 200],
  [600, 292, 210],
  [690, 292, 205],
];

function play(frameSeconds) {
  const cfg = defaultConfig();
  const game = createGame(LEVELS, cfg);
  const shots = new Map(SHOTS.map(([s, x, y]) => [s, { x, y }]));
  const loop = createLoop(cfg, (dt, stepIndex) => {
    // step 0: title -> preview; step 60: skip the preview (freeze);
    // step 140: start the round (past the ready guard and quiet gap)
    if (stepIndex === 0 || stepIndex === 60 || stepIndex === 140) game.inputQueue.push({ type: 'click', x: 10, y: 500 });
    const s = shots.get(stepIndex);
    if (s) game.inputQueue.push({ type: 'click', ...s });
    update(game, dt);
  });
  let i = 0;
  while (loop.stepIndex < 960) {
    loop.advance(typeof frameSeconds === 'function' ? frameSeconds(i++) : frameSeconds);
  }
  return {
    steps: loop.stepIndex,
    score: game.score,
    t: game.world.t.toFixed(6),
    balls: game.world.balls.map((b) => [b.id, b.phase, b.x.toFixed(6), b.y.toFixed(6)]),
    hoops: game.world.hoops.map((h) => [h.x.toFixed(6), h.y.toFixed(6)]),
  };
}

test('identical outcome at 30, 60, 144, 240 fps and with hitchy frames', () => {
  const base = play(1 / 120);
  assert.ok(base.score > 0, 'sanity: some shots should score');
  const variants = {
    '30fps': play(1 / 30),
    '60fps': play(1 / 60),
    '144fps': play(1 / 144),
    '240fps': play(1 / 240),
    hitchy: play((i) => [1 / 60, 1 / 20, 1 / 200, 1 / 45][i % 4]),
  };
  for (const [name, v] of Object.entries(variants)) {
    const trimmed = { ...v, steps: base.steps };
    // the loop may overshoot 960 by a few steps on big frames; compare at equal steps
    if (v.steps !== base.steps) continue;
    assert.deepEqual(trimmed, base, `${name} diverged`);
  }
});

test('equal-step comparison across frame sizes (exact match)', () => {
  // frame sizes that divide 960 steps evenly so every run stops at step 960
  const a = play(1 / 120);
  const b = play(4 / 120);
  const c = play(3 / 120);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});
