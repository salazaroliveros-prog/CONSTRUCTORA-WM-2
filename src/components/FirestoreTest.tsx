import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';
import {
  checkCollections, type CollectionStatus, addDocument, updateDocument,
  deleteDocument, getDocumentsForCollection,
} from '../services/firestoreService';
import { apiFetch, docToObject, objToFirestore } from '../services/firebaseApi';
import {
  CheckCircle2, XCircle, Loader2, Wifi, WifiOff,
  Database, RefreshCw, Activity
} from 'lucide-react';

type Status = 'idle' | 'running' | 'ok' | 'error';

interface TestResult {
  name: string;
  status: Status;
  detail?: string;
  ms?: number;
}

const COLLECTION_LABELS: Record<string, string> = {
  projects:       'Proyectos',
  clients:        'Clientes',
  staff:          'Personal',
  suppliers:      'Proveedores',
  inventory:      'Inventario',
  transactions:   'Transacciones',
  purchaseOrders: 'Órdenes de Compra',
  logs:           'Bitácora de Ejecución',
};

export default function FirestoreTest() {
  const [results, setResults]           = useState<TestResult[]>([]);
  const [running, setRunning]           = useState(false);
  const [collections, setCollections]   = useState<CollectionStatus[]>([]);
  const [loadingCols, setLoadingCols]   = useState(false);
  const [pollLog, setPollLog]           = useState<string[]>([]);
  const [polling, setPolling]           = useState(false);
  const pollRef     = useRef<number | null>(null);
  const testDocRef  = useRef<string | null>(null);

  const update = (name: string, status: Status, detail?: string, ms?: number) => {
    setResults(prev => {
      const idx = prev.findIndex(r => r.name === name);
      const entry = { name, status, detail, ms };
      if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n; }
      return [...prev, entry];
    });
  };

  const loadCollections = async () => {
    if (!auth.currentUser) return;
    setLoadingCols(true);
    try {
      const data = await checkCollections();
      setCollections(data);
    } catch {
      // ignore
    } finally {
      setLoadingCols(false);
    }
  };

  useEffect(() => { loadCollections(); }, []);

  const runTests = async () => {
    if (!auth.currentUser) { alert('Debes iniciar sesión primero'); return; }
    setResults([]);
    setRunning(true);
    const uid = auth.currentUser.uid;
    const testData = {
      ownerId: uid,
      name: '__TEST_DIAGNOSTICO__',
      typology: 'RESIDENCIAL' as const,
      status: 'COTIZACION' as const,
      startDate: new Date().toISOString().split('T')[0],
      items: [] as any[], directCosts: 0, indirectCosts: 0,
      administrativeCosts: 0, personalCosts: 0, progress: 0, budget: 0,
    };

    // 1. ESCRITURA
    update('Escritura (addDoc)', 'running');
    let t = Date.now();
    try {
      const id = await addDocument('projects', testData);
      if (id) {
        testDocRef.current = id;
        update('Escritura (addDoc)', 'ok', `ID: ${id.slice(0, 12)}...`, Date.now() - t);
      } else {
        update('Escritura (addDoc)', 'error', 'No se obtuvo ID');
        setRunning(false);
        return;
      }
    } catch (e: any) {
      update('Escritura (addDoc)', 'error', e.message);
      setRunning(false);
      return;
    }

    // 2. LECTURA
    update('Lectura (GET)', 'running');
    t = Date.now();
    try {
      const result = await apiFetch(`/documents/projects/${testDocRef.current}`);
      const obj = docToObject(result);
      if (obj && obj.id === testDocRef.current) {
        update('Lectura (GET)', 'ok', `doc recibido`, Date.now() - t);
      } else {
        update('Lectura (GET)', 'error', 'doc no coincide');
      }
    } catch (e: any) {
      update('Lectura (GET)', 'error', e.message);
    }

    // 3. MODIFICACIÓN
    update('Modificación (PATCH)', 'running');
    t = Date.now();
    try {
      const fields = objToFirestore({ _test: 'modificado' });
      const mask = Object.keys(fields).join(',');
      await apiFetch(`/documents/projects/${testDocRef.current}?updateMask.fieldPaths=${mask}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
      update('Modificación (PATCH)', 'ok', 'campo _test actualizado', Date.now() - t);
    } catch (e: any) {
      update('Modificación (PATCH)', 'error', e.message);
    }

    // 4. ELIMINACIÓN
    update('Eliminación (DELETE)', 'running');
    t = Date.now();
    try {
      await apiFetch(`/documents/projects/${testDocRef.current}`, { method: 'DELETE' });
      update('Eliminación (DELETE)', 'ok', 'Documento de prueba eliminado', Date.now() - t);
      testDocRef.current = null;
    } catch (e: any) {
      update('Eliminación (DELETE)', 'error', e.message);
    }

    setRunning(false);
    loadCollections();
  };

  const startPollMonitor = async () => {
    if (!auth.currentUser) return;
    if (polling) {
      if (pollRef.current !== null) clearInterval(pollRef.current);
      pollRef.current = null;
      if (testDocRef.current) {
        try { await apiFetch(`/documents/projects/${testDocRef.current}`, { method: 'DELETE' }); } catch { /* ignore */ }
        testDocRef.current = null;
      }
      setPolling(false);
      setPollLog([]);
      return;
    }

    const doc = await addDocument('projects', {
      ownerId: auth.currentUser.uid,
      name: '__MONITOR_TEST__',
      typology: 'RESIDENCIAL', status: 'COTIZACION',
      startDate: new Date().toISOString().split('T')[0],
      items: [], directCosts: 0, indirectCosts: 0,
      administrativeCosts: 0, personalCosts: 0, progress: 0, budget: 0,
      _ping: 0,
    });
    if (!doc) return;
    testDocRef.current = doc;
    setPollLog([`[${new Date().toLocaleTimeString()}] Monitor iniciado — doc: ${doc.slice(0, 8)}...`]);
    setPolling(true);

    const poll = async () => {
      if (!testDocRef.current) return;
      try {
        const result = await apiFetch(`/documents/projects/${testDocRef.current}`);
        const obj = docToObject(result);
        setPollLog(prev => [
          `[${new Date().toLocaleTimeString()}] Ping #${obj._ping ?? 0} recibido`,
          ...prev.slice(0, 9),
        ]);
      } catch { /* ignore */ }
    };

    poll();
    pollRef.current = window.setInterval(poll, 5000);
  };

  const sendPing = async () => {
    if (!testDocRef.current) return;
    try {
      const result = await apiFetch(`/documents/projects/${testDocRef.current}`);
      const obj = docToObject(result);
      const current = obj._ping ?? 0;
      const fields = objToFirestore({ _ping: current + 1 });
      const mask = Object.keys(fields).join(',');
      await apiFetch(`/documents/projects/${testDocRef.current}?updateMask.fieldPaths=${mask}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
    } catch { /* ignore */ }
  };

  useEffect(() => () => {
    if (pollRef.current !== null) clearInterval(pollRef.current);
  }, []);

  const icon = (s: Status) => {
    if (s === 'running') return <Loader2 size={14} className="animate-spin text-blue-500" />;
    if (s === 'ok')      return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (s === 'error')   return <XCircle size={14} className="text-red-500" />;
    return <div className="w-3.5 h-3.5 rounded-full bg-slate-200" />;
  };

  const allCrudOk  = results.length > 0 && results.every(r => r.status === 'ok');
  const allColsOk  = collections.length > 0 && collections.every(c => c.ok);
  const totalDocs  = collections.reduce((s, c) => s + c.count, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h2 className="text-lg font-black text-primary uppercase tracking-tight">Diagnóstico Firestore</h2>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          API REST — {auth.currentUser?.email}
        </p>
      </div>

      {/* Colecciones */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Colecciones de la App
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {collections.length > 0 && (
              <span className="text-[9px] font-bold text-slate-400">
                {totalDocs} docs totales
              </span>
            )}
              <button
              onClick={loadCollections}
              disabled={loadingCols}
              aria-label="Verificar colecciones"
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loadingCols ? 'animate-spin text-blue-500' : 'text-slate-400'} />
            </button>
          </div>
        </div>

        {loadingCols && collections.length === 0 ? (
          <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px] uppercase tracking-widest">Verificando...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {collections.map((col) => (
              <div
                key={col.name}
                className={`flex items-center gap-2.5 p-3 rounded-xl border ${
                  col.ok
                     ? 'bg-emerald-50 border-emerald-100'
                     : 'bg-red-50 border-red-100'
                }`}
              >
                {col.ok
                  ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  : <XCircle size={13} className="text-red-500 shrink-0" />
                }
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-slate-700 truncate">
                    {COLLECTION_LABELS[col.name] ?? col.name}
                  </p>
                  <p className="text-[8px] text-slate-400 font-mono">
                    {col.ok ? `${col.count} docs · ${col.ms}ms` : col.error?.slice(0, 40)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {collections.length > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
            allColsOk
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {allColsOk
              ? <><CheckCircle2 size={12} /> Todas las colecciones accesibles</>
              : <><XCircle size={12} /> Algunas colecciones tienen errores de permisos</>
            }
          </div>
        )}
      </div>

      {/* Test CRUD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Test CRUD Automático</h3>
          </div>
          <button
            onClick={runTests}
            disabled={running}
            className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50 flex items-center gap-2"
          >
            {running && <Loader2 size={12} className="animate-spin" />}
            {running ? 'Ejecutando...' : 'Ejecutar Test'}
          </button>
        </div>

        {results.length === 0 && !running && (
          <p className="text-[9px] text-slate-400 uppercase tracking-widest text-center py-4">
            Presiona "Ejecutar Test" para verificar escritura, lectura y eliminación
          </p>
        )}

        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              {icon(r.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-primary uppercase">{r.name}</p>
                {r.detail && <p className="text-[8px] text-slate-400 font-mono mt-0.5 truncate">{r.detail}</p>}
              </div>
              {r.ms !== undefined && (
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                  r.ms < 500  ? 'bg-emerald-50 text-emerald-600' :
                  r.ms < 1500 ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'
                }`}>
                  {r.ms}ms
                </span>
              )}
            </div>
          ))}
        </div>

        {allCrudOk && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">
            <CheckCircle2 size={12} /> Conexión estable — escritura, lectura y eliminación OK
          </div>
        )}
      </div>

      {/* Monitor polling */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monitor (Polling 5s)</h3>
            </div>
            <p className="text-[8px] text-slate-400 uppercase mt-0.5">Verifica lectura periódica vía REST</p>
          </div>
          <div className="flex gap-2">
            {polling && (
              <button onClick={sendPing} className="px-3 py-2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                Enviar Ping
              </button>
            )}
            <button
              onClick={startPollMonitor}
              className={`px-4 py-2 text-white text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 ${polling ? 'bg-red-500' : 'bg-emerald-600'}`}
            >
              {polling ? <WifiOff size={12} /> : <Wifi size={12} />}
              {polling ? 'Detener' : 'Iniciar Monitor'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[9px] min-h-20 space-y-1">
          {pollLog.length === 0
            ? <p className="text-slate-500">Esperando eventos...</p>
            : pollLog.map((log, i) => (
              <p key={i} className={i === 0 ? 'text-emerald-400' : 'text-slate-500'}>{log}</p>
            ))
          }
        </div>
      </div>
    </div>
  );
}


