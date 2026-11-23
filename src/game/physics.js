import { hoopPose } from './hoop.js';
import { basketAward } from './scoring.js';
import { STAGE } from '../config.js';

// Plane physics: once a thrown ball reaches the backboards it falls in 2D,
// in front of the boards. It only interacts with rims (each rim is two small
// circles at its ends, moving with the hoop) and nets (a gentle funnel that
// guides a scored ball out the bottom, centred under the hoop).
//
// Anti-tunnelling: each fixed step is split into substeps so the ball never
// travels more than maxSubstepTravel * radius per substep.

export function stepPlaneBall(ball, world, dt, emit) {
  const cfg = world.cfg;
  const bc = cfg.ball;
  const hc = cfg.hoop;
  const r = bc.radius;

  // integrate forces (semi-implicit Euler, split across substeps below)
  const speed0 = Math.hypot(ball.vx, ball.vy) + bc.gravity * dt;
  const n = Math.max(1, Math.ceil((speed0 * dt) / (r * bc.maxSubstepTravel)));
  const h = dt / n;
  const tEnd = world.t; // hoops are already advanced to the end of this step
  const tStart = tEnd - dt;

  for (let k = 1; k <= n; k++) {
    const tk = tStart + k * h;
    ball.vy += bc.gravity * h;
    const drag = 1 - bc.airDrag * h;
    ball.vx *= drag;
    ball.vy *= drag;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > bc.maxSpeed) {
      ball.vx *= bc.maxSpeed / sp;
      ball.vy *= bc.maxSpeed / sp;
    }

    const prevX = ball.x;
    const prevY = ball.y;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    for (const hoop of world.hoops) {
      const pose = hoop.fixed ? hoop.fixed : hoopPose(hoop, tk);
      const hvx = hoop.fixed ? 0 : pose.vx;
      const hvy = hoop.fixed ? 0 : pose.vy;
      const rimY = pose.y + hc.rimOffsetY;
      // quick reject: ball nowhere near this hoop
      if (Math.abs(ball.x - pose.x) > hc.rimHalfWidth + r + 20) continue;
      if (ball.y < rimY - r - 40 || ball.y > rimY + hc.netDepth + r + 40) continue;

      const scoredHere = ball.scored.includes(hoop.id);

      // --- net funnel (only for a ball that went through this rim) ---
      const relY = ball.y - rimY;
      if (scoredHere && relY > 0 && relY < hc.netDepth && Math.abs(ball.x - pose.x) < hc.rimHalfWidth) {
        const carryVx = hvx * (hc.netCarry ?? 0.25);
        ball.vx += ((pose.x - ball.x) * hc.netCentering - (ball.vx - carryVx) * hc.netDamping) * h;
        if (ball.vy > hvy) ball.vy -= (ball.vy - hvy) * hc.netDrag * h;
      }

      // --- rim ends ---
      for (const side of [-1, 1]) {
        const ex = pose.x + side * hc.rimHalfWidth;
        const ey = rimY;
        const dx = ball.x - ex;
        const dy = ball.y - ey;
        const R = r + hc.rimEndRadius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        ball.x = ex + nx * R;
        ball.y = ey + ny * R;
        let rvx = ball.vx - hvx;
        let rvy = ball.vy - hvy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          rvx -= (1 + hc.rimRestitution) * vn * nx;
          rvy -= (1 + hc.rimRestitution) * vn * ny;
          const tx = -ny;
          const ty = nx;
          const vt = rvx * tx + rvy * ty;
          rvx -= hc.rimFriction * vt * tx;
          rvy -= hc.rimFriction * vt * ty;
          ball.vx = rvx + hvx;
          ball.vy = rvy + hvy;
          ball.spin += vt / r;
          if (-vn > 60) emit({ type: 'rim', hoopId: hoop.id, strength: -vn, x: ex, y: ey });
        }
      }

      // --- basket: centre crossed the rim line downward, inside the opening ---
      if (!scoredHere) {
        const prevPose = hoop.fixed ? pose : hoopPose(hoop, tk - h);
        const prevRel = prevY - (prevPose.y + hc.rimOffsetY);
        const nowRel = ball.y - rimY;
        const inside = Math.abs(ball.x - pose.x) <= hc.rimHalfWidth + hc.entryAssist;
        // came up through the hoop from underneath: never counts for this ball
        if (prevRel >= 0 && nowRel < 0 && inside && !ball.banned.includes(hoop.id)) {
          ball.banned.push(hoop.id);
        }
        if (prevRel < 0 && nowRel >= 0 && inside && !ball.banned.includes(hoop.id)) {
          ball.scored.push(hoop.id);
          ball.chain += 1;
          const award = basketAward(ball.chain, cfg.scoring);
          hoop.swish = hc.swishTime;
          hoop.flash = 0.35;
          emit({
            type: 'basket',
            ballId: ball.id,
            hoopId: hoop.id,
            x: pose.x,
            y: rimY,
            chain: ball.chain,
            ...award,
          });
        }
      }
    }
  }

  ball.rot += ball.spin * dt + (ball.vx / r) * dt * 0.5;
  ball.spin *= 1 - 1.5 * dt;

  // gone below the playfield (behind the bottom strip) or off the sides
  if (ball.y - r > STAGE.PLAY_BOTTOM + 30 || ball.x < -150 || ball.x > STAGE.W + 150 || ball.y < -400) {
    ball.phase = 'dead';
    emit({ type: 'ballDone', ballId: ball.id, chain: ball.chain });
  }
}
