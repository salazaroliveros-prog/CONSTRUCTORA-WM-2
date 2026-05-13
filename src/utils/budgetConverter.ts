/**
 * Conversores entre BudgetItem y BudgetLine
 * Mejorados para preservar toda la información de dimensiones y configuraciones
 */

import { BudgetItem } from '../types/budget';
import { BudgetLine } from '../lib/budgetData';

/**
 * Convierte un arreglo de BudgetItem a un árbol de BudgetLine.
 * Preserva: dimensions, wasteFactor, typology, durationDays, category, computationType
 */
export function itemsToBudgetTree(items: BudgetItem[]): BudgetLine[] {
  return items.map(item => {
    const hasDimensions = !!item.dimensions && Object.keys(item.dimensions).length > 0;
    const computationType: 'fixed' | 'dynamic' = item.computationType || (hasDimensions ? 'dynamic' : 'fixed');

    const parentLine: BudgetLine = {
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      qty: item.projectQuantity,
      materialCost: 0,
      laborCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: 0,
      children: [],
      computationType,
      dimensions: item.dimensions,
      wasteFactor: item.wasteFactor,
      typology: item.typology,
      durationDays: item.durationDays,
      category: item.category,
    };

    // Materiales como hijos
    const materialChildren = (item.materials || []).map((mat, idx) => ({
      id: `${item.id}-mat-${idx}`,
      parentId: item.id,
      code: `${item.code}-M${idx + 1}`,
      description: mat.name,
      unit: mat.unit,
      qty: mat.quantity * item.projectQuantity, // Cantidad total para el proyecto
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
      qty: lab.quantity * item.projectQuantity, // Cantidad total para el proyecto
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
 * Convierte un árbol de BudgetLine a un arreglo de BudgetItem.
 * Preserva: dimensions, wasteFactor, typology, durationDays, category, computationType
 */
export function budgetTreeToItems(tree: BudgetLine[]): BudgetItem[] {
  return tree.map(line => {
    const children = line.children || [];
    const materialChildren = children.filter(child => child.materialCost > 0 && child.laborCost === 0);
    const laborChildren = children.filter(child => child.laborCost > 0 && child.materialCost === 0);

    const baseQty = line.qty || 1;

    const materials = materialChildren.map(child => ({
      name: child.description,
      unit: child.unit,
      quantity: child.qty / baseQty,
      price: child.materialCost,
    }));

    const labor = laborChildren.map(child => ({
      role: child.description,
      unit: child.unit,
      quantity: child.qty / baseQty,
      price: child.laborCost,
    }));

    return {
      id: line.id,
      code: line.code,
      description: line.description,
      unit: line.unit,
      typology: line.typology || 'RESIDENCIAL',
      durationDays: line.durationDays || 1,
      category: line.category || 'PERSONALIZADO',
      projectQuantity: line.qty,
      selected: true,
      materials,
      labor,
      dimensions: line.dimensions,
      wasteFactor: line.wasteFactor,
      computationType: line.computationType,
    };
  });
}
