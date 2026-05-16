/**
 * Extracts material data from a budget tree (recursive).
 * Shared utility used by both generateStock and periodicValidation functions.
 */
export interface BudgetMaterial {
  name: string;
  unit: string;
  qty: number;
  cost: number;
}

export function extractBudgetMaterials(lines: any[]): BudgetMaterial[] {
  const result: BudgetMaterial[] = [];
  for (const line of lines) {
    for (const m of line.materials || []) {
      const qty = (m.quantity || 0) * (line.projectQuantity || 1);
      const existing = result.find(r => r.name === m.name && r.unit === (m.unit || 'U'));
      if (existing) {
        existing.qty += qty;
      } else {
        result.push({ name: m.name, unit: m.unit || 'U', qty, cost: m.unitPrice || 0 });
      }
    }
    if (line.children) {
      result.push(...extractBudgetMaterials(line.children));
    }
  }
  return result;
}

export function extractLegacyMaterials(items: any[]): BudgetMaterial[] {
  const result: BudgetMaterial[] = [];
  for (const item of items) {
    for (const m of item.materials || []) {
      const qty = (m.quantity || 0) * (item.projectQuantity || 1);
      const existing = result.find(r => r.name === m.name && r.unit === (m.unit || 'U'));
      if (existing) {
        existing.qty += qty;
      } else {
        result.push({ name: m.name, unit: m.unit || 'U', qty, cost: m.price || 0 });
      }
    }
  }
  return result;
}
