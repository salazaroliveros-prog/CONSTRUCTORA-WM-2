import { auth } from '../lib/firebase';
import { apiFetch, docToObject, objToFirestore, collectionQuery, nowISO } from './firebaseApi';
import { cacheCollection, getCachedCollection, clearCache } from './cacheService';
import { addToQueue, getQueue, removeFromQueue } from './offlineQueue';

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
    const data = results
      .filter((r: any) => r.document)
      .map((r: any) => docToObject(r.document));
    cacheCollection(collectionName, data);
    return data;
  } catch (error) {
    const cached = getCachedCollection(collectionName);
    if (cached) {
      console.info(`[firestoreService] Offline — serving cached ${collectionName} (${cached.length} items)`);
      return cached;
    }
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

function isOffline(): boolean {
  return !navigator.onLine;
}

async function validateForeignKeys(collectionName: string, data: any): Promise<void> {
  const fkRules: Record<string, { field: string; target: string }[]> = {
    transactions: [{ field: 'projectId', target: 'projects' }],
    purchaseOrders: [
      { field: 'projectId', target: 'projects' },
      { field: 'supplierId', target: 'suppliers' },
    ],
    inventory: [{ field: 'projectId', target: 'projects' }],
    payrolls: [{ field: 'projectId', target: 'projects' }],
    logs: [{ field: 'projectId', target: 'projects' }],
  };

  const rules = fkRules[collectionName];
  if (!rules) return;

  for (const rule of rules) {
    const fkValue = data[rule.field];
    if (!fkValue) continue;
    try {
      const ref = await getDocument(rule.target, fkValue);
      if (!ref) {
        console.warn(`[FK] ${collectionName} references ${rule.target}/${fkValue} which does not exist`);
      }
    } catch {
      console.warn(`[FK] Could not verify ${rule.target}/${fkValue} for ${collectionName}`);
    }
  }
}

export const addDocument = async (
  collectionName: string,
  data: any,
  _skipAudit?: boolean
): Promise<string | null> => {
  if (!auth.currentUser) throw new Error('Not authenticated');

  await validateForeignKeys(collectionName, data);

  if (isOffline()) {
    const docId = crypto.randomUUID();
    addToQueue({
      collection: collectionName,
      action: 'create',
      docId,
      data: { ...data, ownerId: auth.currentUser.uid },
    });
    const cached = getCachedCollection(collectionName) || [];
    cached.push({ id: docId, ...data, ownerId: auth.currentUser.uid });
    cacheCollection(collectionName, cached);
    console.info(`[offline] Queued create ${collectionName}/${docId}`);
    return docId;
  }

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
    if (!_skipAudit) addAuditLog('create', collectionName, id, JSON.stringify(Object.keys(clean)));
    const cached = getCachedCollection(collectionName) || [];
    cached.push({ id, ...clean, ownerId: auth.currentUser.uid, createdAt: nowISO(), updatedAt: nowISO() });
    cacheCollection(collectionName, cached);
    return id;
  } catch (error) {
    console.error(`[firestoreService] Error creating ${collectionName}:`, error);
    if (!navigator.onLine) {
      const docId = crypto.randomUUID();
      addToQueue({
        collection: collectionName,
        action: 'create',
        docId,
        data: { ...data, ownerId: auth.currentUser.uid },
      });
      const cached = getCachedCollection(collectionName) || [];
      cached.push({ id: docId, ...data, ownerId: auth.currentUser.uid });
      cacheCollection(collectionName, cached);
      return docId;
    }
    throw error;
  }
};

export const updateDocument = async (
  collectionName: string,
  id: string,
  data: any
): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not authenticated');

  if (isOffline()) {
    addToQueue({
      collection: collectionName,
      action: 'update',
      docId: id,
      data,
    });
    const cached = getCachedCollection(collectionName) || [];
    const idx = cached.findIndex((d: any) => d.id === id);
    if (idx >= 0) cached[idx] = { ...cached[idx], ...data };
    else cached.push({ id, ...data });
    cacheCollection(collectionName, cached);
    console.info(`[offline] Queued update ${collectionName}/${id}`);
    return;
  }

  try {
    const clean = sanitize(data);
    const fields = objToFirestore({ ...clean, updatedAt: nowISO() });
    const params = new URLSearchParams();
    Object.keys(fields).forEach(k => params.append('updateMask.fieldPaths', k));

    if (collectionName === 'projects' && data.status === 'EJECUCION') {
      const current = await getDocument(collectionName, id);
      if (current && current.status !== 'EJECUCION') {
        await apiFetch(`/documents/${collectionName}/${id}?${params.toString()}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields }),
        });
        await generateProjectStock({ id, ...current, ...data });
        addAuditLog('update:ejecucion', collectionName, id);
        const cached = getCachedCollection(collectionName) || [];
        const idx = cached.findIndex((d: any) => d.id === id);
        if (idx >= 0) cached[idx] = { ...cached[idx], ...data };
        cacheCollection(collectionName, cached);
        return;
      }
    }

    if (collectionName === 'projects' && data.teamIds !== undefined) {
      const current = await getDocument(collectionName, id).catch(() => null);
      if (current) {
        const oldTeamIds: string[] = current.teamIds || [];
        const newTeamIds: string[] = data.teamIds || [];
        const added = newTeamIds.filter(tid => !oldTeamIds.includes(tid));
        const removed = oldTeamIds.filter(tid => !newTeamIds.includes(tid));
        if (added.length > 0 || removed.length > 0) {
          try {
            const staffDocs = await collectionQuery('staff', [
              { field: 'ownerId', op: 'EQUAL', val: auth.currentUser.uid },
            ]);
            const uid = auth.currentUser.uid;
            const batchUpdate = async () => {
              for (const r of staffDocs) {
                const d = r.document || r;
                const staffId = d.name?.split('/').pop() || d.id;
                const staffObj = docToObject(d);
                const currentProjects: string[] = staffObj.projectIds || [];
                let changed = false;
                if (removed.includes(staffId) && currentProjects.includes(id)) {
                  staffObj.projectIds = currentProjects.filter((pid: string) => pid !== id);
                  changed = true;
                }
                if (added.includes(staffId) && !currentProjects.includes(id)) {
                  staffObj.projectIds = [...currentProjects, id];
                  changed = true;
                }
                if (changed && staffId) {
                  await apiFetch(`/documents/staff/${staffId}?updateMask.fieldPaths=projectIds`, {
                    method: 'PATCH',
                    body: JSON.stringify({ fields: objToFirestore({ projectIds: staffObj.projectIds }) }),
                  }).catch((e: any) => console.warn(`[sync] Failed to update staff/${staffId}:`, e));
                }
              }
            };
            batchUpdate();
          } catch (e) {
            console.warn(`[sync] Error syncing staff projects for ${id}:`, e);
          }
        }
      }
    }

    await apiFetch(`/documents/${collectionName}/${id}?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    addAuditLog('update', collectionName, id, JSON.stringify(Object.keys(data)));
    const cached = getCachedCollection(collectionName) || [];
    const idx = cached.findIndex((d: any) => d.id === id);
    if (idx >= 0) cached[idx] = { ...cached[idx], ...data };
    cacheCollection(collectionName, cached);
  } catch (error) {
    console.error(`[firestoreService] Error updating ${collectionName}/${id}:`, error);
    if (!navigator.onLine) {
      addToQueue({
        collection: collectionName,
        action: 'update',
        docId: id,
        data,
      });
    }
    throw error;
  }
};

async function cascadeDeleteProject(projectId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const linkedCollections = [
    { name: 'transactions', field: 'projectId' },
    { name: 'purchaseOrders', field: 'projectId' },
    { name: 'inventory', field: 'projectId' },
    { name: 'logs', field: 'projectId' },
  ];

  for (const { name, field } of linkedCollections) {
    try {
      const docs = await collectionQuery(name, [
        { field, op: 'EQUAL', val: projectId },
        { field: 'ownerId', op: 'EQUAL', val: uid },
      ]);
      for (const r of docs) {
        const d = r.document || r;
        const docId = d.name?.split('/').pop() || d.id;
        if (docId) {
          await apiFetch(`/documents/${name}/${docId}`, { method: 'DELETE' }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn(`[cascade] Error cleaning ${name} for project ${projectId}:`, e);
    }
  }

  try {
    const clients = await collectionQuery('clients', [
      { field: 'ownerId', op: 'EQUAL', val: uid },
    ]);
    for (const r of clients) {
      const d = docToObject(r.document || r);
      if (d.proyectosIds?.includes(projectId)) {
        const docId = (r.document?.name?.split('/').pop()) || d.id;
        const updated = {
          proyectosIds: d.proyectosIds.filter((pid: string) => pid !== projectId),
          totalProyectos: Math.max(0, (d.totalProyectos || 1) - 1),
        };
        if (docId) {
          await apiFetch(`/documents/clients/${docId}?updateMask.fieldPaths=proyectosIds&updateMask.fieldPaths=totalProyectos`, {
            method: 'PATCH',
            body: JSON.stringify({ fields: objToFirestore(updated) }),
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn(`[cascade] Error updating client project list for ${projectId}:`, e);
  }
}

export const deleteDocument = async (
  collectionName: string,
  id: string
): Promise<boolean> => {
  if (!auth.currentUser) return false;

  if (isOffline()) {
    addToQueue({
      collection: collectionName,
      action: 'delete',
      docId: id,
    });
    const cached = getCachedCollection(collectionName) || [];
    cacheCollection(collectionName, cached.filter((d: any) => d.id !== id));
    console.info(`[offline] Queued delete ${collectionName}/${id}`);
    return true;
  }

  try {
    if (collectionName === 'projects') {
      await cascadeDeleteProject(id);
    }
    await apiFetch(`/documents/${collectionName}/${id}`, { method: 'DELETE' });
    addAuditLog('delete', collectionName, id);
    const cached = getCachedCollection(collectionName) || [];
    cacheCollection(collectionName, cached.filter((d: any) => d.id !== id));
    return true;
  } catch (error) {
    console.error(`[firestoreService] Error deleting ${collectionName}/${id}:`, error);
    if (!navigator.onLine) {
      addToQueue({ collection: collectionName, action: 'delete', docId: id });
    }
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
    const params = new URLSearchParams();
    Object.keys(fields).forEach(k => params.append('updateMask.fieldPaths', k));
    await apiFetch(`/documents/userSettings/${uid}?${params.toString()}`, {
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

export const REQUIRED_COLLECTIONS = [
  'projects',
  'clients',
  'staff',
  'suppliers',
  'inventory',
  'transactions',
  'purchaseOrders',
  'logs',
  'payrolls',
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

export const processPendingQueue = async (): Promise<{ processed: number; failed: number }> => {
  const queue = getQueue();
  if (queue.length === 0 || !auth.currentUser) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      if (op.action === 'create' && op.data) {
        const clean = sanitize(op.data);
        const doc = {
          fields: objToFirestore({ ...clean, ownerId: auth.currentUser.uid, createdAt: nowISO(), updatedAt: nowISO() }),
        };
        await apiFetch(`/documents/${op.collection}?documentId=${op.docId}`, {
          method: 'POST',
          body: JSON.stringify(doc),
        });
      } else if (op.action === 'update' && op.docId && op.data) {
        const clean = sanitize(op.data);
        const fields = objToFirestore({ ...clean, updatedAt: nowISO() });
        const params = new URLSearchParams();
        Object.keys(fields).forEach(k => params.append('updateMask.fieldPaths', k));

        if (op.collection === 'projects' && op.data.status === 'EJECUCION') {
          const current = await getDocument(op.collection, op.docId);
          if (current && current.status !== 'EJECUCION') {
            await apiFetch(`/documents/${op.collection}/${op.docId}?${params.toString()}`, {
              method: 'PATCH',
              body: JSON.stringify({ fields }),
            });
            await generateProjectStock({ id: op.docId, ...current, ...op.data });
            removeFromQueue(op.id);
            processed++;
            continue;
          }
        }

        await apiFetch(`/documents/${op.collection}/${op.docId}?${params.toString()}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields }),
        });
      } else if (op.action === 'delete' && op.docId) {
        await apiFetch(`/documents/${op.collection}/${op.docId}`, { method: 'DELETE' });
      }
      removeFromQueue(op.id);
      processed++;
    } catch (e) {
      console.error(`[sync] Failed to process ${op.action} ${op.collection}/${op.docId}:`, e);
      op.retries++;
      if (op.retries >= 5) {
        console.warn(`[sync] Giving up on ${op.action} ${op.collection}/${op.docId} after 5 retries`);
        removeFromQueue(op.id);
      }
      failed++;
    }
  }

  clearCache();
  return { processed, failed };
};

const AUDIT_COLLECTIONS = ['projects', 'transactions', 'clients', 'inventory', 'staff', 'suppliers', 'purchaseOrders', 'payrolls'];

async function addAuditLog(action: string, collectionName: string, docId: string, details?: string): Promise<void> {
  if (!AUDIT_COLLECTIONS.includes(collectionName) || !auth.currentUser) return;
  try {
    await apiFetch('/documents/logs', {
      method: 'POST',
      body: JSON.stringify({
        fields: objToFirestore({
          action: `${action}:${collectionName}`,
          collection: collectionName,
          docId,
          userId: auth.currentUser.uid,
          details: details || '',
          timestamp: nowISO(),
          ownerId: auth.currentUser.uid,
          projectId: '_system',
        }),
      }),
    });
  } catch {
    // Audit is non-critical; silently ignore
  }
}

export const generateProjectStock = async (project: any): Promise<number> => {
  if (!auth.currentUser || !project.id) return 0;

  const materialsMap = new Map<string, { unit: string; qty: number; cost: number }>();
  const items = project.items || [];
  const budgetLines = project.budgetTree || [];

  if (items.length > 0) {
    for (const item of items) {
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
  } else if (budgetLines.length > 0) {
    const extractBudgetMaterials = (lines: any[]) => {
      for (const line of lines) {
        for (const m of line.materials || []) {
          const key = `${m.name}__${m.unit || 'U'}`;
          const qty = (m.quantity || 0) * (line.projectQuantity || 1);
          if (materialsMap.has(key)) {
            materialsMap.get(key)!.qty += qty;
          } else {
            materialsMap.set(key, { unit: m.unit || 'U', qty, cost: m.unitPrice || 0 });
          }
        }
        if (line.children) extractBudgetMaterials(line.children);
      }
    };
    extractBudgetMaterials(budgetLines);
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
    }, true);
    created++;
  }
  return created;
};
