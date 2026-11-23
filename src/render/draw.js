// Drawing the machine: pipes, striped stops, backboards, rims, nets, ball,
// and the chrome tutorial panel. All original vector art.

import { woodTexture } from './textures.js';

export const COLORS = {
  orange: '#f26a1b',
  orangeDark: '#b9480c',
  rim: '#ff6d12',
  rimDark: '#a83c06',
  net: '#f6f6f2',
  netShade: 'rgba(120,120,120,0.55)',
  pipeEdge: '#6f757c',
  pipeMid: '#b9bec4',
  pipeCore: '#fbfbfb',
  yellowText: '#e9e23a',
};

// ---------- pipes ----------
export function drawRail(ctx, rail) {
  const pts = rail.points;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (rail.closed) ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  // soft shadow on the backdrop
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 26;
  ctx.translate(3, 4);
  path();
  ctx.stroke();
  ctx.translate(-3, -4);
  ctx.strokeStyle = COLORS.pipeEdge;
  ctx.lineWidth = 24;
  path();
  ctx.stroke();
  ctx.strokeStyle = COLORS.pipeMid;
  ctx.lineWidth = 19;
  path();
  ctx.stroke();
  ctx.strokeStyle = COLORS.pipeCore;
  ctx.lineWidth = 10;
  path();
  ctx.stroke();
  // coupling rings every ~200px
  ctx.strokeStyle = 'rgba(70,75,82,0.85)';
  ctx.lineWidth = 2;
  const n = rail.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const dx = (x1 - x0) / len;
    const dy = (y1 - y0) / len;
    for (let s = 100; s < len - 40; s += 200) {
      const cx = x0 + dx * s;
      const cy = y0 + dy * s;
      ctx.beginPath();
      ctx.moveTo(cx - dy * 12, cy + dx * 12);
      ctx.lineTo(cx + dy * 12, cy - dx * 12);
      ctx.stroke();
    }
  }
  ctx.restore();
}

let stripeCanvas = null;
function stripePattern(ctx) {
  if (!stripeCanvas) {
    stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 24;
    stripeCanvas.height = 24;
    const s = stripeCanvas.getContext('2d');
    s.fillStyle = '#f4d012';
    s.fillRect(0, 0, 24, 24);
    s.fillStyle = '#141414';
    s.beginPath();
    s.moveTo(0, 0);
    s.lineTo(12, 0);
    s.lineTo(24, 12);
    s.lineTo(24, 24);
    s.closePath();
    s.fill();
    s.beginPath();
    s.moveTo(0, 12);
    s.lineTo(12, 24);
    s.lineTo(0, 24);
    s.closePath();
    s.fill();
  }
  return ctx.createPattern(stripeCanvas, 'repeat');
}

// Striped bumper. 'h' = long axis horizontal (caps a vertical pipe).
export function drawStop(ctx, stop) {
  const long = 96;
  const thick = 28;
  ctx.save();
  ctx.translate(stop.x, stop.y);
  if (stop.orient === 'v') ctx.rotate(Math.PI / 2);
  // red collar
  ctx.fillStyle = '#b3160f';
  ctx.fillRect(-long / 2 + 6, -thick / 2 - 3, long - 12, thick + 6);
  // striped body
  ctx.fillStyle = stripePattern(ctx);
  ctx.fillRect(-long / 2 + 10, -thick / 2, long - 20, thick);
  // cylinder shading
  const g = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(-long / 2 + 10, -thick / 2, long - 20, thick);
  // red end caps
  for (const sx of [-1, 1]) {
    const cg = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
    cg.addColorStop(0, '#ff6a55');
    cg.addColorStop(0.5, '#c8180e');
    cg.addColorStop(1, '#5e0603');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(sx * (long / 2 - 9), 0, 7, thick / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- hoops ----------
export function drawBoard(ctx, pose, hc, flash = 0) {
  const w = hc.boardW;
  const h = hc.boardH;
  const x0 = Math.round(pose.x - w / 2);
  const y0 = Math.round(pose.y - h / 2);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(woodTexture(w, h), x0, y0, w, h);
  ctx.restore();
  // border
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 7;
  ctx.strokeRect(x0 + 3.5, y0 + 3.5, w - 7, h - 7);
  ctx.strokeStyle = 'rgba(120,40,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 7.5, y0 + 7.5, w - 15, h - 15);
  // shooter's square
  const rimY = pose.y + hc.rimOffsetY;
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 4;
  ctx.strokeRect(pose.x - hc.rimHalfWidth, rimY - 42, hc.rimHalfWidth * 2, 42);
  // rim bracket
  ctx.fillStyle = COLORS.rimDark;
  ctx.fillRect(pose.x - 10, rimY - 5, 20, 7);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,220,${Math.min(0.45, flash * 1.3)})`;
    ctx.fillRect(x0, y0, w, h);
  }
}

export function drawRimBack(ctx, pose, hc) {
  const y = pose.y + hc.rimOffsetY;
  ctx.strokeStyle = COLORS.rimDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(pose.x, y, hc.rimHalfWidth, 7, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

// Net: a diamond lattice from the rim to the bottom ring. A swish (0..1)
// whips the bottom up and out, then lets it settle.
export function drawNet(ctx, pose, hc, swish) {
  const top = pose.y + hc.rimOffsetY;
  const s = swish > 0 ? 1 - swish / hc.swishTime : 0; // 0 -> 1 over the swish
  const kick = swish > 0 ? Math.sin(s * Math.PI) * Math.exp(-s * 1.5) : 0;
  const depth = hc.netDepth * (1 - 0.42 * kick);
  const topHW = hc.rimHalfWidth - 2;
  const botHW = hc.rimHalfWidth * 0.58 + 16 * kick;
  // (u across 0..1, v down 0..1) -> screen, on a tapering cone
  const pt = (u, v) => {
    const hw = topHW + (botHW - topHW) * Math.pow(v, 0.85);
    const wobble = kick * Math.sin(u * 14 + v * 9) * 3;
    return [pose.x + (u * 2 - 1) * hw + wobble, top + depth * v];
  };
  const strands = 8; // per direction
  const slope = 0.55; // how far across a strand travels top->bottom
  const STEPS = 6;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? COLORS.netShade : COLORS.net;
    ctx.lineWidth = pass === 0 ? 3.4 : 1.9;
    ctx.beginPath();
    for (const dir of [1, -1]) {
      for (let i = -strands; i <= strands * 2; i++) {
        const u0 = i / strands;
        let pen = false;
        for (let k = 0; k <= STEPS; k++) {
          const v = k / STEPS;
          const u = u0 + dir * slope * v;
          if (u < -0.001 || u > 1.001) {
            pen = false;
            continue;
          }
          const [px, py] = pt(u, v);
          if (pen) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          pen = true;
        }
      }
    }
    // side edges + bottom ring
    for (const u of [0, 1]) {
      const [ax, ay] = pt(u, 0);
      ctx.moveTo(ax, ay);
      for (let k = 1; k <= STEPS; k++) {
        const [bx, by] = pt(u, k / STEPS);
        ctx.lineTo(bx, by);
      }
    }
    const [lx, ly] = pt(0, 1);
    const [rx] = pt(1, 1);
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ly);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRimFront(ctx, pose, hc) {
  const y = pose.y + hc.rimOffsetY;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.rimDark;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.ellipse(pose.x, y + 0.5, hc.rimHalfWidth, 7, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = COLORS.rim;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(pose.x, y, hc.rimHalfWidth, 7, 0, 0.05, Math.PI - 0.05);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,0.8)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(pose.x, y - 1, hc.rimHalfWidth - 2, 6, 0, 0.6, Math.PI - 0.6);
  ctx.stroke();
  ctx.restore();
}

// ---------- ball ----------
export function drawBall(ctx, x, y, r, rot, shade = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#f39a52');
  g.addColorStop(0.45, '#d9651f');
  g.addColorStop(0.85, '#a9460f');
  g.addColorStop(1, '#6a2806');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // seams (rotate with the ball)
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(rot);
  ctx.strokeStyle = 'rgba(40,14,2,0.9)';
  ctx.lineWidth = Math.max(1, r * 0.055);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.bezierCurveTo(-r * 0.4, r * 0.16, r * 0.4, r * 0.16, r, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.12, -r * 0.4, r * 0.12, r * 0.4, 0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 1.25, 0, r * 0.85, -0.95, 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 1.25, 0, r * 0.85, Math.PI - 0.95, Math.PI + 0.95);
  ctx.stroke();
  ctx.restore();
  // pebble speckle + rim light
  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.6);
  hl.addColorStop(0, 'rgba(255,230,200,0.45)');
  hl.addColorStop(1, 'rgba(255,230,200,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (shade > 0) {
    ctx.fillStyle = `rgba(40,40,46,${shade})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- chrome pipe frame (tutorial panel, menus) ----------
function pipeGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#4b4f56');
  g.addColorStop(0.18, '#9da3ab');
  g.addColorStop(0.42, '#f4f6f8');
  g.addColorStop(0.58, '#c9ced4');
  g.addColorStop(0.85, '#7d838b');
  g.addColorStop(1, '#3f4248');
  return g;
}

export function drawPipeFrame(ctx, x, y, w, h, t = 52) {
  const R = t * 1.35; // elbow centre-line radius
  const half = t / 2;
  const cx0 = x + half;
  const cy0 = y + half;
  const cx1 = x + w - half;
  const cy1 = y + h - half;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  // straight runs
  ctx.fillStyle = pipeGradient(ctx, 0, cy0 - half, 0, cy0 + half);
  ctx.fillRect(cx0 + R, cy0 - half, cx1 - cx0 - 2 * R, t);
  ctx.fillStyle = pipeGradient(ctx, 0, cy1 - half, 0, cy1 + half);
  ctx.fillRect(cx0 + R, cy1 - half, cx1 - cx0 - 2 * R, t);
  ctx.fillStyle = pipeGradient(ctx, cx0 - half, 0, cx0 + half, 0);
  ctx.fillRect(cx0 - half, cy0 + R, t, cy1 - cy0 - 2 * R);
  ctx.fillStyle = pipeGradient(ctx, cx1 - half, 0, cx1 + half, 0);
  ctx.fillRect(cx1 - half, cy0 + R, t, cy1 - cy0 - 2 * R);
  ctx.shadowColor = 'transparent';
  // elbows
  const elbows = [
    [cx0 + R, cy0 + R, Math.PI, Math.PI * 1.5],
    [cx1 - R, cy0 + R, Math.PI * 1.5, Math.PI * 2],
    [cx1 - R, cy1 - R, 0, Math.PI * 0.5],
    [cx0 + R, cy1 - R, Math.PI * 0.5, Math.PI],
  ];
  for (const [ex, ey, a0, a1] of elbows) {
    const g = ctx.createRadialGradient(ex, ey, R - half, ex, ey, R + half);
    g.addColorStop(0, '#3f4248');
    g.addColorStop(0.15, '#7d838b');
    g.addColorStop(0.42, '#c9ced4');
    g.addColorStop(0.58, '#f4f6f8');
    g.addColorStop(0.82, '#9da3ab');
    g.addColorStop(1, '#4b4f56');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, R + half, a0, a1);
    ctx.arc(ex, ey, R - half, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  // flange collars where elbows meet the runs
  const collar = (cx, cy, vertical) => {
    const L = 14;
    const T = t + 10;
    if (vertical) {
      ctx.fillStyle = pipeGradient(ctx, cx - T / 2, 0, cx + T / 2, 0);
      ctx.fillRect(cx - T / 2, cy - L / 2, T, L);
    } else {
      ctx.fillStyle = pipeGradient(ctx, 0, cy - T / 2, 0, cy + T / 2);
      ctx.fillRect(cx - L / 2, cy - T / 2, L, T);
    }
    ctx.strokeStyle = 'rgba(30,30,30,0.5)';
    ctx.lineWidth = 1;
    if (vertical) ctx.strokeRect(cx - T / 2, cy - L / 2, T, L);
    else ctx.strokeRect(cx - L / 2, cy - T / 2, L, T);
  };
  collar(cx0 + R + 7, cy0, false);
  collar(cx1 - R - 7, cy0, false);
  collar(cx0 + R + 7, cy1, false);
  collar(cx1 - R - 7, cy1, false);
  collar(cx0, cy0 + R + 7, true);
  collar(cx1, cy0 + R + 7, true);
  collar(cx0, cy1 - R - 7, true);
  collar(cx1, cy1 - R - 7, true);
  ctx.restore();
}

export const FONT = {
  display: 'Impact, "Anton", "Haettenschweiler", "Arial Narrow Bold", sans-serif',
  body: '"Arial", "Helvetica Neue", Helvetica, sans-serif',
};

export function drawTutorialPanel(ctx, panel) {
  const x = 878;
  const y = 162;
  const w = 616;
  const h = 812;
  drawPipeFrame(ctx, x, y, w, h, 54);
  const cx = x + w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `68px ${FONT.display}`;
  const lines = panel.lines;
  const y0 = 410;
  lines.forEach((ln, i) => {
    const yy = y0 + i * 96;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(ln, cx + 3, yy + 4);
    ctx.fillStyle = COLORS.yellowText;
    ctx.fillText(ln, cx, yy);
  });
  ctx.font = `38px ${FONT.body}`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(panel.sub, cx + 2, y0 + lines.length * 96 - 40 + 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(panel.sub, cx, y0 + lines.length * 96 - 40);
  ctx.restore();
}
