export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'INGRESO' | 'GASTO';
  category: string;
  projectId?: string;
  staffId?: string;
  qty?: number;
  unitCost?: number;
  createdAt?: string;
}
