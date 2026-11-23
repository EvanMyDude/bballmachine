// Small, restrained feedback: DOUBLE!/TRIPLE! popups, a few sparks on
// bonuses, and the HUD score flash. No screen shake.

import { FONT, COLORS } from './draw.js';

export function createFx() {
  return { popups: [], sparks: [], scoreFlash: 0, readyPop: 0, dud: 0 };
}

export function fxEvent(fx, e) {
  if (e.type === 'ready') fx.readyPop = 1;
  if (e.type === 'dud') fx.dud = 1;
  if (e.type === 'levelStart') fx.readyPop = 1;
  if (e.type === 'basket') {
    fx.scoreFlash = 1;
    if (e.label) {
      fx.popups.push({ label: e.label, amount: e.shown, x: e.x, y: e.y - 60, t: 0, life: 1.5 });
      const n = e.chain >= 3 ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + i * 0.37;
        const sp = 220 + ((i * 53) % 140);
        fx.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, life: 0.55 });
      }
    }
  }
}

export function updateFx(fx, dt) {
  fx.scoreFlash = Math.max(0, fx.scoreFlash - dt * 3);
  fx.readyPop = Math.max(0, fx.readyPop - dt * 3.2);
  fx.dud = Math.max(0, fx.dud - dt * 3.5);
  for (const p of fx.popups) p.t += dt;
  fx.popups = fx.popups.filter((p) => p.t < p.life);
  for (const s of fx.sparks) {
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 900 * dt;
  }
  fx.sparks = fx.sparks.filter((s) => s.t < s.life);
}

export function drawFx(ctx, fx) {
  for (const s of fx.sparks) {
    const a = 1 - s.t / s.life;
    ctx.fillStyle = `rgba(255,236,120,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.2 * a + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of fx.popups) {
    const u = p.t / p.life;
    const a = u < 0.08 ? u / 0.08 : u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    const pop = u < 0.12 ? 1.35 - (u / 0.12) * 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.translate(p.x, p.y - u * 26);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.font = `78px ${FONT.display}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(90,60,0,0.6)';
    ctx.strokeText(p.label, 0, 0);
    ctx.fillStyle = COLORS.yellowText;
    ctx.fillText(p.label, 0, 0);
    ctx.font = `72px ${FONT.display}`;
    ctx.strokeText(`+${p.amount}`, 0, 74);
    ctx.fillText(`+${p.amount}`, 0, 74);
    ctx.restore();
  }
}
