import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';

export interface SubRowField { key: string; label: string; value: any; type: 'text' | 'number'; small?: boolean; }

interface EditableSubRowProps {
  fields: SubRowField[];
  totalQty: number;
  totalPrice: number;
  onSave: (data: Record<string, any>) => void;
  onDelete: () => void;
}

export function EditableSubRow({ fields, totalQty, totalPrice, onSave, onDelete }: EditableSubRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, any>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  );
  const handleSave = () => {
    toast('Guardar cambios?', {
      description: String(form[fields[0].key] || ''),
      action: { label: 'Confirmar', onClick: () => { onSave(form); setEditing(false); } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };
  if (editing) {
    return (
      <div className="bg-[color-mix(in_srgb,varwarning_10%,transparent)] border border-[color-mix(in_srgb,varwarning_20%,transparent)] rounded-xl p-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {fields.map(f => (
            <div key={f.key} className={f.small ? '' : 'col-span-2'}>
              <label className="label" htmlFor={`field-${f.key}`}>{f.label}</label>
              <input id={`field-${f.key}`} name={f.key} type={f.type} value={form[f.key]} step={f.type === 'number' ? '0.01' : undefined} inputMode={f.type === 'number' ? 'decimal' : undefined} autoComplete="off"
                onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                className="input" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="flex-1">Cancelar</Button>
          <Button variant="default" size="sm" onClick={handleSave} className="flex-1">Guardar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center bg-(--color-surface-solid) p-2 rounded-xl border border-neutral-100 shadow-sm group/sub">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-primary uppercase truncate">{fields[0].value}</p>
        <p className="text-[7px] font-bold text-neutral-400 uppercase">{totalQty.toLocaleString(undefined, {maximumFractionDigits:2})} {fields[1]?.value} · Q {fields[2]?.value}/u</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <div className="text-right mr-1">
          <p className="text-[9px] font-black text-neutral-600">Q {totalPrice.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
        </div>
        <button onClick={() => { setEditing(true); setForm(Object.fromEntries(fields.map(f => [f.key, f.value]))); }} aria-label="Editar ítem" className="btn-edit opacity-0 group-hover/sub:opacity-100"><Pencil size={10} /></button>
        <button onClick={onDelete} aria-label="Eliminar ítem" className="btn-delete opacity-0 group-hover/sub:opacity-100"><Trash2 size={10} /></button>
      </div>
    </div>
  );
}

export function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm border border-(--color-surface-solid)/10 rounded-xl px-4 py-3 shadow-2xl text-left min-w-30">
      {label && <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] font-black text-neutral-50">Q{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}


