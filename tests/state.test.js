import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/config.js';
import { createGame, update, needed, startLevel, canStart, UI } from '../src/game/state.js';
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
// Title/level start -> preview -> freeze -> deliberate click -> playing.
function startRound(game) {
  if (game.phase === 'title') click(game);
  for (let i = 0; i < 2000 && game.phase === 'intro'; i++) update(game, DT);
  assert.equal(game.phase, 'ready', 'preview should end frozen in ready');
  advance(game, 0.55); // respect the start guard + quiet gap
  click(game);
  assert.equal(game.phase, 'playing');
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
  startRound(game);
  assert.equal(needed(game), LEVELS[0].target);
});

test('level keeps running after NEEDED hits 0; passes when time ends', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(2), cfg);
  startRound(game);
  advance(game, 0.05);
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
  startRound(game);
  advance(game, 2.2 + cfg.game.buzzerGrace);
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
  startRound(game);
  game.score = 0;
  advance(game, 2.2 + cfg.game.buzzerGrace);
  advance(game, 0.5);
  click(game, UI.restart.x + 10, UI.restart.y + 10);
  assert.equal(game.levelIndex, 0);
  assert.equal(game.score, 0);
});

test('beating the last level shows victory and records best score', () => {
  const cfg = defaultConfig();
  const game = createGame(tinyLevels(1), cfg);
  startRound(game);
  advance(game, 0.1);
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
  startRound(game);
  const ticks = [];
  for (let i = 0; i < Math.round(12 / DT); i++) {
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
  startRound(game);
  advance(game, 0.05);
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
  startRound(game);
  advance(game, 0.05);
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
  startRound(game);
  advance(game, 0.05);
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
  startRound(game);
  advance(game, 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'gameOver');
  advance(game, 0.5);
  game.inputQueue.push({ type: 'key' });
  update(game, DT);
  assert.equal(game.phase, 'intro');
  assert.equal(game.levelIndex, 0);
});

// ---------- level start: preview -> freeze -> click to start ----------
import { createWorld } from '../src/game/world.js';

test('preview runs the machine up to its exact start position, then freezes and waits', () => {
  const cfg = defaultConfig();
  const game = createGame(LEVELS, cfg);
  click(game); // title -> level 1 preview
  assert.equal(game.phase, 'intro');
  assert.ok(game.world.t < 0, 'preview starts before t=0');
  const moving = game.world.hoops.find((h) => h.mover);
  const startX = moving.x;
  const startY = moving.y;
  advance(game, 0.5);
  assert.ok(moving.x !== startX || moving.y !== startY, 'hoops move during the preview');

  const ev = [];
  for (let i = 0; i < 1000 && game.phase === 'intro'; i++) {
    update(game, DT);
    ev.push(...game.events.splice(0));
  }
  assert.equal(game.phase, 'ready');
  assert.equal(game.world.t, 0, 'frozen exactly at t = 0');
  assert.equal(ev.filter((e) => e.type === 'machineFreeze').length, 1);
  const fresh = createWorld(LEVELS[0], cfg);
  game.world.hoops.forEach((h, i) => {
    assert.equal(h.x, fresh.hoops[i].x);
    assert.equal(h.y, fresh.hoops[i].y);
  });

  // a break: nothing moves and the clock doesn't run
  advance(game, 30);
  assert.equal(game.phase, 'ready');
  assert.equal(game.world.t, 0);
  assert.equal(game.timeLeft, game.levelTime);
});

test('clicking during the preview skips to the frozen start but never starts the clock', () => {
  const game = createGame(LEVELS, defaultConfig());
  click(game);
  advance(game, 0.4);
  click(game);
  assert.equal(game.phase, 'ready');
  assert.equal(game.world.t, 0);
  click(game); // immediately again: too soon (quiet gap)
  assert.equal(game.phase, 'ready');
});

test('the click that starts the round never throws a ball', () => {
  const game = createGame(LEVELS, defaultConfig());
  startRound(game);
  assert.equal(game.world.balls.length, 0);
  advance(game, 0.05);
  click(game, 292, 205); // the next click does throw
  assert.equal(game.world.balls.length, 1);
});

for (const every of [0.15, 0.33, 0.42]) {
  test(`clicking every ${every}s cannot chain from LEVEL COMPLETE into a running clock`, () => {
    const cfg = defaultConfig();
    const lv = LEVELS.slice(0, 2).map((l) => ({ ...l, time: 2, target: 1 }));
    const game = createGame(lv, cfg);
    startRound(game);
    game.score += 5;
    const stepEvery = Math.round(every / DT);
    for (let i = 0; i < Math.round(12 / DT); i++) {
      if (i % stepEvery === 0) game.inputQueue.push({ type: 'click', x: 800, y: 500 });
      update(game, DT);
      if (game.levelIndex === 1) assert.notEqual(game.phase, 'playing', 'round 2 started while clicking');
    }
    assert.equal(game.levelIndex, 1);
    assert.equal(game.phase, 'ready');
    assert.equal(canStart(game), false, 'prompt stays dim while clicking');
    advance(game, 0.55); // stop clicking for a moment...
    assert.equal(canStart(game), true, 'prompt lights up');
    click(game); // ...then one deliberate click starts it
    assert.equal(game.phase, 'playing');
  });
}

test('carried-over clicks from the buzzer never press START OVER / TRY AGAIN', () => {
  for (const every of [0.15, 0.33]) {
    const cfg = defaultConfig();
    const game = createGame(tinyLevels(2), cfg);
    startRound(game); // target 10, never reached -> game over
    const stepEvery = Math.round(every / DT);
    let sawOver = false;
    for (let i = 0; i < Math.round(8 / DT); i++) {
      if (i % stepEvery === 0) game.inputQueue.push({ type: 'click', x: UI.restart.x + 20, y: UI.restart.y + 20 });
      update(game, DT);
      if (game.phase === 'gameOver') sawOver = true;
      if (sawOver) assert.equal(game.phase, 'gameOver', `a carried-over click (every ${every}s) left the game-over screen`);
    }
    assert.ok(sawOver);
    advance(game, 0.5);
    click(game, UI.retry.x + 10, UI.retry.y + 10);
    assert.equal(game.phase, 'intro', 'a deliberate click still works');
  }
});

test('a double-click cannot skip the level preview', () => {
  const game = createGame(LEVELS, defaultConfig());
  click(game); // title -> preview
  advance(game, 3 * DT);
  click(game); // second click of the double-click
  assert.equal(game.phase, 'intro', 'still previewing');
});

test('a stray ball scoring after the round ends shows no popup and adds nothing', () => {
  const cfg = defaultConfig();
  const lv = tinyLevels(2);
  lv[0].target = 2;
  const game = createGame(lv, cfg);
  startRound(game);
  game.score += 2;
  advance(game, 2.2 + cfg.game.buzzerGrace);
  assert.equal(game.phase, 'levelEnd');
  const before = game.score;
  game.events.length = 0;
  const ev = scoreBasket(game);
  assert.equal(game.score, before);
  assert.equal(ev.filter((e) => e.type === 'basket').length, 0, 'no DOUBLE popup / sound');
});

test('several inputs in one step cause only one phase transition', () => {
  const game = createGame(LEVELS, defaultConfig());
  for (let i = 0; i < 4; i++) game.inputQueue.push({ type: 'click', x: 800, y: 500 });
  update(game, DT);
  assert.equal(game.phase, 'intro', 'title -> intro only; the extra clicks are dropped');
});

test('Space/Enter starts a frozen round, after the quiet gap', () => {
  const game = createGame(LEVELS, defaultConfig());
  click(game);
  for (let i = 0; i < 1000 && game.phase === 'intro'; i++) update(game, DT);
  advance(game, 0.55);
  game.inputQueue.push({ type: 'key' });
  update(game, DT);
  assert.equal(game.phase, 'playing');
});
