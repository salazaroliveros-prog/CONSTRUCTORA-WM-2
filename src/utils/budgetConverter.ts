// src/utils/budgetConverter.ts
import { ProjectItem } from '../constants';
import { BudgetLine } from '../lib/budgetData';

/**
 * Convierte un arreglo de ProjectItem (legacy) a un árbol de BudgetLine.
 * Cada ProjectItem se transforma en una línea padre. Sus materiales y mano de obra
 * se convierten en líneas hijas.
 */
export function itemsToBudgetTree(items: ProjectItem[]): BudgetLine[] {
  return items.map(item => {
    const parentLine: BudgetLine = {
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      qty: item.projectQuantity,
      materialCost: 0, // Los costos están en los hijos
      laborCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: 0, // No hay orden definido; se podría mantener un índice
      children: [],
    };

    // Materiales como hijos
    const materialChildren = (item.materials || []).map((mat, idx) => ({
      id: `${item.id}-mat-${idx}`,
      parentId: item.id,
      code: `${item.code}-M${idx + 1}`,
      description: mat.name,
      unit: mat.unit,
      qty: mat.quantity, // Cantidad total ya que el precio es unitario
      materialCost: mat.price,
      laborCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: idx,
      children: [],
    }));

    // Mano de obra como hijos
    const laborChildren = (item.labor || []).map((lab, idx) => ({
      id: `${item.id}-lab-${idx}`,
      parentId: item.id,
      code: `${item.code}-L${idx + 1}`,
      description: lab.role,
      unit: lab.unit,
      qty: lab.quantity,
      materialCost: 0,
      laborCost: lab.price,
      materialPerf: 1,
      laborPerf: 1,
      order: idx + materialChildren.length,
      children: [],
    }));

    parentLine.children = [...materialChildren, ...laborChildren];
    return parentLine;
  });
}

/**
 * Convierte un árbol de BudgetLine de vuelta a un arreglo de ProjectItem (legacy).
 * Cada línea padre se convierte en un ProjectItem, y sus hijos se agrupan en materiales y mano de obra.
 */
export function budgetTreeToItems(tree: BudgetLine[]): ProjectItem[] {
  return tree.map(line => {
    const children = line.children || [];
    const materialChildren = children.filter(child => child.materialCost > 0 && child.laborCost === 0);
    const laborChildren = children.filter(child => child.laborCost > 0 && child.materialCost === 0);

    const materials = materialChildren.map(child => ({
      name: child.description,
      unit: child.unit,
      quantity: child.qty,
      price: child.materialCost,
    }));

    const labor = laborChildren.map(child => ({
      role: child.description,
      unit: child.unit,
      quantity: child.qty,
      price: child.laborCost,
    }));

    return {
      id: line.id,
      code: line.code,
      description: line.description,
      unit: line.unit,
      typology: 'RESIDENCIAL' as any, // TODO: determinar tipología; por ahora placeholder
      durationDays: 1,
      category: 'PERSONALIZADO',
      projectQuantity: line.qty,
      selected: true,
      materials,
      labor,
    };
  });
}