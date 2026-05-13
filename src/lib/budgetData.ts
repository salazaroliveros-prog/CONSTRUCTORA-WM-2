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
  typology?: string; // Construction typology: RESIDENCIAL, COMERCIAL, INDUSTRIAL, CIVIL, PUBLICA

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

/**
 * Get budget lines filtered by typology
 */
export function getBudgetLinesByTypology(typology: string): BudgetLine[] {
  return defaultBudget.filter(line => !line.typology || line.typology === typology);
}

/**
 * Get all unique typologies from budget lines
 */
export function getAvailableTypologies(): string[] {
  const typologies = new Set(defaultBudget.map(line => line.typology).filter(Boolean));
  return Array.from(typologies);
}

// Default budget data by typology: Critical lines with dynamic computations
// Updated for Guatemala market with engineering calculations for all typologies
export const defaultBudget: BudgetLine[] = [
  // === RESIDENCIAL ===
  {
    id: 'res_foundation_001',
    code: '01-01-001',
    description: 'Cimentación - Excavación y Relleno',
    unit: 'm³',
    qty: 0,
    materialCost: 25,
    laborCost: 15,
    materialPerf: 1,
    laborPerf: 0.5,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.05,
    typology: 'RESIDENCIAL',
    children: []
  },
  {
    id: 'res_foundation_002',
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
    typology: 'RESIDENCIAL',
    children: []
  },
  {
    id: 'res_foundation_003',
    code: '01-01-003',
    description: 'Cimentación - Acero de Refuerzo',
    unit: 'kg',
    qty: 0,
    materialCost: 8.50,
    laborCost: 2.50,
    materialPerf: 1,
    laborPerf: 0.15,
    order: 3,
    computationType: 'dynamic',
    wasteFactor: 1.05,
    materialSpecs: { steelType: "A36", steelDiameter: 12 },
    typology: 'RESIDENCIAL',
    children: []
  },
  {
    id: 'res_columns_001',
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
    dimensions: { width: 0, height: 0, length: 0 },
    wasteFactor: 1.03,
    materialSpecs: { concreteGrade: "f'c 250 kg/cm²" },
    typology: 'RESIDENCIAL',
    children: []
  },
  {
    id: 'res_columns_002',
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
    typology: 'RESIDENCIAL',
    children: []
  },
  {
    id: 'res_slab_001',
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
    typology: 'RESIDENCIAL',
    children: []
  },

  // === COMERCIAL ===
  {
    id: 'com_foundation_001',
    code: '01-01-001',
    description: 'Cimentación - Excavación y Relleno',
    unit: 'm³',
    qty: 0,
    materialCost: 28,
    laborCost: 18,
    materialPerf: 1,
    laborPerf: 0.6,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.06,
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_foundation_002',
    code: '01-01-002',
    description: 'Cimentación - Concreto f\'c 280',
    unit: 'm³',
    qty: 0,
    materialCost: 520,
    laborCost: 45,
    materialPerf: 1,
    laborPerf: 0.35,
    order: 2,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.04,
    materialSpecs: { concreteGrade: "f'c 280 kg/cm²" },
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_foundation_003',
    code: '01-01-003',
    description: 'Cimentación - Acero de Refuerzo A42',
    unit: 'kg',
    qty: 0,
    materialCost: 9.50,
    laborCost: 3.00,
    materialPerf: 1,
    laborPerf: 0.18,
    order: 3,
    computationType: 'dynamic',
    wasteFactor: 1.06,
    materialSpecs: { steelType: "A42", steelDiameter: 16 },
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_columns_001',
    code: '01-02-001',
    description: 'Columnas - Concreto f\'c 300',
    unit: 'm³',
    qty: 0,
    materialCost: 550,
    laborCost: 50,
    materialPerf: 1,
    laborPerf: 0.3,
    order: 4,
    computationType: 'dynamic',
    dimensions: { width: 0, height: 0, length: 0 },
    wasteFactor: 1.04,
    materialSpecs: { concreteGrade: "f'c 300 kg/cm²" },
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_beams_001',
    code: '01-02-002',
    description: 'Vigas - Concreto f\'c 280',
    unit: 'm³',
    qty: 0,
    materialCost: 520,
    laborCost: 45,
    materialPerf: 1,
    laborPerf: 0.25,
    order: 5,
    computationType: 'dynamic',
    dimensions: { width: 0, height: 0, length: 0 },
    wasteFactor: 1.04,
    materialSpecs: { concreteGrade: "f'c 280 kg/cm²" },
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_slab_001',
    code: '01-03-001',
    description: 'Losa - Concreto f\'c 250',
    unit: 'm³',
    qty: 0,
    materialCost: 480,
    laborCost: 40,
    materialPerf: 1,
    laborPerf: 0.22,
    order: 6,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, thickness: 0.18 },
    wasteFactor: 1.04,
    materialSpecs: { concreteGrade: "f'c 250 kg/cm²" },
    typology: 'COMERCIAL',
    children: []
  },
  {
    id: 'com_facade_001',
    code: '01-04-001',
    description: 'Fachada - Vidrio Templado',
    unit: 'm²',
    qty: 0,
    materialCost: 180,
    laborCost: 25,
    materialPerf: 1,
    laborPerf: 0.3,
    order: 7,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0 },
    wasteFactor: 1.08,
    typology: 'COMERCIAL',
    children: []
  },

  // === INDUSTRIAL ===
  {
    id: 'ind_foundation_001',
    code: '01-01-001',
    description: 'Cimentación - Excavación Industrial',
    unit: 'm³',
    qty: 0,
    materialCost: 35,
    laborCost: 25,
    materialPerf: 1,
    laborPerf: 0.7,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.08,
    typology: 'INDUSTRIAL',
    children: []
  },
  {
    id: 'ind_foundation_002',
    code: '01-01-002',
    description: 'Cimentación - Concreto f\'c 350',
    unit: 'm³',
    qty: 0,
    materialCost: 620,
    laborCost: 60,
    materialPerf: 1,
    laborPerf: 0.4,
    order: 2,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.05,
    materialSpecs: { concreteGrade: "f'c 350 kg/cm²" },
    typology: 'INDUSTRIAL',
    children: []
  },
  {
    id: 'ind_columns_001',
    code: '01-02-001',
    description: 'Columnas - Concreto f\'c 400',
    unit: 'm³',
    qty: 0,
    materialCost: 700,
    laborCost: 70,
    materialPerf: 1,
    laborPerf: 0.35,
    order: 3,
    computationType: 'dynamic',
    dimensions: { width: 0, height: 0, length: 0 },
    wasteFactor: 1.05,
    materialSpecs: { concreteGrade: "f'c 400 kg/cm²" },
    typology: 'INDUSTRIAL',
    children: []
  },
  {
    id: 'ind_floor_001',
    code: '01-03-001',
    description: 'Piso Industrial - Concreto f\'c 300',
    unit: 'm³',
    qty: 0,
    materialCost: 550,
    laborCost: 45,
    materialPerf: 1,
    laborPerf: 0.25,
    order: 4,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, thickness: 0.20 },
    wasteFactor: 1.06,
    materialSpecs: { concreteGrade: "f'c 300 kg/cm²" },
    typology: 'INDUSTRIAL',
    children: []
  },
  {
    id: 'ind_roof_001',
    code: '01-04-001',
    description: 'Cubierta - Estructura Metálica',
    unit: 'kg',
    qty: 0,
    materialCost: 12,
    laborCost: 8,
    materialPerf: 1,
    laborPerf: 0.15,
    order: 5,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0 },
    wasteFactor: 1.07,
    typology: 'INDUSTRIAL',
    children: []
  },

  // === CIVIL ===
  {
    id: 'civ_road_001',
    code: '01-01-001',
    description: 'Carretera - Excavación y Relleno',
    unit: 'm³',
    qty: 0,
    materialCost: 45,
    laborCost: 35,
    materialPerf: 1,
    laborPerf: 0.8,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.12,
    typology: 'CIVIL',
    children: []
  },
  {
    id: 'civ_road_002',
    code: '01-01-002',
    description: 'Carretera - Sub-base Granular',
    unit: 'm³',
    qty: 0,
    materialCost: 85,
    laborCost: 25,
    materialPerf: 1,
    laborPerf: 0.4,
    order: 2,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, thickness: 0.30 },
    wasteFactor: 1.10,
    typology: 'CIVIL',
    children: []
  },
  {
    id: 'civ_road_003',
    code: '01-01-003',
    description: 'Carretera - Base Asfáltica',
    unit: 'm³',
    qty: 0,
    materialCost: 180,
    laborCost: 40,
    materialPerf: 1,
    laborPerf: 0.3,
    order: 3,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, thickness: 0.08 },
    wasteFactor: 1.08,
    typology: 'CIVIL',
    children: []
  },
  {
    id: 'civ_bridge_001',
    code: '01-02-001',
    description: 'Puente - Pilas de Concreto f\'c 400',
    unit: 'm³',
    qty: 0,
    materialCost: 700,
    laborCost: 80,
    materialPerf: 1,
    laborPerf: 0.5,
    order: 4,
    computationType: 'dynamic',
    dimensions: { width: 0, height: 0, length: 0 },
    wasteFactor: 1.06,
    materialSpecs: { concreteGrade: "f'c 400 kg/cm²" },
    typology: 'CIVIL',
    children: []
  },

  // === PÚBLICA ===
  {
    id: 'pub_foundation_001',
    code: '01-01-001',
    description: 'Cimentación - Excavación Controlada',
    unit: 'm³',
    qty: 0,
    materialCost: 30,
    laborCost: 20,
    materialPerf: 1,
    laborPerf: 0.6,
    order: 1,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.07,
    typology: 'PUBLICA',
    children: []
  },
  {
    id: 'pub_foundation_002',
    code: '01-01-002',
    description: 'Cimentación - Concreto f\'c 280',
    unit: 'm³',
    qty: 0,
    materialCost: 520,
    laborCost: 45,
    materialPerf: 1,
    laborPerf: 0.32,
    order: 2,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0, height: 0 },
    wasteFactor: 1.04,
    materialSpecs: { concreteGrade: "f'c 280 kg/cm²" },
    typology: 'PUBLICA',
    children: []
  },
  {
    id: 'pub_accessibility_001',
    code: '01-02-001',
    description: 'Accesibilidad - Rampas y Pasillos',
    unit: 'm²',
    qty: 0,
    materialCost: 120,
    laborCost: 30,
    materialPerf: 1,
    laborPerf: 0.4,
    order: 3,
    computationType: 'dynamic',
    dimensions: { length: 0, width: 0 },
    wasteFactor: 1.05,
    typology: 'PUBLICA',
    children: []
  },
  {
    id: 'pub_security_001',
    code: '01-03-001',
    description: 'Seguridad - Cerramientos Perimetrales',
    unit: 'm',
    qty: 0,
    materialCost: 95,
    laborCost: 25,
    materialPerf: 1,
    laborPerf: 0.3,
    order: 4,
    computationType: 'dynamic',
    dimensions: { length: 0, height: 0 },
    wasteFactor: 1.06,
    typology: 'PUBLICA',
    children: []
  }
];

// Note: In a production system, the defaultBudget would be loaded from a JSON file or API.
// For simplicity, we define it here. You can replace this with an import from a JSON file.