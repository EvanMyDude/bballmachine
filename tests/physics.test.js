import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfg, level, dropBall, run, createWorld } from './helpers.js';
import { shoot, boardAt } from '../src/game/world.js';
import { STAGE } from '../src/config.js';

const baskets = (ev) => ev.filter((e) => e.type === 'basket');

function assertNoRepeatHoopPerBall(ev) {
  const seen = new Set();
  for (const e of baskets(ev)) {
    const k = `${e.ballId}:${e.hoopId}`;
    assert.ok(!seen.has(k), `hoop ${e.hoopId} scored twice for ball ${e.ballId}`);
    seen.add(k);
  }
}

test('clean drop through a stationary hoop scores exactly once', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  dropBall(w, 500, 300);
  const ev = run(w, 2);
  assert.equal(baskets(ev).length, 1);
  assert.equal(baskets(ev)[0].points, 2);
  assert.equal(baskets(ev)[0].bonus, 0);
  assert.equal(w.balls.length, 0, 'ball should fall out the bottom');
});

test('slightly off-centre drop still goes in', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  dropBall(w, 512, 300);
  assert.equal(baskets(run(w, 2)).length, 1);
});

test('ball hitting the rim end bounces off and does not score', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  const b = dropBall(w, 553, 300);
  const ev = run(w, 0.4);
  assert.equal(baskets(ev).length, 0);
  assert.ok(ev.some((e) => e.type === 'rim'), 'expected a rim contact');
  assert.ok(b.vx > 0, 'should be knocked outward');
});

test('ball passing well outside the rim neither scores nor touches it', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  dropBall(w, 620, 300);
  const ev = run(w, 2);
  assert.equal(baskets(ev).length, 0);
  assert.equal(ev.filter((e) => e.type === 'rim').length, 0);
});

test('ball coming up from underneath never scores, even when it falls back down', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  dropBall(w, 500, 520, 0, -1100);
  const ev = run(w, 3);
  assert.equal(baskets(ev).length, 0);
});

test('high-speed ball does not tunnel: clean centre scores once, rim end still blocks', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 600] }, { at: [900, 600] }]), c);
  dropBall(w, 500, 160, 0, 2600);
  const rimBall = dropBall(w, 900 + c.hoop.rimHalfWidth, 160, 0, 2600);
  let minGap = Infinity;
  const ev = [];
  for (let i = 0; i < 240; i++) {
    ev.push(...run(w, 1 / 120));
    if (w.balls.includes(rimBall)) {
      const gap = Math.hypot(rimBall.x - (900 + c.hoop.rimHalfWidth), rimBall.y - (600 + c.hoop.rimOffsetY));
      minGap = Math.min(minGap, gap);
    }
  }
  const b = baskets(ev);
  assert.equal(b.length, 1);
  assert.equal(b[0].hoopId, 0);
  assert.ok(minGap >= c.ball.radius + c.hoop.rimEndRadius - 0.5, `ball overlapped rim end (gap ${minGap})`);
});

test('two stacked hoops = DOUBLE +50 on the second basket', () => {
  const w = createWorld(level([{ at: [500, 300] }, { at: [500, 470] }]), cfg());
  dropBall(w, 500, 200);
  const b = baskets(run(w, 3));
  assert.equal(b.length, 2);
  assert.deepEqual(b.map((e) => e.chain), [1, 2]);
  assert.equal(b[1].bonus, 50);
  assert.equal(b[1].label, 'DOUBLE!');
});

test('three stacked hoops = TRIPLE: +100 bonus in total by default (worth 106)', () => {
  const w = createWorld(level([{ at: [500, 250] }, { at: [500, 420] }, { at: [500, 590] }]), cfg());
  dropBall(w, 504, 150);
  const ev = run(w, 3);
  const b = baskets(ev);
  assert.equal(b.length, 3);
  assert.equal(b[1].label, 'DOUBLE!');
  assert.equal(b[2].label, 'TRIPLE!');
  assert.equal(b[2].shown, 100, 'popup shows the triple bonus');
  assert.equal(b.reduce((s, e) => s + e.points + e.bonus, 0), 2 * 3 + 100, 'triple = 106, about two doubles');
  assertNoRepeatHoopPerBall(ev);
});

test("'cumulative' bonus mode makes a triple pay 50 + 100", () => {
  const c = cfg();
  c.scoring.bonusMode = 'cumulative';
  const w = createWorld(level([{ at: [500, 250] }, { at: [500, 420] }, { at: [500, 590] }]), c);
  dropBall(w, 504, 150);
  const b = baskets(run(w, 3));
  assert.equal(b[1].bonus + b[2].bonus, 150);
});

test("'replace' bonus mode makes a triple worth 100 total", () => {
  const c = cfg();
  c.scoring.bonusMode = 'replace';
  const w = createWorld(level([{ at: [500, 250] }, { at: [500, 420] }, { at: [500, 590] }]), c);
  dropBall(w, 500, 150);
  const b = baskets(run(w, 3));
  assert.equal(b[1].bonus + b[2].bonus, 100);
});

test('rim rattles never score the same hoop twice for one ball', () => {
  // sweep entry offsets across the rim edge: lots of bounces, never a repeat
  for (let dx = 30; dx <= 60; dx += 2) {
    const w = createWorld(level([{ at: [500, 400] }]), cfg());
    dropBall(w, 500 + dx, 300);
    const ev = run(w, 3);
    assertNoRepeatHoopPerBall(ev);
    assert.ok(baskets(ev).length <= 1);
  }
});

test('a scored ball leaves the net centred under the hoop', () => {
  const w = createWorld(level([{ at: [500, 400] }]), cfg());
  const b = dropBall(w, 510, 300);
  let exitX = null;
  for (let i = 0; i < 240 && w.balls.length; i++) {
    run(w, 1 / 120);
    if (exitX === null && b.y > 402 + 74) exitX = b.x;
  }
  assert.ok(exitX !== null);
  assert.ok(Math.abs(exitX - 500) < 6, `exited at ${exitX}`);
});

test('moving hoop on a vertical rail under a fixed hoop makes doubles (level-1 style)', () => {
  const lv = level([{ at: [300, 228] }, { track: 'V', start: [300, 600], dir: 1 }], {
    tracks: { V: { mode: 'pingpong', speed: 150, points: [[300, 446], [300, 910]] } },
  });
  const w = createWorld(lv, cfg());
  dropBall(w, 300, 150);
  const b = baskets(run(w, 3));
  assert.equal(b.length, 2);
  assert.equal(b[1].label, 'DOUBLE!');
});

test('throw: click above a rim lands on the board and scores; empty space is a miss', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  assert.ok(boardAt(w, 500, 360));
  assert.equal(boardAt(w, 900, 360), null);
  shoot(w, 500, 360);
  let ev = run(w, 2.5);
  assert.ok(ev.some((e) => e.type === 'shot'));
  assert.ok(ev.some((e) => e.type === 'board'));
  assert.equal(baskets(ev).length, 1);

  shoot(w, 900, 360);
  ev = run(w, 2.5);
  assert.ok(ev.some((e) => e.type === 'miss'));
  assert.equal(baskets(ev).length, 0);
});

// ---------- one ball at a time ----------

// Step until the world has no balls; return how many steps that took and
// whether a throw was ever accepted while the ball was still visible.
function stepUntilClear(w, c, maxSteps = 2000) {
  const events = [];
  for (let i = 0; i < maxSteps; i++) {
    const b = w.balls[0];
    if (!b) return { steps: i, events };
    const r = c.ball.radius * b.scale;
    const visible =
      b.phase === 'flight' ||
      (b.y - r < STAGE.PLAY_BOTTOM && b.x + r > 0 && b.x - r < STAGE.W && (b.alpha ?? 1) > 0);
    assert.ok(visible, `ball ${b.phase} still listed after leaving view (y=${b.y.toFixed(1)})`);
    assert.equal(shoot(w, 300, 500), null, `throw accepted while a ${b.phase} ball is on screen`);
    events.push(...run(w, 1 / 120));
  }
  throw new Error('ball never left the screen');
}

test('one ball at a time: throws are refused until the ball has dropped out of view', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }, { at: [500, 570] }]), c);
  assert.ok(shoot(w, 500, 370));
  const { events } = stepUntilClear(w, c);
  assert.equal(events.filter((e) => e.type === 'basket').length, 2, 'sanity: it was a double');
  // and the instant it is gone, the very next throw is accepted
  assert.ok(shoot(w, 500, 370), 'throw should be available immediately');
});

test('the ball disappears on the exact step it is fully below the playfield', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  const b = dropBall(w, 900, STAGE.PLAY_BOTTOM - 200, 0, 600);
  let lastVisibleTop = -Infinity;
  for (let i = 0; i < 400 && w.balls.length; i++) {
    lastVisibleTop = b.y - c.ball.radius;
    run(w, 1 / 120);
  }
  assert.equal(w.balls.length, 0);
  assert.ok(lastVisibleTop < STAGE.PLAY_BOTTOM, 'it was visible on the step before');
  assert.ok(b.y - c.ball.radius >= STAGE.PLAY_BOTTOM, 'removed only once fully hidden');
});

test('refused throws emit a dud event; clicks on the HUD are silently ignored', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  assert.ok(shoot(w, 500, 360));
  w.events.length = 0;
  assert.equal(shoot(w, 500, 360), null);
  assert.equal(w.events.filter((e) => e.type === 'dud').length, 1);
  w.events.length = 0;
  stepUntilClear(w, c);
  assert.equal(shoot(w, 500, 50), null, 'HUD click');
  assert.equal(w.events.filter((e) => e.type === 'dud').length, 0);
});

test('a miss blocks the next throw only until it has faded / dropped from view', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  assert.ok(shoot(w, 1100, 500)); // empty background
  const { steps, events } = stepUntilClear(w, c);
  const seconds = steps / 120;
  assert.ok(seconds <= c.flight.duration + c.miss.duration + 0.02, `miss took ${seconds}s`);
  assert.ok(events.some((e) => e.type === 'miss'));
  assert.ok(events.some((e) => e.type === 'ready'));
  assert.ok(shoot(w, 500, 360));
});

test('a ball landing dead-centre on a rim end never balances there forever', () => {
  const c = cfg();
  for (const side of [-1, 1]) {
    const w = createWorld(level([{ at: [500, 400] }]), c);
    dropBall(w, 500 + side * c.hoop.rimHalfWidth, 300);
    run(w, 3);
    assert.equal(w.balls.length, 0, `ball stuck on the ${side < 0 ? 'left' : 'right'} rim end`);
  }
});

test('a ball knocked off the side of the screen is gone once fully past the edge', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  const b = dropBall(w, STAGE.W - 60, 300, 900, -200);
  run(w, 1);
  assert.equal(w.balls.length, 0);
  assert.ok(b.x - c.ball.radius >= STAGE.W);
});

test('with oneBallAtATime off, the old cap + cooldown still work (tuning option)', () => {
  const c = cfg();
  c.flight.oneBallAtATime = false;
  c.flight.cooldown = 0.25;
  c.flight.maxLiveBalls = 2;
  const w = createWorld(level([{ at: [500, 400] }]), c);
  assert.ok(shoot(w, 500, 360));
  assert.equal(shoot(w, 500, 360), null, 'cooldown');
  run(w, 0.26);
  assert.ok(shoot(w, 500, 360));
  run(w, 0.26);
  assert.equal(shoot(w, 500, 360), null, 'cap');
});
