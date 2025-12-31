import { Employee, Payroll, Expense, CollectionRecord, PaymentRecord } from '../../types';
import { API_BASE } from '../../config/api';

// Fetch helper
export const fetchJSON = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok || (json && json.ok === false)) {
        throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    return typeof json?.data !== 'undefined' ? json.data : json;
};

// Format date as YYYY-MM-DD using local timezone
// Since the user's system is in WIB (UTC+7), this will return WIB dates
export const formatDateToWIB = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper: Format transaction date string (potentially UTC or WIB) to YYYY-MM-DD in WIB
export const formatTransactionDateToWIB = (input: string | Date): string => {
    if (!input) return '';
    const dateStr = typeof input === 'string' ? input : input.toISOString();
    // If string has no timezone (Z or +HH:MM), treat as UTC by appending Z
    // This matches TransactionManagement.tsx logic
    const normalized = /Z|\+\d{2}:?\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;

    const d = new Date(normalized);
    // Use Intl to get the date in Jakarta timezone
    const parts = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
};

// Month names in Indonesian
export const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Helper: map rows from backend (snake_case) to frontend types (camelCase)
export const mapEmployeeRow = (row: any): Employee => ({
    id: row.id,
    name: row.name,
    position: row.position,
    baseSalary: Number(row.base_salary),
    bonus: Number(row.bonus) || 0,
    startDate: row.start_date,
    status: row.status || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const mapPayrollRow = (row: any): Payroll => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    position: row.position,
    periodMonth: row.period_month,
    totalSalary: Number(row.total_salary),
    paymentDate: row.payment_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const mapExpenseRow = (row: any): Expense => ({
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const mapCollectionRow = (row: any): CollectionRecord => ({
    id: row.id,
    date: row.date,
    amount: Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const mapPaymentRow = (row: any): PaymentRecord => ({
    id: row.id,
    date: row.date,
    amount: Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

// Types for sales data
export interface SalesDataTrend {
    percentage: number;
    isPositive: boolean;
}

export interface SalesData {
    daily: Array<{ date: string; sales: number; transactions: number }>;
    totalRevenue: number;
    totalTransactions: number;
    averagePerTransaction: number;
    trends: {
        revenue: SalesDataTrend;
        transactions: SalesDataTrend;
        averageTransaction: SalesDataTrend;
    };
}

export interface Financials {
    omzet: number;
    cogs: number;
    discounts: number;
}

export interface StockItem {
    product: string;
    remaining: number;
    minStock: number;
    status: 'low' | 'normal';
}

export interface Totals {
    inkaso: number;
    bayar: number;
    tagihan: number;
}

export { API_BASE };
