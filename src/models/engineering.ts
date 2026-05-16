export enum Typology {
  RESIDENCIAL = 'RESIDENCIAL',
  COMERCIAL = 'COMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  CIVIL = 'CIVIL',
  PUBLICA = 'PUBLICA',
}

export type ProjectStatus = 'COTIZACION' | 'EJECUCION' | 'FINALIZADO' | 'PAUSADO';

export interface WasteFactors {
  excavation: number;
  concrete: number;
  steel: number;
  formwork: number;
  masonry: number;
  general: number;
}

export interface SteelRatios {
  foundation: number;
  isolated: number;
  column: number;
  beam: number;
  slab: number;
  wall: number;
  bridge: number;
}

export interface DensityConstants {
  concrete: number;
  steel: number;
}

export interface EngineeringConstants {
  steelRatios: SteelRatios;
  wasteFactors: WasteFactors;
  densities: DensityConstants;
  steelDiameters: number[];
  taxRate: number;
  profitMargin: number;
  contingency: number;
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
}

export const DEFAULT_ENGINEERING: EngineeringConstants = {
  steelRatios: {
    foundation: 0.015, isolated: 0.015, column: 0.025,
    beam: 0.020, slab: 0.012, wall: 0.0025, bridge: 0.04,
  },
  wasteFactors: {
    excavation: 1.10, concrete: 1.03, steel: 1.05,
    formwork: 1.02, masonry: 1.10, general: 1.10,
  },
  densities: { concrete: 2400, steel: 7850 },
  steelDiameters: [6, 8, 10, 12, 16, 20, 25],
  taxRate: 0.12,
  profitMargin: 0.15,
  contingency: 0.05,
  indirectCosts: 15,
  administrativeCosts: 5,
  personalCosts: 10,
};

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  diameter?: number;
}

export type ComputationType = 'fixed' | 'dynamic' | 'steel';

export interface FinancialConfig {
  indirectCostsPct: number;
  adminCostsPct: number;
  personalCostsPct: number;
  profitMarginPct: number;
  contingencyPct: number;
  taxRate: number;
}

export const DEFAULT_FINANCIAL_CONFIG: FinancialConfig = {
  indirectCostsPct: 15,
  adminCostsPct: 5,
  personalCostsPct: 10,
  profitMarginPct: 15,
  contingencyPct: 5,
  taxRate: 12,
};

export interface TopographyParams {
  areaTerreno: number;
  areaConstruccion: number;
  numNiveles: number;
  topografia: 'PLANA' | 'INCLINADA_LEVE' | 'INCLINADA_MODERADA' | 'MONTAÑOSA';
  pendientePorcentaje?: number;
  tipoSuelo: 'ARCILLOSO' | 'ARENOSO' | 'LIMOSO' | 'ROCOSO' | 'MIXTO';
  capacidadPortante?: number;
  nivelFreatico?: number;
}

export interface LegalRestrictions {
  zonificacion?: string;
  usoSuelo?: string;
  retirosFrontales?: number;
  retirosLaterales?: number;
  retirosPosteriores?: number;
  alturaMaxima?: number;
  indicesConstructivos?: string;
}

export interface ServiceAvailability {
  tieneAgua: boolean;
  tieneElectricidad: boolean;
  tieneDrenaje: boolean;
  tieneGas: boolean;
  distanciaRedElectrica?: number;
  distanciaTomaAgua?: number;
}

export interface LogisticsInfo {
  accesoVehicular: 'PUBLICO' | 'PRIVADO' | 'RESTRINGIDO';
  distanciaCentroAcopio?: number;
  condicionesAcceso?: string;
}