/**
 * Instancia Dexie (IndexedDB) para persistencia local y cola de sincronización.
 * src/lib/sync/store.ts
 */

import Dexie from 'dexie';
import type { SyncOperation, SyncStatus } from './types';

const DB_NAME = 'erp_constructora_wm';

class AppDatabase extends Dexie {
  syncQueue!: Dexie.Table<SyncOperation, string>;
  localCache!: Dexie.Table<Record<string, unknown> & { id: string; entity: string }, string>;
  conflicts!: Dexie.Table<SyncOperation & { conflictData: Record<string, unknown> }, string>;
  meta!: Dexie.Table<{ key: string; value: unknown }, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      syncQueue:  'id, entity, entityId, status, createdAt',
      localCache: 'id, entity, updatedAt',
      conflicts:  'id, entity, entityId',
      meta:       'key',
    });
  }
}

let _db: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!_db) {
    _db = new AppDatabase();
  }
  return _db;
}

export async function clearDb(): Promise<void> {
  if (_db) {
    await _db.delete();
    _db = null;
  }
}