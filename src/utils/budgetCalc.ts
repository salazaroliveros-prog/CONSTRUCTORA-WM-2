// src/utils/budgetCalc.ts

import { BudgetLine } from '../lib/budgetData';

// Engineering calculation constants for Guatemala construction
export const ENGINEERING_CONSTANTS = {
  // Steel reinforcement ratios (as percentage of concrete volume)
  steelRatios: {
    foundation: 0.015, // 1.5% for foundations
    columns: 0.025,   // 2.5% for columns
    beams: 0.020,     // 2.0% for beams
    slabs: 0.012,     // 1.2% for slabs
  },
  // Waste factors
  wasteFactors: {
    concrete: 1.03,   // 3% waste
    steel: 1.05,      // 5% waste
    formwork: 1.02,   // 2% waste
    general: 1.10,    // 10% general waste
  },
  // Material densities (kg/m³)
  densities: {
    concrete: 2400,
    steel: 7850,
  },
  // Steel diameters commonly used (mm)
  steelDiameters: [6, 8, 10, 12, 16, 20, 25],
};

/**
 * Calculate quantity based on dimensions for dynamic computation types
 */
export function calculateDynamicQuantity(line: BudgetLine): number {
  if (line.computationType !== 'dynamic' || !line.dimensions) {
    return line.qty; // Return existing qty if not dynamic
  }

  const dims = line.dimensions;
  let volume = 0;

  // Calculate volume based on description/type
  if (line.description.toLowerCase().includes('cimentación') || line.description.toLowerCase().includes('zapata')) {
    // Foundation/Zapata: length × width × depth
    volume = (dims.length || 0) * (dims.width || 0) * (dims.height || 0);
    line.unit = 'm³'; // Update unit
  } else if (line.description.toLowerCase().includes('columna')) {
    // Column: cross-section × height
    const crossSection = (dims.width || 0) * (dims.height || 0); // width × height as cross-section
    volume = crossSection * (dims.length || 0); // length as height
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('solera')) {
    // Solera: width × height × length
    volume = (dims.width || 0) * (dims.height || 0) * (dims.length || 0);
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('losa')) {
    // Slab: area × thickness
    const area = (dims.length || 0) * (dims.width || 0);
    volume = area * (dims.thickness || 0.15); // Default 15cm thickness
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('solera')) {
    // Solera: width × height × length
    volume = (dims.width || 0) * (dims.height || 0) * (dims.length || 0);
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('zapata')) {
    // Zapata: length × width × height (similar to foundation)
    volume = (dims.length || 0) * (dims.width || 0) * (dims.height || 0);
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('carretera') || line.description.toLowerCase().includes('sub-base') || line.description.toLowerCase().includes('base asfáltica')) {
    // Road layers: length × width × thickness
    volume = (dims.length || 0) * (dims.width || 0) * (dims.thickness || 0.15);
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('puente') || line.description.toLowerCase().includes('pilas')) {
    // Bridge piles: cross-section × height
    const crossSection = (dims.width || 0) * (dims.height || 0);
    volume = crossSection * (dims.length || 0);
    line.unit = 'm³';
  } else if (line.description.toLowerCase().includes('fachada') || line.description.toLowerCase().includes('vidrio')) {
    // Facade/glass: length × height
    volume = (dims.length || 0) * (dims.height || 0);
    line.unit = 'm²';
  } else if (line.description.toLowerCase().includes('cerramientos') || line.description.toLowerCase().includes('perimetrales')) {
    // Perimeter fencing: length × height
    volume = (dims.length || 0) * (dims.height || 0);
    line.unit = 'm';
  } else if (line.description.toLowerCase().includes('piso industrial') || line.description.toLowerCase().includes('accesibilidad')) {
    // Floor areas: length × width × thickness
    volume = (dims.length || 0) * (dims.width || 0) * (dims.thickness || 0.15);
    line.unit = 'm²';
  } else if (line.description.toLowerCase().includes('estructura metálica') || line.description.toLowerCase().includes('cubierta')) {
    // Metal structure: area × kg/m²
    volume = (dims.length || 0) * (dims.width || 0);
    line.unit = 'm²';
  }

  // Apply waste factor
  const wasteFactor = line.wasteFactor || ENGINEERING_CONSTANTS.wasteFactors.concrete;
  return volume * wasteFactor;
}

/**
 * Calculate steel reinforcement automatically
 */
export function calculateSteelReinforcement(line: BudgetLine): { diameter: number; length: number; weight: number } {
  let volume = line.qty;
  let steelRatio = 0.015; // Default 1.5%

  // Determine steel ratio based on element type and typology
  if (line.description.toLowerCase().includes('columna')) {
    steelRatio = line.typology === 'INDUSTRIAL' ? 0.03 : ENGINEERING_CONSTANTS.steelRatios.columns;
  } else if (line.description.toLowerCase().includes('viga')) {
    steelRatio = ENGINEERING_CONSTANTS.steelRatios.beams;
  } else if (line.description.toLowerCase().includes('losa')) {
    steelRatio = line.typology === 'COMERCIAL' ? 0.013 : ENGINEERING_CONSTANTS.steelRatios.slabs;
  } else if (line.description.toLowerCase().includes('cimentación') || line.description.toLowerCase().includes('zapata')) {
    steelRatio = ENGINEERING_CONSTANTS.steelRatios.foundation;
  } else if (line.description.toLowerCase().includes('puente') || line.description.toLowerCase().includes('pilas')) {
    steelRatio = 0.04; // Higher reinforcement for bridges
  }

  // Calculate steel volume
  const steelVolume = volume * steelRatio;

  // Determine optimal diameter (simplified logic)
  let diameter = 12; // Default 12mm
  if (volume > 10) diameter = 16; // Larger elements use bigger bars
  if (volume > 50) diameter = 20;

  // Calculate total length (simplified - in reality this would be more complex)
  const barLength = Math.sqrt(volume) * 10; // Rough estimation
  const weight = steelVolume * ENGINEERING_CONSTANTS.densities.steel;

  return {
    diameter,
    length: barLength * (line.wasteFactor || ENGINEERING_CONSTANTS.wasteFactors.steel),
    weight: weight * (line.wasteFactor || ENGINEERING_CONSTANTS.wasteFactors.steel)
  };
}

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
    // Calculate dynamic quantity if needed
    if (line.computationType === 'dynamic') {
      line.qty = calculateDynamicQuantity(line);
    }

    // Calculate steel reinforcement if applicable
    if (line.description.toLowerCase().includes('acero') || line.description.toLowerCase().includes('refuerzo')) {
      const steel = calculateSteelReinforcement(line);
      // Update material performance based on calculated steel
      line.materialPerf = steel.weight / line.qty; // kg per unit
    }

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
