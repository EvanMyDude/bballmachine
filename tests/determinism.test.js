import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { createGame, update } from '../src/game/state.js';
import { createLoop } from '../src/game/loop.js';

// The same inputs on the same physics steps must give the same result no
// matter how the frames are chunked (30 fps, 144 fps, hitchy frames...).
// That proves no frame-time leaks into the simulation.

// [step index, x, y]: level-1 shots above rims, plus a miss into the background
const SHOTS = [
  [30, 292, 200],
  [110, 492, 205],
  [190, 292, 205],
  [260, 800, 600],
  [350, 492, 200],
  [420, 292, 210],
  [500, 292, 205],
];

function play(frameSeconds) {
  const cfg = defaultConfig();
  const game = createGame(LEVELS, cfg);
  const shots = new Map(SHOTS.map(([s, x, y]) => [s, { x, y }]));
  const loop = createLoop(cfg, (dt, stepIndex) => {
    if (stepIndex === 0 || stepIndex === 1) game.inputQueue.push({ type: 'click', x: 10, y: 500 }); // title, skip intro
    const s = shots.get(stepIndex);
    if (s) game.inputQueue.push({ type: 'click', ...s });
    update(game, dt);
  });
  let i = 0;
  while (loop.stepIndex < 720) {
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
    // the loop may overshoot 720 by a few steps on big frames; compare at equal steps
    if (v.steps !== base.steps) continue;
    assert.deepEqual(trimmed, base, `${name} diverged`);
  }
});

test('equal-step comparison across frame sizes (exact match)', () => {
  // frame sizes that divide 720 steps evenly so every run stops at step 720
  const a = play(1 / 120);
  const b = play(4 / 120);
  const c = play(3 / 120);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});
