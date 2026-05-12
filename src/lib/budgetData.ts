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

  // Calculated fields (not stored, computed by the engine)
  materialTotal?: number;
  laborTotal?: number;
  subtotal?: number;
}

// Default budget data: 40 critical lines, chronologically ordered and by typology.
// In a real app, this could be fetched from a backend or a more extensive library.
// For now, we provide a sample structure.
export const defaultBudget: BudgetLine[] = [
  // Example structure (to be expanded to 40 lines)
  {
    id: 'line_1',
    code: '01-01-001',
    description: 'Estructura - Cimentaciones',
    unit: 'm²',
    qty: 100,
    materialCost: 150, // Q. per kg of steel? Adjust as needed.
    laborCost: 80, // Q. per hour
    materialPerf: 0.5, // kg of steel per m²
    laborPerf: 2.0, // hours per m²
    order: 1,
    children: [], // Will be filled with sublines for materials and labor
  },
  // ... more lines would be added here to reach 40
];

// Note: In a production system, the defaultBudget would be loaded from a JSON file or API.
// For simplicity, we define it here. You can replace this with an import from a JSON file.