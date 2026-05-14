/**
 * Motor de cálculo de ingeniería de costos de construcción
 * Precisión: 2 decimales fijos, redondeo bancario (round half up)
 * Incluye: APU, desperdicios, IVA, margen, equipos, sensibilidad
 */

import { BudgetLine } from '../lib/budgetData';
import { SensitivityScenario } from '../types/budget';

// ─── Constantes de ingeniería para Guatemala ────────────────────────────────
export const ENGINEERING_CONSTANTS = {
  steelRatios: {
    foundation: 0.015, columns: 0.025, beams: 0.020, slabs: 0.012,
  },
  wasteFactors: {
    concrete: 1.03, steel: 1.05, formwork: 1.02, general: 1.10,
  },
  densities: { concrete: 2400, steel: 7850 },
  steelDiameters: [6, 8, 10, 12, 16, 20, 25],
  /** IVA Guatemala */
  taxRate: 0.12,
  /** Margen de utilidad recomendado */
  profitMargin: 0.15,
  /** Imprevistos recomendado */
  contingency: 0.05,
};

// ─── Utilidad de precisión ──────────────────────────────────────────────────
/** Redondeo matemático correcto a N decimales (round half up) */
export function precise(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Formatea un número a string con formato 00.00 */
export function fmtInput(value: number): string {
  return value.toFixed(2);
}

// ─── Cálculo de cantidad dinámica por dimensiones ───────────────────────────
export function calculateDynamicQuantity(line: BudgetLine): number {
  if (line.computationType !== 'dynamic' || !line.dimensions) return line.qty;
  const d = line.dimensions;
  let volume = 0;

  if (/cimentaci[oó]n|zapata/i.test(line.description)) {
    volume = (d.length || 0) * (d.width || 0) * (d.height || 0);
    line.unit = 'm³';
  } else if (/columna/i.test(line.description)) {
    volume = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/solera/i.test(line.description)) {
    volume = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/losa|entrepiso/i.test(line.description)) {
    volume = (d.length || 0) * (d.width || 0) * (d.thickness || 0.15);
    line.unit = 'm³';
  } else if (/carretera|sub-base|base asf[lá]ltica/i.test(line.description)) {
    volume = (d.length || 0) * (d.width || 0) * (d.thickness || 0.15);
    line.unit = 'm³';
  } else if (/puente|pilas/i.test(line.description)) {
    volume = (d.width || 0) * (d.height || 0) * (d.length || 0);
    line.unit = 'm³';
  } else if (/fachada|vidrio/i.test(line.description)) {
    volume = (d.length || 0) * (d.height || 0);
    line.unit = 'm²';
  } else if (/cerramientos|perimetrales/i.test(line.description)) {
    volume = (d.length || 0) * (d.height || 0);
    line.unit = 'm';
  } else if (/piso industrial|accesibilidad/i.test(line.description)) {
    volume = (d.length || 0) * (d.width || 0);
    line.unit = 'm²';
  } else if (/estructura met[áa]lica|cubierta/i.test(line.description)) {
    volume = (d.length || 0) * (d.width || 0);
    line.unit = 'm²';
  }
  const waste = line.wasteFactor || ENGINEERING_CONSTANTS.wasteFactors.concrete;
  return precise(volume * waste);
}

// ─── Cálculo de acero de refuerzo ───────────────────────────────────────────
export function calculateSteelReinforcement(line: BudgetLine) {
  let ratio = 0.015;
  if (/columna/i.test(line.description)) ratio = line.typology === 'INDUSTRIAL' ? 0.03 : 0.025;
  else if (/viga|vigueta/i.test(line.description)) ratio = 0.020;
  else if (/losa/i.test(line.description)) ratio = line.typology === 'COMERCIAL' ? 0.013 : 0.012;
  else if (/cimentaci[oó]n|zapata/i.test(line.description)) ratio = 0.015;
  else if (/puente|pilas/i.test(line.description)) ratio = 0.04;

  const steelVol = line.qty * ratio;
  let diameter = 12;
  if (line.qty > 10) diameter = 16;
  if (line.qty > 50) diameter = 20;
  const barLength = Math.sqrt(line.qty) * 10;
  const weight = steelVol * ENGINEERING_CONSTANTS.densities.steel;
  const waste = line.wasteFactor || ENGINEERING_CONSTANTS.wasteFactors.steel;
  return {
    diameter, length: precise(barLength * waste), weight: precise(weight * waste),
  };
}

// ─── Cálculo de una línea individual (APU completo) ─────────────────────────
export function calculateLine(line: BudgetLine): BudgetLine {
  if (line.computationType === 'dynamic') line.qty = calculateDynamicQuantity(line);
  if (/acero|refuerzo/i.test(line.description) && line.qty > 0) {
    const steel = calculateSteelReinforcement(line);
    line.materialPerf = steel.weight / line.qty;
  }

  const qty = line.qty || 0;

  // Costos base
  const materialTotal = precise(qty * (line.materialCost || 0) * (line.materialPerf ?? 1));
  const laborTotal = precise(qty * (line.laborCost || 0) * (line.laborPerf ?? 1));
  const equipmentTotal = precise(qty * (line.equipmentCost || 0));

  // Factor de desperdicio
  const wasteF = (line.wasteFactor || 1) - 1; // wasteFactor 1.05 → 0.05
  const wasteTotal = precise((materialTotal + laborTotal + equipmentTotal) * wasteF);

  // Subtotal con desperdicio
  const subtotal = precise(materialTotal + laborTotal + equipmentTotal + wasteTotal);

  // IVA / impuesto
  const taxRate = line.taxRate ?? ENGINEERING_CONSTANTS.taxRate;
  const taxAmount = precise(subtotal * taxRate);

  // Margen de utilidad
  const marginRate = line.profitMargin ?? ENGINEERING_CONSTANTS.profitMargin;
  const profitAmount = precise(subtotal * marginRate);

  // Imprevistos
  const contingencyRate = line.contingency ?? ENGINEERING_CONSTANTS.contingency;
  const contingencyAmount = precise(subtotal * contingencyRate);

  // Total final del renglón
  const totalLine = precise(subtotal + taxAmount + profitAmount + contingencyAmount);

  // Costo unitario
  const unitCost = qty > 0 ? precise(totalLine / qty) : 0;

  line.materialTotal = materialTotal;
  line.laborTotal = laborTotal;
  line.equipmentTotal = equipmentTotal;
  line.subtotal = totalLine;
  return line;
}

// ─── Cálculo recursivo del árbol de presupuesto ─────────────────────────────
export function calculateBudget(lines: BudgetLine[]): BudgetLine[] {
  lines.forEach(line => {
    let childrenTotal = 0;
    if (line.children?.length) {
      calculateBudget(line.children);
      childrenTotal = line.children.reduce((s, c) => s + (c.subtotal ?? 0), 0);
    }
    calculateLine(line);
    // Si tiene hijos, el subtotal = subtotal propio + suma de hijos
    if (childrenTotal > 0) {
      line.subtotal = precise((line.subtotal ?? 0) + childrenTotal);
    }
  });
  return lines;
}

// ─── Cálculos globales ──────────────────────────────────────────────────────
export function calcProjectTotals(lines: BudgetLine[]) {
  const calculated = calculateBudget(lines);
  let totalMaterial = 0, totalLabor = 0, totalEquipment = 0, totalWaste = 0;
  let totalBase = 0, totalTax = 0, totalProfit = 0, totalContingency = 0;

  const sumAll = (list: BudgetLine[]) => {
    list.forEach(l => {
      totalMaterial += l.materialTotal ?? 0;
      totalLabor += l.laborTotal ?? 0;
      totalEquipment += l.equipmentTotal ?? 0;
      totalBase += (l.subtotal ?? 0);
      if (l.children?.length) sumAll(l.children);
    });
  };
  sumAll(calculated);

  // Descomponer el subtotal total en tax/profit/contingency
  // (se calcula proporcionalmente para no recalcular todo)
  const globalTaxRate = ENGINEERING_CONSTANTS.taxRate;
  const globalMargin = ENGINEERING_CONSTANTS.profitMargin;
  const globalContingency = ENGINEERING_CONSTANTS.contingency;
  // Subtotal sin tax/margin/contingency = baseBudget / (1 + tax + margin + contingency)
  // Pero como calculateLine ya los incluye en subtotal, necesitamos el neto
  const neto = totalBase / (1 + globalTaxRate + globalMargin + globalContingency);
  totalTax = precise(neto * globalTaxRate);
  totalProfit = precise(neto * globalMargin);
  totalContingency = precise(neto * globalContingency);

  return {
    materialTotal: precise(totalMaterial),
    laborTotal: precise(totalLabor),
    equipmentTotal: precise(totalEquipment),
    wasteTotal: precise(totalWaste),
    baseSubtotal: precise(neto),
    totalBudget: precise(totalBase),
    taxTotal: totalTax,
    profitTotal: totalProfit,
    contingencyTotal: totalContingency,
  };
}

// ─── Análisis de sensibilidad ────────────────────────────────────────────────
export function calculateSensitivity(
  lines: BudgetLine[],
  scenarios: { name: string; materialVar: number; laborVar: number }[]
): SensitivityScenario[] {
  const base = calcProjectTotals(lines);
  return scenarios.map(s => {
    // Aplicar variación a materiales y mano de obra
    const adjustment = 1 + (s.materialVar + s.laborVar) / 200; // promedio simple
    const total = precise(base.totalBudget * adjustment);
    const diff = precise(total - base.totalBudget);
    const diffPercent = base.totalBudget > 0 ? precise((diff / base.totalBudget) * 100) : 0;
    return { name: s.name, materialVar: s.materialVar, laborVar: s.laborVar, total, difference: diff, diffPercent };
  });
}

// ─── Alertas de desviación ──────────────────────────────────────────────────
export interface DeviationAlert {
  lineCode: string;
  description: string;
  budgeted: number;
  actual: number;
  deviationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function checkDeviations(lines: BudgetLine[], threshold: number = 10): DeviationAlert[] {
  const alerts: DeviationAlert[] = [];
  const walk = (list: BudgetLine[]) => {
    list.forEach(l => {
      if (l.actualCost !== undefined && l.actualCost > 0 && l.subtotal) {
        const budgeted = l.subtotal;
        const actual = l.actualCost;
        const dev = ((actual - budgeted) / budgeted) * 100;
        if (Math.abs(dev) >= threshold) {
          const severity: DeviationAlert['severity'] =
            Math.abs(dev) >= 50 ? 'critical' :
            Math.abs(dev) >= 30 ? 'high' :
            Math.abs(dev) >= 15 ? 'medium' : 'low';
          alerts.push({
            lineCode: l.code, description: l.description, budgeted: precise(budgeted),
            actual: precise(actual), deviationPercent: precise(dev), severity,
          });
        }
      }
      if (l.children?.length) walk(l.children);
    });
  };
  walk(lines);
  return alerts;
}
