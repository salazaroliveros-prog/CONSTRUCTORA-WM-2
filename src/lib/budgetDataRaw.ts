import { BudgetLineDocument } from '../models/budget';
import { Typology } from '../models/engineering';

// Necesario para usar Typology como VALUE
const T = Typology;

export const RESIDENCIAL_LINES = [
  {
    id:'res_foundation_001', code:'01-01-001',
    description:'Cimentación - Excavación y Relleno',
    unit:'m³', category:'Cimentación', typology:T.RESIDENCIAL,
    order:1, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:'Excavación manual',unit:'m³',quantity:1,unitPrice:25,wasteFactor:1.05,totalCost:26.25}],
    labor:[{role:'Peón',quantity:0.5,dailyWage:85,totalCost:42.5}],
    equipment:[],
    dailyOutput:5, crewSize:3, durationDays:0,
    children:[],
  },
  {
    id:'res_foundation_002', code:'01-01-002',
    description:"Cimentación - Concreto f'c 210",
    unit:'m³', category:'Cimentación', typology:T.RESIDENCIAL,
    order:2, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:"Concreto f'c 210",unit:'m³',quantity:1,unitPrice:450,wasteFactor:1.03,totalCost:463.5}],
    labor:[{role:'Maestro de obras',quantity:0.3,dailyWage:185,totalCost:55.5},{role:'Albañil',quantity:0.5,dailyWage:145,totalCost:72.5}],
    equipment:[],
    dailyOutput:2, crewSize:3, durationDays:0,
    children:[],
    concreteGrade:"f'c 210 kg/cm²",
  },
  {
    id:'res_foundation_003', code:'01-01-003',
    description:'Cimentación - Acero de Refuerzo No.3',
    unit:'kg', category:'Cimentación', typology:T.RESIDENCIAL,
    order:3, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    materials:[{name:'Acero refuerzo No.3 (3/8")',unit:'kg',quantity:1,unitPrice:9,wasteFactor:1.05,totalCost:9.45}],
    labor:[{role:'Acerista',quantity:0.15,dailyWage:120,totalCost:18}],
    equipment:[],
    dailyOutput:50, crewSize:2, durationDays:0,
    children:[],
  },
  {
    id:'res_columns_001', code:'01-02-001',
    description:"Columnas - Concreto f'c 250",
    unit:'m³', category:'Estructura', typology:T.RESIDENCIAL,
    order:4, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:"Concreto f'c 250",unit:'m³',quantity:1,unitPrice:480,wasteFactor:1.03,totalCost:494.4}],
    labor:[{role:'Maestro de obras',quantity:0.25,dailyWage:185,totalCost:46.25},{role:'Albañil',quantity:0.4,dailyWage:145,totalCost:58}],
    equipment:[],
    dailyOutput:1.5, crewSize:4, durationDays:3,
    children:[],
    concreteGrade:"f'c 250 kg/cm²",
  },
  {
    id:'res_slab_001', code:'01-03-001',
    description:"Losa - Concreto f'c 210",
    unit:'m²', category:'Estructura', typology:T.RESIDENCIAL,
    order:5, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,thickness:0.15},
    materials:[{name:"Concreto f'c 210 losa",unit:'m²',quantity:1,unitPrice:450,wasteFactor:1.03,totalCost:463.5}],
    labor:[{role:'Maestro de obras',quantity:0.2,dailyWage:185,totalCost:37},{role:'Albañil',quantity:0.3,dailyWage:145,totalCost:43.5}],
    equipment:[],
    dailyOutput:8, crewSize:3, durationDays:1,
    children:[],
    concreteGrade:"f'c 210 kg/cm²",
  },
];

export const COMERCIAL_LINES = [
  {
    id:'com_foundation_001', code:'01-01-001',
    description:'Cimentación - Excavación mecánica',
    unit:'m³', category:'Cimentación', typology:T.COMERCIAL,
    order:1, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:'Excavación mecánica',unit:'m³',quantity:1,unitPrice:45,wasteFactor:1.06,totalCost:47.7}],
    labor:[{role:'Operador retroexcavadora',quantity:0.1,dailyWage:185,totalCost:18.5},{role:'Peón',quantity:0.1,dailyWage:85,totalCost:8.5}],
    equipment:[],
    dailyOutput:10, crewSize:2, durationDays:0,
    children:[],
  },
  {
    id:'com_platea_001', code:'01-01-002',
    description:"Platea de cimentación f'c=280 kg/cm² e=0.25m",
    unit:'m²', category:'Cimentación', typology:T.COMERCIAL,
    order:2, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0},
    materials:[{name:"Concreto f'c 280",unit:'m²',quantity:1,unitPrice:520,wasteFactor:1.04,totalCost:540.8}],
    labor:[{role:'Maestro de obras',quantity:0.15,dailyWage:185,totalCost:27.75},{role:'Albañil',quantity:0.3,dailyWage:145,totalCost:43.5},{role:'Peón',quantity:0.6,dailyWage:85,totalCost:51}],
    equipment:[],
    dailyOutput:4, crewSize:4, durationDays:0.5,
    children:[],
    concreteGrade:"f'c 280 kg/cm²",
  },
  {
    id:'com_facade_001', code:'01-04-001',
    description:'Fachada - Muro cortina aluminio + vidrio',
    unit:'m²', category:'Fachada', typology:T.COMERCIAL,
    order:7, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,height:0},
    materials:[{name:'Perfil aluminio serie 50',unit:'kg',quantity:8.5,unitPrice:48,wasteFactor:1.08,totalCost:445.44},{name:'Vidrio templado 6mm',unit:'m²',quantity:0.85,unitPrice:285,wasteFactor:1.08,totalCost:267.75}],
    labor:[{role:'Instalador aluminio y vidrio',quantity:0.5,dailyWage:245,totalCost:122.5}],
    equipment:[],
    dailyOutput:2, crewSize:3, durationDays:1,
    children:[],
  },
];

export const INDUSTRIAL_LINES = [
  {
    id:'ind_foundation_001', code:'01-01-001',
    description:'Cimentación - Excavación Industrial',
    unit:'m³', category:'Cimentación', typology:T.INDUSTRIAL,
    order:1, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:'Excavación mecánica industrial',unit:'m³',quantity:1,unitPrice:35,wasteFactor:1.08,totalCost:37.8}],
    labor:[{role:'Operador retroexcavadora',quantity:0.05,dailyWage:185,totalCost:9.25}],
    equipment:[],
    dailyOutput:15, crewSize:2, durationDays:0,
    children:[],
  },
  {
    id:'ind_platea_001', code:'01-01-002',
    description:"Platea industrial f'c=280 kg/cm² e=0.20m",
    unit:'m²', category:'Cimentación', typology:T.INDUSTRIAL,
    order:2, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0},
    materials:[{name:"Concreto industrial f'c 280",unit:'m²',quantity:1,unitPrice:620,wasteFactor:1.05,totalCost:651}],
    labor:[{role:'Maestro de obras',quantity:0.08,dailyWage:185,totalCost:14.8},{role:'Albañil',quantity:0.15,dailyWage:145,totalCost:21.75},{role:'Peón',quantity:0.3,dailyWage:85,totalCost:25.5}],
    equipment:[],
    dailyOutput:6, crewSize:4, durationDays:0.3,
    children:[],
    concreteGrade:"f'c 280 kg/cm²",
  },
  {
    id:'ind_cubierta_001', code:'01-04-001',
    description:'Cubierta - Lámina termoacústica + estructura',
    unit:'m²', category:'Cubierta', typology:T.INDUSTRIAL,
    order:5, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0},
    materials:[{name:'Lámina termoacústica cal.26',unit:'m²',quantity:1.08,unitPrice:185,wasteFactor:1.07,totalCost:214.2},{name:'Correa metálica C-150',unit:'kg',quantity:0.85,unitPrice:48,wasteFactor:1.07,totalCost:43.56}],
    labor:[{role:'Techador especializado',quantity:0.15,dailyWage:165,totalCost:24.75},{role:'Ayudante',quantity:0.15,dailyWage:95,totalCost:14.25}],
    equipment:[],
    dailyOutput:5, crewSize:3, durationDays:0.3,
    children:[],
  },
];

export const CIVIL_LINES = [
  {
    id:'civ_road_001', code:'01-01-001',
    description:'Carretera - Excavación y Relleno',
    unit:'m³', category:'Movimiento de Tierras', typology:T.CIVIL,
    order:1, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:'Excavación con maquinaria',unit:'m³',quantity:1,unitPrice:45,wasteFactor:1.12,totalCost:50.4}],
    labor:[{role:'Operador retroexcavadora',quantity:0.03,dailyWage:185,totalCost:5.55},{role:'Peón',quantity:0.05,dailyWage:85,totalCost:4.25}],
    equipment:[],
    dailyOutput:30, crewSize:2, durationDays:0.03,
    children:[],
  },
  {
    id:'civ_road_002', code:'01-01-002',
    description:'Carretera - Sub-base Granular',
    unit:'m²', category:'Pavimento', typology:T.CIVIL,
    order:2, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,thickness:0.30},
    materials:[{name:'Material granular sub-base',unit:'m³',quantity:0.3,unitPrice:85,wasteFactor:1.10,totalCost:28.05},{name:'Compactación',unit:'m²',quantity:1,unitPrice:12,wasteFactor:1,totalCost:12}],
    labor:[{role:'Operador vibrocompactador',quantity:0.05,dailyWage:185,totalCost:9.25}],
    equipment:[],
    dailyOutput:20, crewSize:2, durationDays:0.05,
    children:[],
  },
  {
    id:'civ_bridge_001', code:'01-02-001',
    description:"Puente - Pilas de Concreto f'c=400 kg/cm²",
    unit:'m³', category:'Estructuras', typology:T.CIVIL,
    order:4, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:"Concreto f'c 400",unit:'m³',quantity:1,unitPrice:700,wasteFactor:1.06,totalCost:742}],
    labor:[{role:'Maestro de obras',quantity:0.5,dailyWage:185,totalCost:92.5},{role:'Albañil',quantity:0.8,dailyWage:145,totalCost:116}],
    equipment:[],
    dailyOutput:0.5, crewSize:5, durationDays:2,
    children:[],
    concreteGrade:"f'c 400 kg/cm²",
  },
];

export const PUBLICA_LINES = [
  {
    id:'pub_foundation_001', code:'01-01-001',
    description:'Cimentación - Excavación Controlada',
    unit:'m³', category:'Cimentación', typology:T.PUBLICA,
    order:1, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0,height:0},
    materials:[{name:'Excavación controlada',unit:'m³',quantity:1,unitPrice:30,wasteFactor:1.07,totalCost:32.1}],
    labor:[{role:'Peón',quantity:0.6,dailyWage:85,totalCost:51}],
    equipment:[],
    dailyOutput:4, crewSize:3, durationDays:0,
    children:[],
  },
  {
    id:'pub_escuela_001', code:'01-02-001',
    description:'Aula escolar - Estructura concreto (módulo 7x8m)',
    unit:'m²', category:'Estructura', typology:T.PUBLICA,
    order:3, isActive:true, projectQuantity:0, computationType:'dynamic' as const,
    dimensions:{length:0,width:0},
    materials:[{name:"Concreto f'c 280 aulas",unit:'m²',quantity:1,unitPrice:575,wasteFactor:1.04,totalCost:598}],
    labor:[{role:'Maestro de obras',quantity:0.3,dailyWage:185,totalCost:55.5},{role:'Albañil',quantity:0.8,dailyWage:145,totalCost:116},{role:'Peón',quantity:1.5,dailyWage:85,totalCost:127.5}],
    equipment:[],
    dailyOutput:1, crewSize:5, durationDays:1.5,
    children:[],
    concreteGrade:"f'c 280 kg/cm²",
  },
];

export const defaultBudget = [...RESIDENCIAL_LINES, ...COMERCIAL_LINES, ...INDUSTRIAL_LINES, ...CIVIL_LINES, ...PUBLICA_LINES];

export function getBudgetLinesByTypology(typology: string) {
  return defaultBudget.filter(l => !l.typology || String(l.typology) === typology);
}

export function getAvailableTypologies(): string[] {
  return Array.from(new Set(defaultBudget.map(l => String(l.typology)).filter(Boolean)));
}