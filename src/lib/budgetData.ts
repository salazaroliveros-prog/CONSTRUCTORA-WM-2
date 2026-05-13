// src/lib/budgetData.ts

export interface BudgetLine {
  id: string;
  parentId?: string; // undefined means it's a top-level line
  code: string; // e.g., "01-01-001"
  description: string;
  unit: string; // e.g., "m²", "kg", "hr"
  qty: number; // base quantity for this line (e.g., area, volume, length)
  materialCost: number; // cost per unit of material (in Q.)
  laborCost: number; // cost per unit of labor (in Q.)
  materialPerf: number; // material performance: units of material per unit of base qty (e.g., kg/m²)
  laborPerf: number; // labor performance: hours of labor per unit of base qty (e.g., hr/m²)
  order: number; // chronological order for sorting
  children: BudgetLine[]; // sub-lines (for material and labor breakdown)

  // New: Dynamic computation fields for engineering calculations
  computationType?: 'fixed' | 'dynamic'; // Whether qty is fixed or calculated from dimensions
  dimensions?: {
    length?: number; // Largo (m)
    width?: number;  // Ancho (m)
    height?: number; // Alto/Profundidad (m)
    diameter?: number; // Diámetro (m) for circular elements
    thickness?: number; // Espesor (m)
  };
  wasteFactor?: number; // Factor de desperdicio (e.g., 1.05 for 5% waste)

  // New: Material specifications for automatic calculations
  materialSpecs?: {
    concreteGrade?: string; // e.g., "f'c 210 kg/cm²"
    steelType?: string; // e.g., "A36", "A42"
    steelDiameter?: number; // Diámetro de acero (mm)
    formworkType?: string; // Tipo de encofrado
  };

  // Calculated fields (not stored, computed by the engine)
  materialTotal?: number;
  laborTotal?: number;
  subtotal?: number;
}

// Default budget data: Critical lines with dynamic computations
// Updated for Guatemala market with engineering calculations
export const defaultBudget: BudgetLine[] = [
  {
    id: 'foundation_001',
    code: '01-01-001',
    description: 'Cimentación - Excavación y Relleno',
    unit: 'm³',
    qty: 0, // Will be calculated dynamically
    materialCost: 25,
    laborCost: 15,
    materialPerf: 1,
    laborPerf: 0.5,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.05,
    children: []
  },
  {
    id: 'foundation_002',
    code: '01-01-002',
    description: 'Cimentación - Concreto f\'c 210',
    unit: 'm³',
    qty: 0,
    materialCost: 450,
    laborCost: 35,
    materialPerf: 1,
    laborPerf: 0.3,
    order: 2,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.03,
    materialSpecs: { concreteGrade: "f'c 210 kg/cm²" },
    children: []
  },
  {
    id: 'foundation_003',
    code: '01-01-003',
    description: 'Cimentación - Acero de Refuerzo',
    unit: 'kg',
    qty: 0,
    materialCost: 8.50,
    laborCost: 2.50,
    materialPerf: 1,
    laborPerf: 0.1,
    order: 3,
    computationType: 'dynamic',
    wasteFactor: 1.05,
    materialSpecs: { steelType: "A36", steelDiameter: 12 },
    children: []
  },
  {
    id: 'columns_001',
    code: '01-02-001',
    description: 'Columnas - Concreto f\'c 250',
    unit: 'm³',
    qty: 0,
    materialCost: 480,
    laborCost: 40,
    materialPerf: 1,
    laborPerf: 0.25,
    order: 4,
    computationType: 'dynamic',
    dimensions: { width: 0, height: 0, length: 0 }, // width=base, height=side, length=altura
    wasteFactor: 1.03,
    materialSpecs: { concreteGrade: "f'c 250 kg/cm²" },
    children: []
  },
  {
    id: 'columns_002',
    code: '01-02-002',
    description: 'Columnas - Acero Longitudinal',
    unit: 'kg',
    qty: 0,
    materialCost: 9.00,
    laborCost: 3.00,
    materialPerf: 1,
    laborPerf: 0.15,
    order: 5,
    computationType: 'dynamic',
    wasteFactor: 1.05,
    materialSpecs: { steelType: "A42", steelDiameter: 16 },
    children: []
  },
  {
    id: 'slab_001',
    code: '01-03-001',
    description: 'Losa - Concreto f\'c 210',
    unit: 'm³',
    qty: 0,
    materialCost: 450,
    laborCost: 35,
    materialPerf: 1,
    laborPerf: 0.2,
    order: 6,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, thickness: 0.15 },
    wasteFactor: 1.03,
    materialSpecs: { concreteGrade: "f'c 210 kg/cm²" },
    children: []
  },
  {
    id: 'slab_002',
    code: '01-03-002',
    description: 'Losa - Malla Electrosoldada',
    unit: 'm²',
    qty: 0,
    materialCost: 25,
    laborCost: 5,
    materialPerf: 1,
    laborPerf: 0.1,
    order: 7,
    computationType: 'dynamic',
    wasteFactor: 1.05,
    children: []
  }
];

// Note: In a production system, the defaultBudget would be loaded from a JSON file or API.
// For simplicity, we define it here. You can replace this with an import from a JSON file.