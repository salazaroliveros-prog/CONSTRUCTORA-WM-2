export interface WarehouseMovement {
  date: string;
  type: 'Entrada' | 'Salida';
  qty: number;
  user: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  cat: 'Materiales' | 'Herramientas' | 'EPP';
  stock: number;
  unit: string;
  location: string;
  minStock: number;
  lastEntry: string;
  expiryDate?: string;
  history: WarehouseMovement[];
  coordinates?: { x: number; y: number };
  iconUrl?: string;
  projectId?: string;
  projectName?: string;
  itemId?: string;
  itemName?: string;
  budgetedQty?: number;
  budgetedCost?: number;
  usedQty?: number;
}
