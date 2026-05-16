/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DataStore Centralizado — Capa de Datos Unificada
 * 
 * REEMPLAZA todas las suscripciones individuales de los módulos.
 * Garantiza una sola fuente de verdad (Single Source of Truth).
 * 
 * Principios:
 * 1. Una suscripción activa por colección de Firestore
 * 2. Estado compartido en memoria (Map<ID, T>)
 * 3. Selectores derivados con memoización
 * 4. Lecturas O(1) por ID
 * 
 * Uso:
 *   const store = useStore();
 *   const projects = store.projects.getAll();
 *   const project = store.projects.getById('project-id');
 *   const filtered = store.transactions.getFiltered(t => t.type === 'GASTO');
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { subscribeToCollection, addDocument as _addDoc, updateDocument as _updateDoc, deleteDocument as _deleteDoc } from '../services/firestoreService';
import { Project, Transaction, WarehouseItem, StaffMember, Supplier, PurchaseOrder, Client, LogEntry } from '../constants';
import { getCachedCollection } from '../services/cacheService';

// ─── Tipos de colección ────────────────────────────────────────────────────────
type CollectionName = 
  | 'projects' 
  | 'transactions' 
  | 'inventory' 
  | 'staff' 
  | 'suppliers' 
  | 'purchaseOrders' 
  | 'clients' 
  | 'logs';

interface CollectionStore<T> {
  items: T[];
  byId: Map<string, T>;
  getById: (id: string) => T | undefined;
  getFiltered: (predicate: (item: T) => boolean) => T[];
  getByProjectId: (projectId: string) => T[];
  isLoading: boolean;
  error: Error | null;
}

// ─── Estado interno por colección ─────────────────────────────────────────────
function createCollectionStore<T>(name: string): CollectionStore<T> {
  const items: T[] = [];
  const byId = new Map<string, T>();

  const store: CollectionStore<T> = {
    items,
    byId,
    getById: (id: string) => byId.get(id),
    getFiltered: (predicate) => items.filter(predicate),
    getByProjectId: (projectId) => items.filter((item: any) => item.projectId === projectId),
    isLoading: true,
    error: null,
  };

  return store;
}

// ─── Estado global del DataStore ──────────────────────────────────────────────
interface DataStoreState {
  projects: CollectionStore<Project>;
  transactions: CollectionStore<Transaction>;
  inventory: CollectionStore<WarehouseItem>;
  staff: CollectionStore<StaffMember>;
  suppliers: CollectionStore<Supplier>;
  purchaseOrders: CollectionStore<PurchaseOrder>;
  clients: CollectionStore<Client>;
  logs: CollectionStore<LogEntry>;
}

const stores = {
  projects: createCollectionStore<Project>('projects'),
  transactions: createCollectionStore<Transaction>('transactions'),
  inventory: createCollectionStore<WarehouseItem>('inventory'),
  staff: createCollectionStore<StaffMember>('staff'),
  suppliers: createCollectionStore<Supplier>('suppliers'),
  purchaseOrders: createCollectionStore<PurchaseOrder>('purchaseOrders'),
  clients: createCollectionStore<Client>('clients'),
  logs: createCollectionStore<LogEntry>('logs'),
};

// ─── Hook principal ───────────────────────────────────────────────────────────
let subscriptionsInitialized = false;
const subscribers: Set<() => void> = new Set();

export function useStore(): DataStoreState {
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Inicializar suscripciones UNA sola vez
  useEffect(() => {
    if (subscriptionsInitialized) return;
    subscriptionsInitialized = true;

    // Seed from cache so UI renders instantly even offline
    for (const [name, store] of Object.entries(stores)) {
      const cached = getCachedCollection(name);
      if (cached && cached.length > 0) {
        (store as any).items = cached.map((d: any) => ({ id: d.id, ...d }));
        (store as any).byId = new Map(cached.map((d: any) => [d.id, { id: d.id, ...d }]));
        (store as any).isLoading = false;
      }
    }
    subscribers.forEach(fn => fn());

    const unsubs: (() => void)[] = [];

    for (const [name, store] of Object.entries(stores)) {
      const unsub = subscribeToCollection(name as CollectionName, (data: any[]) => {
        (store as any).items = data.map((d: any) => ({ id: d.id, ...d }));
        (store as any).byId = new Map(data.map((d: any) => [d.id, { id: d.id, ...d }]));
        (store as any).isLoading = false;
        (store as any).error = null;
        subscribers.forEach(fn => fn());
      });
      unsubs.push(unsub);
    }

    return () => {
      subscriptionsInitialized = false;
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  // Registrar subscriber
  useEffect(() => {
    const update = () => { if (mountedRef.current) forceUpdate(c => c + 1); };
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);

  return stores as DataStoreState;
}

// ─── Hook para acceder a una colección específica ──────────────────────────────
export function useCollection<T>(name: CollectionName): CollectionStore<T> {
  const store = useStore();
  return store[name] as CollectionStore<T>;
}

// ─── Hook para obtener datos filtrados derivados ──────────────────────────────
export function useFiltered<T>(
  collectionName: CollectionName,
  predicate: (item: T) => boolean
): T[] {
  const store = useCollection<T>(collectionName);
  return useMemo(() => store.getFiltered(predicate), [store.items.length, predicate]);
}

// ─── Hook para obtener datos de proyecto específico ────────────────────────────
export function useProjectData(projectId: string) {
  const store = useStore();
  
  return useMemo(() => {
    const project = store.projects.getById(projectId);
    if (!project) return { project: null as Project | null, items: [], transactions: [], inventory: [] };
    
    const items = store.transactions.getByProjectId(projectId);
    const inv = store.inventory.getByProjectId(projectId);
    const logs = store.logs.getByProjectId(projectId);
    
    return { project, items, transactions: items, inventory: inv, logs };
  }, [
    store.projects.byId.size,
    store.transactions.byId.size,
    store.inventory.byId.size,
    projectId,
  ]);
}

// ─── Acciones del store ───────────────────────────────────────────────────────
export async function addDocument(collection: CollectionName, data: any): Promise<string> {
  const id = await _addDoc(collection, data);
  return id;
}

export async function updateDocument(collection: CollectionName, id: string, data: any): Promise<void> {
  await _updateDoc(collection, id, data);
}

export async function deleteDocument(collection: CollectionName, id: string): Promise<void> {
  await _deleteDoc(collection, id);
}

// ─── Derived Computations ────────────────────────────────────────────────────

/** Obtener IDs de proyectos activos */
export function useActiveProjectIds(): Set<string> {
  const projects = useCollection<Project>('projects');
  return useMemo(() => {
    const ids = new Set<string>();
    projects.items.forEach(p => {
      if (p.status === 'EJECUCION') ids.add(p.id);
    });
    return ids;
  }, [projects.items.length]);
}

/** Filtrar datos por proyectos existentes (anti-orphan) */
export function useExistingProjectFilter<T>(data: T[], projectIdField: keyof T): T[] {
  const activeIds = useActiveProjectIds();
  return useMemo(() => {
    if (activeIds.size === 0) return data;
    return data.filter(d => {
      const pid = d[projectIdField] as string | undefined;
      return !pid || activeIds.has(pid);
    });
  }, [data.length, activeIds.size]);
}