import { Timestamp } from 'firebase/firestore';
import {
  Typology as EnumTypology,
  Dimensions,
  ComputationType as EnumComputationType,
  FinancialConfig,
} from './engineering';

// ========================================================================
//  COST ROW DEFINITIONS
// ========================================================================
export interface CostRowMaterial {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  wasteFactor: number;
  totalCost: number;
}

export interface CostRowLabor {
  role: string;
  quantity: number;
  dailyWage: number;
  totalCost: number;
}

export interface CostRowEquipment {
  name: string;
  quantity: number;
  hourlyRate: number;
  totalCost: number;
}

// ========================================================================
//  BUDGETLINE DOCUMENT (V4) — Con TODOS los campos incluyendo legacy
// ========================================================================
export interface BudgetLineDocument {
  // Identity
  id?: string;
  parentId?: string;
  children: BudgetLineDocument[];
  code: string;
  description: string;
  unit: string;
  category: string;
  typology: EnumTypology;
  order: number;

  // Input
  isActive: boolean;
  projectQuantity: number;
  computationType: EnumComputationType;
  dimensions?: Dimensions;
  materials: CostRowMaterial[];
  labor: CostRowLabor[];
  equipment: CostRowEquipment[];

  // Legacy compat (used by BudgetTable, DimensionEditor, useBudget, etc.)
  qty?: number;
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  materialPerf?: number;
  laborPerf?: number;
  wasteFactor?: number;
  materialTotal?: number;
  laborTotal?: number;
  equipmentTotal?: number;
  subtotal?: number;
  taxAmount?: number;
  profitAmount?: number;
  contingencyAmount?: number;
  totalLine?: number;
  unitCost?: number;
  taxRate?: number;
  profitMargin?: number;
  contingency?: number;
  actualCost?: number;
  marketPriceIndex?: number;

  // Engineering
  costLibraryRef?: string;
  concreteGrade?: string;
  steelRatio?: number;
  formworkRatio?: number;

  // Schedule
  dailyOutput: number;
  crewSize: number;
  durationDays: number;
  estimatedDays?: number;

  // Calculated
  steelInfo?: {
    ratio: number;
    diameter: number;
    barLength: number;
    totalBars: number;
    weight: number;
    cost: number;
  };
}

export interface CostRowLabor {
  role: string;
  quantity: number;
  dailyWage: number;
  totalCost: number;
}

export interface CostRowEquipment {
  name: string;
  quantity: number;
  hourlyRate: number;
  totalCost: number;
}

// ========================================================================
//  BUDGETLINE DOCUMENT (V4) — Con campos legacy de compatibilidad
// ========================================================================
export interface BudgetLineDocument {
  // Identity
  id?: string;
  parentId?: string;
  children: BudgetLineDocument[];
  code: string;
  description: string;
  unit: string;
  category: string;
  typology: EnumTypology;
  order: number;

  // Input fields
  isActive: boolean;
  projectQuantity: number;
  computationType: EnumComputationType;
  dimensions?: Dimensions;
  materials: CostRowMaterial[];
  labor: CostRowLabor[];
  equipment: CostRowEquipment[];

  // Legacy compat fields (used by existing components)
  qty?: number;
  wasteFactor?: number;
  materialPerf?: number;
  laborPerf?: number;
  equipmentCost?: number;
  materialTotal?: number;
  laborTotal?: number;

  // Engineering params
  costLibraryRef?: string;
  concreteGrade?: string;
  steelRatio?: number;
  formworkRatio?: number;

  // Schedule
  dailyOutput: number;
  crewSize: number;
  durationDays: number;

  // Financial overrides (per-line)
  taxRate?: number;
  profitMargin?: number;
  contingency?: number;

  // Actual cost for deviation analysis
  actualCost?: number;
  marketPriceIndex?: number;

  // Calculated fields (populated by engine)
  subtotal?: number;
  taxAmount?: number;
  profitAmount?: number;
  contingencyAmount?: number;
  totalLine?: number;
  unitCost?: number;
  estimatedDays?: number;
  steelInfo?: {
    ratio: number;
    diameter: number;
    barLength: number;
    totalBars: number;
    weight: number;
    cost: number;
  };
}

// ========================================================================
//  LINE RESULT
// ========================================================================
export interface LineCalcResult {
  id: string;
  code: string;
  description: string;
  unit: string;
  category: string;
  qty: number;
  computationType: EnumComputationType;
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
  estimatedDays: number;
  steelInfo?: BudgetLineDocument['steelInfo'];
}

// ========================================================================
//  BUDGET TOTALS
// ========================================================================
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
  lines: LineCalcResult[];
}

// ========================================================================
//  SCHEDULE ESTIMATE
// ========================================================================
export interface ScheduleEstimate {
  totalDays: number;
  laborDays: number;
  parallelLaborDays: number;
  maxParallelCrews: number;
}

// ========================================================================
//  DEVIATION
// ========================================================================
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

// ========================================================================
//  SENSITIVITY SCENARIO
// ========================================================================
export interface SensitivityScenario {
  name: string;
  materialVar: number;
  laborVar: number;
  total: number;
  difference: number;
  diffPercent: number;
}

// ========================================================================
//  MATERIAL SUMMARY
// ========================================================================
export interface MaterialSummary {
  name: string;
  unit: string;
  totalQuantity: number;
  category: string;
}

// ========================================================================
//  CALC INPUT / OUTPUT
// ========================================================================
export interface CalcInput {
  lines: BudgetLineDocument[];
  financialConfig: FinancialConfig;
  area?: number;
  marketMultipliers?: { material: number; labor: number };
}

export interface CalcOutput {
  lineResults: LineCalcResult[];
  totals: BudgetTotals;
  schedule: ScheduleEstimate;
  deviations: Deviation[];
  materialSummary: MaterialSummary[];
}

// ========================================================================
//  COST LIBRARY ITEM
// ========================================================================
export interface CostLibraryItem {
  id?: string;
  code: string;
  description: string;
  unit: string;
  category: string;
  typology: EnumTypology;
  materials: CostRowMaterial[];
  labor: CostRowLabor[];
  equipment: CostRowEquipment[];
  concreteGrade?: string;
  steelRatio?: number;
  formworkRatio?: number;
  dailyOutput: number;
  crewSize: number;
  durationDays: number;
  isSystem: boolean;
  isActive?: boolean;
  ownerId: string;
}

// ========================================================================
//  TYPE ALIASES
// ========================================================================
export type Typology = EnumTypology;
export type ComputationType = EnumComputationType;

// ========================================================================
//  FACTORY
// ========================================================================
export function createEmptyLine(
  typology: EnumTypology = EnumTypology.RESIDENCIAL,
  category: string = 'Categoría',
  order: number = 0
): BudgetLineDocument {
  return {
    id: '',
    parentId: undefined,
    children: [],
    code: '',
    description: '',
    unit: 'm²',
    category,
    typology,
    order,
    isActive: true,
    projectQuantity: 0,
    qty: 0,
    computationType: 'fixed',
    dimensions: undefined,
    materials: [{ name: '', unit: 'm²', quantity: 0, unitPrice: 0, wasteFactor: 1, totalCost: 0 }],
    labor: [{ role: '', quantity: 0, dailyWage: 0, totalCost: 0 }],
    equipment: [],
    wasteFactor: 1.03,
    materialPerf: 1,
    laborPerf: 1,
    equipmentCost: 0,
    materialTotal: 0,
    laborTotal: 0,
    costLibraryRef: undefined,
    concreteGrade: undefined,
    steelRatio: undefined,
    formworkRatio: undefined,
    dailyOutput: 1,
    crewSize: 2,
    durationDays: 0,
    taxRate: undefined,
    profitMargin: undefined,
    contingency: undefined,
    actualCost: 0,
    marketPriceIndex: 1,
  };
}

// ========================================================================
//  CONVERTERS
// ========================================================================
export function toFirestore(line: BudgetLineDocument): Record<string, any> {
  return {
    id: line.id,
    parentId: line.parentId,
    children: (line.children || []).map(toFirestore),
    code: line.code,
    description: line.description,
    unit: line.unit,
    category: line.category,
    typology: line.typology,
    order: line.order,
    isActive: line.isActive,
    projectQuantity: line.projectQuantity,
    computationType: line.computationType,
    dimensions: line.dimensions,
    materials: line.materials,
    labor: line.labor,
    equipment: line.equipment,
    costLibraryRef: line.costLibraryRef,
    concreteGrade: line.concreteGrade,
    steelRatio: line.steelRatio,
    formworkRatio: line.formworkRatio,
    dailyOutput: line.dailyOutput,
    crewSize: line.crewSize,
    durationDays: line.durationDays,
    taxRate: line.taxRate,
    profitMargin: line.profitMargin,
    contingency: line.contingency,
    actualCost: line.actualCost,
    marketPriceIndex: line.marketPriceIndex,
  };
}

export function fromFirestore(data: Record<string, any>): BudgetLineDocument {
  return {
    id: data.id || '',
    parentId: data.parentId,
    children: Array.isArray(data.children) ? data.children.map(fromFirestore) : [],
    code: data.code || '',
    description: data.description || '',
    unit: data.unit || 'm²',
    category: data.category || '',
    typology: data.typology || EnumTypology.RESIDENCIAL,
    order: data.order || 0,
    isActive: data.isActive ?? true,
    projectQuantity: data.projectQuantity || 0,
    qty: data.qty || data.projectQuantity || 0,
    computationType: data.computationType || 'fixed',
    dimensions: data.dimensions,
    materials: Array.isArray(data.materials) ? data.materials : [],
    labor: Array.isArray(data.labor) ? data.labor : [],
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    costLibraryRef: data.costLibraryRef,
    concreteGrade: data.concreteGrade,
    steelRatio: data.steelRatio,
    formworkRatio: data.formworkRatio,
    dailyOutput: data.dailyOutput || 1,
    crewSize: data.crewSize || 2,
    durationDays: data.durationDays || 0,
    taxRate: data.taxRate,
    profitMargin: data.profitMargin,
    contingency: data.contingency,
    actualCost: data.actualCost,
    marketPriceIndex: data.marketPriceIndex ?? 1,
    wasteFactor: 1.03,
    materialPerf: 1,
    laborPerf: 1,
    equipmentCost: 0,
    materialTotal: 0,
    laborTotal: 0,
  };
}

export function deepClone(line: BudgetLineDocument): BudgetLineDocument {
  return JSON.parse(JSON.stringify(line));
}

// ========================================================================
//  BACKWARD COMPAT
// ========================================================================
export type BudgetLine = BudgetLineDocument;