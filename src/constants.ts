/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BudgetLine } from './lib/budgetData';

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
  status: 'COTIZACION' | 'EJECUCION' | 'FINALIZADO' | 'PAUSADO';
  startDate: string;
  endDate?: string;
  location?: string;
  teamIds?: string[];
  items: ProjectItem[];
  budgetTree?: BudgetLine[];
  directCosts: number;
  indirectCosts: number;
  administrativeCosts: number;
  personalCosts: number;
  progress: number;
  budget: number;
  attachments?: string[];
  ganttConfig?: { overrides?: Record<string, any>; progress?: Record<string, number> };
  // New: Market and engineering parameters
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

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: number;
  documentId: string;
  email?: string;
  phone?: string;
  status: 'Activo' | 'Inactivo';
  address?: string;
  hireDate?: string;
  projectIds?: string[];
  notes?: string;
  bankName?: string;
  accountNumber?: string;
  documents?: { name: string; url: string; type: string }[];
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  nit?: string;
  type?: 'PERSONA' | 'EMPRESA';
  notes?: string;
  status?: 'ACTIVO' | 'INACTIVO';
  projects?: string[];
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'INGRESO' | 'GASTO';
  category: string;
  projectId?: string;
  staffId?: string;
  qty?: number;
  unitCost?: number;
  createdAt?: string;
}

export interface PayrollEmployee {
  staffId: string;
  name: string;
  role: string;
  baseSalary: number;
  daysWorked: number;
  dailySalary: number;
  grossPay: number;
  igss: number;
  irtra: number;
  intecap: number;
  bonuses: number;
  deductions: number;
  netPay: number;
}

export interface Payroll {
  id: string;
  projectId: string;
  projectName: string;
  period: string;
  type: 'CAMPO' | 'ADMINISTRATIVO';
  employees: PayrollEmployee[];
  totalGross: number;
  totalDeductions: number;
  totalBonuses: number;
  totalNet: number;
  status: 'BORRADOR' | 'PAGADA' | 'CANCELADA';
  createdAt: string;
  paidAt?: string;
  notes?: string;
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
  expiryDate?: string; // Fecha de vencimiento (YYYY-MM-DD)
  history: WarehouseMovement[];
  coordinates?: { x: number; y: number };
  iconUrl?: string;
  // Project-linked fields
  projectId?: string;
  projectName?: string;
  itemId?: string;
  itemName?: string;
  budgetedQty?: number;
  budgetedCost?: number;
  usedQty?: number;
}

export interface PurchaseOrderItem {
  itemId?: string;
  itemName?: string;
  materialName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  projectName: string;
  supplierId: string;
  supplierName: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECIBIDA' | 'CANCELADA';
  items: PurchaseOrderItem[];
  total: number;
  createdAt: string;
  notes?: string;
}

export const WAREHOUSE_DATA: WarehouseItem[] = [];

const IVA = 1.12; // IVA Guatemala 12%

// Helper para calcular precio con IVA
const apu = (mat: number, labor: number) => ({
  mat: Math.round(mat * IVA),
  labor: Math.round(labor * IVA)
});

// ─── RESIDENCIAL (40 renglones) ───────────────────────────────────────────────
const RESIDENCIAL_ITEMS = [
  { desc: 'Limpieza y chapeo del terreno', unit: 'm2', cat: 'Preliminares', days: 0.05, ...apu(3, 85) },
  { desc: 'Trazo y estaqueado', unit: 'm2', cat: 'Preliminares', days: 0.05, ...apu(2, 95) },
  { desc: 'Cerramiento provisional madera', unit: 'ml', cat: 'Preliminares', days: 0.15, ...apu(18, 110) },
  { desc: 'Bodega provisional de obra', unit: 'un', cat: 'Preliminares', days: 2, ...apu(850, 400) },
  { desc: 'Excavación manual de cimientos', unit: 'm3', cat: 'Cimentación', days: 0.5, ...apu(8, 185) },
  { desc: 'Relleno y compactación manual', unit: 'm3', cat: 'Cimentación', days: 0.3, ...apu(22, 140) },
  { desc: 'Solado de limpieza f\'c=140 kg/cm2', unit: 'm2', cat: 'Cimentación', days: 0.1, ...apu(38, 115) },
  { desc: 'Zapata aislada f\'c=210 kg/cm2', unit: 'm3', cat: 'Cimentación', days: 2, ...apu(520, 310) },
  { desc: 'Viga de cimentación f\'c=210 kg/cm2', unit: 'm3', cat: 'Cimentación', days: 1.5, ...apu(495, 295) },
  { desc: 'Acero de refuerzo No.3 (3/8")', unit: 'kg', cat: 'Cimentación', days: 0.04, ...apu(9, 28) },
  { desc: 'Columna principal f\'c=210 kg/cm2', unit: 'm3', cat: 'Estructura', days: 3, ...apu(560, 340) },
  { desc: 'Viga de amarre f\'c=210 kg/cm2', unit: 'm3', cat: 'Estructura', days: 2.5, ...apu(530, 330) },
  { desc: 'Losa maciza entrepiso e=0.12m', unit: 'm2', cat: 'Estructura', days: 1, ...apu(115, 240) },
  { desc: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', cat: 'Estructura', days: 0.04, ...apu(10, 30) },
  { desc: 'Escalera de concreto armado', unit: 'm3', cat: 'Estructura', days: 4, ...apu(590, 390) },
  { desc: 'Muro bloque pómez No.4 (0.10m)', unit: 'm2', cat: 'Mampostería', days: 0.3, ...apu(58, 145) },
  { desc: 'Muro bloque pómez No.5 (0.15m)', unit: 'm2', cat: 'Mampostería', days: 0.35, ...apu(75, 155) },
  { desc: 'Dintel de concreto armado', unit: 'ml', cat: 'Mampostería', days: 0.2, ...apu(38, 135) },
  { desc: 'Solera hidrófuga', unit: 'ml', cat: 'Mampostería', days: 0.25, ...apu(42, 140) },
  { desc: 'Solera corona', unit: 'ml', cat: 'Mampostería', days: 0.25, ...apu(42, 140) },
  { desc: 'Instalación sanitaria PVC 4"', unit: 'ml', cat: 'Instalaciones', days: 0.3, ...apu(42, 155) },
  { desc: 'Instalación hidráulica PVC 1/2"', unit: 'ml', cat: 'Instalaciones', days: 0.2, ...apu(32, 145) },
  { desc: 'Salida eléctrica iluminación 120V', unit: 'un', cat: 'Instalaciones', days: 0.15, ...apu(22, 115) },
  { desc: 'Salida eléctrica tomacorriente 120V', unit: 'un', cat: 'Instalaciones', days: 0.15, ...apu(22, 115) },
  { desc: 'Tablero eléctrico 12 circuitos', unit: 'un', cat: 'Instalaciones', days: 1, ...apu(480, 290) },
  { desc: 'Repello + cernido muros', unit: 'm2', cat: 'Acabados', days: 0.25, ...apu(18, 175) },
  { desc: 'Pintura vinílica 2 manos', unit: 'm2', cat: 'Acabados', days: 0.15, ...apu(14, 115) },
  { desc: 'Piso cerámico 60x60 antideslizante', unit: 'm2', cat: 'Acabados', days: 0.4, ...apu(88, 195) },
  { desc: 'Enchape cerámico baños 30x60', unit: 'm2', cat: 'Acabados', days: 0.5, ...apu(105, 215) },
  { desc: 'Cielo falso tabla yeso 1/2"', unit: 'm2', cat: 'Acabados', days: 0.3, ...apu(68, 175) },
  { desc: 'Puerta madera sólida con marco', unit: 'un', cat: 'Acabados', days: 0.5, ...apu(1350, 195) },
  { desc: 'Ventana aluminio + vidrio 6mm', unit: 'm2', cat: 'Acabados', days: 0.6, ...apu(420, 245) },
  { desc: 'Mesón granito cocina', unit: 'ml', cat: 'Acabados', days: 1.5, ...apu(680, 295) },
  { desc: 'Estructura metálica cubierta', unit: 'kg', cat: 'Cubierta', days: 0.05, ...apu(17, 78) },
  { desc: 'Lámina termoacústica calibre 26', unit: 'm2', cat: 'Cubierta', days: 0.3, ...apu(82, 145) },
  { desc: 'Canal PVC aguas pluviales', unit: 'ml', cat: 'Cubierta', days: 0.4, ...apu(48, 155) },
  { desc: 'Acera perimetral concreto e=0.10m', unit: 'm2', cat: 'Exteriores', days: 0.2, ...apu(48, 145) },
  { desc: 'Jardinización y siembra de grama', unit: 'm2', cat: 'Exteriores', days: 0.1, ...apu(12, 65) },
  { desc: 'Portón metálico de acceso', unit: 'un', cat: 'Exteriores', days: 2, ...apu(2800, 450) },
  { desc: 'Limpieza final y entrega de obra', unit: 'global', cat: 'Exteriores', days: 1, ...apu(0, 850) },
];

// ─── COMERCIAL (40 renglones) ─────────────────────────────────────────────────
const COMERCIAL_ITEMS = [
  { desc: 'Demolición y retiro de escombros', unit: 'm3', cat: 'Preliminares', days: 0.5, ...apu(15, 195) },
  { desc: 'Trazo y nivelación topográfica', unit: 'm2', cat: 'Preliminares', days: 0.05, ...apu(4, 145) },
  { desc: 'Cerramiento metálico provisional', unit: 'ml', cat: 'Preliminares', days: 0.2, ...apu(35, 145) },
  { desc: 'Instalación de servicios provisionales', unit: 'global', cat: 'Preliminares', days: 1, ...apu(1200, 550) },
  { desc: 'Excavación mecánica con retroexcavadora', unit: 'm3', cat: 'Cimentación', days: 0.1, ...apu(45, 95) },
  { desc: 'Pilotes de concreto f\'c=280 kg/cm2', unit: 'ml', cat: 'Cimentación', days: 1, ...apu(380, 295) },
  { desc: 'Platea de cimentación e=0.25m', unit: 'm2', cat: 'Cimentación', days: 0.5, ...apu(185, 245) },
  { desc: 'Viga de cimentación 0.30x0.60m', unit: 'm3', cat: 'Cimentación', days: 2, ...apu(545, 325) },
  { desc: 'Impermeabilización cimentación', unit: 'm2', cat: 'Cimentación', days: 0.2, ...apu(55, 145) },
  { desc: 'Acero de refuerzo No.5 (5/8")', unit: 'kg', cat: 'Cimentación', days: 0.04, ...apu(11, 32) },
  { desc: 'Columna metálica perfil W', unit: 'kg', cat: 'Estructura', days: 0.05, ...apu(22, 85) },
  { desc: 'Viga metálica perfil W', unit: 'kg', cat: 'Estructura', days: 0.05, ...apu(21, 82) },
  { desc: 'Losa colaborante steel deck', unit: 'm2', cat: 'Estructura', days: 0.4, ...apu(145, 195) },
  { desc: 'Conexiones y placas de anclaje', unit: 'un', cat: 'Estructura', days: 1, ...apu(850, 395) },
  { desc: 'Escalera metálica con huella antideslizante', unit: 'ml', cat: 'Estructura', days: 1.5, ...apu(1250, 445) },
  { desc: 'Muro cortina aluminio + vidrio templado', unit: 'm2', cat: 'Fachada', days: 1, ...apu(1850, 395) },
  { desc: 'Panel ACM fachada', unit: 'm2', cat: 'Fachada', days: 0.5, ...apu(680, 245) },
  { desc: 'Muro bloque concreto No.6', unit: 'm2', cat: 'Mampostería', days: 0.35, ...apu(88, 165) },
  { desc: 'Tabique drywall doble cara', unit: 'm2', cat: 'Mampostería', days: 0.3, ...apu(95, 175) },
  { desc: 'Puerta de vidrio templado 10mm', unit: 'un', cat: 'Acabados', days: 1, ...apu(3500, 395) },
  { desc: 'Instalación hidráulica PVC 3/4"', unit: 'ml', cat: 'Instalaciones', days: 0.2, ...apu(38, 155) },
  { desc: 'Instalación sanitaria PVC 6"', unit: 'ml', cat: 'Instalaciones', days: 0.4, ...apu(68, 175) },
  { desc: 'Sistema contra incendios rociadores', unit: 'un', cat: 'Instalaciones', days: 0.5, ...apu(285, 195) },
  { desc: 'Tablero eléctrico 24 circuitos trifásico', unit: 'un', cat: 'Instalaciones', days: 1.5, ...apu(2800, 495) },
  { desc: 'Sistema de aire acondicionado VRF', unit: 'TR', cat: 'Instalaciones', days: 2, ...apu(4500, 850) },
  { desc: 'Piso porcelanato 60x60 rectificado', unit: 'm2', cat: 'Acabados', days: 0.4, ...apu(145, 215) },
  { desc: 'Cielo falso Armstrong 60x60', unit: 'm2', cat: 'Acabados', days: 0.25, ...apu(85, 165) },
  { desc: 'Pintura epóxica muros', unit: 'm2', cat: 'Acabados', days: 0.2, ...apu(28, 125) },
  { desc: 'Señalización y rotulación', unit: 'global', cat: 'Acabados', days: 1, ...apu(1500, 450) },
  { desc: 'Baños completos con accesorios', unit: 'un', cat: 'Acabados', days: 3, ...apu(8500, 1250) },
  { desc: 'Cubierta metálica con aislante', unit: 'm2', cat: 'Cubierta', days: 0.3, ...apu(185, 165) },
  { desc: 'Impermeabilización cubierta losa', unit: 'm2', cat: 'Cubierta', days: 0.2, ...apu(65, 145) },
  { desc: 'Drenaje pluvial cubierta', unit: 'un', cat: 'Cubierta', days: 0.5, ...apu(285, 195) },
  { desc: 'Parqueo concreto estampado', unit: 'm2', cat: 'Exteriores', days: 0.3, ...apu(95, 165) },
  { desc: 'Jardinería y paisajismo', unit: 'm2', cat: 'Exteriores', days: 0.2, ...apu(45, 95) },
  { desc: 'Iluminación exterior LED', unit: 'un', cat: 'Exteriores', days: 0.5, ...apu(485, 195) },
  { desc: 'Acceso vehicular con pluma', unit: 'un', cat: 'Exteriores', days: 2, ...apu(12500, 850) },
  { desc: 'Cámara de seguridad CCTV', unit: 'un', cat: 'Instalaciones', days: 0.5, ...apu(1250, 295) },
  { desc: 'Ascensor hidráulico 6 personas', unit: 'un', cat: 'Instalaciones', days: 5, ...apu(85000, 4500) },
  { desc: 'Limpieza final y entrega', unit: 'global', cat: 'Exteriores', days: 1, ...apu(0, 1250) },
];

// ─── INDUSTRIAL (40 renglones) ────────────────────────────────────────────────
const INDUSTRIAL_ITEMS = [
  { desc: 'Limpieza y nivelación de terreno', unit: 'm2', cat: 'Preliminares', days: 0.03, ...apu(5, 75) },
  { desc: 'Trazo topográfico con estación total', unit: 'm2', cat: 'Preliminares', days: 0.03, ...apu(3, 125) },
  { desc: 'Cerramiento perimetral malla ciclón', unit: 'ml', cat: 'Preliminares', days: 0.3, ...apu(85, 145) },
  { desc: 'Caseta de guardianía prefabricada', unit: 'un', cat: 'Preliminares', days: 1, ...apu(4500, 650) },
  { desc: 'Excavación mecánica masiva', unit: 'm3', cat: 'Cimentación', days: 0.05, ...apu(38, 75) },
  { desc: 'Relleno con material selecto compactado', unit: 'm3', cat: 'Cimentación', days: 0.2, ...apu(45, 125) },
  { desc: 'Platea industrial f\'c=280 kg/cm2 e=0.20m', unit: 'm2', cat: 'Cimentación', days: 0.3, ...apu(165, 195) },
  { desc: 'Zapata corrida f\'c=280 kg/cm2', unit: 'm3', cat: 'Cimentación', days: 1.5, ...apu(565, 315) },
  { desc: 'Perno de anclaje para columna metálica', unit: 'un', cat: 'Cimentación', days: 0.5, ...apu(185, 145) },
  { desc: 'Acero de refuerzo No.6 (3/4")', unit: 'kg', cat: 'Cimentación', days: 0.04, ...apu(12, 34) },
  { desc: 'Columna metálica tubular cuadrada', unit: 'kg', cat: 'Estructura', days: 0.04, ...apu(20, 78) },
  { desc: 'Cercha metálica tipo Pratt', unit: 'kg', cat: 'Estructura', days: 0.05, ...apu(19, 82) },
  { desc: 'Correa metálica C-150', unit: 'kg', cat: 'Estructura', days: 0.03, ...apu(16, 65) },
  { desc: 'Soldadura estructural E-7018', unit: 'kg', cat: 'Estructura', days: 0.5, ...apu(45, 195) },
  { desc: 'Pintura anticorrosiva + esmalte', unit: 'm2', cat: 'Estructura', days: 0.1, ...apu(22, 95) },
  { desc: 'Cubierta lámina galvanizada cal.26', unit: 'm2', cat: 'Cubierta', days: 0.15, ...apu(68, 125) },
  { desc: 'Aislante térmico cubierta', unit: 'm2', cat: 'Cubierta', days: 0.1, ...apu(45, 95) },
  { desc: 'Canaleta metálica aguas pluviales', unit: 'ml', cat: 'Cubierta', days: 0.3, ...apu(55, 145) },
  { desc: 'Bajada de aguas pluviales 4"', unit: 'ml', cat: 'Cubierta', days: 0.2, ...apu(28, 115) },
  { desc: 'Lucernario policarbonato', unit: 'm2', cat: 'Cubierta', days: 0.4, ...apu(185, 165) },
  { desc: 'Muro panel prefabricado concreto', unit: 'm2', cat: 'Mampostería', days: 0.2, ...apu(245, 145) },
  { desc: 'Portón industrial metálico corredizo', unit: 'un', cat: 'Mampostería', days: 2, ...apu(8500, 850) },
  { desc: 'Ventana industrial celosía metálica', unit: 'm2', cat: 'Mampostería', days: 0.5, ...apu(285, 195) },
  { desc: 'Piso industrial concreto pulido f\'c=280', unit: 'm2', cat: 'Acabados', days: 0.2, ...apu(95, 145) },
  { desc: 'Pintura epóxica piso industrial', unit: 'm2', cat: 'Acabados', days: 0.15, ...apu(38, 115) },
  { desc: 'Instalación eléctrica trifásica 220V', unit: 'ml', cat: 'Instalaciones', days: 0.3, ...apu(55, 165) },
  { desc: 'Tablero eléctrico industrial 480V', unit: 'un', cat: 'Instalaciones', days: 2, ...apu(8500, 1250) },
  { desc: 'Instalación hidráulica industrial 2"', unit: 'ml', cat: 'Instalaciones', days: 0.3, ...apu(65, 165) },
  { desc: 'Sistema contra incendios FM200', unit: 'global', cat: 'Instalaciones', days: 3, ...apu(45000, 4500) },
  { desc: 'Compresor de aire red neumática', unit: 'ml', cat: 'Instalaciones', days: 0.4, ...apu(85, 195) },
  { desc: 'Luminaria industrial LED 200W', unit: 'un', cat: 'Instalaciones', days: 0.5, ...apu(850, 195) },
  { desc: 'Puente grúa monorriel 5 ton', unit: 'ml', cat: 'Estructura', days: 1, ...apu(2500, 650) },
  { desc: 'Rampa de acceso vehicular', unit: 'm2', cat: 'Exteriores', days: 0.3, ...apu(125, 165) },
  { desc: 'Plataforma de carga y descarga', unit: 'm2', cat: 'Exteriores', days: 0.4, ...apu(145, 175) },
  { desc: 'Cisterna de agua 50,000 lts', unit: 'un', cat: 'Instalaciones', days: 5, ...apu(28000, 3500) },
  { desc: 'Planta de tratamiento aguas residuales', unit: 'un', cat: 'Instalaciones', days: 5, ...apu(45000, 5500) },
  { desc: 'Señalización industrial OSHA', unit: 'global', cat: 'Exteriores', days: 1, ...apu(2500, 650) },
  { desc: 'Caseta eléctrica transformador', unit: 'un', cat: 'Instalaciones', days: 3, ...apu(18500, 2500) },
  { desc: 'Acometida eléctrica media tensión', unit: 'global', cat: 'Instalaciones', days: 3, ...apu(35000, 4500) },
  { desc: 'Limpieza final y entrega de planta', unit: 'global', cat: 'Exteriores', days: 1, ...apu(0, 1850) },
];

// ─── CIVIL (40 renglones) ─────────────────────────────────────────────────────
const CIVIL_ITEMS = [
  { desc: 'Levantamiento topográfico', unit: 'km', cat: 'Preliminares', days: 1, ...apu(850, 1250) },
  { desc: 'Estudio de suelos', unit: 'global', cat: 'Preliminares', days: 3, ...apu(4500, 2500) },
  { desc: 'Desmonte y limpieza de derecho de vía', unit: 'm2', cat: 'Preliminares', days: 0.02, ...apu(4, 65) },
  { desc: 'Señalización temporal de obra', unit: 'global', cat: 'Preliminares', days: 1, ...apu(3500, 850) },
  { desc: 'Corte de terreno con maquinaria', unit: 'm3', cat: 'Movimiento de Tierras', days: 0.03, ...apu(28, 55) },
  { desc: 'Relleno con material de banco', unit: 'm3', cat: 'Movimiento de Tierras', days: 0.05, ...apu(55, 75) },
  { desc: 'Compactación con vibrocompactador', unit: 'm3', cat: 'Movimiento de Tierras', days: 0.05, ...apu(12, 65) },
  { desc: 'Transporte de material de desperdicio', unit: 'm3', cat: 'Movimiento de Tierras', days: 0.1, ...apu(45, 55) },
  { desc: 'Sub-base granular e=0.20m', unit: 'm2', cat: 'Pavimento', days: 0.05, ...apu(38, 55) },
  { desc: 'Base granular e=0.15m', unit: 'm2', cat: 'Pavimento', days: 0.05, ...apu(45, 58) },
  { desc: 'Carpeta asfáltica e=0.05m', unit: 'm2', cat: 'Pavimento', days: 0.05, ...apu(85, 65) },
  { desc: 'Pavimento rígido concreto e=0.15m', unit: 'm2', cat: 'Pavimento', days: 0.1, ...apu(125, 95) },
  { desc: 'Bordillo de concreto 0.15x0.30m', unit: 'ml', cat: 'Pavimento', days: 0.15, ...apu(38, 95) },
  { desc: 'Cuneta de concreto triangular', unit: 'ml', cat: 'Drenaje', days: 0.2, ...apu(45, 115) },
  { desc: 'Alcantarilla tubería PVC 24"', unit: 'ml', cat: 'Drenaje', days: 0.5, ...apu(285, 195) },
  { desc: 'Pozo de visita ladrillo tayuyo', unit: 'un', cat: 'Drenaje', days: 3, ...apu(2800, 850) },
  { desc: 'Caja de captación pluvial', unit: 'un', cat: 'Drenaje', days: 2, ...apu(1850, 650) },
  { desc: 'Tubería drenaje PVC 8"', unit: 'ml', cat: 'Drenaje', days: 0.3, ...apu(95, 145) },
  { desc: 'Puente vehicular losa concreto', unit: 'm2', cat: 'Estructuras', days: 5, ...apu(2500, 850) },
  { desc: 'Muro de contención concreto ciclópeo', unit: 'm3', cat: 'Estructuras', days: 2, ...apu(485, 295) },
  { desc: 'Gaviones metálicos rellenos', unit: 'm3', cat: 'Estructuras', days: 1, ...apu(285, 195) },
  { desc: 'Tubería agua potable PVC 4"', unit: 'ml', cat: 'Instalaciones', days: 0.2, ...apu(65, 125) },
  { desc: 'Válvula de compuerta 4"', unit: 'un', cat: 'Instalaciones', days: 0.5, ...apu(850, 195) },
  { desc: 'Hidrante contra incendios', unit: 'un', cat: 'Instalaciones', days: 1, ...apu(4500, 650) },
  { desc: 'Línea eléctrica media tensión aérea', unit: 'ml', cat: 'Instalaciones', days: 0.2, ...apu(185, 145) },
  { desc: 'Poste concreto 9m con luminaria', unit: 'un', cat: 'Instalaciones', days: 1, ...apu(2800, 450) },
  { desc: 'Señalización horizontal termoplástico', unit: 'm2', cat: 'Señalización', days: 0.1, ...apu(45, 85) },
  { desc: 'Señalización vertical reglamentaria', unit: 'un', cat: 'Señalización', days: 0.5, ...apu(485, 195) },
  { desc: 'Semáforo vehicular LED', unit: 'un', cat: 'Señalización', days: 2, ...apu(8500, 1250) },
  { desc: 'Acera peatonal concreto e=0.10m', unit: 'm2', cat: 'Acabados', days: 0.15, ...apu(55, 95) },
  { desc: 'Rampa accesibilidad universal', unit: 'un', cat: 'Acabados', days: 1, ...apu(850, 350) },
  { desc: 'Jardinización taludes', unit: 'm2', cat: 'Acabados', days: 0.1, ...apu(8, 55) },
  { desc: 'Baranda metálica puente', unit: 'ml', cat: 'Estructuras', days: 0.5, ...apu(285, 195) },
  { desc: 'Junta de expansión asfáltica', unit: 'ml', cat: 'Pavimento', days: 0.3, ...apu(45, 125) },
  { desc: 'Estabilización de taludes con geomalla', unit: 'm2', cat: 'Estructuras', days: 0.3, ...apu(85, 125) },
  { desc: 'Planta de tratamiento agua potable', unit: 'global', cat: 'Instalaciones', days: 10, ...apu(185000, 25000) },
  { desc: 'Tanque elevado concreto 100m3', unit: 'un', cat: 'Instalaciones', days: 8, ...apu(85000, 12500) },
  { desc: 'Prueba hidrostática tuberías', unit: 'global', cat: 'Instalaciones', days: 1, ...apu(0, 1250) },
  { desc: 'Reforestación área de influencia', unit: 'un', cat: 'Acabados', days: 0.1, ...apu(25, 45) },
  { desc: 'Entrega y pruebas finales', unit: 'global', cat: 'Acabados', days: 2, ...apu(0, 2500) },
];

// ─── PUBLICA (40 renglones) ───────────────────────────────────────────────────
const PUBLICA_ITEMS = [
  { desc: 'Estudio de impacto ambiental', unit: 'global', cat: 'Preliminares', days: 5, ...apu(8500, 4500) },
  { desc: 'Trazo y replanteo con GPS', unit: 'm2', cat: 'Preliminares', days: 0.03, ...apu(3, 135) },
  { desc: 'Cerramiento perimetral con malla', unit: 'ml', cat: 'Preliminares', days: 0.25, ...apu(75, 135) },
  { desc: 'Instalaciones provisionales de obra', unit: 'global', cat: 'Preliminares', days: 2, ...apu(2500, 1250) },
  { desc: 'Excavación y movimiento de tierras', unit: 'm3', cat: 'Cimentación', days: 0.05, ...apu(35, 75) },
  { desc: 'Relleno compactado al 95% Proctor', unit: 'm3', cat: 'Cimentación', days: 0.1, ...apu(48, 95) },
  { desc: 'Cimentación corrida concreto f\'c=210', unit: 'm3', cat: 'Cimentación', days: 1.5, ...apu(495, 295) },
  { desc: 'Zapata aislada f\'c=280 kg/cm2', unit: 'm3', cat: 'Cimentación', days: 2, ...apu(565, 325) },
  { desc: 'Acero de refuerzo corrugado', unit: 'kg', cat: 'Cimentación', days: 0.04, ...apu(10, 30) },
  { desc: 'Impermeabilización de losa de fondo', unit: 'm2', cat: 'Cimentación', days: 0.2, ...apu(58, 145) },
  { desc: 'Columna concreto armado f\'c=280', unit: 'm3', cat: 'Estructura', days: 3, ...apu(575, 345) },
  { desc: 'Viga principal f\'c=280 kg/cm2', unit: 'm3', cat: 'Estructura', days: 2.5, ...apu(545, 335) },
  { desc: 'Losa de entrepiso e=0.15m', unit: 'm2', cat: 'Estructura', days: 0.8, ...apu(125, 235) },
  { desc: 'Escalera de emergencia metálica', unit: 'ml', cat: 'Estructura', days: 1.5, ...apu(1250, 445) },
  { desc: 'Rampa accesibilidad universal 8%', unit: 'm2', cat: 'Estructura', days: 0.5, ...apu(95, 175) },
  { desc: 'Muro bloque concreto No.5', unit: 'm2', cat: 'Mampostería', days: 0.35, ...apu(78, 158) },
  { desc: 'Tabique divisorio drywall', unit: 'm2', cat: 'Mampostería', days: 0.25, ...apu(88, 165) },
  { desc: 'Muro cortafuego 2 horas', unit: 'm2', cat: 'Mampostería', days: 0.4, ...apu(125, 185) },
  { desc: 'Instalación hidráulica PVC 1"', unit: 'ml', cat: 'Instalaciones', days: 0.2, ...apu(35, 148) },
  { desc: 'Instalación sanitaria PVC 4"', unit: 'ml', cat: 'Instalaciones', days: 0.3, ...apu(42, 155) },
  { desc: 'Sistema contra incendios rociadores', unit: 'un', cat: 'Instalaciones', days: 0.5, ...apu(285, 195) },
  { desc: 'Tablero eléctrico principal 3F', unit: 'un', cat: 'Instalaciones', days: 2, ...apu(4500, 850) },
  { desc: 'Salida eléctrica iluminación LED', unit: 'un', cat: 'Instalaciones', days: 0.15, ...apu(28, 118) },
  { desc: 'Sistema de voz y datos Cat6', unit: 'punto', cat: 'Instalaciones', days: 0.3, ...apu(185, 145) },
  { desc: 'Sistema CCTV 16 cámaras', unit: 'global', cat: 'Instalaciones', days: 3, ...apu(18500, 2500) },
  { desc: 'Piso porcelanato antideslizante', unit: 'm2', cat: 'Acabados', days: 0.4, ...apu(135, 205) },
  { desc: 'Cielo falso mineral Armstrong', unit: 'm2', cat: 'Acabados', days: 0.25, ...apu(88, 165) },
  { desc: 'Pintura látex lavable 2 manos', unit: 'm2', cat: 'Acabados', days: 0.15, ...apu(16, 118) },
  { desc: 'Puerta metálica antipánico', unit: 'un', cat: 'Acabados', days: 1, ...apu(2800, 395) },
  { desc: 'Ventana aluminio + vidrio laminado', unit: 'm2', cat: 'Acabados', days: 0.6, ...apu(485, 255) },
  { desc: 'Señalización de emergencia fotoluminiscente', unit: 'un', cat: 'Acabados', days: 0.2, ...apu(185, 95) },
  { desc: 'Mobiliario urbano (bancas, basureros)', unit: 'un', cat: 'Exteriores', days: 0.5, ...apu(1250, 295) },
  { desc: 'Área verde y paisajismo', unit: 'm2', cat: 'Exteriores', days: 0.15, ...apu(35, 85) },
  { desc: 'Iluminación exterior solar LED', unit: 'un', cat: 'Exteriores', days: 0.5, ...apu(1850, 295) },
  { desc: 'Estacionamiento concreto estampado', unit: 'm2', cat: 'Exteriores', days: 0.3, ...apu(95, 165) },
  { desc: 'Cubierta metálica área exterior', unit: 'm2', cat: 'Cubierta', days: 0.3, ...apu(175, 155) },
  { desc: 'Impermeabilización azotea', unit: 'm2', cat: 'Cubierta', days: 0.2, ...apu(65, 145) },
  { desc: 'Planta de emergencia 50 KVA', unit: 'un', cat: 'Instalaciones', days: 2, ...apu(45000, 3500) },
  { desc: 'Pruebas y puesta en marcha', unit: 'global', cat: 'Acabados', days: 2, ...apu(0, 2500) },
  { desc: 'Limpieza final y entrega oficial', unit: 'global', cat: 'Acabados', days: 1, ...apu(0, 1850) },
];

// Mapa de renglones por tipología
const ITEMS_BY_TYPOLOGY: Record<Typology, typeof RESIDENCIAL_ITEMS> = {
  [Typology.RESIDENCIAL]: RESIDENCIAL_ITEMS,
  [Typology.COMERCIAL]:   COMERCIAL_ITEMS,
  [Typology.INDUSTRIAL]:  INDUSTRIAL_ITEMS,
  [Typology.CIVIL]:       CIVIL_ITEMS,
  [Typology.PUBLICA]:     PUBLICA_ITEMS,
};

export const DEFAULT_WORK_ITEMS: WorkItem[] = Object.entries(ITEMS_BY_TYPOLOGY).flatMap(
  ([typo, items]) => items.map((item, index) => ({
    id: `${typo}-${index}`,
    code: `${typo.substring(0, 3).toUpperCase()}-${(index + 1).toString().padStart(3, '0')}`,
    description: item.desc,
    unit: item.unit,
    typology: typo as Typology,
    category: item.cat,
    durationDays: item.days,
    materials: [
      { name: 'Materiales (incl. IVA 12%)', unit: item.unit, quantity: 1, price: item.mat }
    ],
    labor: [
      { role: 'Mano de obra (incl. IVA 12%)', unit: 'día', quantity: item.days, price: item.labor }
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

// ──────────────────────────────────────────────────────────────────────────────
// MATERIALS SUMMARY - Cálculo de materiales para presupuesto
// ──────────────────────────────────────────────────────────────────────────────

export interface MaterialSummaryItem {
  name: string;
  unit: string;
  totalQuantity: number;
  category: string; // 'Concreto' | 'Acero' | 'Mampostería' | 'Acabados' | 'Instalaciones' | 'Varios'
}

// Materiales estándar por categoría de trabajo (por unidad de medida del renglón)
export interface MaterialPerUnit {
  materialName: string;
  unit: string;
  quantity: number; // Cantidad por unidad del renglón
  category: 'concreto' | 'acero' | 'mamposteria' | 'acabados' | 'instalaciones' | 'varios';
}

// Materiales por categoría de ítem (cantidad por unidad del trabajo)
export const MATERIALS_BY_CATEGORY: Record<string, MaterialPerUnit[]> = {
  'Cimentación': [
    { materialName: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 8.5, category: 'concreto' },
    { materialName: 'Arena de río lavada', unit: 'm3', quantity: 0.45, category: 'concreto' },
    { materialName: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.65, category: 'concreto' },
    { materialName: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', quantity: 85, category: 'acero' },
    { materialName: 'Alambre de amarre No.18', unit: 'kg', quantity: 1.2, category: 'acero' },
  ],
  'Estructura': [
    { materialName: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 8.5, category: 'concreto' },
    { materialName: 'Arena de río lavada', unit: 'm3', quantity: 0.45, category: 'concreto' },
    { materialName: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.65, category: 'concreto' },
    { materialName: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', quantity: 120, category: 'acero' },
    { materialName: 'Acero de refuerzo No.3 (3/8")', unit: 'kg', quantity: 45, category: 'acero' },
    { materialName: 'Alambre de amarre No.18', unit: 'kg', quantity: 2, category: 'acero' },
    { materialName: 'Formaleta madera pino', unit: 'm2', quantity: 4, category: 'varios' },
  ],
  'Mampostería': [
    { materialName: 'Bloque pómez No.4 (0.10m)', unit: 'un', quantity: 12.5, category: 'mamposteria' },
    { materialName: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 0.25, category: 'concreto' },
    { materialName: 'Arena de río lavada', unit: 'm3', quantity: 0.015, category: 'concreto' },
  ],
  'Acabados': [
    { materialName: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 0.15, category: 'concreto' },
    { materialName: 'Arena de río lavada', unit: 'm3', quantity: 0.02, category: 'concreto' },
    { materialName: 'Pintura vinílica', unit: 'gal', quantity: 0.08, category: 'acabados' },
    { materialName: 'Cerámica o porcelanato', unit: 'm2', quantity: 1.05, category: 'acabados' },
  ],
  'Preliminares': [
    { materialName: 'Combustible', unit: 'lt', quantity: 0.5, category: 'varios' },
  ],
  'Instalaciones': [
    { materialName: 'Tubo PVC sanitario 4"', unit: 'ml', quantity: 1, category: 'instalaciones' },
    { materialName: 'Tubo PVC hidráulico 1/2"', unit: 'ml', quantity: 1, category: 'instalaciones' },
    { materialName: 'Cable eléctrico THW 12', unit: 'ml', quantity: 3, category: 'instalaciones' },
    { materialName: 'Tub conduit PVC 3/4"', unit: 'ml', quantity: 1.5, category: 'instalaciones' },
  ],
  'Cubierta': [
    { materialName: 'Lámina metálica calibre 26', unit: 'm2', quantity: 1.05, category: 'varios' },
    { materialName: 'Tornillo autorroscante', unit: 'un', quantity: 6, category: 'varios' },
    { materialName: 'Sellador de полиуретано', unit: 'tubo', quantity: 0.1, category: 'varios' },
  ],
  'Exteriores': [
    { materialName: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 0.35, category: 'concreto' },
    { materialName: 'Arena de río lavada', unit: 'm3', quantity: 0.04, category: 'concreto' },
    { materialName: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.06, category: 'concreto' },
    { materialName: 'Planta de grama', unit: 'm2', quantity: 1, category: 'varios' },
  ],
  'Fachada': [
    { materialName: 'Panel ACM o similar', unit: 'm2', quantity: 1.02, category: 'acabados' },
    { materialName: 'Perfilería aluminio', unit: 'ml', quantity: 0.8, category: 'varios' },
    { materialName: 'Sellador estructural', unit: 'tubo', quantity: 0.15, category: 'varios' },
  ],
};

// Categorías de materiales para el resumen
export const MATERIAL_CATEGORIES = [
  { key: 'concreto', label: 'Concreto', color: '#6B7280' },
  { key: 'acero', label: 'Acero y Ferretería', color: '#EF4444' },
  { key: 'mamposteria', label: 'Mampostería', color: '#F59E0B' },
  { key: 'acabados', label: 'Acabados', color: '#10B981' },
  { key: 'instalaciones', label: 'Instalaciones', color: '#3B82F6' },
  { key: 'varios', label: 'Varios', color: '#8B5CF6' },
];
