export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'INGRESO' | 'GASTO';
  category: string;
  projectId?: string;
  budgetLineId?: string;
  budgetLineCode?: string;
  staffId?: string;
  qty?: number;
  unitCost?: number;
  createdAt?: string;
}
