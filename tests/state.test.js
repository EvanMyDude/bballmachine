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
  assert.equal(needed(game), 150);
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
  assert.deepEqual(ticks, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});
