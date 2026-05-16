import { auth } from '../lib/firebase';
import firebaseConfig from '../lib/firebaseConfig';

const PROJECT_ID = firebaseConfig.projectId || 'coonstructora-wm-mys';
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return await user.getIdToken();
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore API error (${res.status}): ${body}`);
  }
  return res.json();
}

export function docToObject(doc: any): Record<string, any> & { id: string } {
  const id = (doc.name as string).split('/').pop() || '';
  const fields = doc.fields || {};
  const obj: Record<string, any> = { id };
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    obj[key] = valueFromFirestore(val as any);
  }
  return obj as Record<string, any> & { id: string };
}

function valueFromFirestore(val: any): any {
  if (val === null || val === undefined) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.mapValue?.fields) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields)) {
      obj[k] = valueFromFirestore(v);
    }
    return obj;
  }
  if (val.arrayValue?.values) return val.arrayValue.values.map(valueFromFirestore);
  if (val.referenceValue !== undefined) return val.referenceValue;
  if (val.geoPointValue !== undefined) return val.geoPointValue;
  if (val.nullValue !== undefined) return null;
  return undefined;
}

export function objToFirestore(obj: any): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (key === 'id') continue;
    fields[key] = toFirestoreVal(val);
  }
  return fields;
}

function toFirestoreVal(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val) && Math.abs(val) < 9007199254740991) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreVal) } };
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreVal(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function buildQuery(collectionName: string, conditions: { field: string; op: string; val: any }[]) {
  const filters = conditions.map(c => {
    const value = toFirestoreVal(c.val);
    const key = Object.keys(value)[0];
    return {
      fieldFilter: {
        field: { fieldPath: c.field },
        op: c.op,
        value: key ? { [key]: value[key] } : { nullValue: null },
      },
    };
  });

  const structuredQuery: any = {
    from: [{ collectionId: collectionName }],
  };

  if (filters.length === 1) {
    structuredQuery.where = filters[0];
  } else if (filters.length > 1) {
    structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
  }

  return structuredQuery;
}

export function collectionQuery(collectionName: string, conditions: { field: string; op: string; val: any }[]) {
  return apiFetch(`/documents:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: buildQuery(collectionName, conditions) }),
  });
}

export function nowISO(): string {
  return new Date().toISOString();
}
