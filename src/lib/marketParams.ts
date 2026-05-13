// src/lib/marketParams.ts

/**
 * Market parameters for Guatemala construction costs
 * Based on current market rates (2026) for residential projects
 */

export interface MarketLevel {
  id: string;
  name: string;
  description: string;
  costPerSqm: {
    min: number; // Minimum cost per m² in Q.
    max: number; // Maximum cost per m² in Q.
    recommended: number; // Recommended cost per m² in Q.
  };
  materialQuality: 'basic' | 'standard' | 'premium';
  laborMultiplier: number; // Multiplier for labor costs
  finishLevel: 'economic' | 'moderate' | 'premium';
}

export const MARKET_LEVELS: MarketLevel[] = [
  {
    id: 'basic',
    name: 'Nivel Básico (Económico)',
    description: 'Acabados básicos con materiales estándar, enfocado en funcionalidad',
    costPerSqm: {
      min: 3000,
      max: 3500,
      recommended: 3200
    },
    materialQuality: 'basic',
    laborMultiplier: 0.8,
    finishLevel: 'economic'
  },
  {
    id: 'moderate',
    name: 'Nivel Moderado (Medio)',
    description: 'Acabados de calidad media con buen balance costo-beneficio',
    costPerSqm: {
      min: 3500,
      max: 4000,
      recommended: 3750
    },
    materialQuality: 'standard',
    laborMultiplier: 1.0,
    finishLevel: 'moderate'
  },
  {
    id: 'premium',
    name: 'Nivel Premium (Alto)',
    description: 'Acabados de alta calidad con materiales premium y detalles finos',
    costPerSqm: {
      min: 4000,
      max: 5000,
      recommended: 4500
    },
    materialQuality: 'premium',
    laborMultiplier: 1.2,
    finishLevel: 'premium'
  }
];

/**
 * Slab and roof typology specifications with automatic calculations
 */
export interface SlabTypology {
  id: string;
  name: string;
  description: string;
  materialSpecs: {
    concrete?: {
      grade: string; // e.g., "f'c 210 kg/cm²"
      volumePerSqm: number; // m³ per m² of slab
      wasteFactor: number;
    };
    steel?: {
      diameter: number; // mm
      kgPerCum: number; // kg of steel per m³ of concrete
      wasteFactor: number;
    };
    formwork?: {
      type: string;
      costPerSqm: number; // Q. per m²
    };
    prefabricated?: {
      viguetaUnits: number; // units per m²
      bovedillaUnits: number; // units per m²
      meshKg: number; // kg of mesh per m²
      compressionSlab: number; // m³ of concrete per m²
    };
    metalPergola?: {
      profileType: string;
      kgPerSqm: number; // kg of metal per m²
      weldingHours: number; // hours per m²
      paintSqm: number; // m² of paint per m²
    };
    woodPergola?: {
      woodType: string;
      boardFeet: number; // board feet per m²
      hardwareSets: number; // hardware sets per m²
      sealerLiters: number; // liters of sealer per m²
    };
    clayTile?: {
      tilesPerSqm: number; // tiles per m²
      supportStructure: number; // linear meters of support per m²
      mortarBags: number; // bags of mortar per m²
    };
  };
  costMultipliers: {
    material: number;
    labor: number;
  };
}

export const SLAB_TYPOLOGIES: SlabTypology[] = [
  {
    id: 'solid_slab',
    name: 'Losa Sólida',
    description: 'Losa de concreto armado tradicional con refuerzo de acero',
    materialSpecs: {
      concrete: {
        grade: "f'c 210 kg/cm²",
        volumePerSqm: 0.15, // 15cm thickness
        wasteFactor: 1.03
      },
      steel: {
        diameter: 12,
        kgPerCum: 120, // 120kg steel per m³ concrete
        wasteFactor: 1.05
      },
      formwork: {
        type: 'Madera',
        costPerSqm: 45
      }
    },
    costMultipliers: {
      material: 1.0,
      labor: 1.0
    }
  },
  {
    id: 'prefabricated_slab',
    name: 'Losa Prefabricada (Vigueta y Bovedilla)',
    description: 'Sistema prefabricado con viguetas, bovedillas y capa de compresión',
    materialSpecs: {
      prefabricated: {
        viguetaUnits: 1.2, // 1.2 viguetas per m²
        bovedillaUnits: 12, // 12 bovedillas per m²
        meshKg: 2.5, // 2.5kg mesh per m²
        compressionSlab: 0.06 // 6cm compression slab
      }
    },
    costMultipliers: {
      material: 0.85,
      labor: 0.7
    }
  },
  {
    id: 'metal_pergola',
    name: 'Pergola Metálica',
    description: 'Estructura metálica con perfiles estructurales',
    materialSpecs: {
      metalPergola: {
        profileType: 'Hierro estructural',
        kgPerSqm: 25,
        weldingHours: 2,
        paintSqm: 1.2
      }
    },
    costMultipliers: {
      material: 1.1,
      labor: 1.3
    }
  },
  {
    id: 'wood_pergola',
    name: 'Pergola de Madera',
    description: 'Estructura de madera con herrajes y selladores',
    materialSpecs: {
      woodPergola: {
        woodType: 'Pino tratado',
        boardFeet: 8,
        hardwareSets: 0.5,
        sealerLiters: 0.3
      }
    },
    costMultipliers: {
      material: 0.9,
      labor: 1.1
    }
  },
  {
    id: 'clay_tile',
    name: 'Tejado (Teja de Barro)',
    description: 'Tejado tradicional con tejas de barro',
    materialSpecs: {
      clayTile: {
        tilesPerSqm: 18,
        supportStructure: 2.5,
        mortarBags: 0.8
      }
    },
    costMultipliers: {
      material: 0.8,
      labor: 1.2
    }
  }
];

/**
 * Apply market parameters to adjust costs based on selected level
 */
export function applyMarketParameters(
  baseCost: number,
  marketLevel: MarketLevel,
  typology?: SlabTypology
): number {
  let adjustedCost = baseCost;

  // Apply market level multiplier
  const marketMultiplier = marketLevel.costPerSqm.recommended / 3750; // Base is moderate level
  adjustedCost *= marketMultiplier;

  // Apply typology multipliers if provided
  if (typology) {
    adjustedCost *= typology.costMultipliers.material;
  }

  return adjustedCost;
}

/**
 * Get recommended market level based on project area and budget
 */
export function getRecommendedMarketLevel(
  projectArea: number,
  totalBudget: number
): MarketLevel {
  const costPerSqm = totalBudget / projectArea;

  if (costPerSqm < 3250) return MARKET_LEVELS[0]; // Basic
  if (costPerSqm < 4250) return MARKET_LEVELS[1]; // Moderate
  return MARKET_LEVELS[2]; // Premium
}