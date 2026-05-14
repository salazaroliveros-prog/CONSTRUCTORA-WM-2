/**
 * Sincronización en tiempo real vía Firestore Snapshot Listeners.
 * src/lib/sync/RealtimeSync.ts
 */

import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, getDoc,
} from 'firebase/firestore';
import { db as firestoreDb, auth } from '../../lib/firebase';
import { getDb } from './store';
import { SyncEngine } from './SyncEngine';

/**
 * Suscripción en tiempo real a los cambios del servidor.
 * Cada cambio se refleja inmediatamente en Dexie local.
 */
export function startRealtimeSync(entityTypes: string[]): () => void {
  const unsubscribers: (() => void)[] = [];

  for (const entityType of entityTypes) {
    const q = query(
      collection(firestoreDb, entityType),
      orderBy('_updatedAt', 'desc')
    );

    const unsub = onSnapshot(q, {
      next: async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const data = change.doc.data();

          if (change.type === 'added' || change.type === 'modified') {
            await getDb().localCache.put({
              ...data,
              id: change.doc.id,
              entity: entityType,
            });
          }

          if (change.type === 'removed') {
            try {
              // Dexie: delete por clave primaria compuesta [entity, id]
              const keys = await getDb().localCache
                .where(['entity', 'id'])
                .equals([entityType, change.doc.id])
                .primaryKeys();
              for (const k of keys) {
                await getDb().localCache.delete(k);
              }
            } catch {
              // El doc puede no existir localmente
            }
          }
        }
      },
      error: (error: any) => {
        console.error(`[RealtimeSync] Error en ${entityType}:`, error.message);
      },
    });

    unsubscribers.push(unsub);
  }

  console.log(`[RealtimeSync] Escuchando ${entityTypes.length} colecciones`);

  return () => unsubscribers.forEach((u) => u());
}

/**
 * Escritura optimista: encola para sincronización.
 * La UI actualiza inmediatamente desde la caché local.
 */
export async function optimisticWrite(params: {
  entity: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
}): Promise<void> {
  const engine = SyncEngine.getInstance();
  await engine.enqueue(params.entity, params.operation, params.entityId, params.data);
}

/**
 * Obtener datos sincronizados desde caché local.
 * Funciona tanto en online como en offline.
 */
export async function getLocalData<K = Record<string, unknown>>(
  entity: string,
  entityId: string
): Promise<K | null> {
  // Primero intentar desde Dexie
  const cached = await getDb().localCache
    .where(['entity', 'id'])
    .equals([entity, entityId])
    .first();

  if (cached) return cached as K;

  // Si no hay caché local y estamos online, intentar Firestore
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const snap = await getDoc(doc(firestoreDb, entity, entityId));
      if (snap.exists()) {
        const data = snap.data();
        await getDb().localCache.put({ ...data, id: snap.id, entity });
        return data as K;
      }
    } catch {
      return null;
    }
  }

  return null;
}