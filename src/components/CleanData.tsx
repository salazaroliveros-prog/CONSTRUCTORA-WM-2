/**
 * Componente para limpiar todos los datos de prueba de Firestore.
 * Usar antes de producción.
 */
import React, { useState } from 'react';
import { getDocumentsForCollection, deleteDocument } from '../services/firestoreService';
import { toast } from 'sonner';
import { Trash2, AlertTriangle } from 'lucide-react';

const COLLECTIONS = ['projects', 'clients', 'staff', 'suppliers', 'inventory', 'transactions', 'purchaseOrders', 'logs'];

export default function CleanData() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleClean = async () => {
    if (!window.confirm('⚠️ PELIGRO: Esto eliminará TODOS los datos de la aplicación. ¿Continuar?')) return;
    if (!window.confirm('¿Está completamente seguro? Esta acción NO se puede deshacer.')) return;
    
    setLoading(true);
    setLog([]);
    
    try {
      addLog('🧹 Iniciando limpieza de datos...');
      
      for (const collection of COLLECTIONS) {
        addLog(`📂 Limpiando colección: ${collection}`);
        const docs = await getDocumentsForCollection(collection);
        
        for (const doc of docs) {
          await deleteDocument(collection, doc.id);
        }
        
        addLog(`✅ ${docs.length} documentos eliminados de ${collection}`);
      }
      
      addLog('🎉 ¡Limpieza completada! La aplicación está lista para datos reales.');
      toast.success('Datos limpiados correctamente');
      
    } catch (e: any) {
      const msg = e.message || String(e);
      addLog(`❌ Error: ${msg}`);
      toast.error('Error al limpiar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-2xl border-2 border-dashed border-red-400 shadow-xl text-left space-y-6">
      <div>
        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded flex items-center gap-1">
          <AlertTriangle size={10} /> Zona de peligro
        </span>
        <h2 className="text-xl font-black text-slate-900 uppercase mt-3">Limpiar Datos de Prueba</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
          Elimina todos los datos de: proyectos, clientes, personal, proveedores, inventario y transacciones
        </p>
      </div>

      <button
        onClick={handleClean}
        disabled={loading}
        className="w-full bg-red-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Trash2 size={14} />
        {loading ? 'Limpiando datos...' : 'Limpiar Todos los Datos'}
      </button>

      {log.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4 space-y-1 max-h-64 overflow-y-auto">
          {log.map((line, i) => (
            <p key={i} className={`text-[10px] font-mono ${
              line.startsWith('❌') ? 'text-red-400' : 
              line.startsWith('🎉') ? 'text-emerald-400' : 
              line.startsWith('✅') ? 'text-green-400' :
              'text-slate-300'
            }`}>{line}</p>
          ))}
          {loading && <p className="text-[10px] font-mono text-slate-400 animate-pulse">Procesando...</p>}
        </div>
      )}
    </div>
  );
}