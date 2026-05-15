/**
 * Motor principal de sincronizacion offline-first.
 * src/lib/sync/SyncEngine.ts
 *
 * Sincroniza operaciones pendientes con Firestore cuando hay conectividad.
 * Usa el guard isFirestoreNetworkDisabled() para evitar llamadas cuando esta offline.
 */

import {
  writeBatch, doc, getDoc, collection, query, orderBy,
  Timestamp, deleteDoc, setDoc
} from 'firebase/firestore'
import { db as firestoreDb, auth, isFirestoreNetworkDisabled } from '../../lib/firebase'
import { getDb } from './store'
import {
  SyncOperation, SyncStatus, VectorClockEntry, SyncState
} from './types'

// Configuracion
const SYNC_BATCH_SIZE = 50
const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 1000
const HEARTBEAT_MS = 30_000

// Identificador unico de este dispositivo/navegador
function getClientId(): string {
  let cid = localStorage.getItem('_sync_client_id')
  if (!cid) {
    cid = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    localStorage.setItem('_sync_client_id', cid)
  }
  return cid
}

// ─── Vector Clock ────────────────────────────────────────────────────────────

function tickClock(clock: VectorClockEntry): VectorClockEntry {
  const cid = getClientId()
  return { ...clock, [cid]: (clock[cid] || 0) + 1 }
}

/**
 * Compara dos relojes vectoriales.
 * Retorna: 'after' si a es posterior, 'before' si b es posterior,
 *          'concurrent' si son concurrentes (conflicto).
 */
function compareClocks(a: VectorClockEntry, b: VectorClockEntry): 'before' | 'after' | 'concurrent' {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let aGreater = false
  let bGreater = false
  for (const k of keys) {
    const av = a[k] || 0
    const bv = b[k] || 0
    if (av > bv) aGreater = true
    if (bv > av) bGreater = true
  }
  if (aGreater && !bGreater) return 'after'
  if (bGreater && !aGreater) return 'before'
  return 'concurrent'
}

// ─── Deteccion de conectividad ───────────────────────────────────────────────

function checkOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  if (!navigator.onLine) return false
  try {
    const conn = (navigator as any).connection
    if (conn && conn.type === 'none') return false
  } catch { /* ignorar */ }
  return true
}

// ─── Sync Engine ────────────────────────────────────────────────────────────

let _instance: SyncEngine | null = null

export class SyncEngine {
  private online = false
  private syncing = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private listeners: ((state: SyncState) => void)[] = []
  private _destroyed = false

  static getInstance(): SyncEngine {
    if (!_instance) _instance = new SyncEngine()
    return _instance
  }

  static resetInstance(): void {
    _instance?.destroy()
    _instance = null
  }

  async init(): Promise<void> {
    try {
      // Desactivado para estabilidad: await enableIndexedDbPersistence(firestoreDb)
    } catch (e: any) {
      if (e.code === 'failed-precondition') {
        console.warn('[SyncEngine] Persistencia offline ya activa en otra pestaña')
      } else {
        console.warn('[SyncEngine] No se pudo habilitar persistencia offline:', e.message)
      }
    }

    this.online = checkOnline() && !isFirestoreNetworkDisabled()

    window.addEventListener('online', this._onConnect)
    window.addEventListener('offline', this._onDisconnect)

    this._startHeartbeat()

    if (this.online) {
      setTimeout(() => this.sync().catch(console.error), 1000)
    }

    console.log('[SyncEngine] Inicializado', { online: this.online, clientId: getClientId() })
  }

  private _onConnect = (): void => {
    if (isFirestoreNetworkDisabled()) {
      console.log('[SyncEngine] Network disabled, skipping connect')
      return
    }
    this.online = true
    console.log('[SyncEngine] Reconectado')
    this.sync().catch((e) => console.error('[SyncEngine] Sync error:', e))
    this._notify()
  }

  private _onDisconnect = (): void => {
    this.online = false
    console.log('[SyncEngine] Desconectado -> modo offline')
    this._notify()
  }

  private _startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this._destroyed) return
      const wasOnline = this.online
      const nowOnline = checkOnline() && !isFirestoreNetworkDisabled()
      this.online = nowOnline

      if (nowOnline && !wasOnline) {
        this._onConnect()
      } else if (!nowOnline && wasOnline) {
        this._onDisconnect()
      }
      this._notify()
    }, HEARTBEAT_MS)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SYNC PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  async sync(): Promise<void> {
    if (this.syncing || !this.online || isFirestoreNetworkDisabled()) return

    this.syncing = true
    this._notify()

    const localDb = getDb()

    try {
      const pendingOps = await localDb.syncQueue
        .where('status')
        .equals(SyncStatus.PENDING)
        .sortBy('createdAt')

      console.log(`[SyncEngine] ${pendingOps.length} ops pendientes`)

      for (let i = 0; i < pendingOps.length; i += SYNC_BATCH_SIZE) {
        const batch = pendingOps.slice(i, i + SYNC_BATCH_SIZE)
        await this._pushBatch(localDb, batch)
      }

      await this._pull(localDb)
    } catch (error: any) {
      console.error('[SyncEngine] Error de sincronizacion:', error.message || error)
    } finally {
      this.syncing = false
      this._notify()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUSH
  // ═══════════════════════════════════════════════════════════════════════════

  private async _pushBatch(
    localDb: ReturnType<typeof getDb>,
    ops: SyncOperation[]
  ): Promise<void> {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('[SyncEngine] No autenticado')

    // Guard: no intentar si red esta deshabilitada
    if (isFirestoreNetworkDisabled()) {
      console.warn('[SyncEngine] Network disabled, skipping batch push')
      return
    }

    const tasks: (() => Promise<void>)[] = []

    for (const op of ops) {
      await localDb.syncQueue.update(op.id, { status: SyncStatus.IN_FLIGHT })

      const ref = doc(firestoreDb, op.entity, op.entityId)

      tasks.push(async () => {
        try {
          const snap = await getDoc(ref)

          if (snap.exists()) {
            const remoteClock = snap.data()._vectorClock || {}

            if (op.operation !== 'delete') {
              const relation = compareClocks(op.vectorClock, remoteClock)

              if (relation === 'concurrent') {
                await this._resolveConflict(localDb, op, snap)
                return
              }
              if (relation === 'before') {
                await localDb.syncQueue.update(op.id, {
                  status: SyncStatus.STALE,
                  completedAt: Date.now()
                })
                await localDb.localCache.put({
                  ...snap.data(),
                  id: snap.id,
                  entity: op.entity
                })
                return
              }
            }
          }

          const newClock = tickClock(op.vectorClock)

          if (op.operation === 'delete') {
            await deleteDoc(ref)
          } else {
            await setDoc(ref, {
              ...op.payload,
              _vectorClock: newClock,
              _updatedAt: Timestamp.fromMillis(op.clientTimestamp),
              _updatedBy: uid
            }, { merge: true })
          }

          await localDb.syncQueue.update(op.id, {
            status: SyncStatus.CONFIRMED,
            serverTimestamp: Timestamp.now().toMillis()
          })
        } catch (error: any) {
          console.error(`[SyncEngine] Error push ${op.id}:`, error.message || error)
          op.retryCount++
          if (op.retryCount >= op.maxRetries) {
            await localDb.syncQueue.update(op.id, { status: SyncStatus.FAILED })
          } else {
            const delay = BACKOFF_BASE_MS * Math.pow(2, op.retryCount)
            setTimeout(() => this.retry(op.id), delay)
          }
        }
      })
    }

    await Promise.allSettled(tasks.map((fn) => fn()))
    await this.cleanup(localDb)
  }

  async retry(opId: string): Promise<void> {
    if (!this.online || isFirestoreNetworkDisabled()) return
    const localDb = getDb()
    const op = await localDb.syncQueue.get(opId)
    if (!op || op.status === SyncStatus.CONFIRMED || op.status === SyncStatus.STALE) return
    await localDb.syncQueue.update(opId, { status: SyncStatus.PENDING })
    setTimeout(() => this.sync().catch(console.error), 300)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONFLICT RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private async _resolveConflict(
    localDb: ReturnType<typeof getDb>,
    op: SyncOperation,
    serverSnap: any
  ): Promise<void> {
    const serverData = serverSnap.data()
    const localData = op.payload

    const META = new Set(['_vectorClock', '_updatedAt', '_updatedBy', 'id'])
    const merged: Record<string, unknown> = {}
    const unresolved: string[] = []

    const allKeys = new Set([
      ...Object.keys(localData),
      ...Object.keys(serverData)
    ])

    for (const key of allKeys) {
      if (META.has(key)) continue

      const lv = localData[key]
      const sv = serverData[key]

      if (lv === undefined) {
        merged[key] = sv
      } else if (sv === undefined) {
        merged[key] = lv
      } else if (lv === sv) {
        merged[key] = lv
      } else {
        if (typeof lv === 'number' && typeof sv === 'number') {
          merged[key] = lv > sv ? lv : sv
        } else if (typeof lv === 'string' && typeof sv === 'string') {
          merged[key] = lv
        } else if (Array.isArray(lv) && Array.isArray(sv)) {
          merged[key] = this._mergeArrays(lv, sv)
        } else if (
          typeof lv === 'object' && typeof sv === 'object' &&
          lv !== null && sv !== null
        ) {
          merged[key] = { ...sv, ...lv }
        } else {
          merged[key] = sv
          unresolved.push(key)
        }
      }
    }

    const newClock = tickClock(op.vectorClock)
    const ref = doc(firestoreDb, op.entity, op.entityId)

    await setDoc(
      ref,
      {
        ...merged,
        _vectorClock: newClock,
        _resolvedBy: 'auto-merge'
      },
      { merge: true }
    )

    if (unresolved.length > 0) {
      await localDb.conflicts.add({
        ...op,
        conflictData: {
          server: serverData,
          local: localData,
          merged,
          unresolvedFields: unresolved
        }
      })
    }

    await localDb.syncQueue.update(op.id, {
      status: SyncStatus.CONFIRMED,
      serverTimestamp: Timestamp.now().toMillis()
    })
  }

  private _mergeArrays(localArr: any[], remoteArr: any[]): any[] {
    const key = 'id'
    const remoteMap = new Map(remoteArr.map((item: any) => [item[key], item]))
    const result = remoteArr.map((item: any) => ({ ...item }))

    for (const item of localArr) {
      const existingIdx = result.findIndex((r: any) => r[key] === item[key])
      if (existingIdx >= 0) {
        result[existingIdx] = { ...result[existingIdx], ...item }
      } else {
        result.push(item)
      }
    }

    return result
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PULL
  // ═══════════════════════════════════════════════════════════════════════════

  private async _pull(localDb: ReturnType<typeof getDb>): Promise<void> {
    if (isFirestoreNetworkDisabled()) return

    const localDocs = await localDb.localCache.toArray()

    for (const localDoc of localDocs) {
      const entity = (localDoc as any).entity as string
      const id = (localDoc as any).id as string
      if (!entity || !id) continue

      try {
        const ref = doc(firestoreDb, entity, id)
        const snap = await getDoc(ref)

        if (!snap.exists()) continue

        const remoteData = snap.data()
        const remoteClock = remoteData._vectorClock || {}
        const localClock = (localDoc as any)._vectorClock || {}

        const relation = compareClocks(remoteClock, localClock)

        if (relation === 'after') {
          await localDb.localCache.put({
            ...remoteData,
            id: snap.id,
            entity
          })
        }
      } catch {
        /* ignorar errores individuales */
      }
    }

    // Limpiar conflictos resueltos
    const conflicts = await localDb.conflicts.toArray()
    for (const c of conflicts) {
      try {
        const ref = doc(firestoreDb, c.entity, c.entityId)
        const snap = await getDoc(ref)
        if (snap.exists() && !(snap.data()._conflictFields && snap.data()._conflictFields.length > 0)) {
          await localDb.conflicts.delete(c.id)
        }
      } catch {
        /* ignorar */
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  COLA DE OPERACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  async enqueue(
    entity: string,
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (isFirestoreNetworkDisabled()) {
      console.warn('[SyncEngine] Network disabled, only saving to local cache')
    }

    const localDb = getDb()
    const op: SyncOperation = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      entity,
      entityId,
      operation,
      payload,
      vectorClock: { [getClientId()]: 1 },
      clientTimestamp: Date.now(),
      serverTimestamp: null,
      status: SyncStatus.PENDING,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      createdAt: Date.now(),
      completedAt: null,
      conflictData: null
    }

    await localDb.syncQueue.add(op)

    // Actualizar cache local para lectura inmediata
    if (operation === 'delete') {
      const allKeys = await localDb.localCache
        .where(['entity', 'id'])
        .equals([entity, entityId])
        .primaryKeys()
      for (const k of allKeys) {
        await localDb.localCache.delete(k)
      }
    } else {
      await localDb.localCache.put({
        ...payload,
        id: entityId,
        entity,
        updatedAt: Date.now()
      })
    }

    // Trigger sync si estamos online
    if (this.online && !this.syncing && !isFirestoreNetworkDisabled()) {
      setTimeout(() => this.sync().catch(console.error), 500)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  async cleanup(
    localDb?: ReturnType<typeof getDb>
  ): Promise<{ confirmed: number; failed: number; stale: number }> {
    const d = localDb || getDb()
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    const confirmedOps = await d.syncQueue
      .where('status')
      .equals(SyncStatus.CONFIRMED)
      .filter((op: SyncOperation) => op.completedAt != null && op.completedAt < cutoff)
      .toArray()
    for (const op of confirmedOps) {
      await d.syncQueue.delete(op.id)
    }

    const failedOps = await d.syncQueue
      .where('status')
      .equals(SyncStatus.FAILED)
      .toArray()
    for (const op of failedOps) {
      await d.syncQueue.delete(op.id)
    }

    const staleOps = await d.syncQueue.where('status').equals(SyncStatus.STALE).toArray()
    for (const op of staleOps) {
      await d.syncQueue.delete(op.id)
    }

    console.log(
      `[SyncEngine] Cleanup: ${confirmedOps.length} confirmed, ${failedOps.length} failed, ${staleOps.length} stale`
    )
    return { confirmed: confirmedOps.length, failed: failedOps.length, stale: staleOps.length }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ESTADO
  // ═══════════════════════════════════════════════════════════════════════════

  async getState(): Promise<SyncState> {
    const localDb = getDb()
    const [pending, failed, conflicts] = await Promise.all([
      localDb.syncQueue.where('status').equals(SyncStatus.PENDING).count(),
      localDb.syncQueue.where('status').equals(SyncStatus.FAILED).count(),
      localDb.conflicts.count()
    ])
    return {
      isOnline: this.online,
      isSyncing: this.syncing,
      pendingCount: pending,
      failedCount: failed,
      conflictCount: conflicts,
      lastSyncAt: this.listeners.length ? Date.now() : null
    }
  }

  onStateChange(cb: (state: SyncState) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private _notify(): void {
    this.getState().then((s) => this.listeners.forEach((l) => l(s)))
  }

  /** Limpieza completa — cerrar sesion */
  async destroy(): Promise<void> {
    this._destroyed = true
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    window.removeEventListener('online', this._onConnect)
    window.removeEventListener('offline', this._onDisconnect)
    _instance = null
  }
}