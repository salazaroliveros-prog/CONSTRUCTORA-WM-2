/**
 * PurchaseOrderPanel - Panel de generación de órdenes de compra
 * Extraído de AdvancedProjectCreator para separación de concerns
 */

import React, { useState } from 'react';
import { ShoppingCart, FileDown, Send, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { parseError } from '../../services/firestoreService';

interface PurchaseOrderPanelProps {
  projectId?: string;
  projectName?: string;
  items: any[];
  suppliers: { id: string; name: string; category: string }[];
  onOrderCreated?: () => void;
}

export function PurchaseOrderPanel({
  projectId,
  projectName,
  items,
  suppliers,
  onOrderCreated
}: PurchaseOrderPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [ocNotes, setOcNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Seleccionar/deseleccionar todos
  const toggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  /**
   * Genera la orden de compra
   */
  const generateOC = async () => {
    if (!selectedSupplier) {
      toast.error('Seleccione un proveedor');
      return;
    }
    if (selectedItems.size === 0) {
      toast.error('Seleccione al menos un material');
      return;
    }

    setGenerating(true);
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplier);
      const ocItems = items
        .filter(item => selectedItems.has(item.id))
        .flatMap(item =>
          (item.materials || []).map(mat => ({
            materialName: mat.name,
            unit: mat.unit,
            qty: mat.quantity * item.projectQuantity,
            unitPrice: mat.price,
            total: mat.price * mat.quantity * item.projectQuantity
          }))
        );

      const ocData = {
        projectId,
        projectName,
        supplierId: selectedSupplier,
        supplierName: supplier?.name,
        items: ocItems,
        notes: ocNotes,
        createdAt: new Date().toISOString(),
        status: 'PENDIENTE' as const
      };

      // TODO: Guardar en Firestore collection 'purchaseOrders'
      // await addDocument('purchaseOrders', ocData);

      toast.success('Orden de compra generada exitosamente');
      setIsOpen(false);
      setSelectedItems(new Set());
      setOcNotes('');
      setSelectedSupplier('');
      onOrderCreated?.();
    } catch (error) {
      toast.error('Error al generar OC', { description: parseError(error as any) });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Botón flotante para abrir panel */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-24 bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition-all z-40"
        title="Generar Orden de Compra"
      >
        <ShoppingCart size={20} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900/40 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={20} />
                Generar Orden de Compra
                <span className="text-sm font-normal text-slate-500">
                  - {projectName}
                </span>
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Selección de proveedor */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">
                  Proveedor
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-neutral-900/40"
                  title="Seleccionar proveedor"
                >
                  <option value="">Seleccione un proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de materiales */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase">
                    Materiales a Comprar
                  </label>
                  <button
                    onClick={toggleAll}
                    className="text-[8px] text-blue-600 hover:underline"
                  >
                    {selectedItems.size === items.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {(items.length === 0) ? (
                    <p className="p-4 text-[9px] text-slate-500 text-center">
                      No hay materiales en el presupuesto.
                    </p>
                  ) : (
                    items.map(item =>
                      (item.materials || []).map((mat: any, idx: number) => {
                        const itemId = `${item.id}-${idx}`;
                        const totalQty = mat.quantity * item.projectQuantity;
                        const totalCost = mat.price * totalQty;
                        return (
                          <label
                            key={itemId}
                            className="flex items-center gap-3 p-2 border-b border-slate-100 hover:bg-black/20 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(itemId)}
                              onChange={() => toggleItem(itemId)}
                              className="rounded border-slate-300"
                            />
                            <div className="flex-1">
                              <p className="text-[9px] font-bold text-slate-800">{mat.name}</p>
                              <p className="text-[8px] text-slate-500">{item.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-slate-700">
                                {totalQty.toFixed(2)} {mat.unit}
                              </p>
                              <p className="text-[8px] text-slate-600">
                                Q {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={ocNotes}
                  onChange={(e) => setOcNotes(e.target.value)}
                  placeholder="Instrucciones especiales, condiciones de entrega, etc."
                  rows={3}
                  className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-[9px] font-bold uppercase bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={generateOC}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-[9px] font-bold uppercase bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
              >
                {generating ? 'Generando...' : <>
                  <FileDown size={12} />
                  Generar OC
                </>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

