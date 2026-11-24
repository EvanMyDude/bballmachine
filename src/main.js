import { STAGE, CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { createGame, update, drainGameEvents, startLevel, beginRound, needed, levelPoints } from './game/state.js';
import { createLoop } from './game/loop.js';
import { hoopPose, createHoops } from './game/hoop.js';
import { shoot, shotReady } from './game/world.js';
import { backgroundFor, makeCanvas } from './render/textures.js';
import { drawRail, drawStop, drawBoard, drawRimBack, drawNet, drawRimFront, drawBall, drawTutorialPanel } from './render/draw.js';
import { drawHud, drawFooter, drawOverlay, drawReadyLamp, SOUND_BUTTON } from './render/hud.js';
import { createFx, fxEvent, updateFx, drawFx } from './render/fx.js';
import { initAudio, audioEvent, setMuted, isMuted, setVolume } from './audio/sfx.js';
import { drawDebug } from './debug/overlay.js';
import { mountPanel } from './debug/panel.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const panelEl = document.getElementById('debug-panel');
const params = new URLSearchParams(location.search);

// ---------- persistence (per-viewer conveniences only) ----------
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`hoopworks:${k}`);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`hoopworks:${k}`, JSON.stringify(v));
    } catch {
      /* private mode etc. */
    }
  },
};

const cfg = CONFIG;
const game = createGame(LEVELS, cfg, { best: store.get('best', 0), roundBest: store.get('roundBest', {}) });
const fx = createFx();
setMuted(store.get('muted', false));
setVolume(cfg.audio.volume);

const rt = {
  cfg,
  pointer: null,
  debug: {
    panel: params.has('debug'),
    overlay: params.has('debug'),
    paused: false,
    timeScale: 1,
    fpsCap: 0,
    fps: 60,
    stepsLast: 0,
    ref: { on: false, opacity: 0.45 },
  },
  view: { scale: 1, dpr: 1, res: 1 },
};

const loop = createLoop(cfg, (dt) => update(game, dt));

// ---------- sizing ----------
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const scale = Math.min(window.innerWidth / STAGE.W, window.innerHeight / STAGE.H);
  const cssW = Math.floor(STAGE.W * scale);
  const cssH = Math.floor(STAGE.H * scale);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  rt.view = { scale, dpr, res: Math.max(1, Math.min(2, scale * dpr)) };
  layerCache.clear();
}
window.addEventListener('resize', fit);

// ---------- cached static layer: panel + pipes + stops ----------
const layerCache = new Map();
function machineLayer(level) {
  const key = `${level.id}@${rt.view.res}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const res = rt.view.res;
  const h = STAGE.PLAY_BOTTOM - STAGE.PLAY_TOP;
  const c = makeCanvas(STAGE.W * res, h * res);
  const g = c.getContext('2d');
  g.scale(res, res);
  g.translate(0, -STAGE.PLAY_TOP);
  if (level.panel) drawTutorialPanel(g, level.panel);
  for (const rail of level.rails || []) drawRail(g, rail);
  for (const stop of level.stops || []) drawStop(g, stop);
  layerCache.set(key, c);
  return c;
}

// ---------- reference screenshots (local dev only; never deployed) ----------
const refImages = new Map();
function refImage(n) {
  if (!refImages.has(n)) {
    const img = new Image();
    img.src = `reference/L${n}.png`;
    refImages.set(n, img);
  }
  return refImages.get(n);
}

// ---------- input ----------
function toStage(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * STAGE.W, y: ((e.clientY - r.top) / r.height) * STAGE.H };
}
const inRect = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

function toggleMute() {
  setMuted(!isMuted());
  store.set('muted', isMuted());
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  // left button / first finger only: right-clicks and extra touches don't throw
  if (e.button !== 0 || !e.isPrimary) return;
  initAudio();
  const p = toStage(e);
  rt.pointer = p;
  if (inRect(SOUND_BUTTON, p)) {
    toggleMute();
    return;
  }
  game.inputQueue.push({ type: 'click', x: p.x, y: p.y });
});
canvas.addEventListener('pointermove', (e) => {
  rt.pointer = toStage(e);
});
canvas.addEventListener('pointerleave', () => {
  rt.pointer = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat) return; // one action per physical press (holding Space mustn't chain screens)
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLButtonElement) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') {
    // continue / try again / start, depending on the screen
    e.preventDefault();
    initAudio();
    game.inputQueue.push({ type: 'key' });
  } else if (e.key === 'm' || e.key === 'M') toggleMute();
  else if (e.key === '`' || e.key === '~') togglePanel();
  else if (rt.debug.panel && (e.key === 'p' || e.key === 'P')) rt.debug.paused = !rt.debug.paused;
  else if (rt.debug.panel && /^[1-8]$/.test(e.key)) api.jumpLevel(Number(e.key));
});

// ---------- debug / test API ----------
const api = {
  levelCount: LEVELS.length,
  jumpLevel(n) {
    game.score = game.phase === 'title' ? 0 : game.score;
    game.inputQueue.length = 0; // a pending click mustn't throw into the new level
    startLevel(game, Math.max(0, Math.min(LEVELS.length - 1, n - 1)));
    beginRound(game);
  },
  setTime(s) {
    game.timeLeft = s;
  },
  addTime(s) {
    game.timeLeft += s;
  },
  fillNeeded() {
    game.score += needed(game);
  },
  rebuildHoops() {
    const { hoops, tracks } = createHoops(game.world.level, cfg);
    game.world.hoops = hoops;
    game.world.tracks = tracks;
  },
};

function togglePanel() {
  rt.debug.panel = !rt.debug.panel;
  rt.debug.overlay = rt.debug.panel;
  syncPanel();
}
function syncPanel() {
  panelEl.hidden = !rt.debug.panel;
  if (rt.debug.panel) mountPanel(panelEl, rt, api);
}

window.__game = {
  game,
  cfg,
  api,
  click(x, y) {
    initAudio();
    game.inputQueue.push({ type: 'click', x, y });
  },
  // Throw directly (bypasses phase checks) at stage coords.
  shootAt(x, y) {
    return !!shoot(game.world, x, y);
  },
  // Where to click so a ball thrown NOW drops cleanly into hoop i.
  lead(i, above = 26) {
    const hoop = game.world.hoops[i];
    const p = hoopPose(hoop, game.world.t + cfg.flight.duration);
    return { x: p.x, y: p.y + cfg.hoop.rimOffsetY - above };
  },
  status() {
    return {
      phase: game.phase,
      level: game.levelIndex + 1,
      score: game.score,
      needed: needed(game),
      levelPoints: levelPoints(game),
      timeLeft: +game.timeLeft.toFixed(2),
      balls: game.world.balls.map((b) => ({ id: b.id, phase: b.phase, chain: b.chain })),
      ready: game.phase === 'playing' && shotReady(game.world),
    };
  },
  jumpLevel: (n) => api.jumpLevel(n),
  setTime: (s) => api.setTime(s),
  debug: rt.debug,
};

// ---------- render ----------
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function render(now) {
  const { scale, dpr } = rt.view;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const world = game.world;
  const level = world.level;
  const hc = cfg.hoop;
  // frozen machine (ready to start): no interpolation, so nothing shimmers
  const alpha = game.phase === 'ready' ? 1 : loop.alpha;
  const tr = world.t - (1 - alpha) / cfg.sim.hz;
  const playH = STAGE.PLAY_BOTTOM - STAGE.PLAY_TOP;

  // playfield
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, STAGE.PLAY_TOP, STAGE.W, playH);
  ctx.clip();
  ctx.drawImage(backgroundFor(level.background), 0, STAGE.PLAY_TOP, STAGE.W, playH);

  const ballPos = (b) => ({
    x: lerp(b.px, b.x, alpha),
    y: lerp(b.py, b.y, alpha),
    s: lerp(b.pscale, b.scale, alpha),
  });

  // misses sail behind the machine
  for (const b of world.balls) {
    if (b.phase !== 'miss') continue;
    const p = ballPos(b);
    drawBall(ctx, p.x, p.y, cfg.ball.radius * p.s, b.rot, b.shade, b.alpha);
  }

  ctx.drawImage(machineLayer(level), 0, STAGE.PLAY_TOP, STAGE.W, playH);

  const sorted = [...world.hoops].sort((a, b) => a.z - b.z);
  const poses = new Map(sorted.map((h) => [h, hoopPose(h, tr)]));
  for (const h of sorted) {
    const pose = poses.get(h);
    drawBoard(ctx, pose, hc, h.flash);
    drawRimBack(ctx, pose, hc);
  }
  // a ball inside a net it has scored is drawn behind that net...
  for (const b of world.balls) {
    if (b.phase !== 'plane' || !b.inNet) continue;
    const p = ballPos(b);
    drawBall(ctx, p.x, p.y, cfg.ball.radius, b.rot);
  }
  for (const h of sorted) {
    const pose = poses.get(h);
    drawNet(ctx, pose, hc, h.swish);
    drawRimFront(ctx, pose, hc);
  }
  // ...every other ball is in front, so a miss never looks like it went in
  for (const b of world.balls) {
    if (b.phase !== 'plane' || b.inNet) continue;
    const p = ballPos(b);
    drawBall(ctx, p.x, p.y, cfg.ball.radius, b.rot);
  }
  drawFx(ctx, fx);
  ctx.restore();

  drawFooter(ctx, isMuted());
  drawReadyLamp(ctx, {
    state: game.phase === 'playing' ? (shotReady(world) ? 'ready' : 'busy') : 'off',
    pop: fx.readyPop,
    dud: fx.dud,
  });
  drawHud(ctx, game, fx, now / 1000);

  // balls in flight are closest to the camera: on top of everything
  for (const b of world.balls) {
    if (b.phase !== 'flight') continue;
    const p = ballPos(b);
    drawBall(ctx, p.x, p.y, cfg.ball.radius * p.s, b.rot);
  }

  drawOverlay(ctx, game, rt.pointer, now / 1000);

  if (rt.debug.ref.on) {
    const img = refImage(game.levelIndex + 1);
    if (img.complete && img.naturalWidth) {
      ctx.globalAlpha = rt.debug.ref.opacity;
      ctx.drawImage(img, 0, 0, STAGE.W, STAGE.H);
      ctx.globalAlpha = 1;
    }
  }
  if (rt.debug.overlay) drawDebug(ctx, rt, game, tr);

  // pointer cursor over buttons
  canvas.style.cursor = rt.pointer && inRect(SOUND_BUTTON, rt.pointer) ? 'pointer' : 'default';
}

// ---------- main loop ----------
let last = performance.now();
let lastRender = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (rt.debug.fpsCap && now - lastRender < 1000 / rt.debug.fpsCap - 0.5) return;
  const wallDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  lastRender = now;
  rt.debug.fps = lerp(rt.debug.fps, 1 / Math.max(1e-3, wallDt), 0.1);
  const dt = rt.debug.paused ? 0 : wallDt * rt.debug.timeScale;
  if (rt.debug.paused) game.inputQueue.length = 0; // don't let clicks pile up while debug-paused
  rt.debug.stepsLast = loop.advance(dt);
  for (const e of drainGameEvents(game)) {
    fxEvent(fx, e);
    audioEvent(e);
    if (e.type === 'gameOver' || e.type === 'victory') store.set('best', game.best);
    if (e.type === 'gameOver' || e.type === 'victory' || e.type === 'levelComplete') store.set('roundBest', game.roundBest);
  }
  updateFx(fx, dt);
  render(now);
}

fit();
syncPanel();
if (document.fonts && document.fonts.load) {
  document.fonts.load('40px Anton').catch(() => {});
}
requestAnimationFrame(frame);
