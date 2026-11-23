import { STAGE } from '../config.js';
import { createHoops, setHoopTime, hoopPose, boardContains } from './hoop.js';
import { stepPlaneBall } from './physics.js';

// The world for one level: hoops (stationary + moving), live balls, and an
// event list that the game state, renderer and audio consume.
//
// Ball lifecycle:
//   flight -> thrown "into" the screen from the cursor. It rises, shrinks with
//             depth, and lands in the hoop plane exactly at the click point.
//   plane  -> it landed on a backboard: 2D fall with rim/net physics.
//   miss   -> it landed on empty background: sails behind the machine.
//   dead   -> remove.

export function createWorld(level, cfg) {
  const { hoops, tracks } = createHoops(level, cfg);
  return {
    level,
    cfg,
    t: 0,
    hoops,
    tracks,
    balls: [],
    nextBallId: 1,
    lastShotT: -Infinity,
    events: [],
  };
}

export function liveBallCount(world) {
  return world.balls.filter((b) => b.phase === 'flight' || b.phase === 'plane').length;
}

export function canShoot(world, x, y) {
  const f = world.cfg.flight;
  if (y < STAGE.PLAY_TOP || y > STAGE.PLAY_BOTTOM) return false;
  if (world.t - world.lastShotT < f.cooldown) return false;
  if (liveBallCount(world) >= f.maxLiveBalls) return false;
  return true;
}

export function shoot(world, x, y) {
  if (!canShoot(world, x, y)) return null;
  const f = world.cfg.flight;
  const ball = {
    id: world.nextBallId++,
    phase: 'flight',
    age: 0,
    tx: x,
    ty: y,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    scale: f.startScale,
    pscale: f.startScale,
    shade: 0,
    alpha: 1,
    rot: 0,
    spin: 3 + ((world.nextBallId * 7) % 5), // deterministic variety
    scored: [],
    banned: [],
    chain: 0,
  };
  world.lastShotT = world.t;
  world.balls.push(ball);
  world.events.push({ type: 'shot', ballId: ball.id, x, y });
  return ball;
}

// Screen-space pose of a ball in flight at normalised time u in [0,1].
// Inverse scale is linear in u, which is how an object receding at constant
// speed shrinks under perspective.
export function flightPose(ball, u, f) {
  const inv = 1 / f.startScale + (1 - 1 / f.startScale) * u;
  return {
    x: ball.tx,
    y: ball.ty - f.arcHeight * 4 * u * (1 - u),
    scale: 1 / inv,
  };
}

// Which hoop's backboard catches a ball arriving at (x, y) at time t?
// The front-most (highest z) wins.
export function boardAt(world, x, y, t = world.t) {
  const hc = world.cfg.hoop;
  const margin = world.cfg.flight.boardCatchMargin;
  let best = null;
  for (const hoop of world.hoops) {
    const pose = hoopPose(hoop, t);
    if (boardContains(pose, x, y, hc, margin) && (!best || hoop.z > best.hoop.z)) {
      best = { hoop, pose };
    }
  }
  return best;
}

function land(world, ball, emit) {
  const f = world.cfg.flight;
  const hc = world.cfg.hoop;
  const hit = boardAt(world, ball.tx, ball.ty);
  ball.x = ball.tx;
  ball.y = ball.ty;
  ball.scale = 1;
  ball.age = 0;
  if (!hit) {
    ball.phase = 'miss';
    ball.vx = 0;
    ball.vy = 0;
    emit({ type: 'miss', ballId: ball.id, x: ball.x, y: ball.y });
    return;
  }
  ball.phase = 'plane';
  // keep part of the arc's downward motion so the drop feels continuous
  const arcFallSpeed = (4 * f.arcHeight) / f.duration;
  ball.vx = 0;
  ball.vy = arcFallSpeed * f.arrivalVyFactor;
  // a landing just below the rim line, inside the opening, still drops in
  const rimY = hit.pose.y + hc.rimOffsetY;
  if (
    ball.y >= rimY &&
    ball.y - rimY <= f.arrivalRimGrace &&
    Math.abs(ball.x - hit.pose.x) < hc.rimHalfWidth - hc.rimEndRadius
  ) {
    ball.y = rimY - 0.5;
  }
  emit({ type: 'board', ballId: ball.id, hoopId: hit.hoop.id, x: ball.x, y: ball.y });
}

export function stepWorld(world, dt) {
  const emit = (e) => world.events.push(e);
  world.t += dt;
  for (const hoop of world.hoops) {
    setHoopTime(hoop, world.t);
    if (hoop.swish > 0) hoop.swish = Math.max(0, hoop.swish - dt);
    if (hoop.flash > 0) hoop.flash = Math.max(0, hoop.flash - dt);
  }

  const f = world.cfg.flight;
  const m = world.cfg.miss;
  for (const ball of world.balls) {
    ball.px = ball.x;
    ball.py = ball.y;
    ball.pscale = ball.scale;
    if (ball.phase === 'flight') {
      ball.age += dt;
      ball.rot += ball.spin * dt;
      const u = Math.min(1, ball.age / f.duration);
      const p = flightPose(ball, u, f);
      ball.x = p.x;
      ball.y = p.y;
      ball.scale = p.scale;
      if (u >= 1) land(world, ball, emit);
    } else if (ball.phase === 'plane') {
      stepPlaneBall(ball, world, dt, emit);
    } else if (ball.phase === 'miss') {
      ball.age += dt;
      const u = Math.min(1, ball.age / m.duration);
      ball.vy += m.gravity * dt;
      ball.y += ball.vy * dt;
      ball.rot += ball.spin * dt * 0.5;
      ball.scale = 1 - (1 - m.endScale) * u;
      ball.shade = m.darken * Math.min(1, u * 2);
      ball.alpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      if (u >= 1) ball.phase = 'dead';
    }
  }
  world.balls = world.balls.filter((b) => b.phase !== 'dead');
}

export function drainEvents(world) {
  const ev = world.events;
  world.events = [];
  return ev;
}
