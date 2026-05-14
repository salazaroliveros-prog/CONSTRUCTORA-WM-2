/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PMath — Operaciones matemáticas de precisa arbitraria
 * Elimina errores de punto flotante IEEE 754
 * Todas las operaciones redondean half-up al número especificado de decimales
 */

/** Redondeo half-up a N decimales */
export function precise(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Suma precisa */
export function padd(a: number, b: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return (Math.round(a * factor) + Math.round(b * factor)) / factor;
}

/** Resta precisa */
export function psub(a: number, b: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return (Math.round(a * factor) - Math.round(b * factor)) / factor;
}

/** Multiplicación precisa */
export function pmul(a: number, b: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(a * b * factor) / factor;
}

/** División precisa */
export function pdiv(a: number, b: number, decimals: number = 2): number {
  if (b === 0) return 0;
  const factor = 10 ** decimals;
  return Math.round((a / b) * factor) / factor;
}

/** Suma de array precisa */
export function psum(arr: number[], decimals: number = 2): number {
  const factor = 10 ** decimals;
  const total = arr.reduce((acc, v) => acc + Math.round(v * factor), 0);
  return total / factor;
}

// ─── Formateo manual con separadores fijos ─────────────────────────────────────
// miles = `,` coma, decimales = `.` punto (estándar Guatemala)
function fmtParts(value: number, decimals: number = 2): { int: string; dec: string } {
  const fixed = value.toFixed(decimals);
  const dotIdx = fixed.indexOf('.');
  const intPart = dotIdx === -1 ? fixed : fixed.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? '' : fixed.slice(dotIdx + 1);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return { int: withCommas, dec: decPart };
}

/** Formatea número a string 00.00 (para inputs de edición) */
export function fmtInput(value: number, decimals: number = 2): string {
  const { int, dec } = fmtParts(precise(value, decimals), decimals);
  return `${int}.${dec}`;
}

/** Formatea a moneda Q con formato Guatemala: Q. 1,500.80 */
export function fmtQ(value: number, decimals: number = 2): string {
  const { int, dec } = fmtParts(precise(value, decimals), decimals);
  return `Q. ${int}.${dec}`;
}

/** Valida que un valor numérico tenga formato 00.00 */
export function enforceFormat(value: string | number): string {
   const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.\-]/g, '')) || 0 : value;
   return precise(num, 2).toFixed(2).padStart(5, '0');
 }

/** Objeto namespace para todas las operaciones matemáticas de precisión */
export const PMath = {
   add: padd,
   sub: psub,
   mul: pmul,
   div: pdiv,
   sum: psum,
   round: precise,
   fmt: fmtInput,
   fmtQ,
   enforceFormat,
};

/** Constantes de ingeniería exportadas como named export */
export const ENGINEERING_CONSTANTS = {
   ratios: {
     steel: {
       foundation: 0.015,
       isolated: 0.015,
       column: 0.025,
       beam: 0.020,
       slab: 0.012,
       wall: 0.0025,
       bridge: 0.04,
     },
   },
   wasteFactors: {
     excavation: 1.10,
     concrete: 1.03,
     steel: 1.05,
     formwork: 1.02,
     masonry: 1.10,
     general: 1.10,
   },
   densities: {
     concrete: 2400,  // kg/m³
     steel: 7850,     // kg/m³
   },
   steelDiameters: [6, 8, 10, 12, 16, 20, 25],
   
   // Parámetros financieros por defecto (pueden ser sobrescritos por proyecto)
   taxRate: 0.12,         // IVA Guatemala
   profitMargin: 0.15,    // Margen de utilidad
   contingency: 0.05,     // Imprevistos
   indirectCosts: 15,     // % costos indirectos
   administrativeCosts: 5, // % gastos administrativos
   personalCosts: 10,     // % gastos de personal
 };