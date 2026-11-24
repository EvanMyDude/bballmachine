// Balance explorer: for each round, simulate many players and report how a
// range of targets would feel. Used to pick each round's time + target.
//
//   node scripts/balance.mjs                 current levels.js times
//   node scripts/balance.mjs --level=2 --times=30,35,40
//
// Goals (challenging, fair, rewarding: you should finish near the buzzer):
//   ideal   (perfect play) needs most of the clock: clears at >= ~60% of T
//   skilled passes >= 75% of the time, typically in the last quarter
//   casual  usually fails at first (needs to learn the machine)

import { defaultConfig } from '../src/config.js';
import { LEVELS } from '../src/levels.js';
import { makeSim, hitTime } from './sim.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const onlyLevel = arg('level') ? Number(arg('level')) : null;
const times = arg('times') ? arg('times').split(',').map(Number) : null;
const N = Number(arg('runs') || 24);

const cfg = defaultConfig();
const { playLevel } = makeSim(cfg);
const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 37);
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

for (const level of LEVELS) {
  if (onlyLevel && level.id !== onlyLevel) continue;
  for (const T of times || [level.time]) {
    const ideal = playLevel(level, { time: T, target: Infinity });
    const sk = seeds.map((s) => playLevel(level, { profile: 'skilled', seed: s, time: T, target: Infinity }));
    const ca = seeds.map((s) => playLevel(level, { profile: 'casual', seed: s, time: T, target: Infinity }));
    const skAvg = Math.round(sk.reduce((a, r) => a + r.pts, 0) / N);
    const caAvg = Math.round(ca.reduce((a, r) => a + r.pts, 0) / N);
    console.log(
      `\nL${level.id}  T=${T}s  current target ${level.target}   ideal ${ideal.pts} (${ideal.shots} shots, ${ideal.doubles}d ${ideal.triples}t)  skilled avg ${skAvg}  casual avg ${caAvg}`,
    );
    if (level.id === 2) {
      const r3 = playLevel(level, { time: T, target: Infinity, only: [0], minChain: 3 });
      const rAny = playLevel(level, { time: T, target: Infinity, only: [0] });
      console.log(
        `    right column: every possible triple only = ${r3.pts} (${r3.triples}t)  -> +1 left triple = ${r3.pts + 106}; right column spam = ${rAny.pts} (${rAny.triples}t ${rAny.doubles}d)`,
      );
    }
    console.log('    target | ideal clears at | skilled pass  median clear | casual pass');
    const lo = Math.max(10, Math.floor((caAvg * 0.6) / 10) * 10);
    const hi = Math.ceil((ideal.pts * 0.9) / 10) * 10;
    const step = Math.max(10, Math.round((hi - lo) / 14 / 10) * 10);
    for (let target = lo; target <= hi; target += step) {
      const it = hitTime(ideal, target);
      const skHits = sk.map((r) => hitTime(r, target)).filter((x) => x !== null);
      const caPass = ca.filter((r) => hitTime(r, target) !== null).length / N;
      const skPass = skHits.length / N;
      const skMed = median(skHits);
      const good = it !== null && it / T >= 0.58 && skPass >= 0.75 && (skMed ?? 0) / T >= 0.7 && caPass <= 0.55;
      console.log(
        `    ${String(target).padStart(6)} | ${it === null ? '  never' : pct(it / T) + ' of T'}    |    ${pct(skPass)}       ${
          skMed === null ? '  -  ' : pct(skMed / T)
        }      |   ${pct(caPass)}${good ? '   <- in the sweet spot' : ''}`,
      );
    }
  }
}
