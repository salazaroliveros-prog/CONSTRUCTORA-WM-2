import { Typology } from './engineering';

export interface Material {
  name: string;
  unit: string;
  quantity: number;
  price: number;
}

export interface Labor {
  role: string;
  unit: string;
  quantity: number;
  price: number;
}

export interface WorkItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  materials: Material[];
  labor: Labor[];
  typology: Typology;
  durationDays: number; // For 1 unit
  category: string;
}
