import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff, Trash2 } from 'lucide-react';

type Status = 'idle' | 'running' | 'ok' | 'error';

interface TestResult {
  name: string;
  status: Status;
  detail?: string;
  ms?: number;
}

export default function FirestoreTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [realtimeLog, setRealtimeLog] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const testDocRef = useRef<string | null>(null);

  const update = (name: string, status: Status, detail?: string, ms?: number) => {
    setResults(prev => {
      const idx = prev.findIndex(r => r.name === name);
      const entry = { name, status, detail, ms };
      if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n; }
      return [...prev, entry];
    });
  };

  const runTests = async () => {
    if (!auth.currentUser) { alert('Debes iniciar sesión primero'); return; }
    setResults([]);
    setRunning(true);
    const uid = auth.currentUser.uid;
    // Usamos 'projects' que tiene permisos, con datos mínimos válidos
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
      update('Escritura (addDoc)', 'ok', `ID: ${ref.id.slice(0,12)}...`, Date.now() - t);
    } catch (e: any) {
      update('Escritura (addDoc)', 'error', e.message); setRunning(false); return;
    }

    // 2. LECTURA en tiempo real
    update('Lectura tiempo real (onSnapshot)', 'running');
    t = Date.now();
    await new Promise<void>((resolve) => {
      const unsub = onSnapshot(doc(db, '_diagnostico', testDocRef.current!), (snap) => {
        if (snap.exists()) {
          update('Lectura tiempo real (onSnapshot)', 'ok', `valor="${snap.data().valor}"`, Date.now() - t);
          unsub();
          resolve();
        }
      }, (err) => {
        update('Lectura tiempo real (onSnapshot)', 'error', err.message);
        unsub(); resolve();
      });
    });

    // 3. MODIFICACIÓN
    update('Modificación (updateDoc)', 'running');
    t = Date.now();
    try {
      await updateDoc(doc(db, '_diagnostico', testDocRef.current!), { valor: 'test-modificado' });
      update('Modificación (updateDoc)', 'ok', 'valor actualizado a "test-modificado"', Date.now() - t);
    } catch (e: any) {
      update('Modificación (updateDoc)', 'error', e.message);
    }

    // 4. VERIFICAR MODIFICACIÓN
    update('Verificar modificación', 'running');
    t = Date.now();
    await new Promise<void>((resolve) => {
      const unsub = onSnapshot(doc(db, '_diagnostico', testDocRef.current!), (snap) => {
        if (snap.exists() && snap.data().valor === 'test-modificado') {
          update('Verificar modificación', 'ok', 'Cambio reflejado en tiempo real', Date.now() - t);
          unsub(); resolve();
        }
      });
      setTimeout(() => { unsub(); update('Verificar modificación', 'error', 'Timeout 5s'); resolve(); }, 5000);
    });

    // 5. ELIMINACIÓN
    update('Eliminación (deleteDoc)', 'running');
    t = Date.now();
    try {
      await deleteDoc(doc(db, '_diagnostico', testDocRef.current!));
      update('Eliminación (deleteDoc)', 'ok', 'Documento eliminado', Date.now() - t);
      testDocRef.current = null;
    } catch (e: any) {
      update('Eliminación (deleteDoc)', 'error', e.message);
    }

    setRunning(false);
  };

  const startRealtimeMonitor = async () => {
    if (!auth.currentUser) return;
    if (listening) { unsubRef.current?.(); setListening(false); setRealtimeLog([]); return; }

    // Crear doc de prueba compartido
    const ref = await addDoc(collection(db, 'projects'), {
      ownerId: auth.currentUser.uid,
      name: '__MONITOR_TEST__',
      typology: 'RESIDENCIAL', status: 'COTIZACION',
      startDate: new Date().toISOString().split('T')[0],
      items: [], directCosts: 0, indirectCosts: 0,
      administrativeCosts: 0, personalCosts: 0, progress: 0, budget: 0,
      mensaje: 'Monitor activo', ts: serverTimestamp()
    });
    testDocRef.current = ref.id;
    setRealtimeLog([`[${new Date().toLocaleTimeString()}] Monitor iniciado — doc: ${ref.id.slice(0,8)}...`]);
    setListening(true);

    unsubRef.current = onSnapshot(doc(db, '_diagnostico', ref.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setRealtimeLog(prev => [
          `[${new Date().toLocaleTimeString()}] Cambio detectado: mensaje="${d.mensaje}"`,
          ...prev.slice(0, 9)
        ]);
      } else {
        setRealtimeLog(prev => [`[${new Date().toLocaleTimeString()}] Documento eliminado`, ...prev.slice(0, 9)]);
        setListening(false);
      }
    });
  };

  const sendRealtimeChange = async () => {
    if (!testDocRef.current) return;
    await updateDoc(doc(db, '_diagnostico', testDocRef.current), {
      mensaje: `Ping desde dispositivo — ${new Date().toLocaleTimeString()}`
    });
  };

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const icon = (s: Status) => {
    if (s === 'running') return <Loader2 size={14} className="animate-spin text-blue-500" />;
    if (s === 'ok') return <CheckCircle2 size={14} className="text-green-500" />;
    if (s === 'error') return <XCircle size={14} className="text-red-500" />;
    return <div className="w-3.5 h-3.5 rounded-full bg-slate-200" />;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h2 className="text-lg font-black text-primary uppercase tracking-tight">Diagnóstico Firestore</h2>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          Prueba escritura, lectura y tiempo real — usuario: {auth.currentUser?.email}
        </p>
      </div>

      {/* Test automático */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Test Automático CRUD</h3>
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
            Presiona "Ejecutar Test" para iniciar
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
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${r.ms < 500 ? 'bg-green-50 text-green-600' : r.ms < 1500 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                  {r.ms}ms
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Monitor tiempo real multi-dispositivo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monitor Tiempo Real</h3>
            <p className="text-[8px] text-slate-400 uppercase mt-0.5">Abre en otro dispositivo y presiona "Enviar Ping"</p>
          </div>
          <div className="flex gap-2">
            {listening && (
              <button onClick={sendRealtimeChange} className="px-3 py-2 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
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

        <div className="bg-slate-900 rounded-xl p-4 font-mono text-[9px] min-h-[100px] space-y-1">
          {realtimeLog.length === 0
            ? <p className="text-slate-500">Esperando eventos...</p>
            : realtimeLog.map((log, i) => (
              <p key={i} className={i === 0 ? 'text-green-400' : 'text-slate-500'}>{log}</p>
            ))
          }
        </div>
      </div>
    </div>
  );
}
