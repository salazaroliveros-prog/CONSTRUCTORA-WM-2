/**
 * Formatea un número como moneda Quetzal (Q) con locale es-GT.
 * Específico para Guatemala: Q. 1,000.00
 */
export function fmtQ(n: number, fractionDigits: number = 2): string {
  if (n === 0) return 'Q. 0.00';
  return 'Q. ' + n.toLocaleString('es-GT', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}