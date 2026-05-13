/**
 * Tipos fuertemente tipados para el sistema de presupuestos
 * Elimina cualquier uso de 'any' en la lógica de presupuestos
 */

export interface BudgetDimensions {
  length?: number;  // Largo (m)
  width?: number;   // Ancho (m)
  height?: number;  // Alto/Profundidad (m)
  thickness?: number; // Espesor (m)
  diameter?: number; // Diámetro (m)
}

export interface MaterialLine {
  name: string;
  unit: string;
  quantity: number;
  price: number;
}

export interface LaborLine {
  role: string;
  unit: string;
  quantity: number;
  price: number;
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
  dimensions?: BudgetDimensions;
  wasteFactor?: number;
  computationType?: 'fixed' | 'dynamic';
}

export interface BudgetCalculationResult {
  materialTotal: number;
  laborTotal: number;
  subtotal: number;
  wasteAmount: number;
}

export interface BudgetSummary {
  totalDirect: number;
  totalMaterials: number;
  totalLabor: number;
  totalWaste: number;
  indirectCost: number;
  adminCost: number;
  personalCost: number;
  baseBudget: number;
  totalBudget: number;
  costPerM2: number;
}

export interface BudgetConfig {
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
  wasteFactors: {
    materials: number;
    labor: number;
  };
}

export type ComputationType = 'fixed' | 'dynamic';
