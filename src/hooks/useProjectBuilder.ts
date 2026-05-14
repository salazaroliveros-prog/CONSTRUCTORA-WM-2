/**
 * Hook personalizado para gestión completa de proyectos de construcción
 * Centraliza estado, cálculos, conversiones y operaciones CRUD
 */

import { useMemo, useCallback, useState } from 'react';
import { BudgetItem, MaterialLine, LaborLine } from '../types/budget';
import { BudgetLine } from '../lib/budgetData';
import { MARKET_LEVELS, SLAB_TYPOLOGIES, applyMarketParameters } from '../lib/marketParams';
import { itemsToBudgetTree, budgetTreeToItems } from '../utils/budgetConverter';
import { toast } from 'sonner';
import { Typology, WorkItem } from '../constants';

interface UseProjectBuilderProps {
  initialItems?: BudgetItem[];
}

interface UseProjectBuilderResult {
  // Estado del proyecto
  project: {
    id: string;
    name: string;
    clientName: string;
    typology: string;
    status: string;
    startDate: string;
    endDate: string;
    items: BudgetItem[];
    indirectCosts: number;
    administrativeCosts: number;
    personalCosts: number;
  };
  // Configuración
  selectedTypology: Typology;
  selectedMarketLevel: typeof MARKET_LEVELS[0];
  selectedSlabType: typeof SLAB_TYPOLOGIES[0];
  wasteFactors: { materials: number; labor: number };
  areaTotal: number;
  showAdvancedConfig: boolean;
  setShowAdvancedConfig: (v: boolean) => void;
  // Árbol de presupuesto (vista calculada)
  budgetTree: BudgetLine[];
  setBudgetTree: (tree: BudgetLine[]) => void;
  // Cálculos
  totals: {
    materialsTotal: number;
    laborTotal: number;
    wasteMaterials: number;
    wasteLabor: number;
    totalDirect: number;
    baseBudget: number;
    totalBudget: number;
    costPerM2: number;
    indirectCost: number;
    adminCost: number;
    personalCost: number;
  };
  estimatedDays: number;
  totalMaterialsSummary: Array<{ name: string; unit: string; totalQuantity: number; totalCost: number }>;
  marketMultipliers: { material: number; labor: number };
  // setters de configuración
  setProject: (p: any) => void;
  setSelectedTypology: (t: Typology) => void;
  setSelectedMarketLevel: (m: typeof MARKET_LEVELS[0]) => void;
  setSelectedSlabType: (s: typeof SLAB_TYPOLOGIES[0]) => void;
  setWasteFactors: (w: { materials: number; labor: number }) => void;
  setAreaTotal: (a: number) => void;
  // Acciones sobre ítems
  addItem: (item: WorkItem) => boolean;
  removeItem: (id: string) => void;
  updateItemField: <K extends keyof BudgetItem>(id: string, field: K, value: BudgetItem[K]) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateDuration: (id: string, days: number) => void;
  updateMaterial: (itemId: string, matIdx: number, field: keyof MaterialLine, value: string | number) => void;
  updateLabor: (itemId: string, labIdx: number, field: keyof LaborLine, value: string | number) => void;
  addCustomItem: () => BudgetItem;
  addAPUItem: (apu: any) => boolean;
}

export function useProjectBuilder({ initialItems = [] }: UseProjectBuilderProps = {}) {
  // Estado principal del proyecto
  const [project, setProject] = useState({
    id: `temp-${Date.now()}`,
    name: 'Nuevo Proyecto',
    clientName: 'Cliente Sin Nombre',
    typology: 'RESIDENCIAL' as Typology,
    status: 'COTIZACION',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    items: initialItems,
    indirectCosts: 15,
    administrativeCosts: 5,
    personalCosts: 10,
  });

  // Configuración
  const [selectedTypology, setSelectedTypology] = useState<Typology>(Typology.RESIDENCIAL);
  const [selectedMarketLevel, setSelectedMarketLevel] = useState(MARKET_LEVELS[1]); // Moderate
  const [selectedSlabType, setSelectedSlabType] = useState(SLAB_TYPOLOGIES[0]); // Solid slab
  const [wasteFactors, setWasteFactors] = useState({ materials: 5, labor: 0 });
  const [areaTotal, setAreaTotal] = useState(0);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Árbol de presupuesto derivado (BudgetLine[])
  const budgetTree = useMemo((): BudgetLine[] => itemsToBudgetTree(project.items), [project.items]);

  // Actualiza el presupuesto desde un árbol (para edición de dimensiones)
  const setBudgetTree = useCallback((newTree: BudgetLine[]) => {
    const newItems = budgetTreeToItems(newTree);
    setProject(prev => ({ ...prev, items: newItems }));
  }, []);

  // Días estimados del proyecto
  const estimatedDays = useMemo(() => {
    return project.items.reduce((acc, item) => {
      const workers = Math.max(1, item.labor.reduce((s, l) => s + (l.quantity || 0), 0));
      return acc + Math.ceil((item.projectQuantity * (item.durationDays || 1)) / workers);
    }, 0);
  }, [project.items]);

  // Resumen total de materiales
  const totalMaterialsSummary = useMemo(() => {
    const summary: Record<string, { name: string; unit: string; totalQuantity: number; totalCost: number }> = {};

    project.items.forEach(item => {
      item.materials.forEach(mat => {
        const key = mat.name;
        if (summary[key]) {
          summary[key].totalQuantity += mat.quantity * item.projectQuantity;
          summary[key].totalCost += mat.price * mat.quantity * item.projectQuantity;
        } else {
          summary[key] = {
            name: mat.name,
            unit: mat.unit,
            totalQuantity: mat.quantity * item.projectQuantity,
            totalCost: mat.price * mat.quantity * item.projectQuantity
          };
        }
      });
    });

    return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
  }, [project.items]);

  // Multiplicadores de mercado aplicados a cada línea
  const marketMultipliers = useMemo(() => ({
    material: (selectedSlabType?.costMultipliers?.material ?? 1) * (selectedMarketLevel.costPerSqm.recommended / 3750),
    labor: selectedMarketLevel.laborMultiplier,
  }), [selectedMarketLevel, selectedSlabType]);

  // Cálculos totales basados en budgetTree con ajustes de mercado por línea
  const totals = useMemo(() => {
    let materialsTotal = 0;
    let laborTotal = 0;

    const matMul = marketMultipliers.material;
    const labMul = marketMultipliers.labor;

    budgetTree.forEach(line => {
      if (line.materialCost > 0) {
        materialsTotal += line.qty * line.materialCost * (line.materialPerf || 1) * matMul;
      }
      if (line.laborCost > 0) {
        laborTotal += line.qty * line.laborCost * (line.laborPerf || 1) * labMul;
      }
      line.children?.forEach(child => {
        if (child.materialCost > 0) {
          materialsTotal += child.qty * child.materialCost * (child.materialPerf || 1) * matMul;
        }
        if (child.laborCost > 0) {
          laborTotal += child.qty * child.laborCost * (child.laborPerf || 1) * labMul;
        }
      });
    });

    const wasteMaterials = materialsTotal * (wasteFactors.materials / 100);
    const wasteLabor = laborTotal * (wasteFactors.labor / 100);
    const totalDirect = materialsTotal + laborTotal + wasteMaterials + wasteLabor;
    const baseBudget = totalDirect * (1 + (project.indirectCosts + project.administrativeCosts + project.personalCosts) / 100);
    // Nota: applyMarketParameters ya no duplica el ajuste de mercado porque lo aplicamos por línea
    const totalBudget = baseBudget;
    const costPerM2 = areaTotal > 0 ? totalBudget / areaTotal : 0;
    const indirectCost = totalDirect * (project.indirectCosts / 100);
    const adminCost = totalDirect * (project.administrativeCosts / 100);
    const personalCost = totalDirect * (project.personalCosts / 100);
    return {
      materialsTotal,
      laborTotal,
      wasteMaterials,
      wasteLabor,
      totalDirect,
      baseBudget,
      totalBudget,
      costPerM2,
      indirectCost,
      adminCost,
      personalCost
    };
  }, [budgetTree, wasteFactors, project.indirectCosts, project.administrativeCosts, project.personalCosts, marketMultipliers, areaTotal]);

  // Acciones sobre ítems
  const addItem = useCallback((item: WorkItem): boolean => {
    if (project.items.some(i => i.id === item.id)) return false;
    const newItem: BudgetItem = { ...item, projectQuantity: 1, selected: true };
    setProject(p => ({ ...p, items: [...p.items, newItem] }));
    return true;
  }, [project.items]);

  const removeItem = useCallback((id: string) => {
    setProject(p => ({ ...p, items: p.items.filter(i => i.id !== id) }));
  }, []);

  const updateItemField = useCallback(<K extends keyof BudgetItem>(id: string, field: K, value: BudgetItem[K]) => {
    setProject(p => ({
      ...p,
      items: p.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    setProject(p => ({
      ...p,
      items: p.items.map(item => item.id === id ? { ...item, projectQuantity: Math.max(0.1, qty) } : item)
    }));
  }, []);

  const updateDuration = useCallback((id: string, days: number) => {
    setProject(p => ({
      ...p,
      items: p.items.map(item => item.id === id ? { ...item, durationDays: Math.max(0.01, days) } : item)
    }));
  }, []);

  const updateMaterial = useCallback((itemId: string, matIdx: number, field: keyof MaterialLine, value: string | number) => {
    setProject(p => ({
      ...p,
      items: p.items.map(item => {
        if (item.id !== itemId) return item;
        const newMaterials = [...item.materials];
        newMaterials[matIdx] = { ...newMaterials[matIdx], [field]: value };
        return { ...item, materials: newMaterials };
      })
    }));
  }, []);

  const updateLabor = useCallback((itemId: string, labIdx: number, field: keyof LaborLine, value: string | number) => {
    setProject(p => ({
      ...p,
      items: p.items.map(item => {
        if (item.id !== itemId) return item;
        const newLabor = [...item.labor];
        newLabor[labIdx] = { ...newLabor[labIdx], [field]: value };
        return { ...item, labor: newLabor };
      })
    }));
  }, []);

  const addCustomItem = useCallback((): BudgetItem => {
    const customId = `CUSTOM-${Date.now()}`;
    const newItem: BudgetItem = {
      id: customId,
      code: 'CUST-000',
      description: 'NUEVO TRABAJO PERSONALIZADO',
      unit: 'GL',
      typology: selectedTypology,
      category: 'Personalizado',
      durationDays: 1,
      projectQuantity: 1,
      selected: true,
      materials: [{ name: 'Material Nuevo', unit: 'GL', quantity: 1, price: 0 }],
      labor: [{ role: 'Oficial', unit: 'día', quantity: 1, price: 0 }],
      dimensions: undefined,
      wasteFactor: undefined,
    };
    setProject(p => ({ ...p, items: [...p.items, newItem] }));
    return newItem;
  }, [selectedTypology]);

  const addAPUItem = useCallback((apu: any): boolean => {
    if (project.items.some(i => i.id === apu.id)) {
      toast.info('Este renglón APU ya está en el presupuesto');
      return false;
    }
    const newItem: BudgetItem = {
      id: apu.id,
      code: apu.code,
      description: apu.description,
      unit: apu.unit,
      typology: apu.typology,
      category: apu.category,
      durationDays: apu.durationDays,
      projectQuantity: 1,
      selected: true,
      materials: apu.materials.map((m: any) => ({ ...m })),
      labor: apu.labor.map((l: any) => ({ ...l })),
      dimensions: undefined,
      wasteFactor: undefined,
    };
    setProject(p => ({ ...p, items: [...p.items, newItem] }));
    toast.success(`APU agregado: ${apu.description}`);
    return true;
  }, [project.items]);

  return {
    project,
    selectedTypology,
    selectedMarketLevel,
    selectedSlabType,
    wasteFactors,
    areaTotal,
    showAdvancedConfig,
    setShowAdvancedConfig,
    budgetTree,
    setBudgetTree,
    totals,
    estimatedDays,
    totalMaterialsSummary,
    marketMultipliers,
    setProject,
    setSelectedTypology,
    setSelectedMarketLevel,
    setSelectedSlabType,
    setWasteFactors,
    setAreaTotal,
    addItem,
    removeItem,
    updateItemField,
    updateQuantity,
    updateDuration,
    updateMaterial,
    updateLabor,
    addCustomItem,
    addAPUItem,
  };
}
