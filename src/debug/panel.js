// Live tuning panel (backtick key or ?debug=1). Sliders write straight into
// the shared config object, so changes take effect on the next physics step.

import { defaultConfig } from '../config.js';

const SLIDERS = [
  ['Ball', 'ball.radius', 20, 48, 1],
  ['', 'ball.gravity', 600, 4500, 50],
  ['', 'ball.airDrag', 0, 1.5, 0.05],
  ['', 'ball.maxSpeed', 800, 4000, 50],
  ['Throw', 'flight.duration', 0.25, 1.4, 0.01],
  ['', 'flight.startScale', 1.2, 4.5, 0.05],
  ['', 'flight.arcHeight', 0, 400, 5],
  ['', 'flight.arrivalVyFactor', 0, 1, 0.02],
  ['', 'flight.cooldown', 0, 1.5, 0.02],
  ['', 'flight.maxLiveBalls', 1, 8, 1],
  ['', 'flight.boardCatchMargin', 0, 40, 1],
  ['', 'flight.topCatchGrace', 0, 120, 2],
  ['Rim / net', 'hoop.rimHalfWidth', 36, 72, 1],
  ['', 'hoop.rimEndRadius', 1, 12, 0.5],
  ['', 'hoop.rimRestitution', 0, 1, 0.02],
  ['', 'hoop.rimFriction', 0, 0.6, 0.02],
  ['', 'hoop.netCentering', 0, 2500, 25],
  ['', 'hoop.netDamping', 0, 120, 1],
  ['', 'hoop.netDrag', 0, 10, 0.1],
  ['', 'hoop.netCarry', 0, 1, 0.05],
  ['', 'hoop.netCatchDepth', 0, 74, 1],
  ['Machine', 'movers.speedScale', 0, 3, 0.05],
  ['Scoring', 'scoring.basketPoints', 1, 10, 1],
  ['', 'scoring.bonuses.2', 0, 200, 5],
  ['', 'scoring.bonuses.3', 0, 400, 5],
];

const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
function set(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((a, k) => a[k], o)[last] = v;
}

export function mountPanel(el, rt, api) {
  const cfg = rt.cfg;
  el.innerHTML = '';
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.assign(n, attrs);
    for (const k of kids) n.append(k);
    return n;
  };

  el.append(h('div', { className: 'dp-title', textContent: 'TUNING  (` to hide)' }));

  const lv = h('div', { className: 'dp-row' }, 'Level ');
  for (let i = 1; i <= api.levelCount; i++) {
    lv.append(h('button', { textContent: String(i), onclick: () => api.jumpLevel(i) }));
  }
  el.append(lv);

  const ctl = h('div', { className: 'dp-row' });
  const pause = h('input', { type: 'checkbox', checked: rt.debug.paused, onchange: () => (rt.debug.paused = pause.checked) });
  ctl.append(h('label', {}, pause, ' pause (P)'));
  const ts = h('select', { onchange: () => (rt.debug.timeScale = Number(ts.value)) });
  for (const v of [0.1, 0.25, 0.5, 1, 2]) ts.append(h('option', { value: v, textContent: `${v}x`, selected: v === rt.debug.timeScale }));
  ctl.append(' speed ', ts);
  const cap = h('select', { onchange: () => (rt.debug.fpsCap = Number(cap.value)) });
  for (const v of [0, 30, 60, 144]) cap.append(h('option', { value: v, textContent: v ? `${v}fps` : 'uncapped' }));
  ctl.append(' ', cap);
  el.append(ctl);

  const ctl2 = h('div', { className: 'dp-row' });
  const ov = h('input', { type: 'checkbox', checked: rt.debug.overlay, onchange: () => (rt.debug.overlay = ov.checked) });
  ctl2.append(h('label', {}, ov, ' colliders'));
  const ref = h('input', { type: 'checkbox', checked: rt.debug.ref.on, onchange: () => (rt.debug.ref.on = ref.checked) });
  ctl2.append(h('label', {}, ref, ' reference'));
  const refOp = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    value: rt.debug.ref.opacity,
    oninput: () => (rt.debug.ref.opacity = Number(refOp.value)),
  });
  ctl2.append(refOp);
  el.append(ctl2);

  const one = h('input', {
    type: 'checkbox',
    checked: cfg.flight.oneBallAtATime,
    onchange: () => (cfg.flight.oneBallAtATime = one.checked),
  });
  el.append(h('div', { className: 'dp-row' }, h('label', {}, one, ' one ball at a time (next throw when it leaves the screen)')));

  const ctl3 = h('div', { className: 'dp-row' });
  ctl3.append(h('button', { textContent: '+10s', onclick: () => api.addTime(10) }));
  ctl3.append(h('button', { textContent: 'time→3s', onclick: () => api.setTime(3) }));
  ctl3.append(h('button', { textContent: 'fill NEEDED', onclick: () => api.fillNeeded() }));
  el.append(ctl3);

  for (const [group, path, min, max, step] of SLIDERS) {
    if (group) el.append(h('div', { className: 'dp-group', textContent: group }));
    const val = h('span', { className: 'dp-val', textContent: String(get(cfg, path)) });
    const input = h('input', {
      type: 'range',
      min,
      max,
      step,
      value: get(cfg, path),
      oninput: () => {
        const v = Number(input.value);
        set(cfg, path, v);
        val.textContent = String(v);
        if (path.startsWith('movers.')) api.rebuildHoops();
      },
    });
    el.append(h('div', { className: 'dp-slider' }, h('span', { className: 'dp-name', textContent: path }), input, val));
  }

  const mode = h('select', { onchange: () => (cfg.scoring.bonusMode = mode.value) });
  for (const v of ['cumulative', 'replace']) mode.append(h('option', { value: v, textContent: v, selected: cfg.scoring.bonusMode === v }));
  el.append(h('div', { className: 'dp-row' }, 'bonusMode ', mode));

  const out = h('textarea', { className: 'dp-out', rows: 4, readOnly: true });
  const actions = h('div', { className: 'dp-row' });
  actions.append(
    h('button', {
      textContent: 'Copy JSON',
      onclick: async () => {
        const json = JSON.stringify(cfg, null, 2);
        out.value = json;
        try {
          await navigator.clipboard.writeText(json);
        } catch {
          out.select();
        }
      },
    }),
  );
  actions.append(
    h('button', {
      textContent: 'Reset',
      onclick: () => {
        const d = defaultConfig();
        for (const k of Object.keys(d)) Object.assign(cfg[k], d[k]);
        api.rebuildHoops();
        mountPanel(el, rt, api);
      },
    }),
  );
  el.append(actions, out);
}
