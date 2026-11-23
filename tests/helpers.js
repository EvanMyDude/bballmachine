import { defaultConfig } from '../src/config.js';
import { createWorld, stepWorld, drainEvents } from '../src/game/world.js';

export function cfg() {
  return defaultConfig();
}

export function level(hoops, extra = {}) {
  return { id: 99, target: 50, time: 60, background: 'fire', rails: [], stops: [], tracks: {}, hoops, ...extra };
}

// Put a ball straight into plane physics (skipping the throw).
export function dropBall(world, x, y, vx = 0, vy = 0) {
  const ball = {
    id: world.nextBallId++,
    phase: 'plane',
    age: 0,
    tx: x,
    ty: y,
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    scale: 1,
    pscale: 1,
    shade: 0,
    alpha: 1,
    rot: 0,
    spin: 0,
    scored: [],
    banned: [],
    chain: 0,
  };
  world.balls.push(ball);
  return ball;
}

export function run(world, seconds, dt = 1 / 120) {
  const events = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    stepWorld(world, dt);
    events.push(...drainEvents(world));
  }
  return events;
}

export { createWorld };
