export interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: number;
  documentId: string;
  email?: string;
  phone?: string;
  status: 'Activo' | 'Inactivo';
  address?: string;
  hireDate?: string;
  projectIds?: string[];
  notes?: string;
  bankName?: string;
  accountNumber?: string;
  documents?: { name: string; url: string; type: string }[];
}
