/** Wilson score interval for a Bernoulli proportion. z = 1.96 → ~95%. */
export function wilsonInterval(hits: number, n: number, z = 1.96) {
  if (!(n > 0) || hits < 0 || hits > n) return null;
  const p = hits / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    p,
    lo: Math.max(0, (centre - margin) / den),
    hi: Math.min(1, (centre + margin) / den),
  };
}
