import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfg, level, dropBall, run, createWorld } from './helpers.js';
import { shoot, boardAt } from '../src/game/world.js';

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

test('three stacked hoops = TRIPLE +100 (cumulative with the double)', () => {
  const w = createWorld(level([{ at: [500, 250] }, { at: [500, 420] }, { at: [500, 590] }]), cfg());
  dropBall(w, 504, 150);
  const ev = run(w, 3);
  const b = baskets(ev);
  assert.equal(b.length, 3);
  assert.equal(b[2].bonus, 100);
  assert.equal(b[2].label, 'TRIPLE!');
  assert.equal(b.reduce((s, e) => s + e.points + e.bonus, 0), 2 * 3 + 50 + 100);
  assertNoRepeatHoopPerBall(ev);
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

test('shot cooldown and live-ball cap are enforced', () => {
  const c = cfg();
  const w = createWorld(level([{ at: [500, 400] }]), c);
  assert.ok(shoot(w, 500, 360));
  assert.equal(shoot(w, 500, 360), null, 'cooldown');
  run(w, c.flight.cooldown + 0.01);
  assert.ok(shoot(w, 500, 360));
  assert.equal(shoot(w, 500, 50), null, 'clicks on the HUD are ignored');
});
