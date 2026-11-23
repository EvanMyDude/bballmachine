// Debug overlay: colliders, scoring lines, net zones, board catch areas,
// tracks with direction, ball velocities, and an aim preview showing where
// every moving board WILL be when a ball thrown now arrives.

import { STAGE } from '../config.js';
import { hoopPose } from '../game/hoop.js';
import { flightPose, boardAt } from '../game/world.js';

export function drawDebug(ctx, rt, game, tr) {
  const cfg = game.cfg;
  const hc = cfg.hoop;
  const w = game.world;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.font = '14px monospace';

  // tracks
  for (const { track } of Object.values(w.tracks)) {
    ctx.strokeStyle = 'rgba(255,0,255,0.8)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    track.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const p0 = track.points[0];
    ctx.fillStyle = 'magenta';
    ctx.fillRect(p0.x - 4, p0.y - 4, 8, 8);
  }

  for (const hoop of w.hoops) {
    const pose = hoopPose(hoop, tr);
    const rimY = pose.y + hc.rimOffsetY;
    // board catch area
    ctx.strokeStyle = 'rgba(0,255,255,0.8)';
    const m = cfg.flight.boardCatchMargin;
    ctx.strokeRect(pose.x - hc.boardW / 2 - m, pose.y - hc.boardH / 2 - m, hc.boardW + 2 * m, hc.boardH + 2 * m);
    // net zone
    ctx.fillStyle = 'rgba(255,255,0,0.15)';
    ctx.fillRect(pose.x - hc.rimHalfWidth, rimY, hc.rimHalfWidth * 2, hc.netDepth);
    // scoring line
    ctx.strokeStyle = 'lime';
    ctx.beginPath();
    ctx.moveTo(pose.x - hc.rimHalfWidth, rimY);
    ctx.lineTo(pose.x + hc.rimHalfWidth, rimY);
    ctx.stroke();
    // rim end colliders
    ctx.strokeStyle = 'red';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(pose.x + s * hc.rimHalfWidth, rimY, hc.rimEndRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    // velocity arrow + id
    if (hoop.mover) arrow(ctx, pose.x, pose.y, pose.vx * 0.4, pose.vy * 0.4, 'magenta');
    ctx.fillStyle = '#fff';
    ctx.fillText(`#${hoop.id}${hoop.mover ? ' M' : ' S'} z${hoop.z}`, pose.x - hc.boardW / 2 + 4, pose.y - hc.boardH / 2 + 14);
  }

  // balls
  for (const b of w.balls) {
    const r = cfg.ball.radius * b.scale;
    ctx.strokeStyle = b.phase === 'plane' ? 'yellow' : b.phase === 'flight' ? 'orange' : 'gray';
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (b.phase === 'plane') arrow(ctx, b.x, b.y, b.vx * 0.1, b.vy * 0.1, 'yellow');
    if (b.phase === 'flight') {
      // full flight path + landing point
      ctx.strokeStyle = 'rgba(255,165,0,0.6)';
      ctx.beginPath();
      for (let u = 0; u <= 1.001; u += 0.05) {
        const p = flightPose(b, u, cfg.flight);
        if (u === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(`${b.phase} c${b.chain}`, b.x + r + 4, b.y);
  }

  // aim preview at the cursor
  const p = rt.pointer;
  if (p && game.phase === 'playing') {
    const tArr = w.t + cfg.flight.duration;
    ctx.setLineDash([4, 4]);
    for (const hoop of w.hoops) {
      if (!hoop.mover) continue;
      const f = hoopPose(hoop, tArr);
      ctx.strokeStyle = 'rgba(0,255,255,0.45)';
      ctx.strokeRect(f.x - hc.boardW / 2, f.y - hc.boardH / 2, hc.boardW, hc.boardH);
    }
    ctx.setLineDash([]);
    const hit = boardAt(w, p.x, p.y, tArr);
    let verdict = 'MISS (behind machine)';
    let col = 'red';
    if (hit) {
      const rimY = hit.pose.y + hc.rimOffsetY;
      const inLine = Math.abs(p.x - hit.pose.x) < hc.rimHalfWidth - hc.rimEndRadius - cfg.ball.radius;
      if (p.y < rimY && inLine) {
        verdict = `CLEAN into #${hit.hoop.id}`;
        col = 'lime';
      } else if (p.y < rimY) {
        verdict = `board #${hit.hoop.id}: rim/edge`;
        col = 'orange';
      } else {
        verdict = `board #${hit.hoop.id}: below rim`;
        col = 'orange';
      }
    }
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, cfg.ball.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(verdict, p.x + cfg.ball.radius + 6, p.y + 4);
  }

  // stats
  const d = rt.debug;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(8, STAGE.PLAY_TOP + 8, 300, 92);
  ctx.fillStyle = '#0f0';
  ctx.fillText(`fps ${d.fps.toFixed(0)}  steps/frame ${d.stepsLast}`, 16, STAGE.PLAY_TOP + 28);
  ctx.fillText(`t ${w.t.toFixed(2)}  phase ${game.phase}`, 16, STAGE.PLAY_TOP + 46);
  ctx.fillText(`balls ${w.balls.length}  timeScale ${d.timeScale}`, 16, STAGE.PLAY_TOP + 64);
  ctx.fillText(`${d.paused ? 'PAUSED  ' : ''}cap ${d.fpsCap || 'off'}`, 16, STAGE.PLAY_TOP + 82);
  ctx.restore();
}

function arrow(ctx, x, y, dx, dy, col) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  const a = Math.atan2(dy, dx);
  ctx.lineTo(x + dx - Math.cos(a - 0.4) * 10, y + dy - Math.sin(a - 0.4) * 10);
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - Math.cos(a + 0.4) * 10, y + dy - Math.sin(a + 0.4) * 10);
  ctx.stroke();
}
