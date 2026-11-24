// Balance report + CI gate, using the shared simulator (scripts/sim.mjs).
//
//   node scripts/bot.mjs            per-round summary for ideal / skilled / casual
//   node scripts/bot.mjs --ci       fail if perfect play can't pass a round, or
//                                   if it clears one in under 45% of the clock
//   node scripts/bot.mjs --speed=1.3   try every hoop 30% faster
//
// Explore alternatives with scripts/balance.mjs.

import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { makeSim, hitTime } from './sim.mjs';

const CI = process.argv.includes('--ci');
const speed = process.argv.find((a) => a.startsWith('--speed='));
const cfg = defaultConfig();
if (speed) cfg.movers.speedScale = Number(speed.split('=')[1]);
const { playLevel } = makeSim(cfg);
const N = 32;
const seeds = Array.from({ length: N }, (_, i) => 500 + i * 41);
const pct = (x) => (x === null ? '  -' : `${Math.round(x * 100)}%`.padStart(4));
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

let failed = false;
console.log(`speedScale ${cfg.movers.speedScale}`);
console.log('round  time  target | perfect: score  clears at | skilled: pass  median clear | casual: pass');
for (const level of LEVELS) {
  const T = level.time;
  const ideal = playLevel(level, { time: T, target: Infinity });
  const it = hitTime(ideal, level.target);
  if (it === null) {
    failed = true;
    console.error(`L${level.id}: perfect play cannot reach the target (${ideal.pts} < ${level.target})`);
  } else if (it / T < 0.45) {
    failed = true;
    console.error(`L${level.id}: too easy, perfect play clears at ${Math.round((it / T) * 100)}% of the clock`);
  }
  let line = `L${level.id}    ${String(T).padStart(4)}s ${String(level.target).padStart(6)} |        ${String(ideal.pts).padStart(5)}   ${pct(it === null ? null : it / T)}  `;
  if (!CI) {
    const sk = seeds.map((s) => playLevel(level, { profile: 'skilled', seed: s, time: T, target: Infinity }));
    const ca = seeds.map((s) => playLevel(level, { profile: 'casual', seed: s, time: T, target: Infinity }));
    const skHits = sk.map((r) => hitTime(r, level.target)).filter((x) => x !== null);
    const caPass = ca.filter((r) => hitTime(r, level.target) !== null).length / N;
    const skMed = median(skHits);
    line += `  |          ${pct(skHits.length / N)}      ${pct(skMed === null ? null : skMed / T)}       |        ${pct(caPass)}`;
  }
  console.log(line);
}
// Round 2 design rule: making every possible right-column triple is NOT
// enough; you also need one left moving-hoop triple (or two doubles).
{
  const L2 = LEVELS.find((l) => l.id === 2);
  const right = playLevel(L2, { target: Infinity, only: [0], minChain: 3 });
  const ok = right.pts < L2.target && right.pts + 106 >= L2.target;
  console.log(
    `L2 rule: all right-column triples = ${right.pts} (${right.triples}t) < target ${L2.target} <= +1 left triple ${right.pts + 106}  ${ok ? 'OK' : 'BROKEN'}`,
  );
  if (!ok) failed = true;
}

if (CI && failed) process.exit(1);
