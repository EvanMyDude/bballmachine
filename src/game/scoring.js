// Scoring rules: every basket is worth basketPoints; when ONE ball completes
// its 2nd / 3rd basket in a single drop, the bonus fires immediately (the
// original shows "DOUBLE! +50" over the 2nd hoop the instant it happens).

export function basketAward(chain, scfg) {
  const table = scfg.bonuses || {};
  const tableValue = table[chain] || 0;
  let bonus = 0;
  if (tableValue) {
    bonus = scfg.bonusMode === 'replace' ? tableValue - (table[chain - 1] || 0) : tableValue;
  }
  return {
    points: scfg.basketPoints,
    bonus,
    label: tableValue ? scfg.labels?.[chain] || `${chain}X!` : null,
    shown: tableValue,
  };
}

// Points still needed this level (never negative).
export function neededFor(target, levelPoints) {
  return Math.max(0, target - levelPoints);
}
