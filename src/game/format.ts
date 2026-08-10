export function formatMoney(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' трлн';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' млрд';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' млн';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' тыс';
  return n.toFixed(2);
}
