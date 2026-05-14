/**
 * Indicador de estado de sincronización para la barra de estado.
 * src/components/SyncStatus.tsx
 */

import React from 'react';
import { useSync } from '../contexts/AuthContext';

export default function SyncStatus(): React.ReactElement {
  const { syncState } = useSync();

  if (!syncState) return null;

  const getStatusInfo = () => {
    if (!syncState.isOnline) {
      return { icon: '⛔', label: 'Sin conexión', color: 'text-red-400' };
    }
    if (syncState.isSyncing) {
      return { icon: '🔄', label: 'Sincronizando...', color: 'text-amber-400' };
    }
    if (syncState.conflictCount > 0) {
      return {
        icon: '⚠️',
        label: `${syncState.conflictCount} conflicto(s)`,
        color: 'text-orange-400',
      };
    }
    if (syncState.pendingCount > 0) {
      return {
        icon: '⏳',
        label: `${syncState.pendingCount} pendiente(s)`,
        color: 'text-amber-300',
      };
    }
    return { icon: '✅', label: 'Sincronizado', color: 'text-emerald-400' };
  };

  const { icon, label, color } = getStatusInfo();

  return (
    <div
      role="status"
      aria-label={`Estado de sincronización: ${label}`}
      className={`flex items-center gap-2 text-xs font-bold ${color} select-none`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {syncState.pendingCount > 0 && (
        <span className="sr-only">{syncState.pendingCount} operaciones pendientes</span>
      )}
    </div>
  );
}