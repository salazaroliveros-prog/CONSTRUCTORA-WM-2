import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
  serverTimestamp,
  getDoc,
  FirestoreError,
  getDocs
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { SyncEngine } from '../lib/sync/SyncEngine'

export const parseError = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message)
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          return 'Permisos insuficientes para realizar esta operación'
        }
        return parsed.error
      }
    } catch {
      return error.message
    }
  }
  return String(error)
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

interface FirestoreErrorInfo {
  error: string
  operationType: OperationType
  path: string | null
  authInfo: any
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  throwOnError: boolean = true
): string {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified
    },
    operationType,
    path
  }
  const msg = JSON.stringify(errInfo)
  console.error('Firestore Error:', msg)
  if (throwOnError) {
    throw new Error(msg)
  }
  return msg
}

/** Verifica si un error es de red/offline para decidir si se debe reintentar. */
function isRetryableError(error: any): boolean {
  if (!error) return false
  const code = error?.code || ''
  const msg = (error?.message || '').toLowerCase()
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    msg.includes('offline') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('network')
  )
}

export const getDocumentsForCollection = async (
  collectionName: string
): Promise<any[]> => {
  if (!auth.currentUser) return []
  try {
    const q = query(
      collection(db, collectionName),
      where('ownerId', '==', auth.currentUser.uid)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(
      `[firestoreService] Error fetching ${collectionName}:`,
      error?.message || error
    )
    return []
  }
}

export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[]) => void
) => {
  if (!auth.currentUser) return () => {}

  const q = query(
    collection(db, collectionName),
    where('ownerId', '==', auth.currentUser.uid)
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      callback(data)
    },
    (error: FirestoreError) => {
      if (isRetryableError(error)) {
        console.log(
          '[firestoreService] Offline/network error for subscription:',
          collectionName
        )
        return
      }
      console.error(
        '[firestoreService] Non-retryable subscription error:',
        error?.message || error
      )
    }
  )
}

const sanitize = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)])
    )
  }
  return obj
}

export const addDocument = async (
  collectionName: string,
  data: any
): Promise<string | null> => {
  if (!auth.currentUser) throw new Error('Not authenticated')
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...sanitize(data),
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName)
    return null
  }
}

/**
 * Actualiza un documento y, si el estado cambia a EJECUCION,
 * genera automáticamente el inventario desde el presupuesto.
 */
export const updateDocument = async (
  collectionName: string,
  id: string,
  data: any
): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not authenticated')
  try {
    const docRef = doc(db, collectionName, id)
    const newData = { ...sanitize(data), updatedAt: serverTimestamp() }

    if (collectionName === 'projects' && data.status === 'EJECUCION') {
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const currentData = snap.data()
        if (currentData.status !== 'EJECUCION') {
          await updateDoc(docRef, newData)
          await generateProjectStock({ id, ...currentData, ...data } as any)
          return
        }
      }
    }

    await updateDoc(docRef, newData)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`)
  }
}

/** Cargar configuración del usuario desde Firestore. Retorna null si no existe o hay error. */
export const loadUserSettings = async (
  uid: string
): Promise<Record<string, unknown> | null> => {
  try {
    const snap = await getDoc(doc(db, 'userSettings', uid))
    return snap.exists() ? snap.data() : null
  } catch {
    return null
  }
}

/** Guardar/actualizar configuración del usuario. Retorna true si tuvo éxito. */
export const saveUserSettings = async (
  uid: string,
  data: Record<string, unknown>
): Promise<boolean> => {
  try {
    await setDoc(doc(db, 'userSettings', uid), sanitize(data), { merge: true })
    return true
  } catch (error) {
    console.error('[firestoreService] Error saving user settings:', error)
    return false
  }
}

/**
 * Verifica si un valor ya existe en una colección (excluyendo un documento opcional).
 */
export const checkUniqueField = async (
  collectionName: string,
  field: string,
  value: string | number,
  excludeId?: string
): Promise<boolean> => {
  if (!auth.currentUser) return false
  try {
    const q = query(
      collection(db, collectionName),
      where('ownerId', '==', auth.currentUser.uid),
      where(field, '==', value)
    )
    const snapshot = await getDocs(q)
    if (excludeId) {
      return snapshot.docs.some((d) => d.id !== excludeId)
    }
    return snapshot.docs.length > 0
  } catch {
    return false
  }
}

/**
 * Escritura con soporte offline-first.
 * Escribe en Firestore si está online, y encola en SyncEngine para sincronización offline.
 */
export const writeWithOfflineQueue = async (
  collectionName: string,
  docId: string,
  data: any,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not authenticated')

  const sanitized = sanitize(data)

  if (!isRetryableError({ code: 'offline_check' })) {
    try {
      const docRef = doc(db, collectionName, docId)

      if (operation === 'delete') {
        await deleteDoc(docRef)
      } else if (operation === 'create') {
        await addDoc(collection(db, collectionName), {
          ...sanitized,
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      } else {
        await updateDoc(docRef, {
          ...sanitized,
          updatedAt: serverTimestamp()
        })
      }
    } catch (error: any) {
      if (isRetryableError(error)) {
        console.warn(
          `[firestoreService] Escritura offline detectada, encolando: ${collectionName}/${docId}`
        )
      } else {
        console.error(
          `[firestoreService] Escritura fallida (${collectionName}/${docId}):`,
          error?.message || error
        )
      }
    }
  }

  try {
    const engine = SyncEngine.getInstance()
    await engine.enqueue(collectionName, operation, docId, sanitized)
  } catch (error: any) {
    console.error(
      '[firestoreService] Error enqueuing sync operation:',
      error?.message || error
    )
  }
}

export const deleteDocument = async (
  collectionName: string,
  id: string
): Promise<boolean> => {
  if (!auth.currentUser) return false
  try {
    await deleteDoc(doc(db, collectionName, id))
    return true
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`)
    return false
  }
}

/** All collections required by the app */
export const REQUIRED_COLLECTIONS = [
  'projects',
  'clients',
  'staff',
  'suppliers',
  'inventory',
  'transactions',
  'purchaseOrders',
  'logs'
] as const

export type CollectionStatus = {
  name: string
  count: number
  ok: boolean
  error?: string
  ms: number
}

/**
 * Checks connectivity and document count for every required collection.
 */
export const checkCollections = async (): Promise<CollectionStatus[]> => {
  if (!auth.currentUser) throw new Error('Not authenticated')
  const results: CollectionStatus[] = []
  for (const name of REQUIRED_COLLECTIONS) {
    const t = Date.now()
    try {
      const snap = await getDocs(
        query(collection(db, name), where('ownerId', '==', auth.currentUser.uid))
      )
      results.push({ name, count: snap.size, ok: true, ms: Date.now() - t })
    } catch (e: any) {
      results.push({
        name,
        count: 0,
        ok: false,
        error: e?.message || String(e),
        ms: Date.now() - t
      })
    }
  }
  return results
}

/**
 * Generates inventory items from a project's budget materials.
 */
export const generateProjectStock = async (project: any): Promise<number> => {
  if (!auth.currentUser || !project.id) return 0

  const materialsMap = new Map<string, { unit: string; qty: number; cost: number }>()
  for (const item of project.items || []) {
    for (const m of item.materials || []) {
      const key = `${m.name}__${m.unit || 'U'}`
      const qty = (m.quantity || 0) * (item.projectQuantity || 1)
      if (materialsMap.has(key)) {
        materialsMap.get(key)!.qty += qty
      } else {
        materialsMap.set(key, { unit: m.unit || 'U', qty, cost: m.price || 0 })
      }
    }
  }
  if (materialsMap.size === 0) return 0

  const existing = await getDocs(
    query(
      collection(db, 'inventory'),
      where('ownerId', '==', auth.currentUser.uid),
      where('projectId', '==', project.id)
    )
  )
  const existingNames = new Set(
    existing.docs.map((d) => `${d.data().name}__${d.data().unit}`)
  )

  let created = 0
  const today = new Date().toISOString().split('T')[0]
  for (const [key, mat] of materialsMap) {
    if (existingNames.has(key)) continue
    const [name] = key.split('__')
    await addDocument('inventory', {
      name,
      cat: 'Materiales',
      stock: 0,
      unit: mat.unit,
      location: 'Almacén Central',
      minStock: Math.max(1, Math.ceil(mat.qty * 0.1)),
      lastEntry: today,
      history: [],
      projectId: project.id,
      projectName: project.name,
      budgetedQty: Math.round(mat.qty * 100) / 100,
      budgetedCost: mat.cost,
      usedQty: 0
    })
    created++
  }
  return created
}