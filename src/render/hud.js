// Top HUD band (logo, LEVEL / SCORE / NEEDED / TIME), bottom gear strip and
// the overlay screens (title, level intro, level complete, game over, victory).

import { STAGE, GAME_TITLE_LINES } from '../config.js';
import { gearStrip } from './textures.js';
import { FONT, COLORS, drawBall, drawPipeFrame } from './draw.js';
import { UI, needed } from '../game/state.js';

let hudBg = null;
let footBg = null;
let stripeCanvas = null;

function logoPattern(ctx) {
  if (!stripeCanvas) {
    stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 16;
    stripeCanvas.height = 16;
    const s = stripeCanvas.getContext('2d');
    s.fillStyle = '#4b1f9a';
    s.fillRect(0, 0, 16, 16);
    s.strokeStyle = '#2f49d8';
    s.lineWidth = 4;
    for (let k = -16; k <= 32; k += 8) {
      s.beginPath();
      s.moveTo(k, 16);
      s.lineTo(k + 16, 0);
      s.stroke();
    }
  }
  return ctx.createPattern(stripeCanvas, 'repeat');
}

// text with manual letter spacing (consistent across browsers)
function spacedText(ctx, text, x, y, spacing, align = 'left') {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  w -= spacing;
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prev;
}

export function drawLogo(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // emblem: a ball in a gear
  ctx.save();
  ctx.translate(-160, -6);
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2;
    ctx.arc(0, 0, i % 2 ? 60 : 68, a0, a1);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8c6a3a';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawBall(ctx, 0, 0, 52, -0.5);
  ctx.restore();
  // lettering: italic, striped purple/blue, lime outline (original wordmark)
  ctx.transform(1, 0, -0.28, 1, 0, 0);
  ctx.font = `86px ${FONT.display}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; // strokes and fills must share one anchor
  const lines = GAME_TITLE_LINES;
  const pos = [
    [-60, 22],
    [0, 92],
  ];
  lines.forEach((ln, i) => {
    const [lx, ly] = pos[i] || [0, 22 + i * 70];
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#0b0820';
    spacedStroke(ctx, ln, lx, ly, 4);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#c9e63b';
    spacedStroke(ctx, ln, lx, ly, 4);
    ctx.fillStyle = logoPattern(ctx);
    spacedText(ctx, ln, lx, ly, 4);
  });
  ctx.restore();
}

function spacedStroke(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) {
    ctx.strokeText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

function label(ctx, text, x, y) {
  ctx.font = `36px ${FONT.display}`;
  ctx.textAlign = 'right';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

function numberBox(ctx, value, x, y, w, h, flash) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#5c5c5c';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,190,60,${flash * 0.6})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.font = `30px ${FONT.display}`;
  ctx.fillStyle = '#fff';
  spacedText(ctx, String(value), x + w - 10, y + h - 7, 7, 'right');
}

function bar(ctx, frac, x, y, w, h, fill, text) {
  ctx.fillStyle = '#0d1b8c';
  ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, fw, h - 4);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.25)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (text != null) {
    ctx.font = `30px ${FONT.display}`;
    ctx.fillStyle = '#fff';
    spacedText(ctx, String(text), x + w / 2, y + h - 7, 8, 'center');
  }
}

export function drawHud(ctx, game, fx, now) {
  const W = STAGE.W;
  if (!hudBg) hudBg = gearStrip(W, STAGE.PLAY_TOP, 7);
  ctx.drawImage(hudBg, 0, 0);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(0, STAGE.PLAY_TOP - 3, W, 3);

  drawLogo(ctx, 400, 50, 0.9);

  const inLevel = game.phase !== 'title';
  const lvl = inLevel ? game.levelIndex + 1 : 1;
  const score = inLevel ? game.score : 0;
  label(ctx, 'LEVEL', 850, 60);
  numberBox(ctx, lvl, 862, 26, 148, 38, 0);
  label(ctx, 'SCORE', 850, 115);
  numberBox(ctx, score, 862, 81, 148, 38, fx.scoreFlash);

  const need = inLevel ? needed(game) : game.levels[0].target;
  const target = inLevel ? game.target : game.levels[0].target;
  label(ctx, 'NEEDED', 1133, 60);
  bar(ctx, target ? need / target : 0, 1145, 26, 410, 38, '#f7941d', need);

  const tFrac = inLevel ? game.timeLeft / game.levelTime : 1;
  const warn = inLevel && game.phase === 'playing' && game.timeLeft <= game.cfg.game.warnTime;
  const blink = warn && Math.floor(now * 4) % 2 === 0;
  label(ctx, 'TIME', 1133, 115);
  bar(ctx, tFrac, 1145, 81, 410, 38, blink ? '#ff4a2a' : '#c9d22c', null);
}

export function drawFooter(ctx, muted) {
  const W = STAGE.W;
  const h = STAGE.H - STAGE.PLAY_BOTTOM;
  if (!footBg) footBg = gearStrip(W, h, 13);
  ctx.drawImage(footBg, 0, STAGE.PLAY_BOTTOM);
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(0, STAGE.PLAY_BOTTOM, W, 3);
  // sound toggle
  const r = SOUND_BUTTON;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.fillStyle = '#f2e9d8';
  const cx = r.x + 16;
  const cy = r.y + r.h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 7);
  ctx.lineTo(cx - 2, cy - 7);
  ctx.lineTo(cx + 7, cy - 15);
  ctx.lineTo(cx + 7, cy + 15);
  ctx.lineTo(cx - 2, cy + 7);
  ctx.lineTo(cx - 8, cy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f2e9d8';
  ctx.lineWidth = 3;
  if (muted) {
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy - 8);
    ctx.lineTo(cx + 28, cy + 8);
    ctx.moveTo(cx + 28, cy - 8);
    ctx.lineTo(cx + 14, cy + 8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx + 9, cy, 9, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 9, cy, 17, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

export const SOUND_BUTTON = { x: STAGE.W - 70, y: STAGE.PLAY_BOTTOM + 20, w: 52, h: 46 };

// Ball-ready lamp in the bottom strip, right where balls drop out of view.
//   lamp.state: 'ready' | 'busy' | 'off'
//   lamp.pop:   0..1 burst when a ball becomes available
//   lamp.dud:   0..1 red flash when the player clicked too early
export function drawReadyLamp(ctx, lamp) {
  const x = 62;
  const y = STAGE.PLAY_BOTTOM + 43;
  const r = 25;
  ctx.save();
  // socket
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(x - r - 12, y - r - 8, 196, 2 * r + 16, 12);
  ctx.fill();
  ctx.strokeStyle = lamp.dud > 0 ? `rgba(255,60,30,${0.5 + lamp.dud * 0.5})` : 'rgba(140,105,60,0.8)';
  ctx.lineWidth = 2 + lamp.dud * 3;
  ctx.stroke();

  const ready = lamp.state === 'ready';
  if (ready && lamp.pop > 0) {
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (1.4 + lamp.pop));
    g.addColorStop(0, `rgba(255,200,80,${0.55 * lamp.pop})`);
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.4 + lamp.pop), 0, Math.PI * 2);
    ctx.fill();
  }
  const s = ready ? 1 + 0.18 * lamp.pop : 0.92;
  drawBall(ctx, x, y, r * s, -0.4, ready ? 0 : 0.72, 1);
  if (lamp.dud > 0) {
    ctx.fillStyle = `rgba(255,40,20,${0.45 * lamp.dud})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `34px ${FONT.display}`;
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  const label = ready ? 'READY' : lamp.state === 'busy' ? 'IN PLAY' : '';
  if (label) {
    ctx.strokeText(label, x + r + 14, y + 12);
    ctx.fillStyle = ready ? '#c9e63b' : lamp.dud > 0 ? '#ff6a4a' : '#8a8172';
    ctx.fillText(label, x + r + 14, y + 12);
  }
  ctx.restore();
}

// ---------- overlay screens ----------
function shadowText(ctx, text, x, y, size, fill, { stroke = '#1a0d00', font = FONT.display, lw = 8 } = {}) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function button(ctx, b, hot) {
  ctx.save();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, hot ? '#ffb347' : '#f7941d');
  g.addColorStop(1, hot ? '#e0700f' : '#b9530a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2a1300';
  ctx.stroke();
  ctx.restore();
  shadowText(ctx, b.label, b.x + b.w / 2, b.y + b.h - 17, 36, '#fff', { lw: 6 });
}

function dim(ctx, a) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, STAGE.PLAY_TOP, STAGE.W, STAGE.PLAY_BOTTOM - STAGE.PLAY_TOP);
}

export function drawOverlay(ctx, game, pointer, now) {
  const cx = STAGE.W / 2;
  const p = game.phase;
  const hot = (b) => pointer && pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h;

  if (p === 'title') {
    dim(ctx, 0.45);
    drawPipeFrame(ctx, 352, 196, 880, 740, 50);
    ctx.fillStyle = 'rgba(10,6,2,0.72)';
    ctx.fillRect(402, 246, 780, 640);
    drawLogo(ctx, cx + 64, 322, 1.25);
    shadowText(ctx, 'Click a backboard to shoot.', cx, 506, 40, '#fff', { font: FONT.body, lw: 6 });
    shadowText(ctx, 'One ball at a time: the next is READY once it drops out.', cx, 552, 27, '#c9e63b', {
      font: FONT.body,
      lw: 5,
    });
    shadowText(ctx, 'Drop one ball through stacked hoops:', cx, 606, 32, '#fff', { font: FONT.body, lw: 6 });
    shadowText(ctx, 'DOUBLE  +50     TRIPLE  +100', cx, 668, 54, COLORS.yellowText);
    shadowText(ctx, 'Beat NEEDED before TIME runs out.', cx, 722, 32, '#fff', { font: FONT.body, lw: 6 });
    const pulse = 0.75 + 0.25 * Math.sin(now * 5);
    ctx.globalAlpha = pulse;
    shadowText(ctx, 'CLICK TO START', cx, 812, 66, '#ff9a2e');
    ctx.globalAlpha = 1;
    if (game.best > 0) shadowText(ctx, `BEST ${game.best}`, cx, 862, 30, '#c9d22c', { lw: 5 });
    return;
  }

  if (p === 'intro') {
    const t = game.phaseT;
    const a = t < 0.15 ? t / 0.15 : t > game.cfg.game.introTime - 0.25 ? Math.max(0, (game.cfg.game.introTime - t) / 0.25) : 1;
    ctx.globalAlpha = a;
    dim(ctx, 0.25);
    const s = 1 + Math.max(0, 0.15 - t) * 2;
    ctx.save();
    ctx.translate(cx, 560);
    ctx.scale(s, s);
    shadowText(ctx, `LEVEL ${game.levelIndex + 1}`, 0, 0, 150, COLORS.yellowText, { lw: 12 });
    ctx.restore();
    shadowText(ctx, `NEEDED: ${game.target}`, cx, 650, 54, '#fff', { lw: 8 });
    ctx.globalAlpha = 1;
    return;
  }

  if (p === 'buzzer') {
    shadowText(ctx, "TIME'S UP!", cx, 580, 120, '#fff', { lw: 12 });
    return;
  }

  if (p === 'levelEnd') {
    dim(ctx, 0.3);
    shadowText(ctx, 'LEVEL COMPLETE!', cx, 540, 120, COLORS.yellowText, { lw: 12 });
    shadowText(ctx, `SCORE ${game.score}`, cx, 630, 54, '#fff', { lw: 8 });
    return;
  }

  if (p === 'gameOver') {
    dim(ctx, 0.5);
    drawPipeFrame(ctx, 452, 300, 680, 470, 46);
    ctx.fillStyle = 'rgba(10,6,2,0.78)';
    ctx.fillRect(498, 346, 588, 378);
    shadowText(ctx, "TIME'S UP!", cx, 450, 100, '#ff6a2a', { lw: 10 });
    shadowText(ctx, `You needed ${needed(game)} more point${needed(game) === 1 ? '' : 's'}.`, cx, 520, 38, '#fff', {
      font: FONT.body,
      lw: 6,
    });
    shadowText(ctx, `SCORE ${game.score}`, cx, 588, 44, COLORS.yellowText, { lw: 7 });
    button(ctx, UI.retry, hot(UI.retry));
    button(ctx, UI.restart, hot(UI.restart));
    return;
  }

  if (p === 'victory') {
    dim(ctx, 0.5);
    drawPipeFrame(ctx, 402, 260, 780, 560, 48);
    ctx.fillStyle = 'rgba(10,6,2,0.78)';
    ctx.fillRect(450, 308, 684, 464);
    shadowText(ctx, 'YOU BEAT', cx, 420, 96, COLORS.yellowText, { lw: 10 });
    shadowText(ctx, 'THE MACHINE!', cx, 510, 96, COLORS.yellowText, { lw: 10 });
    shadowText(ctx, `FINAL SCORE ${game.score}`, cx, 590, 52, '#fff', { lw: 8 });
    shadowText(ctx, game.newBest ? 'NEW BEST!' : `BEST ${game.best}`, cx, 640, 36, '#c9d22c', { lw: 6 });
    button(ctx, UI.again, hot(UI.again));
  }
}
