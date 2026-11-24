// All sound is synthesized live with Web Audio (no samples): punchy,
// slightly lo-fi arcade blips in the spirit of early-2000s browser games.

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
let volume = 0.55;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 16807) % 2147483647;
    d[i] = (seed / 2147483647) * 2 - 1;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : volume, ac.currentTime, 0.02);
}
export function isMuted() {
  return muted;
}
export function setVolume(v) {
  volume = v;
  if (master && !muted) master.gain.setTargetAtTime(v, ac.currentTime, 0.02);
}

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function tone(type, freq, t, dur, peak, { to, attack = 0.005, detune = 0 } = {}) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, attack, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function noise(t, dur, peak, { type = 'bandpass', freq = 2000, q = 1, to } = {}) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  env(g, t, 0.004, peak, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const ok = () => ac && master && ac.state === 'running';

export const sfx = {
  shot() {
    if (!ok()) return;
    const t = ac.currentTime;
    noise(t, 0.28, 0.35, { type: 'bandpass', freq: 1800, q: 0.8, to: 500 });
    tone('triangle', 260, t, 0.12, 0.12, { to: 160 });
  },
  board() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('sine', 150, t, 0.12, 0.45, { to: 70 });
    noise(t, 0.06, 0.25, { type: 'lowpass', freq: 900 });
  },
  rim(strength = 300) {
    if (!ok()) return;
    const t = ac.currentTime;
    const v = Math.min(1, strength / 900) * 0.32 + 0.06;
    tone('square', 1180, t, 0.16, v * 0.5, { detune: 7 });
    tone('triangle', 1760, t, 0.22, v * 0.6);
    tone('sine', 620, t, 0.3, v * 0.5);
    noise(t, 0.05, v, { type: 'highpass', freq: 3000 });
  },
  swish() {
    if (!ok()) return;
    const t = ac.currentTime;
    noise(t, 0.22, 0.4, { type: 'highpass', freq: 2600, to: 6000 });
  },
  basket() {
    if (!ok()) return;
    const t = ac.currentTime + 0.02;
    tone('square', 880, t, 0.09, 0.12);
    tone('square', 1320, t + 0.07, 0.12, 0.12);
  },
  bonus(chain = 2) {
    if (!ok()) return;
    const t = ac.currentTime + 0.05;
    const notes = chain >= 3 ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      tone('square', f, t + i * 0.07, 0.12, 0.14);
      tone('triangle', f * 2, t + i * 0.07, 0.1, 0.06);
    });
  },
  // clicked while the ball is still in play: a soft, dull clunk
  dud() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('triangle', 180, t, 0.07, 0.16, { to: 120 });
    noise(t, 0.04, 0.08, { type: 'lowpass', freq: 500 });
  },
  // a fresh ball is ready: tiny, quiet tick so it never gets tiresome
  ready() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('sine', 1560, t, 0.035, 0.035);
  },
  miss() {
    if (!ok()) return;
    const t = ac.currentTime;
    noise(t, 0.4, 0.12, { type: 'bandpass', freq: 700, q: 0.6, to: 200 });
  },
  tick(sec) {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('square', sec <= 3 ? 1400 : 1000, t, 0.05, 0.12);
  },
  buzzer() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('sawtooth', 220, t, 0.6, 0.18, { detune: -12 });
    tone('sawtooth', 223, t, 0.6, 0.18, { detune: 12 });
  },
  levelUp() {
    if (!ok()) return;
    const t = ac.currentTime + 0.05;
    const seq = [392, 523, 659, 784, 659, 784, 1047];
    seq.forEach((f, i) => tone('square', f, t + i * 0.09, i === seq.length - 1 ? 0.4 : 0.1, 0.13));
    tone('triangle', 131, t, 0.7, 0.2);
  },
  // NEEDED just hit zero: a bright, quick "ta-daa"
  goal(buzzer = false) {
    if (!ok()) return;
    const t = ac.currentTime + 0.12;
    const seq = buzzer ? [523, 659, 784, 1047, 1319] : [784, 988, 1175, 1568];
    seq.forEach((f, i) => {
      tone('square', f, t + i * 0.075, i === seq.length - 1 ? 0.45 : 0.09, 0.13);
      tone('triangle', f / 2, t + i * 0.075, 0.12, 0.08);
    });
  },
  fail() {
    if (!ok()) return;
    const t = ac.currentTime + 0.05;
    [392, 370, 349, 262].forEach((f, i) => tone('square', f, t + i * 0.22, i === 3 ? 0.6 : 0.2, 0.12, { to: f * 0.97 }));
  },
  start() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone('square', 523, t, 0.08, 0.12);
    tone('square', 784, t + 0.08, 0.14, 0.12);
  },
};

// Map game events to sounds
export function audioEvent(e) {
  switch (e.type) {
    case 'shot':
      sfx.shot();
      break;
    case 'board':
      sfx.board();
      break;
    case 'rim':
      sfx.rim(e.strength);
      break;
    case 'basket':
      sfx.swish();
      if (e.label) sfx.bonus(e.chain);
      else sfx.basket();
      break;
    case 'miss':
      sfx.miss();
      break;
    case 'dud':
      sfx.dud();
      break;
    case 'ready':
      sfx.ready();
      break;
    case 'tick':
      sfx.tick(e.seconds);
      break;
    case 'timeUp':
      sfx.buzzer();
      break;
    case 'targetReached':
      sfx.goal(e.buzzer);
      break;
    case 'levelComplete':
    case 'victory':
      sfx.levelUp();
      break;
    case 'gameOver':
      sfx.fail();
      break;
    case 'levelStart':
      sfx.start();
      break;
    default:
      break;
  }
}
