import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  serverTimestamp,
  FirestoreError,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export const parseError = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          return 'Permisos insuficientes para realizar esta operación';
        }
        return parsed.error;
      }
    } catch {
      return error.message;
    }
  }
  return String(error);
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getDocumentsForCollection = async (collectionName: string) => {
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, collectionName), 
      where('ownerId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
    return [];
  }
};

export const subscribeToCollection = (
  collectionName: string, 
  callback: (data: any[]) => void
) => {
  if (!auth.currentUser) return () => {};

  const q = query(
    collection(db, collectionName), 
    where('ownerId', '==', auth.currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  });
};

const sanitize = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)])
    );
  }
  return obj;
};

export const addDocument = async (collectionName: string, data: any) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...sanitize(data),
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...sanitize(data),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
};


/** All collections required by the app */
export const REQUIRED_COLLECTIONS = [
  'projects',
  'clients',
  'staff',
  'suppliers',
  'inventory',
  'transactions',
  'purchaseOrders',
  'logs',
] as const;

export type CollectionStatus = {
  name: string;
  count: number;
  ok: boolean;
  error?: string;
  ms: number;
};

/**
 * Checks connectivity and document count for every required collection.
 * Returns one status entry per collection.
 */
export const checkCollections = async (): Promise<CollectionStatus[]> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const results: CollectionStatus[] = [];
  for (const name of REQUIRED_COLLECTIONS) {
    const t = Date.now();
    try {
      const snap = await getDocs(
        query(collection(db, name), where('ownerId', '==', auth.currentUser.uid))
      );
      results.push({ name, count: snap.size, ok: true, ms: Date.now() - t });
    } catch (e: any) {
      results.push({ name, count: 0, ok: false, error: e.message, ms: Date.now() - t });
    }
  }
  return results;
};

/**
 * Generates inventory items from a project's budget materials.
 * Called automatically when a project transitions to EJECUCION status.
 * Skips materials already created for this project.
 */
export const generateProjectStock = async (project: any): Promise<number> => {
  if (!auth.currentUser || !project.id) return 0;

  // Aggregate materials across all project items
  const materialsMap = new Map<string, { unit: string; qty: number; cost: number }>();
  for (const item of project.items || []) {
    for (const m of item.materials || []) {
      const key = `${m.name}__${m.unit || 'U'}`;
      const qty = (m.quantity || 0) * (item.projectQuantity || 1);
      if (materialsMap.has(key)) {
        materialsMap.get(key)!.qty += qty;
      } else {
        materialsMap.set(key, { unit: m.unit || 'U', qty, cost: m.price || 0 });
      }
    }
  }
  if (materialsMap.size === 0) return 0;

  // Fetch existing inventory for this project to avoid duplicates
  const existing = await getDocs(
    query(collection(db, 'inventory'), where('ownerId', '==', auth.currentUser.uid), where('projectId', '==', project.id))
  );
  const existingNames = new Set(existing.docs.map(d => `${d.data().name}__${d.data().unit}`));

  let created = 0;
  const today = new Date().toISOString().split('T')[0];
  for (const [key, mat] of materialsMap) {
    if (existingNames.has(key)) continue;
    const [name] = key.split('__');
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
      usedQty: 0,
    });
    created++;
  }
  return created;
};
