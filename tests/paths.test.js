import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrack, pointAt, project, makeMover, moverPose } from '../src/game/paths.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('loop track closes itself and measures perimeter', () => {
  const t = makeTrack([[0, 0], [100, 0], [100, 50], [0, 50]], 'loop');
  close(t.length, 300);
  const p = pointAt(t, 275); // last edge runs (0,50) -> (0,0)
  close(p.x, 0);
  close(p.y, 25);
});

test('project finds arc-length of nearest point', () => {
  const t = makeTrack([[0, 0], [100, 0], [100, 100]], 'pingpong');
  close(project(t, 40, 5), 40);
  close(project(t, 103, 70), 170);
});

test('loop mover wraps and reports velocity along the segment', () => {
  const t = makeTrack([[0, 0], [100, 0], [100, 100], [0, 100]], 'loop');
  const m = makeMover(t, { speed: 50, start: [0, 0] });
  let p = moverPose(m, 1);
  close(p.x, 50);
  close(p.vx, 50);
  p = moverPose(m, 8); // full lap (400px at 50px/s)
  close(p.x, 0);
  close(p.y, 0);
  const back = makeMover(t, { speed: 50, start: [0, 0], dir: -1 });
  p = moverPose(back, 1); // backwards along the closing edge (0,100)->(0,0)
  close(p.x, 0);
  close(p.y, 50);
  close(p.vy, 50);
});

test('pingpong mover reverses at ends and pauses', () => {
  const t = makeTrack([[0, 0], [100, 0]], 'pingpong');
  const m = makeMover(t, { speed: 100, start: [0, 0], pause: 0.5 });
  close(moverPose(m, 0.5).x, 50);
  close(moverPose(m, 1.0).x, 100);
  const paused = moverPose(m, 1.25);
  close(paused.x, 100);
  close(paused.vx, 0);
  const back = moverPose(m, 1.75);
  close(back.x, 75);
  close(back.vx, -100);
  close(moverPose(m, 3.0).x, 0); // 1 + 0.5 + 1 + 0.5 = period 3
});

test('pingpong start point + dir -1 heads back toward the first point', () => {
  const t = makeTrack([[0, 0], [100, 0]], 'pingpong');
  const m = makeMover(t, { speed: 10, start: [60, 0], dir: -1 });
  close(moverPose(m, 0).x, 60);
  close(moverPose(m, 1).x, 50);
});
