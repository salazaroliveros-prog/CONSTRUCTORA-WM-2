import { Timestamp } from 'firebase/firestore';
import { Typology, ProjectStatus, FinancialConfig, DEFAULT_FINANCIAL_CONFIG, TopographyParams } from './engineering';
import { BudgetLineDocument, BudgetTotals } from './budget';

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
    calculatedAt: Timestamp;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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