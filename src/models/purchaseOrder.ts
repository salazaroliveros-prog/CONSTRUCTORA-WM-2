export interface PurchaseOrderItem {
  itemId?: string;
  itemName?: string;
  materialName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  projectName: string;
  supplierId: string;
  supplierName: string;
  status: 'PENDIENTE' | 'APROBADA' | 'RECIBIDA' | 'CANCELADA';
  items: PurchaseOrderItem[];
  total: number;
  createdAt: string;
  notes?: string;
}
