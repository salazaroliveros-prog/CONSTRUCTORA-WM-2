// src/utils/budgetCalc.ts

import { BudgetLine } from '../lib/budgetData';

/**
 * Calculate the totals for a budget line and its children recursively.
 * This function mutates the line objects by adding calculated fields:
 *   materialTotal, laborTotal, subtotal.
 * It returns the same array (with calculated fields) for convenience.
 *
 * @param lines Array of budget lines (typically the root level)
 * @returns The same array with calculated fields added to each line.
 */
export function calculateBudget(lines: BudgetLine[]): BudgetLine[] {
  lines.forEach(line => {
    // Calculate material and labor totals for this line based on its own qty and performance.
    const materialTotal = line.qty * line.materialCost * (line.materialPerf ?? 1);
    const laborTotal = line.qty * line.laborCost * (line.laborPerf ?? 1);
    const selfTotal = materialTotal + laborTotal;

    // Recursively calculate children
    let childrenTotal = 0;
    if (line.children && line.children.length > 0) {
      calculateBudget(line.children); // This will populate calculated fields on children
      childrenTotal = line.children.reduce((sum, child) => {
        // We assume that after calculateBudget, each child has a subtotal field.
        return sum + (child.subtotal ?? 0);
      }, 0);
    }

    // The subtotal for this line is its own total plus the total of its children.
    line.materialTotal = materialTotal;
    line.laborTotal = laborTotal;
    line.subtotal = selfTotal + childrenTotal;
  });

  return lines;
}

/**
 * Helper function to get the total budget (sum of all root lines' subtotal).
 * @param lines Array of budget lines (root level)
 * @returns The total budget amount.
 */
export function getTotalBudget(lines: BudgetLine[]): number {
  const calculated = calculateBudget(lines); // Ensure calculated fields are present
  return calculated.reduce((sum, line) => sum + (line.subtotal ?? 0), 0);
}

/**
 * Helper function to get the total material cost (sum of materialTotal across all lines).
 */
export function getTotalMaterialCost(lines: BudgetLine[]): number {
  const calculated = calculateBudget(lines);
  return calculated.reduce((sum, line) => sum + (line.materialTotal ?? 0), 0);
}

/**
 * Helper function to get the total labor cost (sum of laborTotal across all lines).
 */
export function getTotalLaborCost(lines: BudgetLine[]): number {
  const calculated = calculateBudget(lines);
  return calculated.reduce((sum, line) => sum + (line.laborTotal ?? 0), 0);
}
