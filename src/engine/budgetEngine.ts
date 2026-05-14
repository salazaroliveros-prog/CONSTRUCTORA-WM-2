/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Budget Engine v4 — Motor de cálculo de presupuestos de construcción
 *
 * Motor de cálculo de nivel industrial basado en algoritmos de optimización.
 * 100% compatible con código existente vía back-compat aliases.
 *
 * Características:
 * - Precisión matemática con PMath (elimina errores IEEE 754)
 * - Cantidades dinámicas por dimensiones (L×W×H)
 * - Cálculo de acero de refuerzo con ratios por tipología
 * - Automatización de cantidades y tiempos
 * - Análisis de sensibilidad con escenarios múltiples
 * - Cronograma estimado desde rendimientos reales
 * - Desperdicios, IVA, margen, contingencia
 * - Costo indirecto, administrativo, personal
 *
 * Moneda: GTQ (Quetzales Guatemala), 2 decimales, separador ","
 */

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Tipos del modelo central para uso interno y re-export
import type {
  BudgetLineDocument, LineCalcResult, BudgetTotals, ScheduleEstimate,
  Deviation, SensitivityScenario, MaterialSummary, ComputationType,
  Typology, CostRowMaterial, CostRowLabor, CostRowEquipment,
  CostLibraryItem, CalcInput, CalcOutput, createEmptyLine,
  toFirestore, fromFirestore, deepClone, BudgetLine
} from '../models/budget';

// Re-export para consumidores
export type {
  BudgetLineDocument, LineCalcResult, BudgetTotals, ScheduleEstimate,
  Deviation, SensitivityScenario, MaterialSummary, ComputationType,
  Typology, CostRowMaterial, CostRowLabor, CostRowEquipment,
  CostLibraryItem, CalcInput, CalcOutput, createEmptyLine,
  toFirestore, fromFirestore, deepClone, BudgetLine
} from '../models/budget';

import { FinancialConfig, DEFAULT_FINANCIAL_CONFIG, Typology as EnumTypology, SteelRatios } from '../models/engineering';

// Precisión matemática
import { precise, PMath, fmtInput, fmtQ } from './precision';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE INGENIERÍA
// ═══════════════════════════════════════════════════════════════════════════════

// Engine internal copy (without as const for numeric flexibility)
export const ENGINEERING = {
  steelRatios: {
    foundation: 0.015, isolated: 0.015, column: 0.025,
    beam: 0.020, slab: 0.012, wall: 0.0025, bridge: 0.04,
  } as SteelRatios,
  wasteFactors: {
    concrete: 1.03, steel: 1.05, formwork: 1.02,
    masonry: 1.10, excavation: 1.10, general: 1.10,
  },
  densities: { concrete: 2400, steel: 7850 },
  steelDiameters: [6, 8, 10, 12, 16, 20, 25],
  taxRate: 0.12,
  profitMargin: 0.15,
  contingency: 0.05,
  indirectCosts: 15,
  adminCosts: 5,
  personalCosts: 10,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN DE DESCRIPCIONES PARA CÁLCULOS DINÁMICOS
// ═══════════════════════════════════════════════════════════════════════════════

type DynamicCalcType = 'volume' | 'area_m2' | 'area' | 'length' | 'weight' | 'count';

const DYNAMIC_PATTERNS: [RegExp, DynamicCalcType][] = [
  // Volumen (m³)
  [/cimentación|zapata|excavación|corte.*terreno|relleno|columna.*concreto|solera.*concreto|viga.*concreto|puente|pilas|pavimento.*concreto|baranda.*concreto|muro.*concreto/i, 'volume'],
  // Área (m², long × width)
  [/losa|entrepiso|platea|piso.*industrial|fachada.*vidrio|acristalamiento|panel.*acm|pintura.*muros|enchape|plafon|cielo.falso|muro.*bloque|dividir.*drywall|tabique.*drywall/i, 'area_m2'],
  // Área muros (m², alt × anch)
  [/muro|pared|fachada.*muro|cerramiento.*perimetral|pantalla/i, 'area'],
  // Ancho (m-lineales)
  [/perímetro|bardado|cerca|alambre|cercado|junta|expansion|sardinel|borde/i, 'length'],
  // Alcantarilla, tubería, drenaje
  [/alcantarilla|tubería|drenaje|tuberia|pozo/i, 'length'],
  // Peso (kg)
  [/estructura.*metálica|cercha|correa|purlin|acero.*peso|cubierta.*metal|viga.*metal|columna.*metal/i, 'weight'],
  // Conteo
  [/poste|semaforo|lámpara|luminaria|unidad.*servicio|cámara|caja.*eléctrica|transformador|panel.*eléctrico|ascensor|inodoro|baño.*completo|mobiliario/i, 'count'],
  // Área (m², largo × ancho, ej carreteras)
  [/carretera|sub.base|base.*asfaltica|carpeta.*asfaltica|rodadura/i, 'area_m2'],
];

function getDynType(desc: string): DynamicCalcType {
  const lower = desc.toLowerCase();
  for (const [pattern, type] of DYNAMIC_PATTERNS) {
    if (pattern.test(lower)) return type;
  }
  // Default: usar cantidad fija del campo qty
  return 'weight'; // no type, use fixed qty
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO DE CANTIDADES DINÁMICAS
// ═══════════════════════════════════════════════════════════════════════════════

export function calcDynamicQty(line: BudgetLineDocument): { qty: number; unit: string } {
  // Si es cantidad fija, retornar directo
  if (line.computationType === 'fixed') {
    return { qty: line.projectQuantity || 0, unit: line.unit };
  }

  const d = line.dimensions;
  if (!d) return { qty: line.projectQuantity || 0, unit: line.unit };

  const l = d.length || 0;
  const w = d.width || 0;
  const h = d.height || 0;
  const t = d.thickness || 0;
  const diam = d.diameter || 0;

  let qty: number;
  let unit: string;
  const dt = getDynType(line.description || '');

  switch (dt) {
    case 'volume':
      qty = l * w * h;
      unit = 'm³';
      break;
    case 'area_m2':
      qty = l * w;
      unit = 'm²';
      break;
    case 'area':
      qty = l * h;
      unit = 'm²';
      break;
    case 'weight':
      qty = l * w * h * 7850 / 1_000_000; // m³ → ton? no, kg: ρ=7850 kg/m³
      unit = 'kg';
      break;
    case 'length':
      qty = l;
      unit = 'm';
      break;
    case 'count':
      qty = line.projectQuantity || 1;
      unit = line.unit || 'un';
      break;
    default:
      qty = line.projectQuantity || 0;
      unit = line.unit || 'm²';
  }

  // Aplicar factor de desperdicio del primer material
  const wf = line.materials?.[0]?.wasteFactor ?? 1.03;
  qty = precise(qty * wf);

  return { qty, unit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACERO DE REFUERZO
// ═══════════════════════════════════════════════════════════════════════════════

export interface SteelCalcResult {
  ratio: number;
  diameter: number;
  barLength: number;
  totalBars: number;
  weight: number;
  cost: number;
}

export function calcSteelReinforcement(line: BudgetLineDocument, qty: number): SteelCalcResult {
  const desc = (line.description || '').toLowerCase();
  const typology = String(line.typology || EnumTypology.RESIDENCIAL).toUpperCase();

  let ratio = ENGINEERING.steelRatios.foundation;
  if (/columna/i.test(desc)) ratio = typology === 'INDUSTRIAL' ? 0.03 : ENGINEERING.steelRatios.column;
  else if (/viga|vigueta|solera/i.test(desc)) ratio = typology === 'COMERCIAL' ? 0.018 : ENGINEERING.steelRatios.beam;
  else if (/losa|entrepiso/i.test(desc)) ratio = typology === 'COMERCIAL' ? 0.013 : ENGINEERING.steelRatios.slab;
  else if (/puente|pilas/i.test(desc)) ratio = ENGINEERING.steelRatios.bridge;
  else if (/muro|pared/i.test(desc)) ratio = ENGINEERING.steelRatios.wall;

  const steelQty = precise(qty * ratio);

  // Diámetro automático según cantidad
  const DIA = [6, 8, 10, 12, 16, 20, 25];
  let diameter = DIA[0];
  if (qty > 10) diameter = DIA[1];
  if (qty > 50) diameter = DIA[2];
  if (qty > 100) diameter = DIA[3];
  if (qty > 500) diameter = DIA[4];

  const r = diameter / 2000;
  const volPerBar = precise(Math.PI * r * r * 10);
  const totalBars = volPerBar > 0 ? Math.ceil(steelQty / volPerBar) : 0;
  const barLength = precise(Math.sqrt(Math.max(qty, 1)) * 10);
  const weight = precise(steelQty * ENGINEERING.densities.steel);

  // Precio del acero: buscar en materiales de la línea
  const steelMat = line.materials?.find(m =>
    /acero|refuerzo|varilla|hierro|barras?/i.test(m.name)
  );
  const costPerKg = steelMat?.unitPrice ?? 0;
  const cost = precise(weight * costPerKg);

  return { ratio, diameter, barLength, totalBars, weight, cost };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO DE UNA LÍNEA INDIVIDUAL
// ═══════════════════════════════════════════════════════════════════════════════

function calcLine(
  line: BudgetLineDocument,
  marketMultipliers?: { material: number; labor: number }
): LineCalcResult {
  const mm = marketMultipliers?.material ?? 1;
  const ml = marketMultipliers?.labor ?? 1;

  // Cantidad dinámica o fija
  const { qty, unit } = calcDynamicQty(line);

  // Costos base
  const materialCost = line.materials.reduce(
    (s, m) => PMath.add(s, PMath.mul(m.unitPrice, m.quantity)), 0
  );
  const laborCost = line.labor.reduce(
    (s, l) => PMath.add(s, PMath.mul(l.dailyWage, l.quantity)), 0
  );
  const equipmentCost = line.equipment.reduce(
    (s, e) => PMath.add(s, PMath.mul(e.hourlyRate, e.quantity)), 0
  );

  // Aplicar multiplicadores de mercado
  const adjMatCost = PMath.mul(materialCost, mm);
  const adjLabCost = PMath.mul(laborCost, ml);
  const adjEquCost = PMath.mul(equipmentCost, mm);

  // Totales por qty
  const materialTotal = PMath.mul(adjMatCost, qty);
  const laborTotal = PMath.mul(adjLabCost, qty);
  const equipmentTotal = PMath.mul(adjEquCost, qty);

  // Desperdicios
  const wf = line.materials?.[0]?.wasteFactor ?? 1.03;
  const subtotalRaw = PMath.sum([materialTotal, laborTotal, equipmentTotal]);
  const wasteTotal = PMath.mul(subtotalRaw, wf - 1);
  const subtotal = PMath.add(subtotalRaw, wasteTotal);

  // Impuestos y márgenes
  const taxRate = (line.taxRate ?? ENGINEERING.taxRate) / 100;
  const profitRate = (line.profitMargin ?? ENGINEERING.profitMargin) / 100;
  const contingRate = (line.contingency ?? ENGINEERING.contingency) / 100;

  const taxAmount = PMath.mul(subtotal, taxRate);
  const profitAmount = PMath.mul(subtotal, profitRate);
  const contingencyAmount = PMath.mul(subtotal, contingRate);
  const totalLine = PMath.sum([subtotal, taxAmount, profitAmount, contingencyAmount]);

  const unitCost = qty > 0 ? PMath.div(totalLine, qty) : 0;

  // Cronograma por línea (rendimiento real)
  const dailyOutput = Math.max(line.dailyOutput ?? 1, 0.01);
  const crew = Math.max(line.crewSize ?? 2, 1);
  const estimatedDays = Math.ceil(qty / (dailyOutput * crew));

  // ¿Acero?
  const isSteel = /acero|refuerzo|armadura|varilla|hierro/i.test(line.description || '');
  const steelInfo = isSteel && qty > 0 ? calcSteelReinforcement(line, qty) : undefined;

  return {
    id: line.id,
    code: line.code || '',
    description: line.description || '',
    unit,
    category: line.category || '',
    qty,
    computationType: isSteel ? 'steel' : (line.computationType ?? 'fixed'),
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
    estimatedDays,
    steelInfo,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO RECURSIVO DEL ÁRBOL DE PRESUPUESTO (v4)
// ═══════════════════════════════════════════════════════════════════════════════

function walkTree(
  lines: BudgetLineDocument[],
  mm: { material: number; labor: number } | undefined,
  results: LineCalcResult[],
  acc: { mat: number; lab: number; eq: number; waste: number; sub: number; tax: number; profit: number; cont: number; days: number }
): void {
  for (const node of lines) {
    if (node.isActive === false) continue;

    const res = calcLine(node, mm);
    results.push(res);

    acc.mat = PMath.add(acc.mat, res.materialTotal);
    acc.lab = PMath.add(acc.lab, res.laborTotal);
    acc.eq  = PMath.add(acc.eq,  res.equipmentTotal);
    acc.waste = PMath.add(acc.waste, res.wasteTotal);
    acc.sub = PMath.add(acc.sub, res.subtotal);
    acc.tax = PMath.add(acc.tax, res.taxAmount);
    acc.profit = PMath.add(acc.profit, res.profitAmount);
    acc.cont  = PMath.add(acc.cont,  res.contingencyAmount);
    acc.days += res.estimatedDays ?? 0;

    // Recursividad: hijos de BudgetLine (hijos = sub-items de un ítem padre)
    if (node.children && node.children.length > 0) {
      walkTree(node.children, mm, results, acc);
    }
  }
}

/**
 * Calcula un árbol completo de líneas presupuestarias.
 * Retorna cada línea calculada + los totales del proyecto.
 */
export function calculateTree(
  lines: BudgetLineDocument[],
  mm?: { material: number; labor: number }
): { lines: LineCalcResult[]; totals: BudgetTotals } {
  const results: LineCalcResult[] = [];
  const acc = { mat: 0, lab: 0, eq: 0, waste: 0, sub: 0, tax: 0, profit: 0, cont: 0, days: 0 };

  walkTree(lines, mm, results, acc);

  const directCost = PMath.sum([acc.sub, acc.tax, acc.profit, acc.cont]);

  return {
    lines: results,
    totals: {
      materialTotal:  precise(acc.mat),
      laborTotal:     precise(acc.lab),
      equipmentTotal: precise(acc.eq),
      wasteTotal:     precise(acc.waste),
      subtotal:       precise(acc.sub),
      taxTotal:       precise(acc.tax),
      profitTotal:    precise(acc.profit),
      contingencyTotal: precise(acc.cont),
      directCost:     precise(directCost),
      indirectCost:   0,   // Se calcula en calculateProject
      adminCost:      0,
      personalCost:   0,
      totalBudget:    0,
      costPerM2:      0,
      estimatedDays:  0,
      lines:          results,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CÁLCULO COMPLETO DEL PROYECTO (v4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cálculo completo con costos indirectos, administrativos, personales
 * y costo por m² si se provee el área.
 */
export function calculateProject(
  lines: BudgetLineDocument[],
  options: {
    marketMultipliers?: { material: number; labor: number };
    indirectCosts?: number;
    adminCosts?: number;
    personalCosts?: number;
    area?: number;
  } = {}
): BudgetTotals {
  const { totals: partial } = calculateTree(lines, options.marketMultipliers);

  const icPct = (options.indirectCosts ?? ENGINEERING.indirectCosts) / 100;
  const acPct = (options.adminCosts ?? ENGINEERING.adminCosts) / 100;
  const pcPct = (options.personalCosts ?? ENGINEERING.personalCosts) / 100;

  const indirectCost = PMath.mul(partial.directCost, icPct);
  const adminCost    = PMath.mul(partial.directCost, acPct);
  const personalCost = PMath.mul(partial.directCost, pcPct);
  const totalBudget  = PMath.sum([partial.directCost, indirectCost, adminCost, personalCost]);
  const costPerM2    = (options.area && options.area > 0)
    ? PMath.div(totalBudget, options.area)
    : 0;

  return {
    ...partial,
    indirectCost:   precise(indirectCost),
    adminCost:      precise(adminCost),
    personalCost:   precise(personalCost),
    totalBudget:    precise(totalBudget),
    costPerM2:      precise(costPerM2),
    estimatedDays:  partial.estimatedDays,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRONOGRAMA ESTIMADO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula el cronograma estimado basado en rendimientos reales.
 * Retorna: días totales, días-hombre, paralelización.
 */
export function calculateSchedule(lines: BudgetLineDocument[]): ScheduleEstimate {
  let totalDays = 0;
  let maxCrewSize = 1;

  function walk(nodeLines: BudgetLineDocument[]): void {
    for (const node of nodeLines) {
      if (node.isActive === false) continue;

      const dailyOutput = Math.max(node.dailyOutput ?? 1, 0.01);
      const crew = Math.max(node.crewSize ?? 2, 1);
      const days = Math.ceil((node.durationDays ?? Math.ceil(node.projectQuantity / dailyOutput)) / crew);

      totalDays += days;
      if (crew > maxCrewSize) maxCrewSize = crew;

      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(lines);

  return {
    totalDays,
    laborDays: totalDays,
    parallelLaborDays: Math.ceil(totalDays / maxCrewSize),
    maxParallelCrews: maxCrewSize,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS DE SENSIBILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

export function analyzeSensitivity(
  lines: BudgetLineDocument[],
  scenarios: { name: string; materialVar: number; laborVar: number }[],
  options?: {
    indirectCosts?: number; adminCosts?: number; personalCosts?: number; area?: number;
  }
): SensitivityScenario[] {
  const base = calculateProject(lines, options);

  return scenarios.map(s => {
    // Clonar y aplicar variaciones
    const modified = lines.map(l => {
      const newMat = (l.materials || []).map(m => ({
        ...m,
        unitPrice: precise(m.unitPrice * (1 + s.materialVar / 100)),
      }));
      const newLab = (l.labor || []).map(lb => ({
        ...lb,
        dailyWage: precise(lb.dailyWage * (1 + s.laborVar / 100)),
      }));
      return { ...l, materials: newMat, labor: newLab };
    });

    const scenarioResult = calculateProject(modified, options);
    const diff = PMath.sub(scenarioResult.totalBudget, base.totalBudget);
    const diffPct = base.totalBudget > 0
      ? precise(PMath.div(PMath.mul(diff, 100), base.totalBudget))
      : 0;

    return {
      name: s.name,
      materialVar: s.materialVar,
      laborVar: s.laborVar,
      total: scenarioResult.totalBudget,
      difference: diff,
      diffPercent: diffPct,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTAS DE DESVIACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export function checkDeviations(
  lines: BudgetLineDocument[],
  actualCosts: Record<string, number>,
  threshold: number = 10
): Deviation[] {
  const alerts: Deviation[] = [];

  function walk(nodeLines: BudgetLineDocument[]): void {
    for (const node of nodeLines) {
      const actual = actualCosts[node.id];
      if (actual !== undefined && actual > 0) {
        const result = calcLine(node, undefined);
        const dev = precise(((actual - result.totalLine) / result.totalLine) * 100);

        if (Math.abs(dev) >= threshold) {
          alerts.push({
            id: node.id,
            code: node.code || '',
            description: node.description || '',
            budgeted: result.totalLine,
            actual,
            deviation: dev,
            deviationPct: Math.abs(dev),
            severity: Math.abs(dev) >= 50 ? 'critical'
              : Math.abs(dev) >= 30 ? 'high'
                : Math.abs(dev) >= 15 ? 'medium' : 'low',
          });
        }
      }
      if (node.children?.length) walk(node.children);
    }
  }

  walk(lines);
  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN DE MATERIALES
// ═══════════════════════════════════════════════════════════════════════════════

export function generateMaterialSummary(lines: LineCalcResult[]): MaterialSummary[] {
  const map = new Map<string, MaterialSummary>();

  for (const line of lines) {
    const cat = line.category || 'varios';
    const existing = map.get(cat);
    if (existing) {
      existing.totalQuantity += line.qty;
    } else {
      map.set(cat, {
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        unit: line.unit || 'm²',
        totalQuantity: line.qty,
        category: cat,
      });
    }
  }

  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALIDAD DE MATERIALES (BOM)
// ═══════════════════════════════════════════════════════════════════════════════

export interface BillOfMaterials {
  lineId: string;
  lineCode: string;
  lineDescription: string;
  materials: {
    name: string;
    unit: string;
    totalQuantity: number;
    unitPrice: number;
    costWithWaste: number;
  }[];
}

export function generateBOM(lines: LineCalcResult[]): BillOfMaterials[] {
  return lines.map(line => ({
    lineId: line.id,
    lineCode: line.code,
    lineDescription: line.description,
    materials: [
      { name: `Material: ${line.description}`, unit: line.unit, totalQuantity: line.qty, unitPrice: line.materialCost, costWithWaste: line.materialTotal },
    ],
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATADORES / UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

/** Formatea cantidad con separador de miles y decimales configurables */
export function fmtQty(value: number, minDec: number = 0, maxDec: number = 6): string {
  const n = precise(value, maxDec);
  const fixed = n.toFixed(maxDec);
  const dotIdx = fixed.indexOf('.');
  const intPart = dotIdx === -1 ? fixed : fixed.slice(0, dotIdx);
  let decPart = dotIdx === -1 ? '' : fixed.slice(dotIdx + 1);
  while (decPart.length > minDec && decPart.endsWith('0')) decPart = decPart.slice(0, -1);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

/** Formatea cantidad científica para valores extremos */
export function fmtQtyScientific(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1_000_000 || (abs > 0 && abs < 0.001)) return value.toExponential(2);
  return fmtQty(value, 0, 4);
}

/** Parse input de cantidad (soporta coma, punto, notación científica) */
export function parseQtyInput(input: string): number {
  if (!input || input.trim() === '') return 0;
  const cleaned = input.trim().replace(/,/g, '').replace(/\s/g, '');
  if (cleaned.toLowerCase().includes('e')) return parseFloat(cleaned) || 0;
  return parseFloat(cleaned) || 0;
}

/** Valida que una cantidad sea válida (> 0) */
export function validateQty(value: number): boolean {
  return !isNaN(value) && isFinite(value) && value > 0;
}

/** Moneda GTQ */
export const fmtMoney = fmtQ;

// ═══════════════════════════════════════════════════════════════════════════════
// BACK-COMPATIBILITY ALIASES
// ═══════════════════════════════════════════════════════════════════════════════
// Estos alias permiten que módulos existentes sigan importando los nombres antiguos

/** @deprecated Use calculateProject */
export const calculateFullProject = calculateProject;
/** @deprecated Use calculateProject */
export const calculateBudget = calculateProject;
/** @deprecated Use calculateTree */
export const calculateBudgetTree = calculateTree;
/** @deprecated Use analyzeSensitivity */
export const calculateSensitivity = analyzeSensitivity;
/** @deprecated Use LineCalcResult */
export type LineResult = LineCalcResult;
/** @deprecated Use BudgetTotals */
export type ProjectTotals = BudgetTotals;
/** @deprecated Use BudgetTotals */
export type BudgetLineResult = LineCalcResult;
/** @deprecated Use Deviation */
export type DeviationAlert = Deviation;

// Re-export de precisión
export { precise, PMath, fmtInput, fmtQ } from './precision';