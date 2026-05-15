/**
 * Sincronización en tiempo real vía Firestore Snapshot Listeners.
 * src/lib/sync/RealtimeSync.ts
 */

import {
  collection, query, orderBy, onSnapshot, where,
  doc, getDoc, getDocs,
} from 'firebase/firestore';
import { db as firestoreDb, auth, isFirestoreNetworkDisabled, disableFirestoreNetwork, enableFirestoreNetwork } from '../../lib/firebase';
import { getDb } from './store';
import { SyncEngine } from './SyncEngine';

// Polling interval when using manual sync (in ms)
const POLLING_INTERVAL = 30000; // 30 seconds

/**
 * Suscripción en tiempo real a los cambios del servidor.
 * Cada cambio se refleja inmediatamente en Dexie local.
 */
export function startRealtimeSync(entityTypes: string[]): () => void {
  const unsubscribers: (() => void)[] = [];
  let isOffline = false;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  const uid = auth.currentUser?.uid;

  // Guard: must have authenticated user
  if (!uid) {
    console.warn('[RealtimeSync] No authenticated user, skipping realtime sync');
    return () => {};
  }

  // Check if browser is online - use this flag to prevent connection attempts
  const checkOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

  // Handle offline detection to prevent retry spam
  const handleOffline = async () => {
    if (!isOffline) {
      isOffline = true;
      console.log('[RealtimeSync] Offline detected - disabling Firestore network');
      // Disable Firestore network to stop all retry attempts immediately
      try {
        await disableFirestoreNetwork();
      } catch (e) {
        console.error('[RealtimeSync] Failed to disable network:', e);
      }
      unsubscribers.forEach(u => u());
      unsubscribers.length = 0;
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    }
  };

  const handleOnline = async () => {
    if (isOffline) {
      console.log('[RealtimeSync] Connection restored - re-enabling Firestore network and resyncing');
      try {
        await enableFirestoreNetwork();
      } catch (e) {
        console.error('[RealtimeSync] Failed to enable network:', e);
      }
      isOffline = false;
      // Do a full sync when coming back online
      await syncAllCollections();
      // Restart listeners if online
      if (checkOnline() && !isFirestoreNetworkDisabled()) {
        startListeners();
        startPolling();
      }
    }
  };

  const startListeners = () => {
    // Don't start if already offline or Firestore network disabled
    if (isOffline || isFirestoreNetworkDisabled() || !checkOnline()) {
      return;
    }
    for (const entityType of entityTypes) {
      const q = query(
        collection(firestoreDb, entityType),
        where('ownerId', '==', uid),
        orderBy('_updatedAt', 'desc')
      );

      // Wrap onSnapshot to catch connection errors
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
          // Check for offline errors first - these are expected
          const isOfflineError = error.message?.includes('offline') || 
            error.message?.includes('failed to connect') || 
            error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
            error.message?.includes('unavailable');
          
          if (!isOfflineError) {
            console.error(`[RealtimeSync] Error en ${entityType}:`, error.message);
          }
          // On any error, go offline mode
          handleOffline();
        },
      });

      unsubscribers.push(unsub);
    }
  };

  // Manual polling for when realtime sync isn't available
  const syncAllCollections = async () => {
    if (isFirestoreNetworkDisabled() || !checkOnline()) return;
    
    for (const entityType of entityTypes) {
      try {
        const q = query(
          collection(firestoreDb, entityType),
          where('ownerId', '==', uid),
          orderBy('_updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
          await getDb().localCache.put({
            ...doc.data(),
            id: doc.id,
            entity: entityType,
          });
        }
      } catch (e: any) {
        // Ignore offline errors during polling
        if (!e.message?.includes('offline') && !e.message?.includes('failed to connect')) {
          console.error(`[RealtimeSync] Poll error for ${entityType}:`, e);
        }
      }
    }
  };

  const startPolling = () => {
    if (pollingTimer) return;
    pollingTimer = setInterval(() => {
      if (checkOnline() && !isFirestoreNetworkDisabled() && !isOffline) {
        syncAllCollections();
      }
    }, POLLING_INTERVAL);
  };

  // Initial check - if offline, don't even try to start listeners
  const isInitiallyOnline = checkOnline() && !isFirestoreNetworkDisabled();
  if (!isInitiallyOnline) {
    console.log('[RealtimeSync] Offline or network disabled - skipping initial listener start');
    isOffline = true;
  }

  // Initial start only if online
  if (isInitiallyOnline) {
    startListeners();
    startPolling();
  }

  // Listen for connectivity changes
  window.addEventListener('offline', () => handleOffline().catch(console.error));
  window.addEventListener('online', () => handleOnline().catch(console.error));

  console.log(`[RealtimeSync] Escuchando ${entityTypes.length} colecciones`);

  return () => {
    unsubscribers.forEach((u) => u());
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    window.removeEventListener('offline', () => handleOffline());
    window.removeEventListener('online', () => handleOnline());
  };
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