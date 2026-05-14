/**
 * Tipos fuertemente tipados para el sistema de presupuestos profesional
 * Incluye: APU, desperdicios, impuestos, margen, equipos, sensibilidad
 */

export interface BudgetDimensions {
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  diameter?: number;
}

export interface MaterialLine {
  name: string;
  unit: string;
  quantity: number;
  price: number;
  /** Factor de desperdicio específico del material (ej: 1.05 = 5%) */
  wasteFactor?: number;
}

export interface LaborLine {
  role: string;
  unit: string;
  quantity: number;
  price: number;
  /** Rendimiento: unidades por día */
  performance?: number;
}

export interface EquipmentLine {
  name: string;
  unit: string;
  quantity: number;
  /** Costo por hora/día de operación */
  hourlyRate: number;
  /** Horas de uso por unidad de trabajo */
  hoursPerUnit: number;
}

export interface BudgetItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  projectQuantity: number;
  selected: boolean;
  typology: string;
  durationDays: number;
  category: string;
  materials: MaterialLine[];
  labor: LaborLine[];
  equipment?: EquipmentLine[];
  dimensions?: BudgetDimensions;
  /** Factor de desperdicio global del renglón (ej: 1.05 = 5%) */
  wasteFactor?: number;
  /** Tasa de IVA/impuesto (0.12 = 12%) */
  taxRate?: number;
  /** Margen de utilidad (0.15 = 15%) */
  profitMargin?: number;
  /** Porcentaje de imprevistos (0.05 = 5%) */
  contingency?: number;
  computationType?: 'fixed' | 'dynamic';
  /** Precio de mercado actual (para sensibilidad) */
  marketPriceIndex?: number;
  /** Costo real ejecutado (para comparativa) */
  actualCost?: number;
}

export interface BudgetCalculationResult {
  materialTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  wasteTotal: number;
  subtotal: number;
  taxAmount: number;
  profitAmount: number;
  contingencyAmount: number;
  totalWithTaxMargin: number;
  unitCost: number;
}

export interface BudgetSummary {
  totalDirect: number;
  totalMaterials: number;
  totalLabor: number;
  totalEquipment: number;
  totalWaste: number;
  baseSubtotal: number;
  taxTotal: number;
  profitTotal: number;
  contingencyTotal: number;
  indirectCost: number;
  adminCost: number;
  personalCost: number;
  baseBudget: number;
  totalBudget: number;
  costPerM2: number;
  /** Margen general sobre el presupuesto */
  overallMargin: number;
}

export interface BudgetConfig {
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
  wasteFactors: { materials: number; labor: number };
  /** IVA global (%) */
  taxRate: number;
  /** Margen de utilidad global (%) */
  profitMargin: number;
  /** Imprevistos global (%) */
  contingency: number;
}

export interface SensitivityScenario {
  name: string;
  /** Variación porcentual en materiales (-20 a +50) */
  materialVar: number;
  /** Variación porcentual en mano de obra */
  laborVar: number;
  /** Nuevo total calculado */
  total: number;
  /** Diferencia vs presupuesto base */
  difference: number;
  /** Diferencia porcentual */
  diffPercent: number;
}

export type ComputationType = 'fixed' | 'dynamic';
