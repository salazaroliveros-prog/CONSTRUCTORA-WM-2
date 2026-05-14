/**
 * Tipos e interfaces para el módulo de sincronización offline-first.
 * src/lib/sync/types.ts
 */

/** Estados posibles de una operación en la cola de sincronización */
export enum SyncStatus {
  PENDING    = 'pending',
  IN_FLIGHT  = 'in_flight',
  CONFIRMED  = 'confirmed',
  FAILED     = 'failed',
  CONFLICT   = 'conflict',
  STALE      = 'stale',
}

/** Reloj vectorial para detección de causalidad */
export interface VectorClockEntry {
  [clientId: string]: number;
}

/** Cada operación CRUD pendiente de sincronización */
export interface SyncOperation {
  id:              string;
  entity:          string;
  entityId:        string;
  operation:       'create' | 'update' | 'delete';
  payload:         Record<string, unknown>;
  vectorClock:     VectorClockEntry;
  clientTimestamp: number;
  serverTimestamp: number | null;
  status:          SyncStatus;
  retryCount:      number;
  maxRetries:      number;
  createdAt:       number;
  completedAt:     number | null;
  conflictData:    Record<string, unknown> | null;
}

/** Estado global del motor de sincronización */
export interface SyncState {
  isOnline:       boolean;
  isSyncing:      boolean;
  pendingCount:   number;
  failedCount:    number;
  conflictCount:  number;
  lastSyncAt:     number | null;
}

/** Interfaz base para documentos sincronizables */
export interface SyncedDocument {
  id:              string;
  entityType:      string;
  _vectorClock?:   VectorClockEntry;
  _updatedAt?:     string;
  _updatedBy?:     string;
  _localUpdatedAt?: number;
  _syncStatus?:    'synced' | 'pending' | 'conflict';
  _source?:        'field' | 'office';
}