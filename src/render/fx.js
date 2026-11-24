// Small, restrained feedback: DOUBLE!/TRIPLE! popups, a few sparks on
// bonuses, and the HUD score flash. No screen shake.

import { FONT, COLORS } from './draw.js';

export function createFx() {
  return { popups: [], sparks: [], scoreFlash: 0, readyPop: 0, dud: 0, banner: null, goalFlash: 0, go: 0 };
}

export function fxEvent(fx, e) {
  if (e.type === 'ready') fx.readyPop = 1;
  if (e.type === 'dud') fx.dud = 1;
  if (e.type === 'roundStart') {
    fx.go = 1;
    fx.readyPop = 1;
  }
  if (e.type === 'levelStart') {
    fx.banner = null;
    fx.goalFlash = 0;
  }
  // end-of-round screens take over from the mid-round banner
  if (e.type === 'levelComplete' || e.type === 'gameOver' || e.type === 'victory') fx.banner = null;
  if (e.type === 'targetReached') {
    fx.banner = { text: e.buzzer ? 'BUZZER BEATER!' : 'TARGET REACHED!', t: 0, life: e.buzzer ? 2.2 : 1.8 };
    fx.goalFlash = 1;
    for (let i = 0; i < 26; i++) {
      const x = 300 + ((i * 397) % 984);
      fx.sparks.push({ x, y: 420, vx: ((i * 53) % 200) - 100, vy: -260 - ((i * 71) % 260), t: 0, life: 0.9 });
    }
  }
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
  fx.goalFlash = Math.max(0, fx.goalFlash - dt * 0.9);
  fx.go = Math.max(0, fx.go - dt / 0.55);
  if (fx.banner) {
    fx.banner.t += dt;
    if (fx.banner.t >= fx.banner.life) fx.banner = null;
  }
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

function drawBanner(ctx, b) {
  const u = b.t / b.life;
  const a = u < 0.08 ? u / 0.08 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
  const s = u < 0.1 ? 1.6 - (u / 0.1) * 0.6 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  // ribbon
  const y = 420;
  const g = ctx.createLinearGradient(0, y - 70, 0, y + 50);
  g.addColorStop(0, 'rgba(20,12,0,0)');
  g.addColorStop(0.25, 'rgba(20,12,0,0.62)');
  g.addColorStop(0.75, 'rgba(20,12,0,0.62)');
  g.addColorStop(1, 'rgba(20,12,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 70, 1584, 120);
  ctx.translate(792, y);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.font = `104px ${FONT.display}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#1a0d00';
  ctx.strokeText(b.text, 0, 30);
  const tg = ctx.createLinearGradient(0, -50, 0, 30);
  tg.addColorStop(0, '#f4ff8a');
  tg.addColorStop(1, '#a6d61c');
  ctx.fillStyle = tg;
  ctx.fillText(b.text, 0, 30);
  ctx.restore();
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
  if (fx.banner) drawBanner(ctx, fx.banner);
  if (fx.go > 0) drawGo(ctx, fx.go);
}

// "GO!" the instant the clock starts: punches in, then fades fast so it
// never blocks the first throw.
function drawGo(ctx, k) {
  const u = 1 - k; // 0 -> 1 over its 0.55 s life
  const s = u < 0.15 ? 0.6 + (u / 0.15) * 0.6 : 1.2 - (u - 0.15) * 0.25;
  ctx.save();
  ctx.globalAlpha = u < 0.25 ? 1 : Math.max(0, 1 - (u - 0.25) / 0.6);
  ctx.translate(792, 600);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.font = `170px ${FONT.display}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#1a0d00';
  ctx.strokeText('GO!', 0, 50);
  ctx.fillStyle = '#c9e63b';
  ctx.fillText('GO!', 0, 50);
  ctx.restore();
}
