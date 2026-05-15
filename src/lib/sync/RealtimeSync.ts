/**
 * Sincronizacion en tiempo real via Firestore Snapshot Listeners.
 * src/lib/sync/RealtimeSync.ts
 *
 * ESTRATEGIA ANTISPAM:
 * - unsubscribe listeners + disableNetwork() en offline para detener reconexiones del SDK
 * - enableNetwork() + reconnect manual al volver online
 * - Flag global para bloquear nuevas llamadas durante la transicion
 */

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore'
import { db as firestoreDb, auth, disableFirestoreNetwork, enableFirestoreNetwork } from '../../lib/firebase'
import { getDb } from './store'
import { SyncEngine } from './SyncEngine'

const POLLING_INTERVAL = 30000
const RECONNECT_DELAY_MS = 1500

// Flags globales para control de ciclo de vida
let globalIsOffline = false
let globalShuttingDown = false
let globalListenersActive = false

export function startRealtimeSync(entityTypes: string[]): () => void {
  const unsubscribers: (() => void)[] = []
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  const uid = auth.currentUser?.uid
  let localShuttingDown = false

  if (!uid) {
    console.warn('[RealtimeSync] No authenticated user')
    return () => {}
  }

  const checkOnline = (): boolean => {
    if (typeof navigator === 'undefined') return true
    try {
      if (!navigator.onLine) return false
      const conn = (navigator as any).connection
      if (conn && conn.type === 'none') return false
    } catch { /* ignore */ }
    return true
  }

  const isBlocked = (): boolean => {
    return (
      localShuttingDown ||
      globalShuttingDown ||
      globalIsOffline
    )
  }

  const safeToListen = (): boolean => {
    return !isBlocked() && checkOnline() && !globalListenersActive
  }

  const handleOffline = async (source: string) => {
    if (globalIsOffline) return
    console.log(`[RealtimeSync] Offline detected from ${source}`)

    globalIsOffline = true
    globalShuttingDown = true

    // Unsubscribe todos los listeners locales
    localShuttingDown = true
    const subs = [...unsubscribers]
    unsubscribers.length = 0
    for (const unsub of subs) {
      try { unsub() } catch { /* ignore */ }
    }

    // Stop polling
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    // Detener la red de Firestore para evitar reconexiones del SDK
    await disableFirestoreNetwork()

    globalShuttingDown = false
    localShuttingDown = false

    console.log('[RealtimeSync] All listeners stopped, waiting for reconnect')
  }

  const handleOnline = async () => {
    if (!globalIsOffline) return

    console.log('[RealtimeSync] Online event - checking connectivity...')

    // Delay para asegurar que la red esta realmente activa
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))

    // Verificacion duplicada despues del delay
    if (!checkOnline()) {
      console.log('[RealtimeSync] Still offline after delay, waiting...')
      return
    }

    // Reactivar la red de Firestore
    await enableFirestoreNetwork()

    globalIsOffline = false
    console.log('[RealtimeSync] Confirmed online, syncing...')

    // Leer datos del servidor y actualizar cache
    await syncAllCollections()

    // Reiniciar listeners
    if (safeToListen()) {
      startListeners()
      startPolling()
    }
  }

  const startListeners = () => {
    if (!safeToListen()) {
      console.log('[RealtimeSync] Cannot start listeners', {
        blocked: isBlocked(),
        online: checkOnline(),
        alreadyActive: globalListenersActive
      })
      return
    }

    console.log('[RealtimeSync] Starting listeners for', entityTypes.length, 'collections')

    for (const entityType of entityTypes) {
      const q = query(
        collection(firestoreDb, entityType),
        where('ownerId', '==', uid),
        orderBy('_updatedAt', 'desc')
      )

      let active = true

      const unsub = onSnapshot(
        q,
        {
          next: async (snapshot) => {
            if (!active) return
            if (globalIsOffline) return
            for (const change of snapshot.docChanges()) {
              const data = change.doc.data()
              if (change.type === 'added' || change.type === 'modified') {
                try {
                  await getDb().localCache.put({
                    ...data,
                    id: change.doc.id,
                    entity: entityType
                  })
                } catch (e) {
                  console.error(`[RealtimeSync] Cache write error (${entityType}):`, e)
                }
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

            if (isNetError) {
              console.log(
                `[RealtimeSync] Network error (${entityType}): ${code || msg.substring(0, 80)}`
              )
              handleOffline('listener_error').catch(console.error)
            } else {
              console.error(`[RealtimeSync] Error (${entityType}):`, msg || code)
            }
          }
        }
      )

      unsubscribers.push(unsub)
    }

    globalListenersActive = true

    console.log('[RealtimeSync] Listeners started successfully')
  }

  const syncAllCollections = async () => {
    if (isBlocked() || !checkOnline()) return

    let syncedCount = 0
    let errorCount = 0

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
            syncedCount++
          } catch (e) {
            errorCount++
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

    console.log(`[RealtimeSync] Polled: ${syncedCount} docs, ${errorCount} errors`)
  }

  const startPolling = () => {
    if (pollingTimer) return
    pollingTimer = setInterval(() => {
      if (!isBlocked() && checkOnline()) {
        syncAllCollections()
      }
    }, POLLING_INTERVAL)
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  INICIALIZACION
  // ══════════════════════════════════════════════════════════════════════════

  if (checkOnline() && !isBlocked()) {
    startListeners()
    startPolling()
  } else {
    globalIsOffline = true
    console.log('[RealtimeSync] Starting in offline mode')
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EVENTOS DEL NAVEGADOR
  // ══════════════════════════════════════════════════════════════════════════

  window.addEventListener('offline', () => handleOffline('browser_event').catch(console.error))
  window.addEventListener('online', () => handleOnline().catch(console.error))

  // ══════════════════════════════════════════════════════════════════════════
  //  LIMPIEZA
  // ══════════════════════════════════════════════════════════════════════════

  return () => {
    localShuttingDown = true
    globalListenersActive = false

    unsubscribers.forEach((u) => {
      try { u() } catch { /* ignore */ }
    })
    unsubscribers.length = 0

    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    console.log('[RealtimeSync] Destroyed')
  }
}

export async function optimisticWrite(params: {
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
}): Promise<void> {
  if (globalIsOffline) {
    console.warn('[RealtimeSync] Offline - write queued to local cache only')
    return
  }

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
    !globalIsOffline
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