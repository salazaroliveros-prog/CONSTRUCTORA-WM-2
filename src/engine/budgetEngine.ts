/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Budget Engine — UNIFICADO v3
 *
 * Este es EL ÚNICO motor de cálculo del sistema.
 * Reemplaza completamente budgetCalc.ts y budgetEngine.ts anterior.
 * Todos los módulos DEBEN usar este engine.
 *
 * Características:
 * - Precisión matemática con PMath (elimina errores IEEE 754)
 * - Cantidades dinámicas por dimensiones (L×W×H)
 * - Cálculo de acero de refuerzo con ratios por tipología
 * - Análisis de sensibilidad con escenarios
 * - Desviación presupuestaria con umbrales
 * - Desperdicios, IVA, margen, contingencia
 * - Costo indirecto, administrativo, personal
 * - Moneda Guatemala Q.
 */

import { BudgetLine } from '../lib/budgetData';
import { SensitivityScenario } from '../types/budget';
import { PMath, precise, fmtInput, fmtQ } from './precision';

// ─── Constantes de ingeniería Guatemala ────────────────────────────────────────
export const ENGINEERING = {
  steelRatios: {
    foundation: 0.015, isolated: 0.015, column: 0.025,
    beam: 0.020, slab: 0.012, wall: 0.0025, bridge: 0.04,
  },
  wasteFactors: {
    concrete: 1.03, steel: 1.05, formwork: 1.02,
    masonry: 1.10, excavation: 1.10, general: 1.10,
  },
  densities: { concrete: 2400, steel: 7850 }, // kg/m³
  steelDiameters: [6, 8, 10, 12, 16, 20, 25],
  taxRate: 0.12,        // IVA Guatemala
  profitMargin: 0.15,   // Margen de utilidad
  contingency: 0.05,    // Imprevistos
  indirectCosts: 15,     // % costos indirectos
  adminCosts: 5,        // % gastos administrativos
  personalCosts: 10,    // % gastos de personal
} as const;

// ─── Resultado de cálculo de UNA línea ─────────────────────────────────────────
export interface LineResult {
  id: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  computationType: 'fixed' | 'dynamic' | 'steel';
  dimensions?: { length?: number; width?: number; height?: number; thickness?: number; diameter?: number };
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  materialTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  wasteTotal: number;
  subtotal: number;
  taxAmount: number;
  profitAmount: number;
  contingencyAmount: number;
  totalLine: number;
  unitCost: number;
  marketPriceIndex: number;
  laborPerf: number;
  wasteFactor: number;
  steelInfo?: {
    ratio: number;
    diameter: number;
    barLength: number;
    totalBars: number;
    weight: number;
  };
}

// ─── Resultado completo del proyecto ──────────────────────────────────────────
export interface BudgetTotals {
  materialTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  wasteTotal: number;
  subtotal: number;
  taxTotal: number;
  profitTotal: number;
  contingencyTotal: number;
  directCost: number;
  indirectCost: number;
  adminCost: number;
  personalCost: number;
  totalBudget: number;
  costPerM2: number;
  estimatedDays: number;
  lines: LineResult[];
}

// ─── Cálculo de cantidad dinámica por dimensiones ─────────────────────────────
export function calcDynamicQty(line: BudgetLine): number {
  if (line.computationType !== 'dynamic' || !line.dimensions) return line.qty;
  const d = line.dimensions;
  const desc = (line.description || '').toLowerCase();
  let vol = 0;

  if (/cimentaci[oó]n|zapata/i.test(desc)) {
    vol = (d.length || 0) * (d.width || 0) * (d.height || 0);
    line.unit = 'm³';
  } else if (/columna/i.test(desc)) {
    vol = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/solera/i.test(desc)) {
    vol = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/losa|entrepiso/i.test(desc)) {
    vol = (d.length || 0) * (d.width || 0) * (d.thickness || 0.15);
    line.unit = 'm³';
  } else if (/carretera|sub-base|base asf.ltica/i.test(desc)) {
    vol = (d.length || 0) * (d.width || 0) * (d.thickness || 0.15);
    line.unit = 'm³';
  } else if (/puente|pilas/i.test(desc)) {
    vol = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/fachada|vidrio/i.test(desc)) {
    vol = (d.length || 0) * (d.height || 0);
    line.unit = 'm²';
  } else if (/cerramientos|perimetrales/i.test(desc)) {
    vol = (d.length || 0) * (d.height || 0);
    line.unit = 'm';
  } else if (/piso industrial|accesibilidad/i.test(desc)) {
    vol = (d.length || 0) * (d.width || 0);
    line.unit = 'm²';
  } else if (/estructura met.lica|cubierta/i.test(desc)) {
    vol = (d.length || 0) * (d.width || 0);
    line.unit = 'm²';
  }

  const wasteF = line.wasteFactor || ENGINEERING.wasteFactors.concrete;
  return precise(vol * wasteF);
}

// ─── Cálculo de acero de refuerzo ─────────────────────────────────────────────
export interface SteelCalcResult {
  ratio: number;
  diameter: number;
  barLength: number;
  totalBars: number;
  weight: number;
  cost: number;
}

export function calcSteelReinforcement(line: BudgetLine): SteelCalcResult {
  const desc = (line.description || '').toLowerCase();
  const typology = (line.typology || '').toUpperCase();
  const qty = line.qty || 0;

  let ratio = 0.015;
  if (/columna/i.test(desc)) ratio = typology === 'INDUSTRIAL' ? 0.03 : 0.025;
  else if (/viga|vigueta/i.test(desc)) ratio = typology === 'COMERCIAL' ? 0.018 : 0.020;
  else if (/losa/i.test(desc)) ratio = typology === 'COMERCIAL' ? 0.013 : 0.012;
  else if (/cimentaci[oó]n|zapata/i.test(desc)) ratio = 0.015;
  else if (/puente|pilas/i.test(desc)) ratio = 0.04;
  else if (/muro|pared/i.test(desc)) ratio = 0.0025;

  const steelQty = PMath.mul(qty, ratio);

  let diameter = 12;
  if (qty > 10) diameter = 16;
  if (qty > 50) diameter = 20;

  const volPerBar = PMath.mul(Math.PI, PMath.mul(Math.pow(diameter / 2000, 2), 10));
  const totalBars = qty > 0 ? PMath.div(steelQty, volPerBar) : 0;
  const barLength = PMath.mul(Math.sqrt(Math.max(qty, 1)), 10);
  const weight = PMath.mul(steelQty, ENGINEERING.densities.steel);
  const cost = PMath.mul(weight, line.materialCost || 0);

  return {
    ratio,
    diameter,
    barLength: precise(barLength),
    totalBars: Math.ceil(precise(totalBars)),
    weight: precise(weight),
    cost: precise(cost),
  };
}

// ─── Cálculo de UNA línea individual ───────────────────────────────────────────
export function calcLine(
  line: BudgetLine,
  mm?: { material: number; labor: number }
): LineResult {
  const matM = mm?.material ?? 1;
  const labM = mm?.labor ?? 1;

  let qty = line.qty || 0;
  const compType: LineResult['computationType'] = line.computationType === 'dynamic' ? 'dynamic' : 'fixed';

  if (compType === 'dynamic') {
    qty = calcDynamicQty(line);
  }

  const isSteel = /acero|refuerzo/i.test((line.description || '').toLowerCase());
  const steelInfo = isSteel && qty > 0 ? calcSteelReinforcement(line) : undefined;

  const materialCost = PMath.mul(line.materialCost || 0, matM);
  const laborCost = PMath.mul(line.laborCost || 0, labM);
  const equipmentCost = line.equipmentCost || 0;
  const matPerf = line.materialPerf ?? 1;
  const labPerf = line.laborPerf ?? 1;
  const wasteF = line.wasteFactor ?? 1;
  const mktIdx = line.marketPriceIndex ?? 1;

  const materialTotal = PMath.mul(qty, PMath.mul(materialCost, matPerf));
  const laborTotal = PMath.mul(qty, PMath.mul(laborCost, labPerf));
  const equipmentTotal = PMath.mul(qty, equipmentCost);
  const wasteTotal = PMath.mul(PMath.sum([materialTotal, laborTotal, equipmentTotal]), wasteF - 1);
  const subtotal = PMath.sum([materialTotal, laborTotal, equipmentTotal, wasteTotal]);

  const taxRate = line.taxRate ?? ENGINEERING.taxRate;
  const profitRate = line.profitMargin ?? ENGINEERING.profitMargin;
  const contingRate = line.contingency ?? ENGINEERING.contingency;

  const taxAmount = PMath.mul(subtotal, taxRate);
  const profitAmount = PMath.mul(subtotal, profitRate);
  const contingencyAmount = PMath.mul(subtotal, contingRate);
  const totalLine = PMath.sum([subtotal, taxAmount, profitAmount, contingencyAmount]);
  const unitCost = qty > 0 ? PMath.div(totalLine, qty) : 0;

  return {
    id: line.id,
    code: line.code || '',
    description: line.description || '',
    unit: line.unit || '',
    qty,
    computationType: isSteel ? 'steel' : compType,
    dimensions: line.dimensions,
    materialCost,
    laborCost,
    equipmentCost,
    materialTotal,
    laborTotal,
    equipmentTotal,
    wasteTotal,
    subtotal,
    taxAmount,
    profitAmount,
    contingencyAmount,
    totalLine,
    unitCost,
    marketPriceIndex: mktIdx,
    laborPerf: labPerf,
    wasteFactor: wasteF,
    steelInfo,
  };
}

// ─── Cálculo recursivo del árbol de presupuesto ────────────────────────────────
export function calculateTree(
  lines: BudgetLine[],
  mm?: { material: number; labor: number }
): { lines: LineResult[]; totals: BudgetTotals } {
  let mat = 0, lab = 0, eq = 0, waste = 0;
  let sub = 0, tax = 0, profit = 0, conting = 0;
  let days = 0;
  const results: LineResult[] = [];

  function walk(list: BudgetLine[]): void {
    for (const line of list) {
      const r = calcLine(line, mm);
      results.push(r);

      mat = PMath.add(mat, r.materialTotal);
      lab = PMath.add(lab, r.laborTotal);
      eq = PMath.add(eq, r.equipmentTotal);
      waste = PMath.add(waste, r.wasteTotal);
      sub = PMath.add(sub, r.subtotal);
      tax = PMath.add(tax, r.taxAmount);
      profit = PMath.add(profit, r.profitAmount);
      conting = PMath.add(conting, r.contingencyAmount);

      if (line.durationDays && line.durationDays > 0) {
        days += Math.ceil(line.durationDays / Math.max(1, line.laborPerf || 1));
      }

      if (line.children?.length) walk(line.children);
    }
  }

  walk(lines);

  const directCost = PMath.sum([sub, tax, profit, conting]);

  return {
    lines: results,
    totals: {
      materialTotal: precise(mat),
      laborTotal: precise(lab),
      equipmentTotal: precise(eq),
      wasteTotal: precise(waste),
      subtotal: precise(sub),
      taxTotal: precise(tax),
      profitTotal: precise(profit),
      contingencyTotal: precise(conting),
      directCost: precise(directCost),
      indirectCost: 0, adminCost: 0, personalCost: 0, totalBudget: 0,
      costPerM2: 0, estimatedDays: days, lines: results,
    },
  };
}

// ─── Cálculo completo del proyecto ─────────────────────────────────────────────
export function calculateProject(
  lines: BudgetLine[],
  options: {
    marketMultipliers?: { material: number; labor: number };
    indirectCosts?: number;
    adminCosts?: number;
    personalCosts?: number;
    area?: number;
  } = {}
): BudgetTotals {
  const mm = options.marketMultipliers;
  const { totals } = calculateTree(lines, mm);

  const indirectCost = PMath.mul(totals.directCost, (options.indirectCosts ?? ENGINEERING.indirectCosts) / 100);
  const adminCost = PMath.mul(totals.directCost, (options.adminCosts ?? ENGINEERING.adminCosts) / 100);
  const personalCost = PMath.mul(totals.directCost, (options.personalCosts ?? ENGINEERING.personalCosts) / 100);
  const totalBudget = PMath.sum([totals.directCost, indirectCost, adminCost, personalCost]);
  const costPerM2 = options.area && options.area > 0 ? PMath.div(totalBudget, options.area) : 0;

  return {
    ...totals,
    indirectCost: precise(indirectCost),
    adminCost: precise(adminCost),
    personalCost: precise(personalCost),
    totalBudget: precise(totalBudget),
    costPerM2: precise(costPerM2),
  };
}

// ─── Análisis de sensibilidad ─────────────────────────────────────────────────
export function analyzeSensitivity(
  lines: BudgetLine[],
  scenarios: { name: string; materialVar: number; laborVar: number }[],
  options?: Parameters<typeof calculateProject>[1]
): SensitivityScenario[] {
  const base = calculateProject(lines, options);
  const baseBudget = base.totalBudget;

  return scenarios.map(s => {
    const modified = deepClone(lines);
    applyVariation(modified, s.materialVar, s.laborVar);
    const scenario = calculateProject(modified, options);
    const diff = PMath.sub(scenario.totalBudget, baseBudget);
    const diffPct = baseBudget > 0 ? PMath.div(PMath.mul(diff, 100), baseBudget) : 0;
    return { name: s.name, materialVar: s.materialVar, laborVar: s.laborVar, total: scenario.totalBudget, difference: diff, diffPercent: diffPct };
  });
}

// ─── Alertas de desviación ─────────────────────────────────────────────────────
export interface Deviation {
  id: string;
  code: string;
  description: string;
  budgeted: number;
  actual: number;
  deviation: number;
  deviationPct: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function checkDeviations(
  lines: BudgetLine[],
  threshold: number = 10
): Deviation[] {
  const alerts: Deviation[] = [];

  function walk(list: BudgetLine[]): void {
    for (const l of list) {
      if (l.actualCost !== undefined && l.actualCost > 0 && l.subtotal) {
        const dev = ((l.actualCost - l.subtotal) / l.subtotal) * 100;
        if (Math.abs(dev) >= threshold) {
          alerts.push({
            id: l.id,
            code: l.code,
            description: l.description,
            budgeted: precise(l.subtotal),
            actual: precise(l.actualCost),
            deviation: precise(dev),
            deviationPct: precise(Math.abs(dev)),
            severity: Math.abs(dev) >= 50 ? 'critical' : Math.abs(dev) >= 30 ? 'high' : Math.abs(dev) >= 15 ? 'medium' : 'low',
          });
        }
      }
      if (l.children?.length) walk(l.children);
    }
  }

  walk(lines);
  return alerts;
}

// ─── Helpers internos ───────────────────────────────────────────────────────────
function deepClone(lines: BudgetLine[]): BudgetLine[] {
  return lines.map(l => ({ ...l, children: l.children ? deepClone(l.children) : undefined }));
}

function applyVariation(lines: BudgetLine[], matVar: number, labVar: number): void {
  for (const line of lines) {
    if (line.materialCost > 0) line.materialCost = PMath.mul(line.materialCost, 1 + matVar / 100);
    if (line.laborCost > 0) line.laborCost = PMath.mul(line.laborCost, 1 + labVar / 100);
    if (line.children) applyVariation(line.children, matVar, labVar);
  }
}

// ─── Formateo avanzado de cantidades ────────────────────────────────────────────
/** Formatea cantidad con separador de miles y decimales configurables */
export function fmtQty(value: number, minDecimals = 0, maxDecimals = 6): string {
  const n = precise(value, maxDecimals);
  const fixed = n.toFixed(maxDecimals);
  const dotIdx = fixed.indexOf('.');
  const intPart = dotIdx === -1 ? fixed : fixed.slice(0, dotIdx);
  let decPart = dotIdx === -1 ? '' : fixed.slice(dotIdx + 1);
  // recortar ceros a la derecha respetando minDecimals
  while (decPart.length > minDecimals && decPart.endsWith('0')) decPart = decPart.slice(0, -1);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

/** Formatea cantidad científica (para valores > 1M o < 0.001) */
export function fmtQtyScientific(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1_000_000 || (abs > 0 && abs < 0.001)) {
    return value.toExponential(2);
  }
  return fmtQty(value, 0, 4);
}

/** Parse input de cantidad (soporta coma, punto, notación científica) */
export function parseQtyInput(input: string): number {
  if (!input || input.trim() === '') return 0;
  const cleaned = input.trim().replace(/,/g, '').replace(/\s/g, '');
  // Handle scientific notation
  if (cleaned.toLowerCase().includes('e')) {
    return parseFloat(cleaned) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/** Valida que una cantidad sea válida (> 0) */
export function validateQty(value: number): boolean {
  return !isNaN(value) && isFinite(value) && value > 0;
}

/** Formatea costo con Q. para Guatemala */
export const fmtMoney = fmtQ;
export type BudgetLineResult = LineResult;
export type DeviationAlert = Deviation;
export type ProjectTotals = BudgetTotals;
export const calculateBudget = calculateTree;
export const calculateFullProject = calculateProject;
export const calculateDynamicQuantity = calcDynamicQty;
export const calculateLine = calcLine;
export const calculateBudgetTree = calculateTree;
export { precise, PMath, fmtInput, fmtQ };
export const calculateSensitivity = analyzeSensitivity;