import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/config.js';
import { createGame, update, needed, startLevel, UI } from '../src/game/state.js';
import { LEVELS } from '../src/levels.js';

const DT = 1 / 120;
function advance(game, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) update(game, DT);
}
function click(game, x = 800, y = 500) {
  game.inputQueue.push({ type: 'click', x, y });
  update(game, DT);
}
function tinyLevels(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    target: 10,
    time: 2,
    background: 'fire',
    rails: [],
    stops: [],
    tracks: {},
    hoops: [{ at: [500, 400] }],
  }));
}

test('all eight levels build without error and have sane data', () => {
  const cfg = defaultConfig();
  const game = createGame(LEVELS, cfg);
  assert.equal(LEVELS.length, 8);
  for (let i = 0; i < LEVELS.length; i++) {
    startLevel(game, i);
    assert.ok(game.world.hoops.length >= 3);
    assert.ok(game.target > 0);
    advance(game, 0.5);
  }
});

test('title click starts level 1 with intro, then play', () => {
  const game = createGame(LEVELS, defaultConfig());
  assert.equal(game.phase, 'title');
  click(game);
  assert.equal(game.phase, 'intro');
  assert.equal(game.levelIndex, 0);
  advance(game, 2);
  assert.equal(game.phase, 'playing');
  assert.equal(needed(game), LEVELS[0].target);
});

test('level keeps running after NEEDED hits 0; passes when time ends', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(2), cfg);
  click(game);
  advance(game, cfg.game.introTime + 0.05);
  assert.equal(game.phase, 'playing');
  game.score += 12; // pretend we scored
  assert.equal(needed(game), 0);
  advance(game, 1);
  assert.equal(game.phase, 'playing', 'timer must run out first');
  advance(game, 1.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'levelEnd');
  advance(game, cfg.game.levelEndTime + 0.05);
  assert.equal(game.levelIndex, 1);
  assert.equal(game.levelStartScore, 12, 'score is cumulative');
});

test('time out short of target = game over; retry restores the level start score', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(2), cfg);
  click(game);
  advance(game, cfg.game.introTime + 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'gameOver');
  game.score = 4; // anything; retry should restore
  advance(game, 0.5);
  click(game, UI.retry.x + 10, UI.retry.y + 10);
  assert.equal(game.phase, 'intro');
  assert.equal(game.score, 0);
  assert.equal(game.levelIndex, 0);
});

test('start over from game over goes back to level 1', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(2), cfg);
  click(game);
  game.score = 0;
  advance(game, cfg.game.introTime + 2.2 + cfg.game.buzzerGrace);
  advance(game, 0.5);
  click(game, UI.restart.x + 10, UI.restart.y + 10);
  assert.equal(game.levelIndex, 0);
  assert.equal(game.score, 0);
});

test('beating the last level shows victory and records best score', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(1), cfg);
  click(game);
  advance(game, cfg.game.introTime + 0.1);
  game.score += 20;
  advance(game, 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'victory');
  assert.equal(game.best, 20);
  assert.ok(game.newBest);
});

test('warning ticks fire once per second in the last seconds', () => {
  const cfg = defaultConfig();
  const lv = tinyLevels(1);
  lv[0].time = 12;
  const game = createGame(lv, cfg);
  click(game);
  const ticks = [];
  for (let i = 0; i < Math.round((cfg.game.introTime + 12) / DT); i++) {
    update(game, DT);
    for (const e of game.events.splice(0)) if (e.type === 'tick') ticks.push(e.seconds);
  }
  const expected = Array.from({ length: cfg.game.warnTime }, (_, i) => cfg.game.warnTime - i);
  assert.deepEqual(ticks, expected);
});

// A level with one hoop where a ball dropped into it always scores 2 points.
function scoreBasket(game) {
  const w = game.world;
  w.balls.push({
    id: w.nextBallId++, phase: 'plane', age: 0, tx: 500, ty: 300, x: 500, y: 300, px: 500, py: 300,
    vx: 0, vy: 0, scale: 1, pscale: 1, shade: 0, alpha: 1, rot: 0, spin: 0, scored: [], banned: [], chain: 0,
  });
  const seen = [];
  for (let i = 0; i < 240 && w.balls.length; i++) {
    update(game, DT);
    seen.push(...game.events.splice(0));
  }
  return seen;
}

test('TARGET REACHED fires once, the moment NEEDED hits zero, and the round keeps going', () => {
  const cfg = defaultConfig();
  const lv = tinyLevels(1);
  lv[0].target = 4;
  lv[0].time = 30;
  const game = createGame(lv, cfg);
  click(game);
  advance(game, cfg.game.introTime + 0.05);
  let ev = scoreBasket(game);
  assert.equal(ev.filter((e) => e.type === 'targetReached').length, 0, 'still 2 needed');
  ev = scoreBasket(game);
  const hit = ev.filter((e) => e.type === 'targetReached');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].buzzer, false);
  assert.equal(game.phase, 'playing', 'round continues after the target');
  ev = scoreBasket(game);
  assert.equal(ev.filter((e) => e.type === 'targetReached').length, 0, 'only once per round');
});

test('a ball that crosses the target after time runs out is a BUZZER BEATER', () => {
  const cfg = defaultConfig();
  const lv = tinyLevels(2);
  lv[0].target = 2;
  const game = createGame(lv, cfg);
  click(game);
  advance(game, cfg.game.introTime + 0.05);
  game.timeLeft = 0.01;
  // ball already in the air when the buzzer goes
  const w = game.world;
  w.balls.push({
    id: w.nextBallId++, phase: 'plane', age: 0, tx: 500, ty: 250, x: 500, y: 250, px: 500, py: 250,
    vx: 0, vy: 0, scale: 1, pscale: 1, shade: 0, alpha: 1, rot: 0, spin: 0, scored: [], banned: [], chain: 0,
  });
  const ev = [];
  for (let i = 0; i < 400 && game.phase !== 'levelEnd'; i++) {
    update(game, DT);
    ev.push(...game.events.splice(0));
  }
  const hit = ev.find((e) => e.type === 'targetReached');
  assert.ok(hit, 'target reached during the buzzer grace');
  assert.equal(hit.buzzer, true);
  assert.equal(game.phase, 'levelEnd');
});

test('round bests are recorded and flagged when beaten', () => {
  const cfg = defaultConfig();
  const lv = tinyLevels(2);
  const game = createGame(lv, cfg, { roundBest: { 1: 8 } });
  click(game);
  advance(game, cfg.game.introTime + 0.05);
  game.score += 12;
  advance(game, 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'levelEnd');
  assert.equal(game.lastRoundPoints, 12);
  assert.ok(game.newRoundBest);
  assert.equal(game.roundBest[1], 12);
});

test('Space/Enter on game over retries the round instantly', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(2), cfg);
  click(game);
  advance(game, cfg.game.introTime + 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'gameOver');
  advance(game, 0.5);
  game.inputQueue.push({ type: 'key' });
  update(game, DT);
  assert.equal(game.phase, 'intro');
  assert.equal(game.levelIndex, 0);
});
