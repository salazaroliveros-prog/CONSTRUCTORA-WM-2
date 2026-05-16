export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  nit?: string;
  status: 'ACTIVO' | 'INACTIVO';
  rating?: number;
  projects?: string[];
  createdAt?: string;
}
