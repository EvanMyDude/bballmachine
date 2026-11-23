// Fixed-timestep accumulator. Rendering can run at any framerate; the game
// only ever advances in exact 1/hz steps, so physics never depends on FPS.

export function createLoop(cfg, stepFn) {
  let acc = 0;
  let stepIndex = 0;
  return {
    get stepIndex() {
      return stepIndex;
    },
    // feed wall-clock seconds; returns how many fixed steps ran
    advance(seconds) {
      const dt = 1 / cfg.sim.hz;
      acc += Math.min(seconds, 0.25);
      let n = 0;
      while (acc >= dt - 1e-9 && n < cfg.sim.maxStepsPerFrame) {
        stepFn(dt, stepIndex);
        stepIndex++;
        acc -= dt;
        n++;
      }
      if (n === cfg.sim.maxStepsPerFrame) acc = Math.min(acc, dt); // drop backlog
      return n;
    },
    // 0..1 progress toward the next step, for render interpolation
    get alpha() {
      return Math.max(0, Math.min(1, acc * cfg.sim.hz));
    },
  };
}
