/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package,
  CheckCircle2,
  Plus,
  Building2,
  DollarSign,
  Zap,
  Truck,
  ShieldCheck,
  X,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { subscribeToCollection, addDocument, getDocumentsForCollection, deleteDocument, parseError } from '../services/firestoreService';
import { useSettings } from '../contexts/SettingsContext';
import Modal from './ui/Modal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const { settings } = useSettings();
  const [projects, setProjects] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');

  const [accountingForm, setAccountingForm] = useState({
    type: 'Salida' as 'Entrada' | 'Salida',
    quantity: 1,
    cost: 0,
    description: '',
    category: 'Materiales',
    date: new Date().toISOString().split('T')[0]
  });

  const entryCategories = ['Aporte Cliente', 'Anteproyecto', 'Estudios', 'Agrimensura', 'Cuantificación', 'Otros'];
  const exitCategories = ['Materiales', 'Mano de Obra', 'Herramienta y Equipo', 'Sub-contratos', 'Administrativo', 'Personales', 'Hogar'];

  useEffect(() => {
    const unsubProjects = subscribeToCollection('projects', (data) => {
      setProjects(data);
      setLoading(false);
    });
    const unsubInventory = subscribeToCollection('inventory', setInventory);
    const unsubTransactions = subscribeToCollection('transactions', setTransactions);
    
    return () => {
      unsubProjects();
      unsubInventory();
      unsubTransactions();
    };
  }, []);

  const handleAccountingSubmit = async () => {
    try {
      await addDocument('transactions', {
        description: accountingForm.description || 'Registro Contable Directo',
        amount: accountingForm.cost * accountingForm.quantity,
        qty: accountingForm.quantity,
        unitCost: accountingForm.cost,
        type: accountingForm.type === 'Entrada' ? 'INGRESO' : 'GASTO',
        category: accountingForm.category,
        date: accountingForm.date,
        createdAt: new Date().toISOString()
      });
      setIsAccountingModalOpen(false);
      setAccountingForm({
        type: 'Salida',
        quantity: 1,
        cost: 0,
        description: '',
        category: exitCategories[0],
        date: new Date().toISOString().split('T')[0]
      });
      toast.success("Registro contable guardado");
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar contabilidad", { description: parseError(e) });
    }
  };

  const handleSystemReset = async () => {
    if (!window.confirm('¿ESTÁ SEGURO? Esta acción eliminará permanentemente TODOS los datos de proyectos, inventario, transacciones, clientes, proveedores y personal. Esta acción no se puede deshacer.')) return;
    
    const collections = ['projects', 'inventory', 'transactions', 'staff', 'suppliers', 'clients'];
    setLoading(true);
    
    try {
      for (const collName of collections) {
        const docs = await getDocumentsForCollection(collName);
        for (const d of docs) {
          await deleteDocument(collName, d.id);
        }
      }
      toast.success('Sistema reiniciado', { description: 'Todos los datos han sido eliminados' });
    } catch (e) {
      console.error(e);
      toast.error('Error al reiniciar', { description: parseError(e) });
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const executingProjects = projects.filter(p => !['FINALIZADO', 'PAUSADO'].includes(p.status) && p.status === 'EJECUCION');
  const finishedOrPausedProjects = projects.filter(p => ['FINALIZADO', 'PAUSADO'].includes(p.status));
  
  const filteredProjects = selectedProjectId === 'ALL' 
    ? executingProjects 
    : executingProjects.filter(p => p.id === selectedProjectId);

  const totalIncome = transactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netCash = totalIncome - totalExpenses;
  
  const executingBudget = filteredProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const finishedPausedBudget = finishedOrPausedProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  
  const criticalStock = inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length;

  // Pie Chart Data: Expenses by Category
  const expenseByCategory = selectedProjectId !== 'ALL' ? [
    { name: 'Costo Directo', value: filteredProjects.reduce((acc, p) => acc + (p.directCosts || 0), 0) },
    { name: 'Indirectos', value: filteredProjects.reduce((acc, p) => acc + ((p.directCosts || 0) * (p.indirectCosts || 0) / 100), 0) },
    { name: 'Administrativo', value: filteredProjects.reduce((acc, p) => acc + ((p.directCosts || 0) * (p.administrativeCosts || 0) / 100), 0) },
    { name: 'Personal', value: filteredProjects.reduce((acc, p) => acc + ((p.directCosts || 0) * (p.personalCosts || 0) / 100), 0) }
  ].filter(cat => cat.value > 0) : exitCategories.map(cat => ({
    name: cat,
    value: transactions.filter(t => t.type === 'GASTO' && t.category === cat).reduce((acc, t) => acc + (t.amount || 0), 0)
  })).filter(cat => cat.value > 0);

  // Bar Chart Data: Group transactions by date/month
  const chartData = (() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonthIndex = new Date().getMonth();
    
    // Last 3 months for simple visualization
    const lastMonths = [
      (currentMonthIndex - 2 + 12) % 12,
      (currentMonthIndex - 1 + 12) % 12,
      currentMonthIndex
    ];

    return lastMonths.map(monthIdx => {
      const monthTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === monthIdx;
      });

      return {
        name: months[monthIdx],
        ingresos: monthTransactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + (t.amount || 0), 0),
        gastos: monthTransactions.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + (t.amount || 0), 0)
      };
    });
  })();

  const COLORS = [settings.secondaryColor, settings.primaryColor, '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9'];

  const getCardStyle = () => {
    switch (settings.cardStyle) {
      case 'flat': return 'bg-slate-50 border border-slate-100 shadow-none';
      case 'glass': return 'bg-white/40 backdrop-blur-md border border-white/50 shadow-xl';
      case 'bordered': return 'bg-white border-2 border-slate-900 shadow-none';
      case 'elevated':
      default: return 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow';
    }
  };

  const cardClass = getCardStyle();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="dashboard-container" className="grid grid-cols-12 auto-rows-min gap-6 pb-10">
      
      {/* Accounting Modal */}
      <Modal 
        isOpen={isAccountingModalOpen} 
        onClose={() => setIsAccountingModalOpen(false)}
        title="Registro Contable"
      >
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tipo Registro</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Entrada', category: entryCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Entrada' ? "bg-white text-green-600 shadow-sm" : "text-slate-400")}
                >
                  <ArrowDownLeft size={10} className="inline mr-1" />
                  Ingreso (+)
                </button>
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Salida', category: exitCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Salida' ? "bg-white text-red-600 shadow-sm" : "text-slate-400")}
                >
                  <ArrowUpRight size={10} className="inline mr-1" />
                  Gasto (-)
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
              <input 
                type="date"
                value={accountingForm.date}
                onChange={(e) => setAccountingForm({ ...accountingForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Categoría</label>
            <select 
              value={accountingForm.category}
              onChange={(e) => setAccountingForm({ ...accountingForm, category: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
            >
              {(accountingForm.type === 'Entrada' ? entryCategories : exitCategories).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cantidad / Unidades</label>
              <input 
                type="number"
                step="0.01"
                value={accountingForm.quantity || ''}
                onChange={(e) => setAccountingForm({ ...accountingForm, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Costo / Precio Unit. (Q)</label>
              <input 
                type="number"
                step="0.01"
                value={accountingForm.cost || ''}
                onChange={(e) => setAccountingForm({ ...accountingForm, cost: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descripción de la Factura / Movimiento</label>
            <textarea 
              value={accountingForm.description}
              onChange={(e) => setAccountingForm({ ...accountingForm, description: e.target.value })}
              placeholder="Ej: Pago sub-contrato Fase 1, Compra de cemento..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm min-h-[80px]"
            />
          </div>

          <button 
            type="button"
            onClick={handleAccountingSubmit}
            disabled={accountingForm.cost <= 0 || accountingForm.quantity <= 0}
            className="w-full bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 shadow-xl shadow-primary/10"
          >
            Registrar en Contabilidad
          </button>
        </div>
      </Modal>

      {/* Top Filter and KPI Ribbon */}
      <div className="col-span-12 space-y-4">
        {/* Project Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filtro de Visualización</h2>
            <p className="text-sm font-black text-primary uppercase">Métricas de Proyectos en Ejecución</p>
          </div>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
          >
            <option value="ALL">TODOS LOS PROYECTOS</option>
            {executingProjects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Proyectos Activos', value: executingProjects.length, icon: <Zap size={14} />, color: 'bg-blue-500' },
            { label: 'Efectivo Neto', value: `Q${(netCash / 1000).toFixed(1)}k`, icon: <DollarSign size={14} />, color: 'bg-emerald-500' },
            { label: 'Presp. Ejecución', value: `Q${(executingBudget/1000).toFixed(0)}k`, icon: <TrendingUp size={14} />, color: 'bg-secondary' },
            { label: 'Presp. Fin/Pausa', value: `Q${(finishedPausedBudget/1000).toFixed(0)}k`, icon: <CheckCircle2 size={14} />, color: 'bg-slate-400' },
            { label: 'Alertas Stock', value: criticalStock, icon: <ShieldCheck size={14} />, color: 'bg-red-500' },
          ].map((kpi, i) => (
            <div key={i} className={cn(cardClass, "p-3 rounded-xl flex items-center gap-3 group transition-all cursor-default")}>
              <div className={cn("p-2 rounded-lg text-white shadow-lg shrink-0", kpi.color)}>
                {kpi.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{kpi.label}</p>
                <p className="text-base font-black text-primary leading-none truncate">{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Analysis Section */}
      <section className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-1 gap-6">
        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className={cn(cardClass, "rounded-2xl p-6 text-left")}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black text-primary uppercase tracking-tight">Flujo de Caja</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparativa Ingresos vs Gastos</p>
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {settings.graphType === 'bar' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="ingresos" fill={settings.secondaryColor} radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="gastos" fill={settings.primaryColor} radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  ) : settings.graphType === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="ingresos" stroke={settings.secondaryColor} strokeWidth={3} dot={{ r: 4, fill: settings.secondaryColor }} />
                      <Line type="monotone" dataKey="gastos" stroke={settings.primaryColor} strokeWidth={3} dot={{ r: 4, fill: settings.primaryColor }} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="ingresos" stroke={settings.secondaryColor} fill={settings.secondaryColor} fillOpacity={0.1} />
                      <Area type="monotone" dataKey="gastos" stroke={settings.primaryColor} fill={settings.primaryColor} fillOpacity={0.1} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
           </div>

           <div className={cn(cardClass, "rounded-2xl p-6 text-left")}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black text-primary uppercase tracking-tight">Estructura de Gastos</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Distribución por Categoría</p>
                </div>
              </div>
              <div className="h-[200px] w-full flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory.length > 0 ? expenseByCategory : [{ name: 'Sin Datos', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-1/3 space-y-2">
                   {expenseByCategory.slice(0, 4).map((item, i) => (
                     <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[8px] font-black uppercase truncate text-slate-500">{item.name}</span>
                     </div>
                   ))}
                </div>
              </div>
           </div>
        </div>

        {/* Progress Tracker (Real Data) */}
        <div className={cn(cardClass, "rounded-2xl p-6 text-left")}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-black text-primary uppercase tracking-tight">Cronograma de Ejecución</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avance real de proyectos activos</p>
            </div>
            <TrendingUp size={20} className="text-secondary opacity-20" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProjects.length > 0 ? filteredProjects.slice(0, 4).map((p) => (
              <div key={p.id} className="group p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-secondary transition-all">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-tight mb-2">
                  <span className="truncate flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900 group-hover:bg-secondary transition-colors" />
                    {p.name}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[7px] font-black",
                    p.status === 'EJECUCION' ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                  )}>{p.progress || 0}%</span>
                </div>
                <div className="h-3 bg-white rounded-full overflow-hidden relative border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${p.progress || 0}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-slate-900 absolute z-10 rounded-full"
                  />
                  <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                </div>
                <div className="mt-3 flex justify-between text-[8px] font-bold text-slate-400 uppercase italic">
                   <span>ID: {p.id.slice(0, 8)}</span>
                   <span>Cliente: {p.clientName || 'S/N'}</span>
                </div>
              </div>
            )) : (
              <div className="col-span-2 py-12 flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl opacity-40">
                 <Building2 size={24} className="text-slate-300 mb-2" />
                 <p className="text-[8px] font-black uppercase tracking-[0.2em]">Sin Proyectos en Ejecución</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Side Actions / Live Feed */}
      <aside className="col-span-12 lg:col-span-3 space-y-4">
         <div className={cn(cardClass, "rounded-2xl p-6 text-left relative overflow-hidden")}>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Acciones Rápidas</h4>
            <div className="space-y-2">
               <button 
                 onClick={() => setIsAccountingModalOpen(true)}
                 className="w-full flex items-center gap-3 p-4 bg-primary text-white rounded-xl font-black tracking-widest uppercase text-[9px] transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-primary/20"
               >
                 <ArrowUpRight size={14} className="text-secondary" />
                 Registro Contable
               </button>
               {[
                 { label: 'Nueva Cotización', icon: <Plus size={14} />, color: 'bg-slate-100 text-primary' },
                 { label: 'Ver Inventario', icon: <Package size={14} />, color: 'bg-slate-100 text-primary' },
                 { label: 'Reporte de Obra', icon: <Truck size={14} />, color: 'bg-slate-100 text-primary' },
               ].map((action, i) => (
                 <button key={i} className={cn(
                   "w-full flex items-center gap-3 p-3.5 rounded-xl font-black tracking-widest uppercase text-[9px] transition-all hover:scale-[1.02] active:scale-95",
                   action.color
                 )}>
                   {action.icon}
                   {action.label}
                 </button>
               ))}
               <button 
                 onClick={handleSystemReset}
                 className="w-full flex items-center gap-3 p-3.5 rounded-xl font-black tracking-widest uppercase text-[9px] transition-all hover:bg-red-50 text-red-500 mt-2 border border-dashed border-red-200"
               >
                 <RotateCcw size={14} />
                 Reiniciar Sistema (Limpiar Datos)
               </button>
            </div>
         </div>

         <div className="bg-slate-900 rounded-2xl p-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10 text-white"><ShieldCheck size={40} /></div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Estatus Financiero</h4>
            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-[9px] font-black uppercase text-white mb-1">
                     <span>Liquidez</span>
                     <span className="text-secondary">{netCash > 0 ? 'ALTA' : 'CRÍTICA'}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-secondary w-[85%] rounded-full shadow-[0_0_10px_#FBBF24]" />
                  </div>
               </div>
               <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                     <span>Ingresos</span>
                     <span className="text-emerald-400">+ Q{totalIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                     <span>Egresos</span>
                     <span className="text-red-400">- Q{totalExpenses.toLocaleString()}</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-secondary p-5 rounded-2xl text-primary text-left">
            <div className="flex items-center gap-2 mb-3">
               <Zap size={16} className="fill-current" />
               <span className="text-[9px] font-black uppercase tracking-widest">Tip Constructivo</span>
            </div>
            <p className="text-[10px] font-black leading-relaxed uppercase tracking-tight">
              Asegúrate de registrar cada factura inmediatamente para mantener el análisis de rentabilidad actualizado.
            </p>
         </div>
      </aside>

    </div>
  );
}
