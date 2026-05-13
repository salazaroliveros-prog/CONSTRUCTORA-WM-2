/**
 * Formatea un número como moneda Quetzal (Q) con locale es-GT.
 * Extracted from duplicated fmtQ functions across exportUtils.ts, reports.ts, etc.
 */
export function fmtQ(n: number, fractionDigits: number = 2): string {
  return 'Q ' + n.toLocaleString('es-GT', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}