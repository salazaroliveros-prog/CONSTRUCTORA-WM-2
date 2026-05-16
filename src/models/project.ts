import { Typology, ProjectStatus, FinancialConfig, DEFAULT_FINANCIAL_CONFIG, TopographyParams } from './engineering';
import { BudgetLineDocument, BudgetTotals } from './budget';
import { WorkItem } from './workItem';

/** @deprecated Use the ProjectDocument budgetTree instead — kept for legacy BudgetTable/ReportEngine */
export interface ProjectItem extends WorkItem {
  projectQuantity: number;
  selected: boolean;
}

/** @deprecated Use ProjectDocument instead — kept for legacy UI compatibility */
export interface Project {
  id: string;
  name: string;
  clientName: string;
  typology: Typology;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  location?: string;
  teamIds?: string[];
  items: ProjectItem[];
  budgetTree?: BudgetLineDocument[];
  directCosts: number;
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
  progress: number;
  budget: number;
  attachments?: string[];
  ganttConfig?: { overrides?: Record<string, any>; progress?: Record<string, number> };
  marketLevel?: {
    id: string;
    name: string;
    costPerSqm: { min: number; max: number; recommended: number };
  };
  slabType?: {
    id: string;
    name: string;
    description: string;
  };
  area?: number;
  costPerSqm?: number;
}

export interface ProjectDocument {
  id?: string;
  name: string;
  clientId: string;
  clientName: string;
  terrainDataId?: string;
  typology: Typology;
  status: ProjectStatus;
  areaTerreno: number;
  areaConstruccion: number;
  numNiveles: number;
  budgetTree: BudgetLineDocument[];
  financialConfig: FinancialConfig;
  cachedResults?: {
    totalBudget: number;
    directCost: number;
    indirectCost: number;
    adminCost: number;
    personalCost: number;
    costPerM2: number;
    estimatedDays: number;
    materialTotal: number;
    laborTotal: number;
    equipmentTotal: number;
    calculatedAt: string;
  };
  startDate?: string;
  endDate?: string;
  estimatedDurationDays?: number;
  progress: number;
  location?: string;
  teamIds?: string[];
  attachments?: string[];
  ganttConfig?: Record<string, any>;
  notes?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName: string;
  typology: Typology;
  status: ProjectStatus;
  budget: number;
  progress: number;
  areaConstruccion: number;
  costPerM2: number;
  estimatedDays: number;
  startDate?: string;
}

export interface CreateProjectInput {
  name: string;
  clientId: string;
  clientName: string;
  typology: Typology;
  areaTerreno: number;
  areaConstruccion: number;
  numNiveles: number;
  financialConfig?: FinancialConfig;
}

export function defaultProjectInput(): CreateProjectInput {
  return {
    name: '',
    clientId: '',
    clientName: '',
    typology: Typology.RESIDENCIAL,
    areaTerreno: 0,
    areaConstruccion: 0,
    numNiveles: 1,
    financialConfig: { ...DEFAULT_FINANCIAL_CONFIG },
  };
}

export function emptyProjectDoc(ownerId: string): ProjectDocument {
  return {
    name: '',
    clientId: '',
    clientName: '',
    typology: Typology.RESIDENCIAL,
    status: 'COTIZACION',
    areaTerreno: 0,
    areaConstruccion: 0,
    numNiveles: 1,
    budgetTree: [],
    financialConfig: { ...DEFAULT_FINANCIAL_CONFIG },
    progress: 0,
    ownerId,
  };
}