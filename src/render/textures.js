// Procedurally generated art: every background, the wood grain and the gear
// strips are drawn in code (seeded, so they look the same on every load).
// Nothing here is copied from the original game.

import { STAGE } from '../config.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = r();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const sm = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = sm(x - xi);
    const yf = sm(y - yi);
    const a = v(xi, yi);
    const b = v(xi + 1, yi);
    const c = v(xi, yi + 1);
    const d = v(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  const fbm = (x, y, oct = 5) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
  return { noise, fbm };
}

function lerpColor(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0 || 1);
      return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u];
    }
  }
  return stops[stops.length - 1][1];
}

// Paint a noise field at low resolution, then scale it up smoothly
// (gives the soft, out-of-focus photo look of the originals' backdrops).
function fieldCanvas(w, h, down, fn) {
  const lw = Math.ceil(w / down);
  const lh = Math.ceil(h / down);
  const low = makeCanvas(lw, lh);
  const lctx = low.getContext('2d');
  const img = lctx.createImageData(lw, lh);
  const d = img.data;
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const [r, g, b] = fn(x / lw, y / lh);
      const i = (y * lw + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, w, h);
  return out;
}

function softBlur(src, down) {
  const low = makeCanvas(src.width / down, src.height / down);
  const lc = low.getContext('2d');
  lc.imageSmoothingQuality = 'high';
  lc.drawImage(src, 0, 0, low.width, low.height);
  const out = makeCanvas(src.width, src.height);
  const oc = out.getContext('2d');
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(low, 0, 0, out.width, out.height);
  return out;
}

function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const BG = {
  fire(w, h) {
    const { fbm } = makeNoise(11);
    const pal = [
      [0, [25, 4, 0]],
      [0.3, [105, 16, 2]],
      [0.5, [190, 48, 6]],
      [0.7, [238, 108, 18]],
      [0.86, [255, 170, 50]],
      [1, [255, 226, 140]],
    ];
    const c = fieldCanvas(w, h, 4, (x, y) => {
      const wx = fbm(x * 3 + 7, y * 3, 4) * 2.2;
      const wy = fbm(x * 3, y * 3 + 3, 4) * 2.2;
      let v = fbm(x * 4 + wx, y * 3 + wy, 5);
      v = v * 1.25 - 0.18 + y * 0.18 + x * 0.06;
      const smoke = fbm(x * 9 + 2, y * 9, 3);
      v -= Math.max(0, smoke - 0.55) * 0.9;
      return lerpColor(pal, v);
    });
    vignette(c.getContext('2d'), w, h, 0.45);
    return c;
  },

  bluesmoke(w, h) {
    const { fbm } = makeNoise(23);
    const pal = [
      [0, [4, 12, 32]],
      [0.35, [14, 40, 78]],
      [0.6, [36, 82, 124]],
      [0.82, [86, 132, 168]],
      [1, [170, 200, 220]],
    ];
    const c = fieldCanvas(w, h, 4, (x, y) => {
      const wx = fbm(x * 2.5 + 1, y * 2.5 + 9, 4) * 2.5;
      const wy = fbm(x * 2.5 + 5, y * 2.5, 4) * 2.5;
      let v = fbm(x * 3.5 + wx, y * 3.5 + wy, 6);
      v = v * 1.35 - 0.2 + (1 - Math.abs(x - 0.6)) * 0.12;
      return lerpColor(pal, v);
    });
    vignette(c.getContext('2d'), w, h, 0.5);
    return c;
  },

  planks(w, h) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng(5);
    ctx.fillStyle = '#5b5250';
    ctx.fillRect(0, 0, w, h);
    const panel = (cx, cy, pw, ph, ang, stripe, light, dark, shadow) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
      }
      ctx.fillStyle = dark;
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.shadowColor = 'transparent';
      for (let y = -ph / 2; y < ph / 2; y += stripe) {
        const k = 0.85 + r() * 0.3;
        ctx.fillStyle = light;
        ctx.globalAlpha = 0.55 * k;
        ctx.fillRect(-pw / 2, y, pw, stripe * 0.45);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.fillRect(-pw / 2, y + stripe * 0.45, pw, 1.5);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };
    // corrugated back panels
    panel(w * 0.3, h * 0.4, w * 1.1, h * 1.2, -0.2, 11, '#a8a09c', '#6c6462', false);
    panel(w * 0.82, h * 0.75, w * 0.8, h * 0.8, 0.38, 11, '#9f9794', '#625a58', true);
    // big dark deck boards in the middle
    ctx.save();
    ctx.translate(w * 0.47, h * 0.47);
    ctx.rotate(-0.04);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    const bw = w * 0.62;
    const bh = h * 0.92;
    ctx.fillStyle = '#4e4645';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.shadowColor = 'transparent';
    const boards = 6;
    for (let i = 0; i < boards; i++) {
      const y = -bh / 2 + (bh / boards) * i;
      const g = ctx.createLinearGradient(0, y, 0, y + bh / boards);
      const base = 70 + r() * 18;
      g.addColorStop(0, `rgb(${base + 14},${base + 6},${base + 4})`);
      g.addColorStop(1, `rgb(${base - 8},${base - 14},${base - 15})`);
      ctx.fillStyle = g;
      ctx.fillRect(-bw / 2, y + 2, bw, bh / boards - 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let k = 0; k < 14; k++) {
        ctx.beginPath();
        const yy = y + 6 + r() * (bh / boards - 12);
        ctx.moveTo(-bw / 2, yy);
        ctx.bezierCurveTo(-bw / 6, yy + r() * 6 - 3, bw / 6, yy + r() * 6 - 3, bw / 2, yy);
        ctx.stroke();
      }
    }
    ctx.restore();
    return softBlur(c, 1.6);
  },

  straw(w, h) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng(77);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#7a3a0c');
    g.addColorStop(1, '#4a1e06');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const cols = ['#f0b35a', '#e59a3a', '#d27a22', '#f6cf86', '#a8521a', '#7a3510'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 3400; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = (r() - 0.5) * Math.PI * 0.9 + (r() < 0.5 ? 0 : Math.PI / 2.4);
      const len = 50 + r() * 230;
      ctx.strokeStyle = cols[Math.floor(r() * cols.length)];
      ctx.globalAlpha = 0.45 + r() * 0.55;
      ctx.lineWidth = 1.5 + r() * 5.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 30,
        y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 30,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    vignette(ctx, w, h, 0.4);
    return c;
  },

  sky(w, h) {
    const { fbm } = makeNoise(41);
    const c = fieldCanvas(w, h, 3, (x, y) => {
      const base = lerpColor(
        [
          [0, [214, 232, 246]],
          [0.45, [150, 196, 230]],
          [1, [196, 222, 242]],
        ],
        y,
      );
      let cl = fbm(x * 3 + 4, y * 4.5, 6);
      cl = Math.max(0, Math.min(1, (cl - 0.42) * 2.6));
      const band = Math.exp(-((y - 0.5) ** 2) / 0.05);
      cl *= 0.5 + band * 0.7;
      return [base[0] + (250 - base[0]) * cl, base[1] + (252 - base[1]) * cl, base[2] + (255 - base[2]) * cl];
    });
    // the original's backdrop has a coarse diamond dither; nod to it
    const ctx = c.getContext('2d');
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#1d4f86';
    ctx.lineWidth = 1;
    for (let k = -h; k < w; k += 9) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + h, h);
      ctx.moveTo(k + h, 0);
      ctx.lineTo(k, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  },

  brick(w, h) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng(19);
    ctx.fillStyle = '#2a0904';
    ctx.fillRect(0, 0, w, h);
    const bh = 92;
    const bw = 270;
    for (let row = -1; row * bh < h + bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const k = r();
        const rr = 78 + k * 40;
        const g = ctx.createLinearGradient(0, row * bh, 0, row * bh + bh);
        g.addColorStop(0, `rgb(${rr + 20},${28 + k * 16},${14 + k * 8})`);
        g.addColorStop(1, `rgb(${rr - 30},${14 + k * 10},${8})`);
        ctx.fillStyle = g;
        ctx.fillRect(x + off + 5, row * bh + 6, bw - 10, bh - 12);
      }
    }
    const out = softBlur(c, 9);
    const o = out.getContext('2d');
    // warm light from the right, like a lit wall
    const lg = o.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.35)');
    lg.addColorStop(1, 'rgba(255,140,60,0.18)');
    o.fillStyle = lg;
    o.fillRect(0, 0, w, h);
    vignette(o, w, h, 0.5);
    return out;
  },

  beans(w, h) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const r = rng(31);
    ctx.fillStyle = '#244d0c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) {
      const x = r() * w;
      const y = r() * h;
      const rx = 55 + r() * 70;
      const ry = rx * (0.55 + r() * 0.15);
      const a = r() * Math.PI;
      const k = r();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, 4, 0, 0, rx);
      g.addColorStop(0, `rgb(${205 + k * 30},${230},${140 + k * 30})`);
      g.addColorStop(0.3, `rgb(${130 + k * 40},${175 + k * 25},${45 + k * 20})`);
      g.addColorStop(0.8, `rgb(${62 + k * 20},${105 + k * 18},${18})`);
      g.addColorStop(1, 'rgb(22,48,6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const out = softBlur(c, 7);
    vignette(out.getContext('2d'), w, h, 0.45);
    return out;
  },

  grunge(w, h) {
    const { fbm, noise } = makeNoise(57);
    return fieldCanvas(w, h, 2, (x, y) => {
      const v = fbm(x * 16 + 3, y * 11, 6);
      const blot = v > 0.55 ? 1 : v > 0.5 ? (v - 0.5) / 0.05 : 0;
      const speck = noise(x * 320, y * 240) > 0.8 ? 0.45 : 0;
      const dark = fbm(x * 3, y * 3 + 8, 3) < 0.45 ? 0.5 : 1;
      const base = [30, 37, 30];
      const hi = [96, 106, 90];
      const k = Math.min(1, blot + speck) * dark;
      return [base[0] + (hi[0] - base[0]) * k, base[1] + (hi[1] - base[1]) * k, base[2] + (hi[2] - base[2]) * k];
    });
  },
};

const bgCache = new Map();
export function backgroundFor(id) {
  const w = STAGE.W;
  const h = STAGE.PLAY_BOTTOM - STAGE.PLAY_TOP;
  if (!bgCache.has(id)) {
    const make = BG[id] || BG.fire;
    bgCache.set(id, make(w, h));
  }
  return bgCache.get(id);
}
export const BACKGROUND_IDS = Object.keys(BG);

let woodCache = null;
export function woodTexture(w, h) {
  if (woodCache && woodCache.width === w && woodCache.height === h) return woodCache;
  const { fbm } = makeNoise(3);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x / 90, y / 35, 4);
      const grain = Math.sin((y + n * 38 + x * 0.06) * 0.42) * 0.5 + 0.5;
      const fine = fbm(x / 6, y / 1.6, 2);
      const k = 0.82 + grain * 0.12 + fine * 0.1;
      const i = (y * w + x) * 4;
      d[i] = Math.min(255, 238 * k);
      d[i + 1] = Math.min(255, 182 * k);
      d[i + 2] = Math.min(255, 118 * k);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  woodCache = c;
  return c;
}

// A strip of dim bronze gears (HUD band and bottom strip).
export function gearStrip(w, h, seed) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1c140d');
  g.addColorStop(1, '#0d0906');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const count = Math.round(w / 120);
  for (let i = 0; i < count; i++) {
    const R = h * (0.45 + r() * 0.9);
    const x = r() * w;
    const y = h * (0.2 + r() * 0.8);
    drawGear(ctx, x, y, R, 10 + Math.floor(r() * 10), r() * Math.PI, 0.35 + r() * 0.35);
  }
  return softBlur(c, 2.2);
}

function drawGear(ctx, x, y, R, teeth, rot, light) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const tooth = R * 0.16;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? R : R + tooth;
    ctx.arc(0, 0, rr, a0, a1);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
  const l = light;
  g.addColorStop(0, `rgba(${200 * l + 40},${160 * l + 25},${100 * l + 10},1)`);
  g.addColorStop(1, `rgba(${80 * l + 15},${60 * l + 10},${35 * l + 5},1)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, R * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
