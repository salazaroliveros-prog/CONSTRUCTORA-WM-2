/**
 * Conversores entre BudgetItem y BudgetLine
 * Mejorados para preservar toda la información de dimensiones y configuraciones
 */

import { BudgetItem } from '../types/budget';
import { BudgetLine } from '../lib/budgetData';
import { Typology } from '../models/engineering';

/**
 * Convierte un arreglo de BudgetItem a un árbol de BudgetLine.
 * Preserva: dimensions, wasteFactor, typology, durationDays, category, computationType
 */
export function itemsToBudgetTree(items: BudgetItem[]): BudgetLine[] {
  return items.map(item => {
    const hasDimensions = !!item.dimensions && Object.keys(item.dimensions).length > 0;
const rawType: string = item.computationType || (hasDimensions ? 'dynamic' : 'fixed');
     const computationType: 'fixed' | 'dynamic' = rawType === 'steel' ? 'dynamic' : (rawType as 'fixed' | 'dynamic');

    const typology = (item.typology as Typology) || Typology.RESIDENCIAL;

    const parentLine: BudgetLine = {
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      qty: item.projectQuantity,
      materialCost: 0,
      laborCost: 0,
      equipmentCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: 0,
      children: [],
      computationType,
      dimensions: item.dimensions,
      wasteFactor: item.wasteFactor,
      typology,
      durationDays: item.durationDays,
      category: item.category,
      isActive: true,
      projectQuantity: item.projectQuantity,
      materials: [],
      labor: [],
      equipment: [],
      dailyOutput: 1,
      crewSize: 2,
      estimatedDays: 0,
    };

    // Materiales como hijos
    const materialChildren = (item.materials || []).map((mat, idx) => ({
      id: `${item.id}-mat-${idx}`,
      parentId: item.id,
      code: `${item.code}-M${idx + 1}`,
      description: mat.name,
      unit: mat.unit,
      qty: mat.quantity * item.projectQuantity,
      materialCost: mat.price,
      laborCost: 0,
      equipmentCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: idx,
      children: [] as BudgetLine[],
      computationType: 'fixed' as const,
      dimensions: undefined,
      wasteFactor: 1,
      typology,
      durationDays: item.durationDays || 1,
      category: item.category || 'Materiales',
      isActive: true,
      projectQuantity: item.projectQuantity,
      materials: [] as any,
      labor: [] as any,
      equipment: [] as any,
      dailyOutput: 1,
      crewSize: 2,
    }));

    // Mano de obra como hijos
    const laborChildren = (item.labor || []).map((lab, idx) => ({
      id: `${item.id}-lab-${idx}`,
      parentId: item.id,
      code: `${item.code}-L${idx + 1}`,
      description: lab.role,
      unit: lab.unit,
      qty: lab.quantity * item.projectQuantity,
      materialCost: 0,
      laborCost: lab.price,
      equipmentCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: idx + materialChildren.length,
      children: [] as BudgetLine[],
      computationType: 'fixed' as const,
      dimensions: undefined,
      wasteFactor: 1,
      typology,
      durationDays: item.durationDays || 1,
      category: item.category || 'Mano de Obra',
      isActive: true,
      projectQuantity: item.projectQuantity,
      materials: [] as any,
      labor: [] as any,
      equipment: [] as any,
      dailyOutput: 1,
      crewSize: 2,
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
      typology: (line.typology as any) || Typology.RESIDENCIAL,
      durationDays: line.durationDays || 1,
      category: line.category || 'PERSONALIZADO',
      projectQuantity: line.qty,
      selected: true as const,
      materials,
      labor,
      dimensions: line.dimensions,
      wasteFactor: line.wasteFactor,
      computationType: line.computationType === 'steel' ? 'dynamic' : (line.computationType as any),
    };
  });
}