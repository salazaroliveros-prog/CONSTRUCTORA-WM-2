import React from 'react';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';

export default function SyncStatus(): React.ReactElement {
  const { isOnline } = useNetworkStatus();

  return (
    <div
      role="status"
      aria-label={`Estado de conexión: ${isOnline ? 'en línea' : 'sin conexión'}`}
      className={`flex items-center gap-2 text-xs font-bold select-none ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}
    >
      <span aria-hidden="true" className={`w-2 h-2 rounded-full inline-block ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
    </div>
  );
}
