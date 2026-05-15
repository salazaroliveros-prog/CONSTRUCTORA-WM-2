/**
 * Sincronización en tiempo real vía Firestore Snapshot Listeners.
 * src/lib/sync/RealtimeSync.ts
 */

import {
  collection, query, orderBy, onSnapshot, where,
  doc, getDoc, getDocs,
} from 'firebase/firestore';
import {
  db as firestoreDb, auth,
  isFirestoreNetworkDisabled, isFirestoreTerminated,
  disableFirestoreNetwork, enableFirestoreNetwork
} from '../../lib/firebase';
import { getDb } from './store';
import { SyncEngine } from './SyncEngine';

// Polling interval when using manual sync (in ms)
const POLLING_INTERVAL = 30000; // 30 seconds
// Delay before restarting listeners after coming back online (ms)
const RECONNECT_DELAY_MS = 1000;

// Global lock to prevent multiple concurrent listener initializations
let globalIsShuttingDown = false;

/**
 * Suscripción en tiempo real a los cambios del servidor.
 * Cada cambio se refleja inmediatamente en Dexie local.
 */
export function startRealtimeSync(entityTypes: string[]): () => void {
  const unsubscribers: (() => void)[] = [];
  let isOffline = false;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  const uid = auth.currentUser?.uid;
  let localIsShuttingDown = false;

  // Guard: must have authenticated user
  if (!uid) {
    console.warn('[RealtimeSync] No authenticated user, skipping realtime sync');
    return () => {};
  }

  // Guard: if global shutdown is in progress, don't start
  if (globalIsShuttingDown) {
    console.log('[RealtimeSync] Global shutdown in progress - skipping start');
    return () => {};
  }

  // Check if browser is online
  const checkOnline = (): boolean => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  };

  // Check if we can start listeners (online + not disabled/terminated)
  const canStartListeners = (): boolean => {
    if (localIsShuttingDown || globalIsShuttingDown) return false;
    if (isOffline) return false;
    if (isFirestoreNetworkDisabled()) return false;
    if (isFirestoreTerminated()) return false;
    if (!checkOnline()) return false;
    return true;
  };

  // Handle offline detection to prevent retry spam
  const handleOffline = async () => {
    if (!isOffline) {
      localIsShuttingDown = true;
      isOffline = true;
      console.log('[RealtimeSync] Offline detected - shutting down Firestore connections');

      // Clean up all listeners first
      const unsubs = [...unsubscribers];
      unsubscribers.length = 0;
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }

      // Unsubscribe all listeners
      for (const unsub of unsubs) {
        try { unsub(); } catch { /* ignore */ }
      }

      // Disable Firestore network (will terminate connections)
      await disableFirestoreNetwork();
      localIsShuttingDown = false;
    }
  };

  const handleOnline = async () => {
    if (isOffline) {
      isOffline = false;
      console.log('[RealtimeSync] Connection restored - re-enabling Firestore');

      try {
        await enableFirestoreNetwork();
      } catch (e) {
        console.error('[RealtimeSync] Failed to enable network:', e);
        return;
      }

      // Wait a moment for Firestore to fully reconnect
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));

      // Check again that we're still online after reconnection
      if (checkOnline() && !isFirestoreNetworkDisabled() && !isFirestoreTerminated()) {
        await syncAllCollections();
        if (canStartListeners()) {
          startListeners();
          startPolling();
        }
      }
    }
  };

  const startListeners = () => {
    if (!canStartListeners()) {
      console.log('[RealtimeSync] Cannot start listeners - offline or disabled');
      return;
    }

    console.log('[RealtimeSync] Starting listeners for', entityTypes.length, 'collections');

    for (const entityType of entityTypes) {
      const q = query(
        collection(firestoreDb, entityType),
        where('ownerId', '==', uid),
        orderBy('_updatedAt', 'desc')
      );

      let listenerActive = true;

      const unsub = onSnapshot(q, {
        next: async (snapshot) => {
          if (!listenerActive) return;
          for (const change of snapshot.docChanges()) {
            const data = change.doc.data();

            if (change.type === 'added' || change.type === 'modified') {
              try {
                await getDb().localCache.put({
                  ...data,
                  id: change.doc.id,
                  entity: entityType,
                });
              } catch (e) {
                console.error(`[RealtimeSync] Error saving ${entityType} to cache:`, e);
              }
            }

            if (change.type === 'removed') {
              try {
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
          if (!listenerActive) return;

          const isOfflineError =
            error?.code === 'unavailable' ||
            error?.code === 'failed-precondition' ||
            error?.message?.includes('offline') ||
            error?.message?.includes('failed to connect') ||
            error?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
            error?.message?.includes('The Internet connection appears to be offline') ||
            error?.message?.includes('Network');

          if (!isOfflineError) {
            console.error(`[RealtimeSync] Error en ${entityType}:`, error.message || error);
          }

          // Only go offline if we're not already shutting down
          if (!localIsShuttingDown && !globalIsShuttingDown) {
            handleOffline().catch(console.error);
          }
        },
      });

      unsubscribers.push(unsub);
    }
  };

  // Manual polling for data synchronization
  const syncAllCollections = async () => {
    if (isFirestoreNetworkDisabled() || isFirestoreTerminated() || !checkOnline()) return;

    for (const entityType of entityTypes) {
      try {
        const q = query(
          collection(firestoreDb, entityType),
          where('ownerId', '==', uid),
          orderBy('_updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
          try {
            await getDb().localCache.put({
              ...doc.data(),
              id: doc.id,
              entity: entityType,
            });
          } catch (e) {
            console.error(`[RealtimeSync] Error caching ${entityType}/${doc.id}:`, e);
          }
        }
      } catch (e: any) {
        if (!e?.message?.includes('offline') && !e?.message?.includes('failed to connect') && e?.code !== 'unavailable') {
          console.error(`[RealtimeSync] Poll error for ${entityType}:`, e?.message || e);
        }
      }
    }
  };

  const startPolling = () => {
    if (pollingTimer) return;
    pollingTimer = setInterval(() => {
      if (canStartListeners()) {
        syncAllCollections();
      }
    }, POLLING_INTERVAL);
  };

  // ─── INITIAL START ─────────────────────────────────────────────────────────

  const shouldStartOnline = checkOnline() && !isFirestoreNetworkDisabled() && !isFirestoreTerminated();

  if (shouldStartOnline) {
    startListeners();
    startPolling();
  } else {
    isOffline = true;
    console.log('[RealtimeSync] Offline or network disabled - listeners deferred');
    if (!shouldStartOnline && !isFirestoreNetworkDisabled() && !isFirestoreTerminated()) {
      // We're offline — do an initial sync attempt if it's just navigator saying offline
      syncAllCollections().catch(() => {});
    }
  }

  // ─── CONNECTIVITY EVENTS ──────────────────────────────────────────────────

  const onOffline = () => {
    console.log('[RealtimeSync] Browser offline event');
    handleOffline().catch(console.error);
  };

  const onOnline = () => {
    console.log('[RealtimeSync] Browser online event');
    handleOnline().catch(console.error);
  };

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  console.log(`[RealtimeSync] Initialized for ${entityTypes.length} collections (${shouldStartOnline ? 'online' : 'offline'})`);

  // ─── CLEANUP ───────────────────────────────────────────────────────────────

  return () => {
    localIsShuttingDown = true;
    unsubscribers.forEach((u) => {
      try { u(); } catch { /* ignore */ }
    });
    unsubscribers.length = 0;

    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }

    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);

    console.log('[RealtimeSync] Cleaned up');
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
  try {
    const cached = await getDb().localCache
      .where(['entity', 'id'])
      .equals([entity, entityId])
      .first();

    if (cached) return cached as K;
  } catch { /* ignore — Dexie error */ }

  // Si no hay caché local y estamos online, intentar Firestore
  if (typeof navigator !== 'undefined' && navigator.onLine && !isFirestoreTerminated()) {
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