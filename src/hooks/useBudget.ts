// src/hooks/useBudget.ts

import { useState, useEffect, useCallback } from 'react';
import { BudgetLine, defaultBudget } from '../lib/budgetData';
import { calculateBudget } from '../utils/budgetCalc';
import { getPerformanceData } from '../lib/performanceLib';

/**
 * Hook to manage the budget tree for a project.
 * @param initialBudget Optional initial budget lines (if not provided, uses defaultBudget)
 * @returns An object with the budget lines and functions to manipulate them.
 */
export function useBudget(initialBudget: BudgetLine[] = defaultBudget) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [calculatedBudget, setCalculatedBudget] = useState<BudgetLine[]>([]);

  // Initialize budget lines with the provided initial data (or default)
  useEffect(() => {
    setBudgetLines(initialBudget);
    // Initial calculation
    const calculated = calculateBudget(initialBudget);
    setCalculatedBudget(calculated);
  }, [initialBudget]);

  // Recalculate whenever budgetLines change
  useEffect(() => {
    const calculated = calculateBudget(budgetLines);
    setCalculatedBudget(calculated);
  }, [budgetLines]);

  /**
   * Add a new budget line.
   * @param line The line to add (without id, parentId, order, children - these will be set)
   * @param parentId Optional parent ID. If undefined, the line is added at the root level.
   * @param index Optional index at which to insert the line. If undefined, it's appended.
   */
  const addLine = useCallback((
    line: Omit<BudgetLine, 'id' | 'parentId' | 'order' | 'children'>,
    parentId?: string,
    index?: number
  ) => {
    const newLine: BudgetLine = {
      ...line,
      id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentId: parentId ?? undefined,
      order: Date.now(), // Simple chronological order; in a real app, you might want to sort by a displayed order.
      children: [],
    };

    setBudgetLines(prev => {
      const newLines = [...prev];
      if (parentId === undefined) {
        // Adding to root
        if (index === undefined) {
          newLines.push(newLine);
        } else {
          newLines.splice(index, 0, newLine);
        }
      } else {
        // Adding to a parent's children
        const parent = newLines.find(l => l.id === parentId);
        if (parent) {
          if (index === undefined) {
            parent.children.push(newLine);
          } else {
            parent.children.splice(index, 0, newLine);
          }
        } else {
          // Parent not found, add to root as fallback
          if (index === undefined) {
            newLines.push(newLine);
          } else {
            newLines.splice(index, 0, newLine);
          }
        }
      }
      return newLines;
    });
  }, []);

  /**
   * Update an existing budget line (by id).
   * @param id The id of the line to update.
   * @param updates Partial object of fields to update.
   */
  const updateLine = useCallback((id: string, updates: Partial<BudgetLine>) => {
    const updateLineRecursive = (lines: BudgetLine[]): BudgetLine[] => {
      return lines.map(line => {
        if (line.id === id) {
          return { ...line, ...updates };
        }
        if (line.children && line.children.length > 0) {
          return {
            ...line,
            children: updateLineRecursive(line.children),
          };
        }
        return line;
      });
    };

    setBudgetLines(prev => updateLineRecursive(prev));
  }, []);

  /**
   * Delete a budget line (by id) and all its children.
   * @param id The id of the line to delete.
   */
  const deleteLine = useCallback((id: string) => {
    const deleteLineRecursive = (lines: BudgetLine[]): BudgetLine[] => {
      return lines.filter(line => {
        if (line.id === id) {
          // Do not include this line (and thus its children are removed)
          return false;
        }
        if (line.children && line.children.length > 0) {
          return {
            ...line,
            children: deleteLineRecursive(line.children),
          };
        }
        return line;
      });
    };

    setBudgetLines(prev => deleteLineRecursive(prev));
  }, []);

  /**
   * Move a line (and its children) to a new parent or position.
   * This is a more advanced function; for now, we'll leave it out but note that it might be needed.
   */

  /**
   * Get a line by id (including searching in children).
   */
  const getLineById = useCallback((id: string, lines: BudgetLine[] = budgetLines): BudgetLine | undefined => {
    for (const line of lines) {
      if (line.id === id) {
        return line;
      }
      const found = getLineById(id, line.children);
      if (found) return found;
    }
    return undefined;
  }, [budgetLines]);

  // Return the state and functions
  return {
    budgetLines,
    calculatedBudget,
    addLine,
    updateLine,
    deleteLine,
    getLineById,
    // We expose the setter for budgetLines if needed elsewhere, but prefer using the functions above.
    setBudgetLines,
  };
}
