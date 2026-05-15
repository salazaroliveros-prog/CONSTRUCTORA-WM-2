/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * useProjectBuilder — Refactorizado con Engine Unificado y DataStore
 * 
 * Cambios vs versión anterior:
 * - Usa BudgetEngine para todos los cálculos
 * - Market multipliers aplicados a nivel de línea en el Engine
 * - PMath para todas las operaciones
 * - Datos derivados computados una sola vez
 */

import { useMemo, useCallback, useState } from 'react';
import { WorkItem } from '../models/workItem';
import { Typology } from '../models/engineering';
import { BudgetItem, MaterialLine, LaborLine } from '../types/budget';
import { BudgetLine } from '../lib/budgetData';
import { MARKET_LEVELS, SLAB_TYPOLOGIES, MarketLevel, SlabTypology } from '../lib/marketParams';
import { itemsToBudgetTree, budgetTreeToItems } from '../utils/budgetConverter';
import {
  calculateTree,
  calculateProject,
  calcDynamicQty,
  calcSteelReinforcement,
  PMath,
  precise,
} from '../engine/budgetEngine';
import { toast } from 'sonner';

interface UseProjectBuilderProps {
  initialItems?: BudgetItem[];
  projectConfig?: {
    indirectCosts?: number;
    administrativeCosts?: number;
    personalCosts?: number;
    marketLevel?: MarketLevel;
    slabType?: SlabTypology;
    areaTotal?: number;
  };
}

interface UseProjectBuilderResult {
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
  selectedTypology: Typology;
  selectedMarketLevel: MarketLevel;
  selectedSlabType: SlabTypology;
  wasteFactors: { materials: number; labor: number };
  areaTotal: number;
  showAdvancedConfig: boolean;
  setShowAdvancedConfig: (v: boolean) => void;
  budgetTree: BudgetLine[];
  setBudgetTree: (tree: BudgetLine[]) => void;
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
    taxAmount: number;
    profitAmount: number;
    contingencyAmount: number;
    estimatedDays: number;
    totalMaterialsSummary: Array<{
      name: string;
      unit: string;
      totalQuantity: number;
      totalCost: number;
    }>;
  };
  estimatedDays: number;
  totalMaterialsSummary: Array<{
    name: string;
    unit: string;
    totalQuantity: number;
    totalCost: number;
  }>;
  marketMultipliers: { material: number; labor: number };
  setProject: (p: any) => void;
  setSelectedTypology: (t: Typology) => void;
  setSelectedMarketLevel: (m: MarketLevel) => void;
  setSelectedSlabType: (s: SlabTypology) => void;
  setWasteFactors: (w: { materials: number; labor: number }) => void;
  setAreaTotal: (a: number) => void;
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

export function useProjectBuilder({ initialItems = [], projectConfig }: UseProjectBuilderProps = {}): UseProjectBuilderResult {
  // Estado principal del proyecto
  const [project, setProjectState] = useState({
    id: `temp-${Date.now()}`,
    name: 'Nuevo Proyecto',
    clientName: 'Cliente Sin Nombre',
    typology: 'RESIDENCIAL' as Typology,
     status: 'COTIZACION',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    items: initialItems,
    indirectCosts: projectConfig?.indirectCosts ?? 15,
    administrativeCosts: projectConfig?.administrativeCosts ?? 5,
    personalCosts: projectConfig?.personalCosts ?? 10,
  });

  // Configuración
  const [selectedTypology, setSelectedTypology] = useState<Typology>(project.typology);
  const [selectedMarketLevel, setSelectedMarketLevel] = useState<MarketLevel>(projectConfig?.marketLevel || MARKET_LEVELS[1]);
  const [selectedSlabType, setSelectedSlabType] = useState<SlabTypology>(projectConfig?.slabType || SLAB_TYPOLOGIES[0]);
  const [wasteFactors, setWasteFactorsState] = useState({ materials: 5, labor: 0 });
  const [areaTotal, setAreaTotal] = useState(projectConfig?.areaTotal || 0);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Árbol de presupuesto derivado
  const budgetTree = useMemo(
    () => itemsToBudgetTree(project.items),
    [project.items]
  );

  // Actualizar árbol desde edición de dimensiones
  const setBudgetTree = useCallback((newTree: BudgetLine[]) => {
    const newItems = budgetTreeToItems(newTree);
    setProjectState(prev => ({ ...prev, items: newItems }));
  }, []);

  // Market multipliers
  const marketMultipliers = useMemo(() => ({
    material: (selectedSlabType?.costMultipliers?.material ?? 1) *
              (selectedMarketLevel.costPerSqm.recommended / 3750),
    labor: selectedMarketLevel.laborMultiplier,
  }), [selectedMarketLevel, selectedSlabType]);

  // ─── CÁLCULO UNIFICADO CON ENGINE ──────────────────────────────────────────
  const calculationResult = useMemo(() => {
    const result = calculateProject(budgetTree, {
      marketMultipliers,
      indirectCosts: project.indirectCosts,
      adminCosts: project.administrativeCosts,
      personalCosts: project.personalCosts,
      area: areaTotal,
    });
    return result;
  }, [budgetTree, marketMultipliers, project.indirectCosts,
      project.administrativeCosts, project.personalCosts, areaTotal]);

  // Días estimados
  const estimatedDays = useMemo(() => {
    return project.items.reduce((acc, item) => {
      const workers = Math.max(1, item.labor.reduce((s, l) => s + (l.quantity || 0), 0));
      return acc + Math.ceil((item.projectQuantity * (item.durationDays || 1)) / workers);
    }, 0);
  }, [project.items]);

  // Resumen total de materiales con PMath
  const totalMaterialsSummary = useMemo(() => {
    const summary: Record<string, { name: string; unit: string; totalQuantity: number; totalCost: number }> = {};

    project.items.forEach(item => {
      item.materials.forEach(mat => {
        const key = mat.name;
        const qty = PMath.mul(mat.quantity, item.projectQuantity);
        const cost = PMath.mul(mat.price, qty);

        if (summary[key]) {
          summary[key].totalQuantity = PMath.add(summary[key].totalQuantity, qty);
          summary[key].totalCost = PMath.add(summary[key].totalCost, cost);
        } else {
          summary[key] = { name: mat.name, unit: mat.unit, totalQuantity: qty, totalCost: cost };
        }
      });
    });

    return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
  }, [project.items]);

  // ─── ACCIONES ─────────────────────────────────────────────────────────────────
  const setProject = useCallback((p: any) => {
    setProjectState(prev => ({
      ...prev,
      ...p,
      items: p.items || prev.items,
    }));
  }, []);

  const addItem = useCallback((item: WorkItem): boolean => {
    if (project.items.some(i => i.id === item.id)) {
      toast.info('Este renglón ya está en el presupuesto');
      return false;
    }
    const newItem: BudgetItem = { ...item, projectQuantity: 1, selected: true };
    setProjectState(p => ({ ...p, items: [...p.items, newItem] }));
    return true;
  }, [project.items]);

  const removeItem = useCallback((id: string) => {
    setProjectState(p => ({ ...p, items: p.items.filter(i => i.id !== id) }));
  }, []);

  const updateItemField = useCallback(<K extends keyof BudgetItem>(id: string, field: K, value: BudgetItem[K]) => {
    setProjectState(p => ({
      ...p,
      items: p.items.map(item => item.id === id ? { ...item, [field]: value } : item),
    }));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    setProjectState(p => ({
      ...p,
      items: p.items.map(item =>
        item.id === id ? { ...item, projectQuantity: Math.max(0.1, qty) } : item
      ),
    }));
  }, []);

  const updateDuration = useCallback((id: string, days: number) => {
    setProjectState(p => ({
      ...p,
      items: p.items.map(item =>
        item.id === id ? { ...item, durationDays: Math.max(0.01, days) } : item
      ),
    }));
  }, []);

  const updateMaterial = useCallback((itemId: string, matIdx: number, field: keyof MaterialLine, value: string | number) => {
    setProjectState(p => ({
      ...p,
      items: p.items.map(item => {
        if (item.id !== itemId) return item;
        const newMaterials = [...item.materials];
        newMaterials[matIdx] = { ...newMaterials[matIdx], [field]: value };
        return { ...item, materials: newMaterials };
      }),
    }));
  }, []);

  const updateLabor = useCallback((itemId: string, labIdx: number, field: keyof LaborLine, value: string | number) => {
    setProjectState(p => ({
      ...p,
      items: p.items.map(item => {
        if (item.id !== itemId) return item;
        const newLabor = [...item.labor];
        newLabor[labIdx] = { ...newLabor[labIdx], [field]: value };
        return { ...item, labor: newLabor };
      }),
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
    setProjectState(p => ({ ...p, items: [...p.items, newItem] }));
    return newItem;
  }, [selectedTypology]);

  const addAPUItem = useCallback((apu: any): boolean => {
    if (project.items.some(i => i.id === apu.id)) {
      toast.info('Este APU ya está en el presupuesto');
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
    setProjectState(p => ({ ...p, items: [...p.items, newItem] }));
    toast.success(`APU agregado: ${apu.description}`);
    return true;
  }, [project.items]);

   // Forzar recálculo manual
   const recalculate = useCallback(() => {
     setProjectState(p => ({ ...p }));
   }, []);

  // ─── Totales finales ────────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    materialsTotal: precise(calculationResult.materialTotal),
    laborTotal: precise(calculationResult.laborTotal),
    wasteMaterials: precise(calculationResult.wasteTotal * 0.6), // Aprox proporcional
    wasteLabor: precise(calculationResult.wasteTotal * 0.4),
    totalDirect: calculationResult.directCost,
    baseBudget: PMath.sum([
      calculationResult.subtotal,
      calculationResult.taxTotal,
      calculationResult.profitTotal,
      calculationResult.contingencyTotal,
    ]),
    totalBudget: calculationResult.totalBudget,
    costPerM2: calculationResult.costPerM2,
    indirectCost: calculationResult.indirectCost,
    adminCost: calculationResult.adminCost,
    personalCost: calculationResult.personalCost,
    taxAmount: calculationResult.taxTotal,
    profitAmount: calculationResult.profitTotal,
    contingencyAmount: calculationResult.contingencyTotal,
    estimatedDays,
    totalMaterialsSummary,
  }), [calculationResult, estimatedDays, totalMaterialsSummary]);

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
    setWasteFactors: setWasteFactorsState,
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