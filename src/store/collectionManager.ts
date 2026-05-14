/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Collection Manager — Subscripciones unificadas y deduplicadas
 * 
 * Antes: Cada módulo hacía subscribeToCollection() por separado
 *        → N suscripciones a la misma colección
 *        → N re-renders por snapshot
 *        
 * Ahora: DataStore crea UNA suscripción por colección
 *        → 1 re-render centralizado
 *        → Múltiples componentes leen del mismo store
 * 
 * Si un módulo necesita datos adicionales de una colección,
 * simplemente lee del store sin crear nuevas suscripciones.
 */

import { subscribeToCollection } from '../services/firestoreService';

// ─── Registro de suscripciones activas ────────────────────────────────────────
const activeSubscriptions = new Map<string, () => void>();
const dataCache = new Map<string, any[]>();
const callbacks = new Map<string, Set<(data: any[]) => void>>();
const loadingStates = new Map<string, boolean>();

/**
 * Suscripción unificada a una colección de Firestore.
 * Si ya existe una suscripción activa, reutiliza los datos.
 * 
 * @param collection Nombre de la colección
 * @param onUpdate Callback que recibe los datos actualizados
 * @returns Función de desuscripción
 */
export function unifiedSubscribe(
  collection: string,
  onUpdate: (data: any[]) => void
): () => void {
  // Registrar callback
  if (!callbacks.has(collection)) {
    callbacks.set(collection, new Set());
  }
  const cbSet = callbacks.get(collection)!;
  cbSet.add(onUpdate);

  // Si ya hay suscripción activa, devolver datos en caché
  if (activeSubscriptions.has(collection)) {
    const cached = dataCache.get(collection) || [];
    // Enviar datos en caché inmediatamente
    queueMicrotask(() => onUpdate(cached));
    return () => {
      cbSet.delete(onUpdate);
      if (cbSet.size === 0) {
        cleanupSubscription(collection);
      }
    };
  }

  // Crear nueva suscripción
  loadingStates.set(collection, true);
  const unsub = subscribeToCollection(collection, (data: any[]) => {
    dataCache.set(collection, data);
    loadingStates.set(collection, false);
    cbSet.forEach(cb => cb(data));
  });

  activeSubscriptions.set(collection, unsub);

  return () => {
    cbSet.delete(onUpdate);
    if (cbSet.size === 0) {
      cleanupSubscription(collection);
    }
  };
}

function cleanupSubscription(collection: string): void {
  const unsub = activeSubscriptions.get(collection);
  if (unsub) {
    unsub();
    activeSubscriptions.delete(collection);
    dataCache.delete(collection);
    callbacks.delete(collection);
    loadingStates.delete(collection);
  }
}

/**
 * Obtener datos en caché de una colección
 */
export function getCachedData(collection: string): any[] {
  return dataCache.get(collection) || [];
}

/**
 * Verificar si una colección está cargando
 */
export function isLoading(collection: string): boolean {
  return loadingStates.get(collection) ?? true;
}

/**
 * Obtener todas las suscripciones activas (para debugging)
 */
export function getActiveSubscriptions(): Map<string, number> {
  const result = new Map<string, number>();
  callbacks.forEach((cbSet, collection) => {
    result.set(collection, cbSet.size);
  });
  return result;
}

/**
 * Forzar actualización manual de una colección
 */
export function refreshCollection(collection: string): void {
  const cached = dataCache.get(collection);
  if (cached) {
    const cbSet = callbacks.get(collection);
    if (cbSet) {
      cbSet.forEach(cb => cb([...cached]));
    }
  }
}

/**
 * Limpiar todas las suscripciones (para testing o logout)
 */
export function clearAllSubscriptions(): void {
  for (const [collection] of activeSubscriptions) {
    cleanupSubscription(collection);
  }
}