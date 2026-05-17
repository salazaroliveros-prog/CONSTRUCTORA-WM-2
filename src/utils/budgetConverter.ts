/**
 * Conversores entre BudgetItem y BudgetLine
 * Mejorados para preservar toda la información de dimensiones y configuraciones
 */

import { BudgetItem } from '../types/budget';
import { BudgetLine } from '../lib/budgetData';
import { Typology } from '../models/engineering';
import { PMath } from '../engine/precision';

/**
 * Convierte un arreglo de BudgetItem a un árbol de BudgetLine.
 * Preserva: dimensions, wasteFactor, typology, durationDays, category, computationType
 *
 * CAMBIO CRÍTICO v5: Se mantienen materials[] y labor[] en el nodo padre
 * para que el motor de cálculo (calcLine) pueda procesarlos correctamente.
 * Los hijos se usan SÓLO para mostrar desglose en la BudgetTable.
 */
export function itemsToBudgetTree(items: BudgetItem[]): BudgetLine[] {
  return items.map(item => {
    const hasDimensions = !!item.dimensions && Object.keys(item.dimensions).length > 0;
    const rawType: string = item.computationType || (hasDimensions ? 'dynamic' : 'fixed');
    const computationType: 'fixed' | 'dynamic' = rawType === 'steel' ? 'dynamic' : (rawType as 'fixed' | 'dynamic');
    const typology = (item.typology as Typology) || Typology.RESIDENCIAL;

    // Costos directos del item para usar en el padre
    const totalMatCost = (item.materials || []).reduce((s, m) => PMath.add(s, PMath.mul(m.price, m.quantity)), 0);
    const totalLabCost = (item.labor || []).reduce((s, l) => PMath.add(s, PMath.mul(l.price, l.quantity)), 0);
    const totalEqCost = (item.equipment || []).reduce((s, e) => PMath.add(s, PMath.mul(e.hourlyRate, e.quantity)), 0);

    const parentLine: BudgetLine = {
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      qty: item.projectQuantity,
      materialCost: totalMatCost,
      laborCost: totalLabCost,
      equipmentCost: totalEqCost,
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
      // CRÍTICO: Mantener materials[] y labor[] en el padre para que calcLine() funcione
      materials: (item.materials || []).map(m => ({
        name: m.name,
        unit: m.unit,
        quantity: m.quantity,
        unitPrice: m.price,
        wasteFactor: item.wasteFactor || 1.03,
        totalCost: PMath.mul(m.price, m.quantity),
      })),
      labor: (item.labor || []).map(l => ({
        role: l.role,
        quantity: l.quantity,
        dailyWage: l.price,
        totalCost: PMath.mul(l.price, l.quantity),
      })),
      equipment: (item.equipment || []).map(e => ({
        name: e.name || '',
        unit: e.unit || '',
        quantity: e.quantity || 0,
        hourlyRate: e.hourlyRate || 0,
        hoursPerUnit: e.hoursPerUnit || 0,
        totalCost: (e.hourlyRate || 0) * (e.quantity || 0),
      })),
      dailyOutput: 1,
      crewSize: 2,
      estimatedDays: 0,
    };

    // Hijo: Desglose de materiales (solo para visualización en BudgetTable)
    const materialChildren = (item.materials || []).map((mat, idx) => ({
      id: `${item.id}-mat-${idx}`,
      parentId: item.id,
      code: `${item.code}-M${idx + 1}`,
      description: mat.name,
      unit: mat.unit,
      qty: mat.quantity,
      materialCost: mat.price,
      laborCost: 0,
      equipmentCost: 0,
      materialPerf: 1,
      laborPerf: 1,
      order: idx,
      children: [] as BudgetLine[],
      computationType: 'fixed' as const,
      dimensions: undefined,
      wasteFactor: item.wasteFactor || 1.03,
      typology,
      durationDays: item.durationDays || 1,
      category: item.category || 'Materiales',
      isActive: false,
      projectQuantity: item.projectQuantity,
      materials: [] as any,
      labor: [] as any,
      equipment: [] as any,
      dailyOutput: 1,
      crewSize: 2,
    }));

    // Hijo: Desglose de mano de obra (solo para visualización)
    const laborChildren = (item.labor || []).map((lab, idx) => ({
      id: `${item.id}-lab-${idx}`,
      parentId: item.id,
      code: `${item.code}-L${idx + 1}`,
      description: lab.role,
      unit: lab.unit,
      qty: lab.quantity,
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
      isActive: false,
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
    const materialChildren = children.filter(child => (child.materialCost ?? 0) > 0 && (child.laborCost ?? 0) === 0);
    const laborChildren = children.filter(child => (child.laborCost ?? 0) > 0 && (child.materialCost ?? 0) === 0);

    const baseQty = line.qty || 1;

    const materials = materialChildren.map(child => ({
      name: child.description,
      unit: child.unit,
      quantity: (child.qty ?? 0) / baseQty,
      price: child.materialCost ?? 0,
    }));

    const labor = laborChildren.map(child => ({
      role: child.description,
      unit: child.unit,
      quantity: (child.qty ?? 0) / baseQty,
      price: child.laborCost ?? 0,
    }));

    return {
      id: line.id || '',
      code: line.code,
      description: line.description,
      unit: line.unit,
      typology: (line.typology as any) || Typology.RESIDENCIAL,
      durationDays: line.durationDays || 1,
      category: line.category || 'PERSONALIZADO',
      projectQuantity: line.qty ?? 1,
      selected: true as const,
      materials,
      labor,
      dimensions: line.dimensions,
      wasteFactor: line.wasteFactor,
      computationType: line.computationType === 'steel' ? 'dynamic' : (line.computationType as any),
    };
  });
}