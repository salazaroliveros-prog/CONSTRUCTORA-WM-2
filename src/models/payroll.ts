export interface PayrollEmployee {
  staffId: string;
  name: string;
  role: string;
  baseSalary: number;
  daysWorked: number;
  dailySalary: number;
  grossPay: number;
  igss: number;
  irtra: number;
  intecap: number;
  bonuses: number;
  deductions: number;
  netPay: number;
}

export interface Payroll {
  id: string;
  projectId: string;
  projectName: string;
  period: string;
  type: 'CAMPO' | 'ADMINISTRATIVO';
  employees: PayrollEmployee[];
  totalGross: number;
  totalDeductions: number;
  totalBonuses: number;
  totalNet: number;
  status: 'BORRADOR' | 'PAGADA' | 'CANCELADA';
  createdAt: string;
  paidAt?: string;
  notes?: string;
}
