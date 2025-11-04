export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'apoteker' | 'kasir';
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  buyPrice: number;
  expiryDate: string;
  requiresPrescription: boolean;
  supplier: string;
  description?: string;
}

export interface Transaction {
  id: string;
  date: string;
  cashierId: string;
  items: TransactionItem[];
  subtotal: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  total: number;
  paymentMethod: 'cash';
  prescriptionId?: string;
  status: 'completed' | 'pending' | 'cancelled';
}

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Prescription {
  id: string;
  doctorName: string;
  patientName: string;
  date: string;
  medications: PrescriptionMedication[];
  status: 'active' | 'used';
}

export interface PrescriptionMedication {
  productId: string;
  productName: string;
  quantity: number;
  dosage: string;
  instructions: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address: string;
  phone: string;
  email: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  baseSalary: number;
  bonus: number;
  startDate: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  employeeName?: string;
  position?: string;
  periodMonth: string;
  totalSalary: number;
  paymentDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}