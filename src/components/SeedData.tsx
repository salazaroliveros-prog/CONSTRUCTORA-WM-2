/**
 * Componente temporal para cargar datos de prueba en Firestore.
 * ELIMINAR antes de producción.
 */
import React, { useState } from 'react';
import { addDocument } from '../services/firestoreService';
import { toast } from 'sonner';

const today = new Date();
const d = (offsetDays: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().split('T')[0];
};

// ── CLIENTES ──────────────────────────────────────────────
const CLIENTS = [
  { name: 'Familia Rodríguez Méndez', email: 'rodriguez@gmail.com', phone: '5555-1001', address: 'Zona 10, Guatemala City' },
  { name: 'Inversiones Comerciales S.A.', email: 'inv.comerciales@empresa.gt', phone: '2222-3001', address: 'Zona 4, Guatemala City' },
  { name: 'Municipalidad de Mixco', email: 'obras@mixco.gob.gt', phone: '2222-4001', address: 'Mixco, Guatemala' },
  { name: 'Bodega Industrial Norte Ltda.', email: 'gerencia@bodegaindustrial.gt', phone: '5555-2002', address: 'Zona Industrial, Villa Nueva' },
  { name: 'Familia Castillo Pérez', email: 'castillo.perez@hotmail.com', phone: '5555-3003', address: 'San Lucas Sacatepéquez' },
  { name: 'Constructora Aliada S.A.', email: 'proyectos@aliada.gt', phone: '2222-5005', address: 'Zona 13, Guatemala City' },
  { name: 'Clínica Médica Santa Rosa', email: 'admin@clinicasantarosa.gt', phone: '2222-6006', address: 'Antigua Guatemala' },
];

// ── PROVEEDORES ───────────────────────────────────────────
const SUPPLIERS = [
  { name: 'Cementos Progreso', contact: 'Ventas', email: 'ventas@cementosprogreso.com', phone: '2222-1000', category: 'Materiales', rating: 5 },
  { name: 'Ferretería El Constructor', contact: 'Carlos López', email: 'carlos@ferreteria.gt', phone: '5555-4004', category: 'Materiales', rating: 4 },
  { name: 'Aceros de Guatemala', contact: 'Ana Morales', email: 'ana@acerogt.com', phone: '2222-2000', category: 'Materiales', rating: 5 },
  { name: 'Alquiler de Maquinaria GT', contact: 'Pedro Soto', email: 'pedro@maquinariagt.com', phone: '5555-5005', category: 'Maquinaria', rating: 4 },
  { name: 'Eléctrica Nacional', contact: 'Luis Fuentes', email: 'luis@electricanacional.gt', phone: '2222-3000', category: 'Eléctrico', rating: 3 },
  { name: 'Impermeabilizantes del Sur', contact: 'María García', email: 'maria@impermeabilizantes.gt', phone: '5555-6006', category: 'Especialidad', rating: 4 },
];

// ── PERSONAL ──────────────────────────────────────────────
const STAFF = [
  { name: 'Ing. Roberto Alvarado', role: 'Residente de Obra', salary: 12000, documentId: '1234567-8', email: 'r.alvarado@wmconstru.gt', phone: '5555-0001', status: 'Activo' },
  { name: 'Ing. Sandra Morales', role: 'Supervisora de Calidad', salary: 10500, documentId: '2345678-9', email: 's.morales@wmconstru.gt', phone: '5555-0002', status: 'Activo' },
  { name: 'Arq. Diego Fuentes', role: 'Diseñador Arquitectónico', salary: 9000, documentId: '3456789-0', email: 'd.fuentes@wmconstru.gt', phone: '5555-0003', status: 'Activo' },
  { name: 'Maestro Juan Coj', role: 'Maestro de Obra', salary: 6500, documentId: '4567890-1', email: '', phone: '5555-0004', status: 'Activo' },
  { name: 'Maestro Pedro Xol', role: 'Maestro de Obra', salary: 6500, documentId: '5678901-2', email: '', phone: '5555-0005', status: 'Activo' },
  { name: 'Albañil Carlos Toj', role: 'Albañil', salary: 4200, documentId: '6789012-3', email: '', phone: '5555-0006', status: 'Activo' },
  { name: 'Albañil Miguel Caal', role: 'Albañil', salary: 4200, documentId: '7890123-4', email: '', phone: '5555-0007', status: 'Activo' },
  { name: 'Electricista Héctor Batz', role: 'Electricista', salary: 5000, documentId: '8901234-5', email: '', phone: '5555-0008', status: 'Activo' },
  { name: 'Plomero Ernesto Choc', role: 'Plomero', salary: 4800, documentId: '9012345-6', email: '', phone: '5555-0009', status: 'Activo' },
  { name: 'Asistente Laura Ajú', role: 'Asistente Administrativa', salary: 4500, documentId: '0123456-7', email: 'l.aju@wmconstru.gt', phone: '5555-0010', status: 'Activo' },
];

// ── PROYECTOS ─────────────────────────────────────────────
const PROJECTS = [
  // 5 EN EJECUCIÓN
  {
    name: 'Residencia Rodríguez — Zona 15',
    clientName: 'Familia Rodríguez Méndez',
    typology: 'RESIDENCIAL',
    status: 'EJECUCION',
    startDate: d(-90),
    endDate: d(60),
    location: 'Zona 15, Guatemala City',
    progress: 72,
    budget: 850000,
    directCosts: 620000,
    indirectCosts: 8,
    administrativeCosts: 5,
    personalCosts: 12,
    items: [],
  },
  {
    name: 'Centro Comercial Inversiones — Zona 4',
    clientName: 'Inversiones Comerciales S.A.',
    typology: 'COMERCIAL',
    status: 'EJECUCION',
    startDate: d(-120),
    endDate: d(90),
    location: 'Zona 4, Guatemala City',
    progress: 45,
    budget: 2400000,
    directCosts: 1650000,
    indirectCosts: 10,
    administrativeCosts: 6,
    personalCosts: 15,
    items: [],
  },
  {
    name: 'Puente Peatonal Mixco — Km 14',
    clientName: 'Municipalidad de Mixco',
    typology: 'CIVIL',
    status: 'EJECUCION',
    startDate: d(-60),
    endDate: d(120),
    location: 'Km 14, Mixco',
    progress: 28,
    budget: 1200000,
    directCosts: 890000,
    indirectCosts: 12,
    administrativeCosts: 7,
    personalCosts: 10,
    items: [],
  },
  {
    name: 'Bodega Industrial Norte — Fase 2',
    clientName: 'Bodega Industrial Norte Ltda.',
    typology: 'INDUSTRIAL',
    status: 'EJECUCION',
    startDate: d(-45),
    endDate: d(75),
    location: 'Villa Nueva, Zona Industrial',
    progress: 55,
    budget: 680000,
    directCosts: 490000,
    indirectCosts: 9,
    administrativeCosts: 5,
    personalCosts: 11,
    items: [],
  },
  {
    name: 'Casa Castillo — San Lucas',
    clientName: 'Familia Castillo Pérez',
    typology: 'RESIDENCIAL',
    status: 'EJECUCION',
    startDate: d(-30),
    endDate: d(150),
    location: 'San Lucas Sacatepéquez',
    progress: 15,
    budget: 420000,
    directCosts: 310000,
    indirectCosts: 8,
    administrativeCosts: 5,
    personalCosts: 12,
    items: [],
  },
  // 1 EN EVALUACIÓN (COTIZACION)
  {
    name: 'Clínica Médica Santa Rosa — Ampliación',
    clientName: 'Clínica Médica Santa Rosa',
    typology: 'COMERCIAL',
    status: 'COTIZACION',
    startDate: d(30),
    endDate: d(210),
    location: 'Antigua Guatemala',
    progress: 0,
    budget: 950000,
    directCosts: 700000,
    indirectCosts: 10,
    administrativeCosts: 6,
    personalCosts: 13,
    items: [],
  },
  // 2 FINALIZADOS
  {
    name: 'Residencia Aliada — Zona 13',
    clientName: 'Constructora Aliada S.A.',
    typology: 'RESIDENCIAL',
    status: 'FINALIZADO',
    startDate: d(-365),
    endDate: d(-30),
    location: 'Zona 13, Guatemala City',
    progress: 100,
    budget: 560000,
    directCosts: 410000,
    indirectCosts: 8,
    administrativeCosts: 5,
    personalCosts: 10,
    items: [],
  },
  {
    name: 'Parque Municipal Mixco — Remodelación',
    clientName: 'Municipalidad de Mixco',
    typology: 'PUBLICA',
    status: 'FINALIZADO',
    startDate: d(-300),
    endDate: d(-60),
    location: 'Mixco, Guatemala',
    progress: 100,
    budget: 380000,
    directCosts: 275000,
    indirectCosts: 9,
    administrativeCosts: 5,
    personalCosts: 8,
    items: [],
  },
  // 1 PAUSADO
  {
    name: 'Torre Oficinas Zona 10 — Fase 1',
    clientName: 'Inversiones Comerciales S.A.',
    typology: 'COMERCIAL',
    status: 'PAUSADO',
    startDate: d(-200),
    endDate: d(180),
    location: 'Zona 10, Guatemala City',
    progress: 38,
    budget: 3200000,
    directCosts: 2100000,
    indirectCosts: 12,
    administrativeCosts: 8,
    personalCosts: 15,
    items: [],
  },
];

// ── INVENTARIO ────────────────────────────────────────────
const INVENTORY = [
  { name: 'Cemento UGC 4000 PSI (saco 42.5kg)', cat: 'Materiales', stock: 320, unit: 'sacos', location: 'Bodega A-1', minStock: 50 },
  { name: 'Block 15x20x40 cm', cat: 'Materiales', stock: 4800, unit: 'unidades', location: 'Bodega A-2', minStock: 500 },
  { name: 'Hierro 3/8" corrugado (varilla 6m)', cat: 'Materiales', stock: 180, unit: 'varillas', location: 'Bodega B-1', minStock: 30 },
  { name: 'Hierro 1/2" corrugado (varilla 6m)', cat: 'Materiales', stock: 95, unit: 'varillas', location: 'Bodega B-1', minStock: 20 },
  { name: 'Hierro 1/4" liso (varilla 6m)', cat: 'Materiales', stock: 12, unit: 'varillas', location: 'Bodega B-1', minStock: 20 },  // stock crítico
  { name: 'Arena de río (m³)', cat: 'Materiales', stock: 45, unit: 'm³', location: 'Patio exterior', minStock: 10 },
  { name: 'Piedrín 3/4" (m³)', cat: 'Materiales', stock: 38, unit: 'm³', location: 'Patio exterior', minStock: 10 },
  { name: 'Tabla de pino 1"x10"x10\' (unidad)', cat: 'Materiales', stock: 210, unit: 'unidades', location: 'Bodega C-1', minStock: 30 },
  { name: 'Clavo 3" (libra)', cat: 'Materiales', stock: 85, unit: 'libras', location: 'Bodega C-2', minStock: 20 },
  { name: 'Alambre de amarre (rollo 25kg)', cat: 'Materiales', stock: 8, unit: 'rollos', location: 'Bodega B-2', minStock: 5 },
  { name: 'Impermeabilizante Sika (cubeta 19L)', cat: 'Materiales', stock: 3, unit: 'cubetas', location: 'Bodega D-1', minStock: 5 }, // stock crítico
  { name: 'Azulejo 30x30 beige (caja)', cat: 'Materiales', stock: 120, unit: 'cajas', location: 'Bodega D-2', minStock: 20 },
  { name: 'Pintura blanca interior (cubeta 19L)', cat: 'Materiales', stock: 22, unit: 'cubetas', location: 'Bodega D-3', minStock: 8 },
  { name: 'Mezcladora de concreto 1 saco', cat: 'Herramientas', stock: 3, unit: 'unidades', location: 'Taller', minStock: 1 },
  { name: 'Vibrador de concreto eléctrico', cat: 'Herramientas', stock: 2, unit: 'unidades', location: 'Taller', minStock: 1 },
  { name: 'Andamio tubular (módulo)', cat: 'Herramientas', stock: 24, unit: 'módulos', location: 'Patio exterior', minStock: 8 },
  { name: 'Casco de seguridad', cat: 'EPP', stock: 18, unit: 'unidades', location: 'Oficina', minStock: 10 },
  { name: 'Chaleco reflectivo', cat: 'EPP', stock: 15, unit: 'unidades', location: 'Oficina', minStock: 10 },
  { name: 'Guantes de trabajo (par)', cat: 'EPP', stock: 4, unit: 'pares', location: 'Oficina', minStock: 10 }, // stock crítico
  { name: 'Botas de hule punta de acero', cat: 'EPP', stock: 6, unit: 'pares', location: 'Oficina', minStock: 8 }, // stock crítico
];

// ── TRANSACCIONES ─────────────────────────────────────────
const TRANSACTIONS = [
  // INGRESOS — anticipos y pagos de clientes
  { date: d(-85), type: 'INGRESO', category: 'Aporte Cliente', description: 'Anticipo 30% — Residencia Rodríguez Zona 15', amount: 255000 },
  { date: d(-50), type: 'INGRESO', category: 'Aporte Cliente', description: 'Pago avance 50% — Residencia Rodríguez Zona 15', amount: 170000 },
  { date: d(-115), type: 'INGRESO', category: 'Aporte Cliente', description: 'Anticipo 25% — Centro Comercial Inversiones Zona 4', amount: 600000 },
  { date: d(-70), type: 'INGRESO', category: 'Aporte Cliente', description: 'Pago avance 40% — Centro Comercial Inversiones Zona 4', amount: 480000 },
  { date: d(-55), type: 'INGRESO', category: 'Aporte Cliente', description: 'Anticipo 30% — Puente Peatonal Mixco', amount: 360000 },
  { date: d(-40), type: 'INGRESO', category: 'Aporte Cliente', description: 'Anticipo 35% — Bodega Industrial Norte Fase 2', amount: 238000 },
  { date: d(-25), type: 'INGRESO', category: 'Aporte Cliente', description: 'Anticipo 30% — Casa Castillo San Lucas', amount: 126000 },
  { date: d(-35), type: 'INGRESO', category: 'Anteproyecto', description: 'Pago diseño arquitectónico — Clínica Santa Rosa', amount: 45000 },
  { date: d(-28), type: 'INGRESO', category: 'Estudios', description: 'Estudio de suelos — Clínica Santa Rosa', amount: 18000 },
  { date: d(-32), type: 'INGRESO', category: 'Aporte Cliente', description: 'Liquidación final — Residencia Aliada Zona 13', amount: 150000 },
  { date: d(-62), type: 'INGRESO', category: 'Aporte Cliente', description: 'Liquidación final — Parque Municipal Mixco', amount: 95000 },

  // GASTOS — materiales
  { date: d(-88), type: 'GASTO', category: 'Materiales', description: 'Compra cemento 500 sacos — Cementos Progreso', amount: 62500 },
  { date: d(-75), type: 'GASTO', category: 'Materiales', description: 'Hierro corrugado 3/8" y 1/2" — Aceros de Guatemala', amount: 48000 },
  { date: d(-60), type: 'GASTO', category: 'Materiales', description: 'Block 15x20x40 — 8,000 unidades — Ferretería El Constructor', amount: 32000 },
  { date: d(-55), type: 'GASTO', category: 'Materiales', description: 'Arena y piedrín 60m³ — Proveedor local', amount: 18000 },
  { date: d(-45), type: 'GASTO', category: 'Materiales', description: 'Tabla de pino y clavos — Ferretería El Constructor', amount: 14500 },
  { date: d(-38), type: 'GASTO', category: 'Materiales', description: 'Impermeabilizante Sika 20 cubetas — Impermeabilizantes del Sur', amount: 9800 },
  { date: d(-30), type: 'GASTO', category: 'Materiales', description: 'Azulejo y cerámica — Ferretería El Constructor', amount: 22000 },
  { date: d(-20), type: 'GASTO', category: 'Materiales', description: 'Pintura interior y exterior — Ferretería El Constructor', amount: 11200 },
  { date: d(-15), type: 'GASTO', category: 'Materiales', description: 'Cemento 300 sacos — Cementos Progreso', amount: 37500 },
  { date: d(-10), type: 'GASTO', category: 'Materiales', description: 'Hierro 1/2" 80 varillas — Aceros de Guatemala', amount: 19200 },

  // GASTOS — mano de obra
  { date: d(-90), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q1)', amount: 28400 },
  { date: d(-75), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q2)', amount: 28400 },
  { date: d(-60), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q3)', amount: 28400 },
  { date: d(-45), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q4)', amount: 28400 },
  { date: d(-30), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q5)', amount: 28400 },
  { date: d(-15), type: 'GASTO', category: 'Mano de Obra', description: 'Planilla quincenal — Maestros y albañiles (Q6)', amount: 28400 },

  // GASTOS — sub-contratos
  { date: d(-80), type: 'GASTO', category: 'Sub-contratos', description: 'Sub-contrato instalación eléctrica — Eléctrica Nacional', amount: 85000 },
  { date: d(-50), type: 'GASTO', category: 'Sub-contratos', description: 'Sub-contrato plomería y drenajes — Plomería Especializada GT', amount: 62000 },
  { date: d(-35), type: 'GASTO', category: 'Sub-contratos', description: 'Sub-contrato estructura metálica — Metálica Industrial', amount: 145000 },
  { date: d(-20), type: 'GASTO', category: 'Sub-contratos', description: 'Sub-contrato acabados finos — Acabados Premium GT', amount: 48000 },

  // GASTOS — herramienta y equipo
  { date: d(-85), type: 'GASTO', category: 'Herramienta y Equipo', description: 'Alquiler mezcladora y vibrador — Alquiler Maquinaria GT', amount: 12000 },
  { date: d(-55), type: 'GASTO', category: 'Herramienta y Equipo', description: 'Alquiler andamios 30 módulos — Alquiler Maquinaria GT', amount: 9000 },
  { date: d(-25), type: 'GASTO', category: 'Herramienta y Equipo', description: 'Compra EPP — cascos, chalecos, guantes', amount: 4800 },

  // GASTOS — administrativo
  { date: d(-90), type: 'GASTO', category: 'Administrativo', description: 'Licencias municipales y permisos de construcción', amount: 18500 },
  { date: d(-60), type: 'GASTO', category: 'Administrativo', description: 'Seguro de obra — 3 proyectos activos', amount: 22000 },
  { date: d(-30), type: 'GASTO', category: 'Administrativo', description: 'Servicios contables y legales — Mes', amount: 8500 },
  { date: d(-15), type: 'GASTO', category: 'Administrativo', description: 'Combustible y transporte — Mes', amount: 6200 },

  // GASTOS — personales (planilla administrativa)
  { date: d(-90), type: 'GASTO', category: 'Personales', description: 'Planilla administrativa — Ing. Alvarado + Ing. Morales + Arq. Fuentes', amount: 31500 },
  { date: d(-60), type: 'GASTO', category: 'Personales', description: 'Planilla administrativa — Mes 2', amount: 31500 },
  { date: d(-30), type: 'GASTO', category: 'Personales', description: 'Planilla administrativa — Mes 3', amount: 31500 },
  { date: d(-15), type: 'GASTO', category: 'Personales', description: 'Bono incentivo — Equipo técnico', amount: 9000 },
];

async function seedAll(onProgress: (msg: string) => void) {
  const { auth } = await import('../lib/firebase');
  if (!auth.currentUser) throw new Error('No hay usuario autenticado. Inicia sesión primero.');

  onProgress(`Usuario: ${auth.currentUser.email}`);

  for (const c of CLIENTS) {
    await addDocument('clients', c);
  }
  onProgress(`✓ ${CLIENTS.length} clientes insertados`);

  for (const s of SUPPLIERS) {
    await addDocument('suppliers', s);
  }
  onProgress(`✓ ${SUPPLIERS.length} proveedores insertados`);

  for (const s of STAFF) {
    await addDocument('staff', s);
  }
  onProgress(`✓ ${STAFF.length} empleados insertados`);

  for (const p of PROJECTS) {
    await addDocument('projects', p);
  }
  onProgress(`✓ ${PROJECTS.length} proyectos insertados`);

  for (const item of INVENTORY) {
    await addDocument('inventory', { ...item, lastEntry: d(-5), history: [] });
  }
  onProgress(`✓ ${INVENTORY.length} items de inventario insertados`);

  for (const t of TRANSACTIONS) {
    await addDocument('transactions', { ...t, qty: 1, unitCost: t.amount });
  }
  onProgress(`✓ ${TRANSACTIONS.length} transacciones insertadas`);

  onProgress('🎉 ¡Listo! Recarga la app para ver los datos.');
}

export default function SeedData() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleSeed = async () => {
    if (!window.confirm('¿Cargar datos de prueba? Esto agregará registros a Firestore.')) return;
    setLoading(true);
    setError('');
    setLog([]);
    try {
      await seedAll(addLog);
      toast.success('Datos de prueba cargados correctamente');
    } catch (e: any) {
      const msg = e.message || String(e);
      setError(msg);
      addLog(`❌ Error: ${msg}`);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-2xl border-2 border-dashed border-amber-400 shadow-xl text-left space-y-6">
      <div>
        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded">⚠ Solo desarrollo — eliminar antes de producción</span>
        <h2 className="text-xl font-black text-slate-900 uppercase mt-3">Cargar Datos de Prueba</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
          {PROJECTS.length} proyectos · {CLIENTS.length} clientes · {STAFF.length} empleados · {INVENTORY.length} materiales · {TRANSACTIONS.length} transacciones
        </p>
      </div>

      <button
        onClick={handleSeed}
        disabled={loading}
        className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 disabled:opacity-50 transition-all"
      >
        {loading ? 'Insertando datos...' : 'Insertar Datos de Prueba'}
      </button>

      {log.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 space-y-1 max-h-64 overflow-y-auto">
          {log.map((line, i) => (
            <p key={i} className={`text-[10px] font-mono ${line.startsWith('❌') ? 'text-red-400' : line.startsWith('🎉') ? 'text-amber-400' : 'text-emerald-400'}`}>{line}</p>
          ))}
          {loading && <p className="text-[10px] font-mono text-slate-400 animate-pulse">Procesando...</p>}
        </div>
      )}
    </div>
  );
}
