// Polyline tracks that hoops ride along.
//   mode 'loop':     closed circuit, hoop wraps forever in one direction
//   mode 'pingpong': open rail, hoop reverses at each end (optional pause)
// A hoop's pose is a pure function of level time, so movement is exactly
// reproducible regardless of framerate.

export function makeTrack(points, mode = 'loop') {
  if (points.length < 2) throw new Error('track needs at least 2 points');
  const pts = points.map(([x, y]) => ({ x, y }));
  if (mode === 'loop') {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a.x !== b.x || a.y !== b.y) pts.push({ x: a.x, y: a.y });
  }
  const segs = [];
  let length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len === 0) continue;
    segs.push({ p, q, len, start: length, dx: (q.x - p.x) / len, dy: (q.y - p.y) / len });
    length += len;
  }
  return { mode, points: pts, segs, length };
}

// Position + unit direction at arc-length s (clamped to [0, length]).
export function pointAt(track, s) {
  const { segs, length } = track;
  if (s <= 0) {
    const g = segs[0];
    return { x: g.p.x, y: g.p.y, dx: g.dx, dy: g.dy };
  }
  if (s >= length) {
    const g = segs[segs.length - 1];
    return { x: g.q.x, y: g.q.y, dx: g.dx, dy: g.dy };
  }
  // binary search the segment
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].start <= s) lo = mid;
    else hi = mid - 1;
  }
  const g = segs[lo];
  const u = s - g.start;
  return { x: g.p.x + g.dx * u, y: g.p.y + g.dy * u, dx: g.dx, dy: g.dy };
}

// Arc-length of the closest point on the track to (x, y).
export function project(track, x, y) {
  let best = Infinity;
  let bestS = 0;
  for (const g of track.segs) {
    let u = (x - g.p.x) * g.dx + (y - g.p.y) * g.dy;
    u = Math.max(0, Math.min(g.len, u));
    const px = g.p.x + g.dx * u;
    const py = g.p.y + g.dy * u;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) {
      best = d;
      bestS = g.start + u;
    }
  }
  return bestS;
}

const mod = (a, n) => ((a % n) + n) % n;

// A mover = a track + speed + phase. Build once per hoop.
//   start: [x,y] where the hoop is at t=0 (projected onto the track)
//   dir:   +1 follows the point order, -1 goes against it
//   pause: seconds to wait at each end (pingpong only)
export function makeMover(track, { speed, start, dir = 1, pause = 0 }) {
  const s0 = start ? project(track, start[0], start[1]) : 0;
  const L = track.length;
  const mover = { track, speed, dir: dir >= 0 ? 1 : -1, pause, s0, phase0: 0 };
  if (track.mode === 'pingpong') {
    const leg = L / speed;
    // phase timeline: [fwd leg][pause][back leg][pause]
    mover.period = 2 * leg + 2 * pause;
    mover.phase0 = mover.dir > 0 ? s0 / speed : leg + pause + (L - s0) / speed;
  }
  return mover;
}

// Pose of the mover at level time t: {x, y, vx, vy}
export function moverPose(m, t) {
  const { track, speed } = m;
  const L = track.length;
  if (track.mode === 'loop') {
    const s = mod(m.s0 + m.dir * speed * t, L);
    const p = pointAt(track, s);
    return { x: p.x, y: p.y, vx: p.dx * speed * m.dir, vy: p.dy * speed * m.dir };
  }
  const leg = L / speed;
  const ph = mod(m.phase0 + t, m.period);
  let s;
  let v = 0; // +1 forward, -1 backward, 0 paused
  if (ph < leg) {
    s = ph * speed;
    v = 1;
  } else if (ph < leg + m.pause) {
    s = L;
  } else if (ph < 2 * leg + m.pause) {
    s = L - (ph - leg - m.pause) * speed;
    v = -1;
  } else {
    s = 0;
  }
  const p = pointAt(track, s);
  return { x: p.x, y: p.y, vx: p.dx * speed * v, vy: p.dy * speed * v };
}
