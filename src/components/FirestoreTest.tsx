import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { checkCollections, type CollectionStatus } from '../services/firestoreService';
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
  const [realtimeLog, setRealtimeLog]   = useState<string[]>([]);
  const [listening, setListening]       = useState(false);
  const unsubRef   = useRef<(() => void) | null>(null);
  const testDocRef = useRef<string | null>(null);

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
    const col = collection(db, 'projects');
    const testData = {
      ownerId: uid,
      name: '__TEST_DIAGNOSTICO__',
      typology: 'RESIDENCIAL',
      status: 'COTIZACION',
      startDate: new Date().toISOString().split('T')[0],
      items: [], directCosts: 0, indirectCosts: 0,
      administrativeCosts: 0, personalCosts: 0, progress: 0, budget: 0
    };

    // 1. ESCRITURA
    update('Escritura (addDoc)', 'running');
    let t = Date.now();
    try {
      const ref = await addDoc(col, { ...testData, ts: serverTimestamp() });
      testDocRef.current = ref.id;
      update('Escritura (addDoc)', 'ok', `ID: ${ref.id.slice(0, 12)}...`, Date.now() - t);
    } catch (e: any) {
      update('Escritura (addDoc)', 'error', e.message);
      setRunning(false);
      return;
    }

    // 2. LECTURA en tiempo real
    update('Lectura tiempo real (onSnapshot)', 'running');
    t = Date.now();
    await new Promise<void>((resolve) => {
      const unsub = onSnapshot(doc(db, 'projects', testDocRef.current!), (snap) => {
        if (snap.exists()) {
          update('Lectura tiempo real (onSnapshot)', 'ok', `doc recibido`, Date.now() - t);
          unsub(); resolve();
        }
      }, (err) => {
        update('Lectura tiempo real (onSnapshot)', 'error', err.message);
        unsub(); resolve();
      });
      setTimeout(() => { unsub(); update('Lectura tiempo real (onSnapshot)', 'error', 'Timeout 5s'); resolve(); }, 5000);
    });

    // 3. MODIFICACIÓN
    update('Modificación (updateDoc)', 'running');
    t = Date.now();
    try {
      await updateDoc(doc(db, 'projects', testDocRef.current!), { _test: 'modificado' });
      update('Modificación (updateDoc)', 'ok', 'campo _test actualizado', Date.now() - t);
    } catch (e: any) {
      update('Modificación (updateDoc)', 'error', e.message);
    }

    // 4. ELIMINACIÓN
    update('Eliminación (deleteDoc)', 'running');
    t = Date.now();
    try {
      await deleteDoc(doc(db, 'projects', testDocRef.current!));
      update('Eliminación (deleteDoc)', 'ok', 'Documento de prueba eliminado', Date.now() - t);
      testDocRef.current = null;
    } catch (e: any) {
      update('Eliminación (deleteDoc)', 'error', e.message);
    }

    setRunning(false);
    // Refrescar conteo de colecciones tras el test
    loadCollections();
  };

  const startRealtimeMonitor = async () => {
    if (!auth.currentUser) return;
    if (listening) {
      unsubRef.current?.();
      if (testDocRef.current) {
        try { await deleteDoc(doc(db, 'projects', testDocRef.current)); } catch { /* ignore */ }
        testDocRef.current = null;
      }
      setListening(false);
      setRealtimeLog([]);
      return;
    }
    const ref = await addDoc(collection(db, 'projects'), {
      ownerId: auth.currentUser.uid,
      name: '__MONITOR_TEST__',
      typology: 'RESIDENCIAL', status: 'COTIZACION',
      startDate: new Date().toISOString().split('T')[0],
      items: [], directCosts: 0, indirectCosts: 0,
      administrativeCosts: 0, personalCosts: 0, progress: 0, budget: 0,
      _ping: 0, ts: serverTimestamp()
    });
    testDocRef.current = ref.id;
    setRealtimeLog([`[${new Date().toLocaleTimeString()}] Monitor iniciado — doc: ${ref.id.slice(0, 8)}...`]);
    setListening(true);
    unsubRef.current = onSnapshot(doc(db, 'projects', ref.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setRealtimeLog(prev => [
          `[${new Date().toLocaleTimeString()}] Ping #${d._ping ?? 0} recibido`,
          ...prev.slice(0, 9)
        ]);
      }
    });
  };

  const sendPing = async () => {
    if (!testDocRef.current) return;
    const snap = await new Promise<any>((res) => {
      const u = onSnapshot(doc(db, 'projects', testDocRef.current!), (s) => { u(); res(s.data()); });
    });
    await updateDoc(doc(db, 'projects', testDocRef.current), { _ping: (snap?._ping ?? 0) + 1 });
  };

  useEffect(() => () => { unsubRef.current?.(); }, []);

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
          Conexión · Colecciones · Tiempo real — {auth.currentUser?.email}
        </p>
      </div>

      {/* ── Panel de colecciones ── */}
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

      {/* ── Test CRUD ── */}
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

      {/* ── Monitor tiempo real ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monitor Tiempo Real</h3>
            </div>
            <p className="text-[8px] text-slate-400 uppercase mt-0.5">Verifica sincronización entre dispositivos</p>
          </div>
          <div className="flex gap-2">
            {listening && (
              <button onClick={sendPing} className="px-3 py-2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                Enviar Ping
              </button>
            )}
            <button
              onClick={startRealtimeMonitor}
              className={`px-4 py-2 text-white text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 ${listening ? 'bg-red-500' : 'bg-emerald-600'}`}
            >
              {listening ? <WifiOff size={12} /> : <Wifi size={12} />}
              {listening ? 'Detener' : 'Iniciar Monitor'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[9px] min-h-[80px] space-y-1">
          {realtimeLog.length === 0
            ? <p className="text-slate-500">Esperando eventos...</p>
            : realtimeLog.map((log, i) => (
              <p key={i} className={i === 0 ? 'text-emerald-400' : 'text-slate-500'}>{log}</p>
            ))
          }
        </div>
      </div>
    </div>
  );
}
