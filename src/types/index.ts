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
  status: 'active' | 'used' | 'expired';
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