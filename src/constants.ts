/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Typology {
  RESIDENCIAL = 'RESIDENCIAL',
  COMERCIAL = 'COMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  CIVIL = 'CIVIL',
  PUBLICA = 'PUBLICA',
}

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

export interface ProjectItem extends WorkItem {
  projectQuantity: number;
  selected: boolean;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  typology: Typology;
  status: 'COTIZACION' | 'EJECUCION' | 'FINALIZADO';
  startDate: string;
  endDate?: string;
  location?: string;
  teamIds?: string[];
  items: ProjectItem[];
  directCosts: number;
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
  progress: number;
  budget: number;
  attachments?: string[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: number;
  documentId: string;
  email?: string;
  phone?: string;
  status: 'Activo' | 'Inactivo';
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  projects?: string[];
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'INGRESO' | 'GASTO';
  category: string;
}

export interface WarehouseMovement {
  date: string;
  type: 'Entrada' | 'Salida';
  qty: number;
  user: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  cat: 'Materiales' | 'Herramientas' | 'EPP';
  stock: number;
  unit: string;
  location: string;
  minStock: number;
  lastEntry: string;
  history: WarehouseMovement[];
  coordinates?: { x: number; y: number }; // Visual location
  iconUrl?: string;
}

export const WAREHOUSE_DATA: WarehouseItem[] = [];

// Default items template to generate 40 items per typology
const STAGES = [
  'Preliminares',
  'Cimentación',
  'Estructura',
  'Mampostería',
  'Instalaciones',
  'Acabados',
  'Cubierta',
  'Exteriores'
];

// Refined items matching chronological construction phases
const ITEM_BASE = [
  { desc: 'Limpieza y Descapote', unit: 'm2', cat: 'Preliminares', days: 0.1, matPrice: 5, laborPrice: 100 },
  { desc: 'Cerramiento Provisional', unit: 'ml', cat: 'Preliminares', days: 0.2, matPrice: 20, laborPrice: 120 },
  { desc: 'Localización y Replanteo', unit: 'm2', cat: 'Preliminares', days: 0.05, matPrice: 2, laborPrice: 150 },
  { desc: 'Excavación Manual', unit: 'm3', cat: 'Preliminares', days: 0.5, matPrice: 10, laborPrice: 200 },
  { desc: 'Transporte de Materiales', unit: 'm3', cat: 'Preliminares', days: 0.2, matPrice: 50, laborPrice: 180 },
  { desc: 'Relleno Compactado', unit: 'm3', cat: 'Cimentación', days: 0.3, matPrice: 25, laborPrice: 150 },
  { desc: 'Solado de Limpieza (3000 PSI)', unit: 'm2', cat: 'Cimentación', days: 0.1, matPrice: 40, laborPrice: 120 },
  { desc: 'Zapatas en Concreto (3000 PSI)', unit: 'm3', cat: 'Cimentación', days: 2, matPrice: 500, laborPrice: 300 },
  { desc: 'Vigas de Cimentación', unit: 'm3', cat: 'Cimentación', days: 1.5, matPrice: 480, laborPrice: 300 },
  { desc: 'Impermeabilización de Vigas', unit: 'ml', cat: 'Cimentación', days: 0.2, matPrice: 30, laborPrice: 150 },
  { desc: 'Columnas en Concreto', unit: 'm3', cat: 'Estructura', days: 3, matPrice: 550, laborPrice: 350 },
  { desc: 'Vigas de Amarre', unit: 'm3', cat: 'Estructura', days: 2.5, matPrice: 520, laborPrice: 350 },
  { desc: 'Losa Entrepiso Aligerada', unit: 'm2', cat: 'Estructura', days: 1, matPrice: 120, laborPrice: 250 },
  { desc: 'Escaleras en Concreto', unit: 'm3', cat: 'Estructura', days: 4, matPrice: 600, laborPrice: 400 },
  { desc: 'Refuerzo de Acero (Figuras)', unit: 'kg', cat: 'Estructura', days: 0.05, matPrice: 15, laborPrice: 50 },
  { desc: 'Muro Bloque No. 4', unit: 'm2', cat: 'Mampostería', days: 0.3, matPrice: 60, laborPrice: 150 },
  { desc: 'Muro Bloque No. 5', unit: 'm2', cat: 'Mampostería', days: 0.4, matPrice: 80, laborPrice: 160 },
  { desc: 'Dinteles Reforzados', unit: 'ml', cat: 'Mampostería', days: 0.2, matPrice: 40, laborPrice: 140 },
  { desc: 'Pañete Liso Muros', unit: 'm2', cat: 'Acabados', days: 0.25, matPrice: 20, laborPrice: 180 },
  { desc: 'Estuco y Pintura Vinilo', unit: 'm2', cat: 'Acabados', days: 0.2, matPrice: 15, laborPrice: 120 },
  { desc: 'Instalación Sanitaria 4"', unit: 'ml', cat: 'Instalaciones', days: 0.3, matPrice: 45, laborPrice: 160 },
  { desc: 'Instalación Hidráulica 1/2"', unit: 'ml', cat: 'Instalaciones', days: 0.2, matPrice: 35, laborPrice: 150 },
  { desc: 'Salida Eléctrica Iluminación', unit: 'un', cat: 'Instalaciones', days: 0.15, matPrice: 25, laborPrice: 120 },
  { desc: 'Salida Eléctrica Tomas', unit: 'un', cat: 'Instalaciones', days: 0.15, matPrice: 25, laborPrice: 120 },
  { desc: 'Tablero Eléctrico 12 Ctos', unit: 'un', cat: 'Instalaciones', days: 1, matPrice: 500, laborPrice: 300 },
  { desc: 'Piso Cerámico 60x60', unit: 'm2', cat: 'Acabados', days: 0.4, matPrice: 90, laborPrice: 200 },
  { desc: 'Guardaescobas Cerámico', unit: 'ml', cat: 'Acabados', days: 0.1, matPrice: 10, laborPrice: 100 },
  { desc: 'Enchape Baños', unit: 'm2', cat: 'Acabados', days: 0.5, matPrice: 110, laborPrice: 220 },
  { desc: 'Cielo Falso en Drywall', unit: 'm2', cat: 'Acabados', days: 0.3, matPrice: 70, laborPrice: 180 },
  { desc: 'Puerta Madera con Marco', unit: 'un', cat: 'Acabados', days: 0.5, matPrice: 400, laborPrice: 200 },
  { desc: 'Ventana Aluminio Vidrio 4mm', unit: 'm2', cat: 'Acabados', days: 0.6, matPrice: 250, laborPrice: 250 },
  { desc: 'Mesón de Cocina Granito', unit: 'ml', cat: 'Acabados', days: 1.5, matPrice: 300, laborPrice: 300 },
  { desc: 'Estructura Metálica Cubierta', unit: 'kg', cat: 'Cubierta', days: 0.05, matPrice: 18, laborPrice: 80 },
  { desc: 'Teja Termoacústica', unit: 'm2', cat: 'Cubierta', days: 0.3, matPrice: 85, laborPrice: 150 },
  { desc: 'Caballete Cubierta', unit: 'ml', cat: 'Cubierta', days: 0.2, matPrice: 35, laborPrice: 140 },
  { desc: 'Canales Aguas Lluvias', unit: 'ml', cat: 'Cubierta', days: 0.4, matPrice: 50, laborPrice: 160 },
  { desc: 'Piso en Concreto Escobillado', unit: 'm2', cat: 'Exteriores', days: 0.2, matPrice: 50, laborPrice: 150 },
  { desc: 'Andenes Perimetrales', unit: 'm2', cat: 'Exteriores', days: 0.3, matPrice: 60, laborPrice: 160 },
  { desc: 'Acometida Eléctrica Principal', unit: 'ml', cat: 'Instalaciones', days: 0.5, matPrice: 100, laborPrice: 200 },
  { desc: 'Caja de Inspección Sanitaria', unit: 'un', cat: 'Instalaciones', days: 1, matPrice: 200, laborPrice: 250 },
];

export const DEFAULT_WORK_ITEMS: WorkItem[] = Object.values(Typology).flatMap(typo => 
  ITEM_BASE.map((item, index) => ({
    id: `${typo}-${index}`,
    code: `${typo.substring(0, 3)}-${(index + 1).toString().padStart(3, '0')}`,
    description: `${item.desc} (${typo.toLowerCase()})`,
    unit: item.unit,
    typology: typo,
    category: item.cat,
    durationDays: item.days,
    materials: [
      { name: 'Material Base', unit: item.unit, quantity: 1, price: item.matPrice }
    ],
    labor: [
      { role: 'Mano de Obra', unit: 'día', quantity: item.days, price: item.laborPrice }
    ]
  }))
);

export const BRAND_COLORS = {
  primary: '#1A1A1A', // Slate Black
  secondary: '#F15A24', // Construction Orange
  accent: '#0071BC', // Blueprint Blue
  bg: '#F8F9FA',
  text: '#2D3436'
};
