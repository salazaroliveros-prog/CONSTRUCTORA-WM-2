import { Typology } from '../models/engineering';

export interface APUMaterial { name: string; unit: string; quantity: number; price: number; }
export interface APULabor    { role: string; unit: string; quantity: number; price: number; }
export interface APUItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  category: string;
  typology: Typology;
  durationDays: number;
  materials: APUMaterial[];
  labor: APULabor[];
  notes?: string;
}

// IVA Guatemala 12%
const iva = (n: number) => Math.round(n * 1.12);

// ── RESIDENCIAL ───────────────────────────────────────────────────────────────
const RESIDENCIAL: APUItem[] = [
  {
    id: 'APU-RES-001', code: 'RES-001',
    description: 'Limpieza y chapeo del terreno',
    unit: 'm2', category: 'Preliminares', typology: Typology.RESIDENCIAL, durationDays: 0.05,
    materials: [
      { name: 'Combustible motosierra', unit: 'lt', quantity: 0.05, price: iva(12) },
    ],
    labor: [
      { role: 'Peón', unit: 'día', quantity: 0.05, price: iva(85) },
    ],
    notes: 'Incluye retiro de maleza y escombros superficiales'
  },
  {
    id: 'APU-RES-002', code: 'RES-002',
    description: 'Excavación manual de cimientos',
    unit: 'm3', category: 'Cimentación', typology: Typology.RESIDENCIAL, durationDays: 0.5,
    materials: [
      { name: 'Herramienta menor (pico, pala)', unit: 'global', quantity: 0.02, price: iva(450) },
    ],
    labor: [
      { role: 'Peón', unit: 'día', quantity: 0.5, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-003', code: 'RES-003',
    description: "Zapata aislada f'c=210 kg/cm2",
    unit: 'm3', category: 'Cimentación', typology: Typology.RESIDENCIAL, durationDays: 2,
    materials: [
      { name: 'Cemento Portland tipo I (saco 42.5kg)', unit: 'saco', quantity: 8.5, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.45, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.65, price: iva(210) },
      { name: 'Agua', unit: 'm3', quantity: 0.18, price: iva(8) },
      { name: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', quantity: 85, price: iva(9.5) },
      { name: 'Alambre de amarre No.18', unit: 'kg', quantity: 1.2, price: iva(12) },
      { name: 'Formaleta madera pino', unit: 'm2', quantity: 4, price: iva(45) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.5, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 1, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 2, price: iva(85) },
    ],
    notes: 'Incluye armado, formaleta, colado y desencofrado'
  },
  {
    id: 'APU-RES-004', code: 'RES-004',
    description: "Columna principal f'c=210 kg/cm2",
    unit: 'm3', category: 'Estructura', typology: Typology.RESIDENCIAL, durationDays: 3,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 8.5, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.45, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.65, price: iva(210) },
      { name: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', quantity: 120, price: iva(9.5) },
      { name: 'Acero de refuerzo No.3 (3/8")', unit: 'kg', quantity: 45, price: iva(9.2) },
      { name: 'Alambre de amarre No.18', unit: 'kg', quantity: 2, price: iva(12) },
      { name: 'Formaleta metálica columna', unit: 'm2', quantity: 6, price: iva(85) },
      { name: 'Desmoldante', unit: 'lt', quantity: 0.5, price: iva(28) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.75, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 1.5, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 3, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-005', code: 'RES-005',
    description: 'Losa maciza entrepiso e=0.12m',
    unit: 'm2', category: 'Estructura', typology: Typology.RESIDENCIAL, durationDays: 1,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 1.1, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.055, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.08, price: iva(210) },
      { name: 'Acero de refuerzo No.3 (3/8")', unit: 'kg', quantity: 8.5, price: iva(9.2) },
      { name: 'Formaleta madera pino', unit: 'm2', quantity: 1.1, price: iva(45) },
      { name: 'Puntales metálicos', unit: 'un', quantity: 0.15, price: iva(185) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.1, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.25, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.5, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-006', code: 'RES-006',
    description: 'Muro bloque pómez No.4 (0.10m)',
    unit: 'm2', category: 'Mampostería', typology: Typology.RESIDENCIAL, durationDays: 0.3,
    materials: [
      { name: 'Bloque de pómez No.4 (0.10x0.20x0.40m)', unit: 'un', quantity: 12.5, price: iva(4.5) },
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 0.25, price: iva(62) },
      { name: 'Arena amarilla para pega', unit: 'm3', quantity: 0.02, price: iva(145) },
      { name: 'Acero de refuerzo No.3 (3/8")', unit: 'kg', quantity: 1.8, price: iva(9.2) },
    ],
    labor: [
      { role: 'Albañil', unit: 'día', quantity: 0.2, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.15, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-007', code: 'RES-007',
    description: 'Repello + cernido muros',
    unit: 'm2', category: 'Acabados', typology: Typology.RESIDENCIAL, durationDays: 0.25,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 0.18, price: iva(62) },
      { name: 'Cal hidratada', unit: 'saco', quantity: 0.12, price: iva(38) },
      { name: 'Arena blanca fina', unit: 'm3', quantity: 0.015, price: iva(165) },
    ],
    labor: [
      { role: 'Albañil', unit: 'día', quantity: 0.15, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.1, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-008', code: 'RES-008',
    description: 'Piso cerámico 60x60 antideslizante',
    unit: 'm2', category: 'Acabados', typology: Typology.RESIDENCIAL, durationDays: 0.4,
    materials: [
      { name: 'Cerámica 60x60 antideslizante', unit: 'm2', quantity: 1.05, price: iva(85) },
      { name: 'Pegamento cerámico (saco 25kg)', unit: 'saco', quantity: 0.25, price: iva(48) },
      { name: 'Fragua color (saco 5kg)', unit: 'saco', quantity: 0.1, price: iva(35) },
      { name: 'Crucetas 3mm', unit: 'bolsa', quantity: 0.05, price: iva(18) },
    ],
    labor: [
      { role: 'Azulejero', unit: 'día', quantity: 0.25, price: iva(165) },
      { role: 'Peón', unit: 'día', quantity: 0.15, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-009', code: 'RES-009',
    description: 'Instalación sanitaria PVC 4"',
    unit: 'ml', category: 'Instalaciones', typology: Typology.RESIDENCIAL, durationDays: 0.3,
    materials: [
      { name: 'Tubería PVC sanitaria 4" (6m)', unit: 'un', quantity: 0.17, price: iva(185) },
      { name: 'Codo PVC 4" x 90°', unit: 'un', quantity: 0.1, price: iva(28) },
      { name: 'Yee PVC 4"', unit: 'un', quantity: 0.05, price: iva(35) },
      { name: 'Pegamento PVC (1/4 lt)', unit: 'un', quantity: 0.02, price: iva(45) },
    ],
    labor: [
      { role: 'Plomero', unit: 'día', quantity: 0.15, price: iva(155) },
      { role: 'Peón', unit: 'día', quantity: 0.1, price: iva(85) },
    ],
  },
  {
    id: 'APU-RES-010', code: 'RES-010',
    description: 'Pintura vinílica 2 manos',
    unit: 'm2', category: 'Acabados', typology: Typology.RESIDENCIAL, durationDays: 0.15,
    materials: [
      { name: 'Pintura vinílica interior (galón)', unit: 'galón', quantity: 0.08, price: iva(95) },
      { name: 'Sellador acrílico (galón)', unit: 'galón', quantity: 0.04, price: iva(75) },
      { name: 'Lija No.120', unit: 'un', quantity: 0.05, price: iva(8) },
      { name: 'Cinta enmascarar', unit: 'rollo', quantity: 0.02, price: iva(18) },
    ],
    labor: [
      { role: 'Pintor', unit: 'día', quantity: 0.08, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.05, price: iva(85) },
    ],
  },
];


// ── COMERCIAL ─────────────────────────────────────────────────────────────────
const COMERCIAL: APUItem[] = [
  {
    id: 'APU-COM-001', code: 'COM-001',
    description: 'Excavación mecánica con retroexcavadora',
    unit: 'm3', category: 'Cimentación', typology: Typology.COMERCIAL, durationDays: 0.1,
    materials: [
      { name: 'Combustible diesel (retroexcavadora)', unit: 'galón', quantity: 0.08, price: iva(32) },
    ],
    labor: [
      { role: 'Operador retroexcavadora', unit: 'hora', quantity: 0.5, price: iva(185) },
      { role: 'Peón', unit: 'día', quantity: 0.1, price: iva(85) },
    ],
  },
  {
    id: 'APU-COM-002', code: 'COM-002',
    description: "Platea de cimentación f'c=280 kg/cm2 e=0.25m",
    unit: 'm2', category: 'Cimentación', typology: Typology.COMERCIAL, durationDays: 0.5,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 2.8, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.14, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.2, price: iva(210) },
      { name: 'Acero de refuerzo No.5 (5/8")', unit: 'kg', quantity: 18, price: iva(9.8) },
      { name: 'Malla electrosoldada 6x6-10/10', unit: 'm2', quantity: 1.1, price: iva(45) },
      { name: 'Aditivo impermeabilizante', unit: 'kg', quantity: 0.5, price: iva(28) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.15, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.3, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.6, price: iva(85) },
    ],
  },
  {
    id: 'APU-COM-003', code: 'COM-003',
    description: 'Columna metálica perfil W8x31',
    unit: 'kg', category: 'Estructura', typology: Typology.COMERCIAL, durationDays: 0.05,
    materials: [
      { name: 'Perfil W8x31 A36', unit: 'kg', quantity: 1.02, price: iva(18) },
      { name: 'Electrodo E7018 (kg)', unit: 'kg', quantity: 0.015, price: iva(45) },
      { name: 'Pintura anticorrosiva', unit: 'lt', quantity: 0.008, price: iva(38) },
    ],
    labor: [
      { role: 'Soldador certificado', unit: 'día', quantity: 0.025, price: iva(285) },
      { role: 'Ayudante soldador', unit: 'día', quantity: 0.025, price: iva(125) },
    ],
  },
  {
    id: 'APU-COM-004', code: 'COM-004',
    description: 'Losa colaborante steel deck e=0.12m',
    unit: 'm2', category: 'Estructura', typology: Typology.COMERCIAL, durationDays: 0.4,
    materials: [
      { name: 'Steel deck calibre 22 (m2)', unit: 'm2', quantity: 1.05, price: iva(125) },
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 1.0, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.05, price: iva(185) },
      { name: 'Grava triturada 3/8"', unit: 'm3', quantity: 0.07, price: iva(210) },
      { name: 'Malla electrosoldada 6x6-10/10', unit: 'm2', quantity: 1.1, price: iva(45) },
      { name: 'Puntales metálicos', unit: 'un', quantity: 0.12, price: iva(185) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.08, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.2, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.4, price: iva(85) },
    ],
  },
  {
    id: 'APU-COM-005', code: 'COM-005',
    description: 'Muro cortina aluminio + vidrio templado 6mm',
    unit: 'm2', category: 'Fachada', typology: Typology.COMERCIAL, durationDays: 1,
    materials: [
      { name: 'Perfil aluminio serie 50 (kg)', unit: 'kg', quantity: 8.5, price: iva(48) },
      { name: 'Vidrio templado 6mm', unit: 'm2', quantity: 0.85, price: iva(285) },
      { name: 'Silicón estructural (cartucho)', unit: 'un', quantity: 0.5, price: iva(85) },
      { name: 'Tornillería inoxidable', unit: 'global', quantity: 0.02, price: iva(185) },
    ],
    labor: [
      { role: 'Instalador aluminio y vidrio', unit: 'día', quantity: 0.5, price: iva(245) },
      { role: 'Ayudante', unit: 'día', quantity: 0.5, price: iva(105) },
    ],
  },
  {
    id: 'APU-COM-006', code: 'COM-006',
    description: 'Piso porcelanato 60x60 rectificado',
    unit: 'm2', category: 'Acabados', typology: Typology.COMERCIAL, durationDays: 0.4,
    materials: [
      { name: 'Porcelanato 60x60 rectificado', unit: 'm2', quantity: 1.05, price: iva(145) },
      { name: 'Pegamento porcelanato (saco 25kg)', unit: 'saco', quantity: 0.3, price: iva(58) },
      { name: 'Fragua epóxica (kg)', unit: 'kg', quantity: 0.15, price: iva(85) },
      { name: 'Crucetas 2mm', unit: 'bolsa', quantity: 0.05, price: iva(18) },
    ],
    labor: [
      { role: 'Azulejero especializado', unit: 'día', quantity: 0.25, price: iva(195) },
      { role: 'Peón', unit: 'día', quantity: 0.15, price: iva(85) },
    ],
  },
];

// ── INDUSTRIAL ────────────────────────────────────────────────────────────────
const INDUSTRIAL: APUItem[] = [
  {
    id: 'APU-IND-001', code: 'IND-001',
    description: "Platea industrial f'c=280 kg/cm2 e=0.20m",
    unit: 'm2', category: 'Cimentación', typology: Typology.INDUSTRIAL, durationDays: 0.3,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 2.2, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.11, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.16, price: iva(210) },
      { name: 'Malla electrosoldada 6x6-6/6', unit: 'm2', quantity: 1.1, price: iva(65) },
      { name: 'Aditivo endurecedor de piso', unit: 'kg', quantity: 0.8, price: iva(35) },
      { name: 'Membrana polietileno 6 mil', unit: 'm2', quantity: 1.1, price: iva(8) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.08, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.15, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.3, price: iva(85) },
    ],
    notes: 'Incluye curado con membrana y juntas de contracción'
  },
  {
    id: 'APU-IND-002', code: 'IND-002',
    description: 'Estructura metálica nave industrial (cercha)',
    unit: 'kg', category: 'Estructura', typology: Typology.INDUSTRIAL, durationDays: 0.04,
    materials: [
      { name: 'Perfil HSS cuadrado A500', unit: 'kg', quantity: 1.02, price: iva(16) },
      { name: 'Placa de conexión A36 (kg)', unit: 'kg', quantity: 0.08, price: iva(18) },
      { name: 'Electrodo E7018', unit: 'kg', quantity: 0.012, price: iva(45) },
      { name: 'Pintura anticorrosiva epóxica', unit: 'lt', quantity: 0.006, price: iva(55) },
      { name: 'Pintura esmalte acabado', unit: 'lt', quantity: 0.004, price: iva(48) },
    ],
    labor: [
      { role: 'Soldador certificado 6G', unit: 'día', quantity: 0.02, price: iva(325) },
      { role: 'Ayudante soldador', unit: 'día', quantity: 0.02, price: iva(125) },
      { role: 'Operador grúa', unit: 'hora', quantity: 0.05, price: iva(285) },
    ],
  },
  {
    id: 'APU-IND-003', code: 'IND-003',
    description: 'Cubierta lámina termoacústica cal.26 + estructura',
    unit: 'm2', category: 'Cubierta', typology: Typology.INDUSTRIAL, durationDays: 0.3,
    materials: [
      { name: 'Lámina termoacústica cal.26 (m2)', unit: 'm2', quantity: 1.08, price: iva(185) },
      { name: 'Correa metálica C4x1.8 (ml)', unit: 'ml', quantity: 0.85, price: iva(48) },
      { name: 'Tornillo autoperforante 2"', unit: 'un', quantity: 8, price: iva(1.8) },
      { name: 'Sellador poliuretano (cartucho)', unit: 'un', quantity: 0.05, price: iva(65) },
      { name: 'Cumbrera metálica (ml)', unit: 'ml', quantity: 0.08, price: iva(85) },
    ],
    labor: [
      { role: 'Techador especializado', unit: 'día', quantity: 0.15, price: iva(165) },
      { role: 'Ayudante', unit: 'día', quantity: 0.15, price: iva(95) },
    ],
  },
];

// ── CIVIL ─────────────────────────────────────────────────────────────────────
const CIVIL: APUItem[] = [
  {
    id: 'APU-CIV-001', code: 'CIV-001',
    description: 'Excavación mecánica masiva (retroexcavadora)',
    unit: 'm3', category: 'Movimiento de Tierras', typology: Typology.CIVIL, durationDays: 0.05,
    materials: [
      { name: 'Combustible diesel', unit: 'galón', quantity: 0.12, price: iva(32) },
    ],
    labor: [
      { role: 'Operador retroexcavadora', unit: 'hora', quantity: 0.4, price: iva(185) },
      { role: 'Peón', unit: 'día', quantity: 0.05, price: iva(85) },
    ],
  },
  {
    id: 'APU-CIV-002', code: 'CIV-002',
    description: 'Pavimento rígido concreto e=0.15m',
    unit: 'm2', category: 'Pavimento', typology: Typology.CIVIL, durationDays: 0.1,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 1.65, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.08, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.12, price: iva(210) },
      { name: 'Malla electrosoldada 6x6-10/10', unit: 'm2', quantity: 1.05, price: iva(45) },
      { name: 'Membrana polietileno 6 mil', unit: 'm2', quantity: 1.05, price: iva(8) },
      { name: 'Aditivo plastificante', unit: 'lt', quantity: 0.3, price: iva(22) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.05, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.08, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.15, price: iva(85) },
    ],
  },
  {
    id: 'APU-CIV-003', code: 'CIV-003',
    description: 'Cuneta de concreto triangular',
    unit: 'ml', category: 'Drenaje', typology: Typology.CIVIL, durationDays: 0.2,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 0.45, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.022, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.032, price: iva(210) },
      { name: 'Formaleta madera pino', unit: 'm2', quantity: 0.5, price: iva(45) },
    ],
    labor: [
      { role: 'Albañil', unit: 'día', quantity: 0.12, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 0.1, price: iva(85) },
    ],
  },
];

// ── PÚBLICA ───────────────────────────────────────────────────────────────────
const PUBLICA: APUItem[] = [
  {
    id: 'APU-PUB-001', code: 'PUB-001',
    description: 'Aula escolar estructura concreto (módulo 7x8m)',
    unit: 'm2', category: 'Estructura', typology: Typology.PUBLICA, durationDays: 1.5,
    materials: [
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 3.5, price: iva(62) },
      { name: 'Arena de río lavada', unit: 'm3', quantity: 0.18, price: iva(185) },
      { name: 'Grava triturada 3/4"', unit: 'm3', quantity: 0.25, price: iva(210) },
      { name: 'Acero de refuerzo No.4 (1/2")', unit: 'kg', quantity: 22, price: iva(9.5) },
      { name: 'Bloque de pómez No.5', unit: 'un', quantity: 12, price: iva(5.5) },
      { name: 'Formaleta metálica', unit: 'm2', quantity: 2.5, price: iva(85) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.3, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 0.8, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 1.5, price: iva(85) },
    ],
    notes: 'Según normas MINEDUC Guatemala'
  },
  {
    id: 'APU-PUB-002', code: 'PUB-002',
    description: 'Pozo de visita ladrillo tayuyo D=1.20m',
    unit: 'un', category: 'Drenaje', typology: Typology.PUBLICA, durationDays: 3,
    materials: [
      { name: 'Ladrillo tayuyo (un)', unit: 'un', quantity: 850, price: iva(1.8) },
      { name: 'Cemento Portland tipo I', unit: 'saco', quantity: 12, price: iva(62) },
      { name: 'Arena amarilla', unit: 'm3', quantity: 0.8, price: iva(145) },
      { name: 'Brocal y tapa hierro fundido', unit: 'un', quantity: 1, price: iva(1850) },
      { name: 'Escalones hierro fundido', unit: 'un', quantity: 6, price: iva(185) },
    ],
    labor: [
      { role: 'Maestro de obras', unit: 'día', quantity: 0.5, price: iva(185) },
      { role: 'Albañil', unit: 'día', quantity: 2, price: iva(145) },
      { role: 'Peón', unit: 'día', quantity: 3, price: iva(85) },
    ],
  },
];

// ── Export ────────────────────────────────────────────────────────────────────
export const APU_LIBRARY: APUItem[] = [
  ...RESIDENCIAL,
  ...COMERCIAL,
  ...INDUSTRIAL,
  ...CIVIL,
  ...PUBLICA,
];

export const APU_BY_TYPOLOGY: Record<Typology, APUItem[]> = {
  [Typology.RESIDENCIAL]: RESIDENCIAL,
  [Typology.COMERCIAL]:   COMERCIAL,
  [Typology.INDUSTRIAL]:  INDUSTRIAL,
  [Typology.CIVIL]:       CIVIL,
  [Typology.PUBLICA]:     PUBLICA,
};
