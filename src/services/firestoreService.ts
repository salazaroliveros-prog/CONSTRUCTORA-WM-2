import { auth } from '../lib/firebase';
import { apiFetch, docToObject, objToFirestore, collectionQuery, nowISO } from './firebaseApi';

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

export const getDocumentsForCollection = async (collectionName: string): Promise<any[]> => {
  if (!auth.currentUser) return [];
  try {
    const results = await collectionQuery(collectionName, [
      { field: 'ownerId', op: 'EQUAL', val: auth.currentUser.uid },
    ]);
    return results
      .filter((r: any) => r.document)
      .map((r: any) => docToObject(r.document));
  } catch (error) {
    console.error(`[firestoreService] Error fetching ${collectionName}:`, error);
    return [];
  }
};

export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[]) => void
) => {
  let cancelled = false;

  if (!auth.currentUser) return () => {};

  const fetch = async () => {
    if (cancelled) return;
    const data = await getDocumentsForCollection(collectionName);
    if (!cancelled) callback(data);
  };

  fetch();

  const intervalId = window.setInterval(fetch, 30000);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
  };
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

export const addDocument = async (
  collectionName: string,
  data: any
): Promise<string | null> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  try {
    const clean = sanitize(data);
    const doc = {
      fields: objToFirestore({
        ...clean,
        ownerId: auth.currentUser.uid,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }),
    };

    const result = await apiFetch(`/documents/${collectionName}`, {
      method: 'POST',
      body: JSON.stringify(doc),
    });

    const id = (result.name as string).split('/').pop() || '';
    return id;
  } catch (error) {
    console.error(`[firestoreService] Error creating ${collectionName}:`, error);
    throw error;
  }
};

export const updateDocument = async (
  collectionName: string,
  id: string,
  data: any
): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  try {
    const clean = sanitize(data);
    const fields = objToFirestore({ ...clean, updatedAt: nowISO() });
    const mask = Object.keys(fields).join(',');

    if (collectionName === 'projects' && data.status === 'EJECUCION') {
      const current = await getDocument(collectionName, id);
      if (current && current.status !== 'EJECUCION') {
        await apiFetch(`/documents/${collectionName}/${id}?updateMask.fieldPaths=${mask}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields }),
        });
        await generateProjectStock({ id, ...current, ...data });
        return;
      }
    }

    await apiFetch(`/documents/${collectionName}/${id}?updateMask.fieldPaths=${mask}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
  } catch (error) {
    console.error(`[firestoreService] Error updating ${collectionName}/${id}:`, error);
    throw error;
  }
};

export const deleteDocument = async (
  collectionName: string,
  id: string
): Promise<boolean> => {
  if (!auth.currentUser) return false;
  try {
    await apiFetch(`/documents/${collectionName}/${id}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error(`[firestoreService] Error deleting ${collectionName}/${id}:`, error);
    return false;
  }
};

export const loadUserSettings = async (
  uid: string
): Promise<Record<string, unknown> | null> => {
  try {
    const result = await apiFetch(`/documents/userSettings/${uid}`);
    return docToObject(result);
  } catch {
    return null;
  }
};

export const saveUserSettings = async (
  uid: string,
  data: Record<string, unknown>
): Promise<boolean> => {
  try {
    const clean = sanitize(data);
    const fields = objToFirestore(clean);
    const mask = Object.keys(fields).join(',');
    await apiFetch(`/documents/userSettings/${uid}?updateMask.fieldPaths=${mask}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return true;
  } catch (error) {
    console.error('[firestoreService] Error saving user settings:', error);
    return false;
  }
};

export const checkUniqueField = async (
  collectionName: string,
  field: string,
  value: string | number,
  excludeId?: string
): Promise<boolean> => {
  if (!auth.currentUser) return false;
  try {
    const results = await collectionQuery(collectionName, [
      { field: 'ownerId', op: 'EQUAL', val: auth.currentUser.uid },
      { field, op: 'EQUAL', val: value },
    ]);
    const docs = results.filter((r: any) => r.document).map((r: any) => docToObject(r.document));
    if (excludeId) {
      return docs.some((d) => d.id !== excludeId);
    }
    return docs.length > 0;
  } catch {
    return false;
  }
};

export const writeWithOfflineQueue = async (
  collectionName: string,
  docId: string,
  data: any,
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const sanitized = sanitize(data);
  try {
    if (operation === 'delete') {
      await apiFetch(`/documents/${collectionName}/${docId}`, { method: 'DELETE' });
    } else if (operation === 'create') {
      const doc = {
        fields: objToFirestore({
          ...sanitized,
          ownerId: auth.currentUser.uid,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }),
      };
      await apiFetch(`/documents/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(doc),
      });
    } else {
      const fields = objToFirestore({ ...sanitized, updatedAt: nowISO() });
      const mask = Object.keys(fields).join(',');
      await apiFetch(`/documents/${collectionName}/${docId}?updateMask.fieldPaths=${mask}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
    }
  } catch (error: any) {
    console.error(`[firestoreService] Error ${operation} ${collectionName}/${docId}:`, error);
    throw error;
  }
};

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

export const checkCollections = async (): Promise<CollectionStatus[]> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const results: CollectionStatus[] = [];
  for (const name of REQUIRED_COLLECTIONS) {
    const t = Date.now();
    try {
      const data = await getDocumentsForCollection(name);
      results.push({ name, count: data.length, ok: true, ms: Date.now() - t });
    } catch (e: any) {
      results.push({
        name,
        count: 0,
        ok: false,
        error: e?.message || String(e),
        ms: Date.now() - t,
      });
    }
  }
  return results;
};

async function getDocument(collectionName: string, id: string): Promise<any | null> {
  try {
    const result = await apiFetch(`/documents/${collectionName}/${id}`);
    return docToObject(result);
  } catch {
    return null;
  }
}

export const generateProjectStock = async (project: any): Promise<number> => {
  if (!auth.currentUser || !project.id) return 0;

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

  const existing = await collectionQuery('inventory', [
    { field: 'ownerId', op: 'EQUAL', val: auth.currentUser.uid },
    { field: 'projectId', op: 'EQUAL', val: project.id },
  ]);
  const existingNames = new Set(
    existing.filter((r: any) => r.document).map((r: any) => {
      const d = docToObject(r.document);
      return `${d.name}__${d.unit}`;
    })
  );

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
