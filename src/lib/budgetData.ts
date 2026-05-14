/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Budget Data — Compatibilidad backward
 * Re-exporta todo desde el modelo central y datos crudos
 */

import {
  BudgetLineDocument as BudgetLine,
  LineCalcResult as LineResult,
  BudgetTotals as ProjectTotals,
  Deviation,
} from '../models/budget';

export type { BudgetLine, LineResult, ProjectTotals, Deviation };

export { ENGINEERING } from '../engine/budgetEngine';

export interface BudgetDimensions {
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  diameter?: number;
}