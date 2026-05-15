import React from 'react';

export default function SyncStatus(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Estado de conexión: en línea"
      className="flex items-center gap-2 text-xs font-bold text-emerald-400 select-none"
    >
      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
      <span>En línea</span>
    </div>
  );
}
