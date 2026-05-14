/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * useBudget — Refactorizado para usar el Engine Unificado
 * 
 * Cambios vs versión anterior:
 * - Usa BudgetEngine en lugar de cálculos inline
 * - Operaciones de precisión con PMath
 * - Compatible con marketMultipliers del proyecto
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BudgetLine } from '../lib/budgetData';
import { BudgetLineDocument } from '../models/budget';
import { calculateTree, calculateProject, BudgetTotals as ProjectTotals, LineResult } from '../engine/budgetEngine';
import { MarketLevel, SLAB_TYPOLOGIES, MARKET_LEVELS, applyMarketParameters } from '../lib/marketParams';
import { itemsToBudgetTree, budgetTreeToItems } from '../utils/budgetConverter';
import { PMath, precise } from '../engine/precision';

interface UseBudgetProps {
  initialBudget?: BudgetLine[];
  projectConfig?: {
    indirectCosts?: number;
    administrativeCosts?: number;
    personalCosts?: number;
    wasteFactors?: { materials: number; labor: number };
    marketLevel?: MarketLevel;
    slabType?: typeof SLAB_TYPOLOGIES[0];
    areaTotal?: number;
  };
}

interface UseBudgetResult {
  budgetLines: BudgetLine[];
  calculatedBudget: LineResult[];
  totals: ProjectTotals & {
    costPerM2WithArea: number;
    totalWithIndirects: number;
  };
  addLine: (line: Omit<BudgetLine, 'id' | 'parentId' | 'order' | 'children'>, parentId?: string, index?: number) => void;
  updateLine: (id: string, updates: Partial<BudgetLine>) => void;
  deleteLine: (id: string) => void;
  getLineById: (id: string) => BudgetLine | undefined;
  setBudgetLines: (lines: BudgetLine[]) => void;
}

export function useBudget(props: UseBudgetProps = {}): UseBudgetResult {
  const { initialBudget = [], projectConfig } = props;

  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [calculatedBudget, setCalculatedBudget] = useState<LineResult[]>([]);
  const [totals, setTotals] = useState<UseBudgetResult['totals']>({} as any);

  // Calcular market multipliers
  const marketMultipliers = useMemo(() => {
    if (!projectConfig?.marketLevel || !projectConfig?.slabType) {
      return { material: 1, labor: 1 };
    }
    return {
      material: (projectConfig.slabType.costMultipliers?.material ?? 1) * 
                (projectConfig.marketLevel.costPerSqm.recommended / 3750),
      labor: projectConfig.marketLevel.laborMultiplier,
    };
  }, [projectConfig?.marketLevel, projectConfig?.slabType]);

  // Recalcular cuando cambian los datos
  useEffect(() => {
    setBudgetLines(initialBudget);
  }, [initialBudget]);

   useEffect(() => {
     // Calcular con engine unificado
     const result = calculateTree(budgetLines);
     setCalculatedBudget(result.lines);

     // Calcular totales completos del proyecto
     const fullResult = calculateProject(budgetLines, {
       marketMultipliers,
       indirectCosts: projectConfig?.indirectCosts,
       adminCosts: projectConfig?.administrativeCosts,
       personalCosts: projectConfig?.personalCosts,
       area: projectConfig?.areaTotal,
     });

    // Calcular costo por m² con área
    const area = projectConfig?.areaTotal || 0;
    const costPerM2WithArea = area > 0 ? PMath.div(fullResult.totalBudget, area) : 0;

    setTotals({
      ...fullResult,
      costPerM2WithArea,
      totalWithIndirects: fullResult.totalBudget,
    });
   }, [budgetLines, marketMultipliers, projectConfig?.indirectCosts, 
       projectConfig?.administrativeCosts, projectConfig?.personalCosts, projectConfig?.areaTotal, projectConfig?.slabType]);

  // ─── Operaciones CRUD ─────────────────────────────────────────────────────────
  const addLine = useCallback((
    line: Omit<BudgetLine, 'id' | 'parentId' | 'order' | 'children'>,
    parentId?: string,
    index?: number
  ) => {
    const newLine: BudgetLine = {
      ...line,
      id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentId: parentId ?? undefined,
      order: Date.now(),
      children: [],
    };

    setBudgetLines(prev => {
      const newLines = [...prev];
      if (parentId === undefined) {
        if (index === undefined) {
          newLines.push(newLine);
        } else {
          newLines.splice(index, 0, newLine);
        }
      } else {
        const addToParent = (lines: BudgetLine[]): BudgetLine[] => {
          return lines.map(l => {
            if (l.id === parentId) {
              const children = [...(l.children || [])];
              if (index === undefined) {
                children.push(newLine);
              } else {
                children.splice(index, 0, newLine);
              }
              return { ...l, children };
            }
            return { ...l, children: addToParent(l.children || []) };
          });
        };
        return addToParent(newLines);
      }
      return newLines;
    });
  }, []);

  const updateLine = useCallback((id: string, updates: Partial<BudgetLine>) => {
    setBudgetLines(prev => {
      const updateRecursive = (lines: BudgetLine[]): BudgetLine[] => {
        return lines.map(line => {
          if (line.id === id) {
            return { ...line, ...updates };
          }
          if (line.children?.length) {
            return { ...line, children: updateRecursive(line.children) };
          }
          return line;
        });
      };
      return updateRecursive(prev);
    });
  }, []);

  const deleteLine = useCallback((id: string) => {
    setBudgetLines(prev => {
      const deleteRecursive = (lines: BudgetLine[]): BudgetLine[] => {
        return lines.filter(line => {
          if (line.id === id) return false;
          if (line.children?.length) {
            return { ...line, children: deleteRecursive(line.children) };
          }
          return true;
        });
      };
      return deleteRecursive(prev);
    });
  }, []);

  const getLineById = useCallback((id: string, lines: BudgetLine[] = budgetLines): BudgetLine | undefined => {
    for (const line of lines) {
      if (line.id === id) return line;
      if (line.children?.length) {
        const found = getLineById(id, line.children);
        if (found) return found;
      }
    }
    return undefined;
  }, [budgetLines]);

  return {
    budgetLines,
    calculatedBudget,
    totals,
    addLine,
    updateLine,
    deleteLine,
    getLineById,
    setBudgetLines,
  };
}