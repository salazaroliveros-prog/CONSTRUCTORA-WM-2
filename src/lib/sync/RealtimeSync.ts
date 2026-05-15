/**
 * Sincronizacion en tiempo real via Firestore Snapshot Listeners.
 * src/lib/sync/RealtimeSync.ts
 *
 * Estrategia antispam:
 * - Verificar isFirestoreNetworkDisabled() antes de TODA operacion
 * - Unsubscribe inmediato en error antes de disableNetwork
 * - Guards dobles (navigator.onLine + isFirestoreNetworkDisabled)
 */

import {
  collection, query, orderBy, onSnapshot, where,
  doc, getDoc, getDocs
} from 'firebase/firestore'
import {
  db as firestoreDb,
  auth,
  isFirestoreNetworkDisabled,
  disableFirestoreNetwork,
  enableFirestoreNetwork
} from '../../lib/firebase'
import { getDb } from './store'
import { SyncEngine } from './SyncEngine'

const POLLING_INTERVAL = 30000
const RECONNECT_DELAY_MS = 1500
let globalListenersActive = false

export function startRealtimeSync(entityTypes: string[]): () => void {
  const unsubscribers: (() => void)[] = []
  let isOffline = false
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  const uid = auth.currentUser?.uid
  let shuttingDown = false

  if (!uid) {
    console.warn('[RealtimeSync] No authenticated user')
    return () => {}
  }

  if (!globalListenersActive) {
    globalListenersActive = true
  }

  const checkOnline = (): boolean => {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  }

  const canStart = (): boolean => {
    if (shuttingDown) return false
    if (isOffline) return false
    if (isFirestoreNetworkDisabled()) return false
    if (!checkOnline()) return false
    return true
  }

  const handleOffline = async () => {
    if (isOffline) return
    shuttingDown = true
    isOffline = true
    console.log('[RealtimeSync] Offline detected - stopping all listeners')

    // 1. Unsubscribe all listeners FIRST
    const subs = [...unsubscribers]
    unsubscribers.length = 0
    for (const unsub of subs) {
      try { unsub() } catch { /* ignore */ }
    }

    // 2. Stop polling
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    // 3. Now disable network
    try {
      await disableFirestoreNetwork()
    } catch (e) {
      console.error('[RealtimeSync] disableNetwork error:', e)
    }

    shuttingDown = false
    globalListenersActive = false
  }

  const handleOnline = async () => {
    if (!isOffline) return
    console.log('[RealtimeSync] Online event detected')
    isOffline = false

    try {
      if (isFirestoreNetworkDisabled()) {
        await enableFirestoreNetwork()
      }
    } catch (e) {
      console.error('[RealtimeSync] enableNetwork error:', e)
      return
    }

    // Wait for Firestore to be ready
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS))

    if (canStart()) {
      await syncAllCollections()
      startListeners()
      startPolling()
      globalListenersActive = true
      console.log('[RealtimeSync] Restarted after reconnect')
    }
  }

  const startListeners = () => {
    if (!canStart()) {
      console.log('[RealtimeSync] Cannot start - offline or disabled')
      return
    }

    // Prevent double-start
    if (unsubscribers.length > 0) {
      console.log('[RealtimeSync] Listeners already active')
      return
    }

    console.log('[RealtimeSync] Starting', entityTypes.length, 'listeners')

    for (const entityType of entityTypes) {
      const q = query(
        collection(firestoreDb, entityType),
        where('ownerId', '==', uid),
        orderBy('_updatedAt', 'desc')
      )

      let active = true

      const unsub = onSnapshot(q, {
        next: async (snapshot) => {
          if (!active) return
          for (const change of snapshot.docChanges()) {
            const data = change.doc.data()
            if (change.type === 'added' || change.type === 'modified') {
              await getDb().localCache.put({
                ...data,
                id: change.doc.id,
                entity: entityType
              })
            }
            if (change.type === 'removed') {
              try {
                const keys = await getDb().localCache
                  .where(['entity', 'id'])
                  .equals([entityType, change.doc.id])
                  .primaryKeys()
                for (const k of keys) {
                  await getDb().localCache.delete(k)
                }
              } catch { /* ignore */ }
            }
          }
        },
        error: (error: any) => {
          if (!active) return

          const msg = error?.message || ''
          const code = error?.code || ''
          const isNetError =
            code === 'unavailable' ||
            code === 'failed-precondition' ||
            msg.includes('offline') ||
            msg.includes('ERR_INTERNET') ||
            msg.includes('Internet connection') ||
            msg.includes('Network')

          if (!isNetError) {
            console.error(`[RealtimeSync] Error (${entityType}):`, msg || code)
          }

          if (!shuttingDown) {
            handleOffline().catch(console.error)
          }
        }
      })

      unsubscribers.push(unsub)
    }
  }

  const syncAllCollections = async () => {
    if (!canStart()) return

    for (const entityType of entityTypes) {
      try {
        const q = query(
          collection(firestoreDb, entityType),
          where('ownerId', '==', uid),
          orderBy('_updatedAt', 'desc')
        )
        const snap = await getDocs(q)
        for (const d of snap.docs) {
          try {
            await getDb().localCache.put({
              ...d.data(),
              id: d.id,
              entity: entityType
            })
          } catch (e) {
            console.error(`[RealtimeSync] Cache error (${entityType}/${d.id}):`, e)
          }
        }
      } catch (e: any) {
        const msg = e?.message || ''
        if (
          e?.code !== 'unavailable' &&
          e?.code !== 'failed-precondition' &&
          !msg.includes('offline') &&
          !msg.includes('ERR_INTERNET')
        ) {
          console.error(`[RealtimeSync] Poll error (${entityType}):`, msg)
        }
      }
    }
  }

  const startPolling = () => {
    if (pollingTimer) return
    pollingTimer = setInterval(() => {
      if (canStart()) {
        syncAllCollections()
      }
    }, POLLING_INTERVAL)
  }

  // INIT
  if (canStart()) {
    startListeners()
    startPolling()
  } else {
    isOffline = true
    console.log('[RealtimeSync] Starting in offline mode')
    syncAllCollections().catch(() => {})
  }

  // EVENTS
  window.addEventListener('offline', () => handleOffline().catch(console.error))
  window.addEventListener('online', () => handleOnline().catch(console.error))

  // CLEANUP
  return () => {
    shuttingDown = true
    unsubscribers.forEach(u => { try { u() } catch { /* ignore */ } })
    unsubscribers.length = 0

    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    globalListenersActive = false
    console.log('[RealtimeSync] Destroyed')
  }
}

export async function optimisticWrite(params: {
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
}): Promise<void> {
  const engine = SyncEngine.getInstance()
  await engine.enqueue(params.entity, params.operation, params.entityId, params.data)
}

export async function getLocalData<K = Record<string, unknown>>(
  entity: string,
  entityId: string
): Promise<K | null> {
  try {
    const cached = await getDb().localCache
      .where(['entity', 'id'])
      .equals([entity, entityId])
      .first()
    if (cached) return cached as K
  } catch { /* ignore */ }

  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine &&
    !isFirestoreNetworkDisabled()
  ) {
    try {
      const snap = await getDoc(doc(firestoreDb, entity, entityId))
      if (snap.exists()) {
        const data = snap.data()
        await getDb().localCache.put({ ...data, id: snap.id, entity })
        return data as K
      }
    } catch {
      return null
    }
  }

  return null
}