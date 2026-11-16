/** Counts such as views and likes, in K / M / B. 1234 -> 1.2K, 2685000 -> 2.7M */
export function compactCount(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  const abs = Math.abs(n);
  const trim = (x: number) => x.toFixed(decimals).replace(/\.?0+$/, "");
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return String(Math.round(n));
}

/** Rupees written out in full, with Indian digit grouping. */
export function rupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
