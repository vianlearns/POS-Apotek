import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Download,
  DollarSign,
  Users,
  Receipt,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { Employee, Payroll, Expense, CollectionRecord, PaymentRecord } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';


const ReportsInterface = () => {
  // Set default dates to last 30 days (WIB timezone)
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(currentDate);
  thirtyDaysAgo.setDate(currentDate.getDate() - 30);
  
  // Convert to WIB timezone (UTC+7) and format as YYYY-MM-DD
  const formatDateToWIB = (date: Date) => {
    // Create date in WIB timezone (UTC+7)
    const wibOffset = 7 * 60; // WIB is UTC+7
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const wibDate = new Date(utc + (wibOffset * 60000));
    return wibDate.toISOString().split('T')[0];
  };
  
  const { userProfile } = useAuth();
  
  const [dateFrom, setDateFrom] = useState(formatDateToWIB(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDateToWIB(currentDate));
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>({
    daily: [],
    monthly: [],
    totalRevenue: 0,
    totalTransactions: 0,
    averagePerTransaction: 0,
    trends: {
      revenue: { percentage: 0, isPositive: true },
      transactions: { percentage: 0, isPositive: true },
      averageTransaction: { percentage: 0, isPositive: true }
    }
  });
  const [financials, setFinancials] = useState<{ omzet: number; cogs: number; discounts: number }>({
    omzet: 0,
    cogs: 0,
    discounts: 0,
  });
  const [stockMovement, setStockMovement] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportsData();
    fetchEmployees();
    fetchPayrolls();
    fetchExpenses();
    fetchCollections();
    fetchPayments();
  }, [dateFrom, dateTo]);

  const totals = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const inkaso = (collections || [])
      .filter((c: any) => {
        const d = new Date(c.date);
        return d >= from && d <= to;
      })
      .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const bayar = (payments || [])
      .filter((p: any) => {
        const d = new Date(p.date);
        return d >= from && d <= to;
      })
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    return { inkaso, bayar, tagihan: inkaso - bayar };
  }, [dateFrom, dateTo, collections, payments]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);

      // Calculate previous period dates
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      const periodLength = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const prevToDate = new Date(fromDate);
      prevToDate.setDate(prevToDate.getDate() - 1);
      const prevFromDate = new Date(prevToDate);
      prevFromDate.setDate(prevFromDate.getDate() - periodLength + 1);

      // Fetch current period sales data
      const transactionsData = await fetchJSON(
        `${API_BASE}/transactions?from=${dateFrom}&to=${dateTo}&status=completed`
      );

      // Fetch previous period sales data for comparison
      const prevTransactionsData = await fetchJSON(
        `${API_BASE}/transactions?from=${formatDateToWIB(prevFromDate)}&to=${formatDateToWIB(prevToDate)}&status=completed`
      );
      
      // Reset daily sales map
      const dailySalesMap = {};
      
      // Pastikan transactionsData adalah array dan proses grouping
      if (Array.isArray(transactionsData) && transactionsData.length > 0) {
        transactionsData.forEach((item: any) => {
          // Ambil tanggal saja (YYYY-MM-DD) dari format ISO
          let dateKey = '';
          
          try {
            if (item.date) {
              // Format date: "2025-11-29 05:02:31.079196+00" atau ISO
              if (typeof item.date === 'string') {
                // Ambil bagian YYYY-MM-DD saja
                dateKey = item.date.substring(0, 10);
              } else {
                dateKey = formatDateToWIB(new Date(item.date));
              }
            }
          } catch (e) {
            console.warn('Error parsing date:', item.date, e);
            return;
          }
          
          if (!dateKey) return;

          // Initialize jika belum ada
          if (!dailySalesMap[dateKey]) {
            dailySalesMap[dateKey] = { 
              date: dateKey, 
              sales: 0, 
              transactions: 0 
            };
          }
          
          // Tambahkan sales dan increment transactions - PAKAI FIELD YANG BENAR
          const itemSales = Number(item.sales || item.total || 0);
          const itemTransactions = Number(item.transactions || 1);
          
          dailySalesMap[dateKey].sales += itemSales;
          dailySalesMap[dateKey].transactions += itemTransactions;
        
        });
      }

      // Convert ke array dan urutkan
      const sortedDailySales = Object.values(dailySalesMap || {})
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Hitung total dari data yang sudah dikelompokkan - INI YANG BENAR
      const totalRevenue = sortedDailySales.reduce((sum: number, day: any) => sum + (Number(day.sales) || 0), 0);
      const totalTransactions = sortedDailySales.reduce((sum: number, day: any) => sum + (Number(day.transactions) || 0), 0);
      const averagePerTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Process previous period data with same grouping logic
      const prevDailySalesMap = {};
      if (Array.isArray(prevTransactionsData) && prevTransactionsData.length > 0) {
        prevTransactionsData.forEach((item: any) => {
          let dateKey = '';
          try {
            if (item.date) {
              if (typeof item.date === 'string') {
                dateKey = item.date.substring(0, 10);
              } else {
                dateKey = formatDateToWIB(new Date(item.date));
              }
            }
          } catch (e) {
            return;
          }
          
          if (!dateKey) return;

          if (!prevDailySalesMap[dateKey]) {
            prevDailySalesMap[dateKey] = { date: dateKey, sales: 0, transactions: 0 };
          }
          
          // PAKAI FIELD YANG BENAR untuk previous data juga
          const prevItemSales = Number(item.sales || item.total || 0);
          const prevItemTransactions = Number(item.transactions || 1);
          
          prevDailySalesMap[dateKey].sales += prevItemSales;
          prevDailySalesMap[dateKey].transactions += prevItemTransactions;
        });
      }

      const sortedPrevDailySales = Object.values(prevDailySalesMap || {});
      const prevTotalRevenue = sortedPrevDailySales.reduce((sum: number, day: any) => sum + (Number(day.sales) || 0), 0);
      const prevTotalTransactions = sortedPrevDailySales.reduce((sum: number, day: any) => sum + (Number(day.transactions) || 0), 0);
      const prevAveragePerTransaction = prevTotalTransactions > 0 ? prevTotalRevenue / prevTotalTransactions : 0;

      // Simpan data transaksi mentah untuk keperluan top products dan financials
      const rawTransactionsData = Array.isArray(transactionsData) ? transactionsData : [];
      const rawPrevTransactionsData = Array.isArray(prevTransactionsData) ? prevTransactionsData : [];

      // Calculate trends
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return { percentage: 0, isPositive: true };
        const change = ((current - previous) / previous) * 100;
        return {
          percentage: Math.abs(change),
          isPositive: change >= 0
        };
      };

      const trends = {
        revenue: calculateTrend(totalRevenue, prevTotalRevenue),
        transactions: calculateTrend(totalTransactions, prevTotalTransactions),
        averageTransaction: calculateTrend(averagePerTransaction, prevAveragePerTransaction)
      };

      setSalesData({
        daily: sortedDailySales, // <-- Ini harusnya data yang sudah dikelompokkan
        totalRevenue,
        totalTransactions,
        averagePerTransaction,
        trends
      });

      // Process top products - menggunakan data mentah
      const productSales = rawTransactionsData.reduce((acc: any, transaction: any) => {
        transaction.transaction_items?.forEach((item: any) => {
          if (!acc[item.product_name]) {
            acc[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
          }
          acc[item.product_name].quantity += item.quantity;
          acc[item.product_name].revenue += Number(item.total);
        });
        return acc;
      }, {});

      const sortedProducts = Object.values(productSales || {})
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopProducts(sortedProducts);

      // Fetch stock movement
      const productsData = await fetchJSON(`${API_BASE}/products`);
      const productsArr = Array.isArray(productsData) ? productsData : [];
      // Build buy price map for HPP calculation
      const buyPriceMap = new Map<string, number>(
        productsArr.map((p: any) => [String(p.id), Number(p.buy_price) || 0])
      );
      // Calculate Omzet (sum of selling price x quantity sold) - menggunakan data mentah
      const omzet = rawTransactionsData.reduce((sum: number, t: any) => {
        if (Array.isArray(t.transaction_items)) {
          return sum + t.transaction_items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        }
        // Fallback to subtotal if items aren't present
        return sum + Number(t.subtotal || 0);
      }, 0);
      // Calculate HPP (COGS) using product buy price x quantity - menggunakan data mentah
      const cogs = rawTransactionsData.reduce((sum: number, t: any) => {
        if (Array.isArray(t.transaction_items)) {
          return sum + t.transaction_items.reduce((s: number, i: any) => {
            const buyPrice = buyPriceMap.get(String(i.product_id)) || 0;
            return s + (Number(i.quantity || 0) * buyPrice);
          }, 0);
        }
        return sum;
      }, 0);
      // Calculate total discounts = subtotal - total across transactions - menggunakan data mentah
      const discounts = rawTransactionsData.reduce((sum: number, t: any) => {
        const subtotal = Number(t.subtotal || 0);
        const total = Number(t.total || 0);
        if (subtotal > 0 && total >= 0) return sum + Math.max(0, subtotal - total);
        const disc = Number(t.discount || 0);
        const dtype = t.discount_type;
        if (dtype === 'percentage') return sum + (subtotal * disc / 100);
        if (dtype === 'fixed') return sum + disc;
        return sum;
      }, 0);
      setFinancials({ omzet, cogs, discounts });
      const stockData = productsArr.map(product => ({
        product: product.name,
        remaining: product.stock,
        minStock: product.min_stock,
        status: Number(product.stock) <= Number(product.min_stock) ? 'low' : 'normal'
      }));

      setStockMovement(stockData);

    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data laporan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/employees`);
      const arr = Array.isArray(data) ? data : [];
      setEmployees(arr.map(mapEmployeeRow));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPayrolls = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/payrolls`);
      const arr = Array.isArray(data) ? data : [];
      setPayrolls(arr.map(mapPayrollRow));
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/expenses`);
      const arr = Array.isArray(data) ? data : [];
      setExpenses(arr.map(mapExpenseRow));
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchCollections = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/collections`);
      const arr = Array.isArray(data) ? data : [];
      setCollections(arr.map((row: any) => ({
        id: row.id,
        date: row.date,
        amount: Number(row.amount),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/payments`);
      const arr = Array.isArray(data) ? data : [];
      setPayments(arr.map((row: any) => ({
        id: row.id,
        date: row.date,
        amount: Number(row.amount),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const handleSaveEmployee = async (formData: FormData) => {
    try {
      const employeeData = {
        name: formData.get('name') as string,
        position: formData.get('position') as string,
        base_salary: Number(formData.get('baseSalary')),
        bonus: Number(formData.get('bonus')) || 0,
        start_date: formData.get('startDate') as string,
        status: 'active'
      };

      if (editingEmployee) {
        await fetchJSON(`${API_BASE}/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employeeData)
        });
        toast({ title: "Berhasil", description: "Data karyawan berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/employees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employeeData)
        });
        toast({ title: "Berhasil", description: "Karyawan baru berhasil ditambahkan" });
      }

      setShowEmployeeDialog(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({ title: "Error", description: "Gagal menyimpan data karyawan", variant: "destructive" });
    }
  };

  const handleSavePayroll = async (formData: FormData) => {
    try {
      const payrollData = {
        employee_id: formData.get('employeeId') as string,
        period_month: formData.get('periodMonth') as string,
        total_salary: Number(formData.get('totalSalary')),
        payment_date: formData.get('paymentDate') as string,
        notes: (formData.get('notes') as string) || ''
      };

      if (editingPayroll) {
        await fetchJSON(`${API_BASE}/payrolls/${editingPayroll.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payrollData)
        });
        toast({ title: "Berhasil", description: "Data penggajian berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/payrolls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payrollData)
        });
        toast({ title: "Berhasil", description: "Data penggajian berhasil ditambahkan" });
      }

      setShowPayrollDialog(false);
      setEditingPayroll(null);
      fetchPayrolls();
    } catch (error) {
      console.error('Error saving payroll:', error);
      toast({ title: "Error", description: "Gagal menyimpan data penggajian", variant: "destructive" });
    }
  };

  const handleSaveExpense = async (formData: FormData) => {
    try {
      const expenseData = {
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        amount: Number(formData.get('amount')),
        date: formData.get('date') as string,
        created_by: (userProfile?.name || userProfile?.username || 'admin')
      };

      if (editingExpense) {
        await fetchJSON(`${API_BASE}/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData)
        });
        toast({ title: "Berhasil", description: "Data pengeluaran berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData)
        });
        toast({ title: "Berhasil", description: "Data pengeluaran berhasil ditambahkan" });
      }

      setShowExpenseDialog(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({ title: "Error", description: "Gagal menyimpan data pengeluaran", variant: "destructive" });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) return;
    
    try {
      await fetchJSON(`${API_BASE}/employees/${id}`, { method: 'DELETE' });
      toast({ title: "Berhasil", description: "Karyawan berhasil dihapus" });
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({ title: "Error", description: "Gagal menghapus karyawan", variant: "destructive" });
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data penggajian ini?')) return;
    
    try {
      await fetchJSON(`${API_BASE}/payrolls/${id}`, { method: 'DELETE' });
      toast({ title: "Berhasil", description: "Data penggajian berhasil dihapus" });
      fetchPayrolls();
    } catch (error) {
      console.error('Error deleting payroll:', error);
      toast({ title: "Error", description: "Gagal menghapus data penggajian", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengeluaran ini?')) return;
    
    try {
      await fetchJSON(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
      toast({ title: "Berhasil", description: "Pengeluaran berhasil dihapus" });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({ title: "Error", description: "Gagal menghapus pengeluaran", variant: "destructive" });
    }
  };





  const exportToExcel = async () => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Ambil data produk untuk harga jual & harga modal
      const productsData = await fetchJSON(`${API_BASE}/products`);
      const productsArr = Array.isArray(productsData) ? productsData : [];
      const productPriceByName = new Map<string, { price: number; buy_price: number }>(
        productsArr.map((p: any) => [p.name, { price: Number(p.price) || 0, buy_price: Number(p.buy_price) || 0 }])
      );

      // Ambil data transaksi untuk transparansi diskon per transaksi
      const transactionsData = await fetchJSON(
        `${API_BASE}/transactions?from=${dateFrom}&to=${dateTo}&status=completed`
      );
      const transactionsArr = Array.isArray(transactionsData) ? transactionsData : [];

      // Sales Summary Sheet
      const salesSummary = [
        ['LAPORAN PENJUALAN'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['RINGKASAN'],
        ['Total Penjualan', Number(salesData.totalRevenue)],
        ['Total Transaksi', Number(salesData.totalTransactions)],
        ['Rata-rata per Transaksi', Number(salesData.averagePerTransaction)]
      ];

      const wsSales = XLSX.utils.aoa_to_sheet(salesSummary);
      // Format angka pada Ringkasan Penjualan
      const rangeSales = XLSX.utils.decode_range(wsSales['!ref'] as string);
      for (let R = 4; R <= 6; R++) {
        const cell = wsSales[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsSales['!cols'] = [{ wch: 20 }, { wch: 20 }];
      wsSales['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSales, 'Ringkasan Penjualan');

      // Top Products Sheet
      const topProductsData = [
        ['PRODUK TERLARIS'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Nama Produk', 'Harga Jual', 'Harga Modal', 'Kuantitas Terjual', 'Omzet', 'HPP', 'Laba Kotor']
      ];

      topProducts.forEach((product: any) => {
        const prices = productPriceByName.get(product.name) || { price: 0, buy_price: 0 };
        const qty = Number(product.quantity || 0);
        const sell = Number(prices.price || 0);
        const cost = Number(prices.buy_price || 0);
        const omzet = sell * qty; // harga jual x terjual (konsisten dengan definisi omzet)
        const hpp = cost * qty;   // harga modal x terjual
        const grossProfit = Math.max(0, omzet - hpp);
        topProductsData.push([
          product.name,
          sell,
          cost,
          qty,
          omzet,
          hpp,
          grossProfit
        ]);
      });

      const wsProducts = XLSX.utils.aoa_to_sheet(topProductsData);
      const rangeProducts = XLSX.utils.decode_range(wsProducts['!ref'] as string);
      for (let R = 4; R <= rangeProducts.e.r; R++) {
        // Kolom: 1=Harga Jual, 2=Harga Modal, 3=Qty, 4=Omzet, 5=HPP, 6=Laba Kotor
        for (const C of [1, 2, 3, 4, 5, 6]) {
          const cell = wsProducts[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = '#,##0';
          }
        }
      }
      wsProducts['!cols'] = [
        { wch: 30 }, // Nama Produk
        { wch: 14 }, // Harga Jual
        { wch: 14 }, // Harga Modal
        { wch: 12 }, // Qty
        { wch: 14 }, // Omzet
        { wch: 14 }, // HPP
        { wch: 14 }, // Laba Kotor
      ];
      wsProducts['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Produk Terlaris');

      // Stock Report Sheet
      const stockData = [
        ['LAPORAN STOK'],
        [`Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`],
        [''],
        ['Nama Produk', 'Stok Saat Ini', 'Stok Minimum', 'Status']
      ];

      stockMovement.forEach((item: any) => {
        stockData.push([
          item.product,
          item.remaining,
          item.minStock,
          item.status
        ]);
      });

      const wsStock = XLSX.utils.aoa_to_sheet(stockData);
      wsStock['!cols'] = [
        { wch: 30 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
      ];
      wsStock['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsStock, 'Laporan Stok');

      // Profit & Loss Sheet (Laba Rugi)
      const payrollTotal = (payrolls || [])
        .filter((p: any) => {
          const d = new Date(p.payment_date || p.paymentDate);
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          return d >= from && d <= to;
        })
        .reduce((sum: number, p: any) => sum + Number(p.total_salary || p.totalSalary || 0), 0);

      const expenseTotal = (expenses || [])
        .filter((e: any) => {
          const d = new Date(e.date);
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          return d >= from && d <= to;
        })
        .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

      // Inkaso (Collections) & Pembayaran Inkaso (Payments)
      const collectionTotal = (collections || [])
        .filter((c: any) => {
          const d = new Date(c.date);
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          return d >= from && d <= to;
        })
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

      const paymentTotal = (payments || [])
        .filter((p: any) => {
          const d = new Date(p.date);
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          return d >= from && d <= to;
        })
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      const receivableTotal = collectionTotal - paymentTotal;

      const profitLoss = Number(financials.omzet) - Number(financials.cogs) - Number(financials.discounts) - payrollTotal - expenseTotal;
      const plSummary = [
        ['LAPORAN LABA RUGI'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Omzet (Harga jual x terjual)', Number(financials.omzet)],
        ['HPP (Harga modal x terjual)', Number(financials.cogs)],
        ['Diskon Transaksi', Number(financials.discounts)],
        ['Gaji Karyawan', payrollTotal],
        ['Pengeluaran', expenseTotal],
        ['Inkaso (Tagihan dibuat)', collectionTotal],
        ['Pembayaran Inkaso', paymentTotal],
        ['Tagihan (Inkaso - Pembayaran)', receivableTotal],
        ['Laba Rugi', profitLoss],
      ];
      const wsPL = XLSX.utils.aoa_to_sheet(plSummary);
      const rangePL = XLSX.utils.decode_range(wsPL['!ref'] as string);
      for (let R = 3; R <= 11; R++) {
        const cell = wsPL[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsPL['!cols'] = [{ wch: 36 }, { wch: 18 }];
      wsPL['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsPL, 'Laba Rugi');

      // Daily Sales Sheet (Penjualan Harian)
      const dailySalesSheet = [
        ['PENJUALAN HARIAN'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Tanggal', 'Penjualan', 'Jumlah Transaksi']
      ];
      (salesData.daily || []).forEach((day: any) => {
        dailySalesSheet.push([
          day.date,
          Number(day.sales || 0),
          Number(day.transactions || 0)
        ]);
      });
      const wsDaily = XLSX.utils.aoa_to_sheet(dailySalesSheet);
      const rangeDaily = XLSX.utils.decode_range(wsDaily['!ref'] as string);
      for (let R = 4; R <= rangeDaily.e.r; R++) {
        const cell = wsDaily[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsDaily['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 18 }];
      wsDaily['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Penjualan Harian');

      // Transactions Sheet (Transaksi)
      const txSheet = [
        ['DATA TRANSAKSI'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Tanggal', 'Subtotal', 'Diskon', 'Total', 'Metode', 'Kasir']
      ];
      transactionsArr.forEach((t: any) => {
        const subtotal = Number(t.subtotal || 0);
        // Diskon per transaksi: gunakan subtotal - total jika tersedia, atau field diskon
        const total = Number(t.total || 0);
        let disc = 0;
        if (subtotal > 0 && total >= 0) {
          disc = Math.max(0, subtotal - total);
        } else {
          const dtype = t.discount_type;
          const dval = Number(t.discount || 0);
          if (dtype === 'percentage') disc = subtotal * dval / 100;
          else if (dtype === 'fixed') disc = dval;
        }
        txSheet.push([
          t.date?.split('T')[0] || '-',
          subtotal,
          disc,
          total,
          t.payment_method || t.paymentMethod || '-',
          t.cashier || t.cashier_name || t.created_by || '-'
        ]);
      });
      const wsTx = XLSX.utils.aoa_to_sheet(txSheet);
      const rangeTx = XLSX.utils.decode_range(wsTx['!ref'] as string);
      for (let R = 4; R <= rangeTx.e.r; R++) {
        for (const C of [1, 2, 3]) { // Subtotal, Diskon, Total
          const cell = wsTx[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = '#,##0';
          }
        }
      }
      wsTx['!cols'] = [
        { wch: 12 }, // Tanggal
        { wch: 14 }, // Subtotal
        { wch: 12 }, // Diskon
        { wch: 14 }, // Total
        { wch: 14 }, // Metode
        { wch: 18 }, // Kasir
      ];
      wsTx['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsTx, 'Transaksi');

      // Payrolls Sheet (Penggajian)
      const payrollSheet = [
        ['DATA PENGGAJIAN'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Karyawan (ID)', 'Periode', 'Total Gaji', 'Tanggal Bayar', 'Catatan']
      ];
      (payrolls || []).forEach((p: any) => {
        payrollSheet.push([
          p.employee_id || p.employeeId || '-',
          p.period_month || p.periodMonth || '-',
          Number(p.total_salary || p.totalSalary || 0),
          p.payment_date || p.paymentDate || '-',
          p.notes || ''
        ]);
      });
      const wsPayroll = XLSX.utils.aoa_to_sheet(payrollSheet);
      const rangePayroll = XLSX.utils.decode_range(wsPayroll['!ref'] as string);
      for (let R = 4; R <= rangePayroll.e.r; R++) {
        const cell = wsPayroll[XLSX.utils.encode_cell({ r: R, c: 2 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsPayroll['!cols'] = [
        { wch: 20 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
      ];
      wsPayroll['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsPayroll, 'Penggajian');

      // Expenses Sheet (Pengeluaran)
      const expenseSheet = [
        ['DATA PENGELUARAN'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Kategori', 'Deskripsi', 'Jumlah', 'Tanggal', 'Dibuat Oleh']
      ];
      (expenses || []).forEach((e: any) => {
        expenseSheet.push([
          e.category || '-',
          e.description || '',
          Number(e.amount || 0),
          e.date || '-',
          e.created_by || e.createdBy || '-'
        ]);
      });
      const wsExpenses = XLSX.utils.aoa_to_sheet(expenseSheet);
      const rangeExpenses = XLSX.utils.decode_range(wsExpenses['!ref'] as string);
      for (let R = 4; R <= rangeExpenses.e.r; R++) {
        const cell = wsExpenses[XLSX.utils.encode_cell({ r: R, c: 2 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsExpenses['!cols'] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
      ];
      wsExpenses['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Pengeluaran');

      // Inkaso Sheet (Detail per baris)
      const inkasoSheet = [
        ['DATA INKASO'],
        [`Periode: ${dateFrom} sampai ${dateTo}`],
        [''],
        ['Tanggal', 'Jenis', 'Jumlah']
      ];
      (collections || []).forEach((c: any) => {
        inkasoSheet.push([
          c.date || '-',
          'Inkaso',
          Number(c.amount || 0),
        ]);
      });
      (payments || []).forEach((p: any) => {
        inkasoSheet.push([
          p.date || '-',
          'Pembayaran',
          Number(p.amount || 0),
        ]);
      });
      const wsInkaso = XLSX.utils.aoa_to_sheet(inkasoSheet);
      const rangeInkaso = XLSX.utils.decode_range(wsInkaso['!ref'] as string);
      for (let R = 4; R <= rangeInkaso.e.r; R++) {
        const cell = wsInkaso[XLSX.utils.encode_cell({ r: R, c: 2 })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      }
      wsInkaso['!cols'] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
      ];
      wsInkaso['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsInkaso, 'Inkaso');

      // Generate filename with current date
      const today = new Date();
      const filename = `Laporan_Apotek_${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Berhasil",
        description: `Laporan telah diexport ke file ${filename}`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Gagal mengexport laporan",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div className="flex justify-between items-center slide-up">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-accent/10">
            <BarChart3 className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Laporan</h2>
            <p className="text-muted-foreground font-medium">
              Analisis penjualan dan keuangan apotek
            </p>
          </div>
        </div>
        <Button 
          onClick={exportToExcel}
          className="bg-accent hover:bg-accent/90 shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="medical-card p-6 slide-up" style={{animationDelay: '0.1s'}}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Filter Periode</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="dateFrom" className="font-medium">Dari Tanggal</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-12 bg-background/50 border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo" className="font-medium">Sampai Tanggal</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-12 bg-background/50 border-border/60"
            />
          </div>
          <Button 
            onClick={fetchReportsData}
            className="h-12 bg-primary hover:bg-primary-hover"
          >
            Terapkan Filter
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-6 slide-up" style={{animationDelay: '0.2s'}}>
        <TabsList className="bg-card/60 p-1">
          <TabsTrigger value="sales" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Penjualan</TabsTrigger>
          <TabsTrigger value="stock" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Stok</TabsTrigger>
          <TabsTrigger value="employees" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Karyawan</TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">Pengeluaran</TabsTrigger>
          <TabsTrigger value="profit" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Laba Rugi</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stats-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium">Penjualan Bulan Ini</p>
                  <div className="text-2xl font-bold text-primary">
                    Rp {salesData.totalRevenue.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                {salesData.trends.revenue.isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1 text-secondary" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1 text-destructive" />
                )}
                {salesData.trends.revenue.isPositive ? '+' : '-'}{salesData.trends.revenue.percentage.toFixed(1)}% dari periode sebelumnya
              </div>
            </div>

            <div className="stats-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-secondary/10">
                  <BarChart3 className="h-6 w-6 text-secondary" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium">Total Transaksi</p>
                  <div className="text-2xl font-bold text-secondary">
                    {salesData.totalTransactions.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                {salesData.trends.transactions.isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1 text-secondary" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1 text-destructive" />
                )}
                {salesData.trends.transactions.isPositive ? '+' : '-'}{salesData.trends.transactions.percentage.toFixed(1)}% dari periode sebelumnya
              </div>
            </div>

            <div className="stats-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-full bg-accent/10">
                  <DollarSign className="h-6 w-6 text-accent" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium">Rata-rata per Transaksi</p>
                  <div className="text-2xl font-bold text-accent">
                    Rp {Math.round(salesData.averagePerTransaction).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                {salesData.trends.averageTransaction.isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1 text-secondary" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1 text-destructive" />
                )}
                {salesData.trends.averageTransaction.isPositive ? '+' : '-'}{salesData.trends.averageTransaction.percentage.toFixed(1)}% dari periode sebelumnya
              </div>
            </div>
          </div>



          {/* Sales by Period */}
          <div className="grid grid-cols-1 gap-6">
            <div className="medical-card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                <h3 className="text-lg font-semibold text-foreground">Penjualan Harian</h3>
                <p className="text-sm text-muted-foreground">30 hari terakhir</p>
              </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">Tanggal</TableHead>
                    <TableHead className="font-semibold">Jumlah Transaksi</TableHead>
                    <TableHead className="font-semibold">Total Penjualan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.daily.map((day, index) => (
                    <TableRow
                      key={index}
                      className="border-border/30 hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        // day.date sudah format YYYY-MM-DD; kirim ke Dashboard via CustomEvent
                        window.dispatchEvent(new CustomEvent('navigateToTransactions', { detail: { date: day.date } }));
                      }}
                    >
                      <TableCell className="font-medium">{new Date(day.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{day.transactions}</TableCell>
                      <TableCell className="font-medium text-primary">Rp {day.sales.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pergerakan Stok</CardTitle>
              <CardDescription>
                Laporan stok masuk, keluar, dan sisa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                      <TableHead>Stok Saat Ini</TableHead>
                      <TableHead>Min. Stok</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovement.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.product}</TableCell>
                      <TableCell>{item.remaining}</TableCell>
                      <TableCell>{item.minStock}</TableCell>
                      <TableCell>
                        <Badge variant={item.remaining <= item.minStock ? "destructive" : "default"}>
                          {item.remaining <= item.minStock ? "Rendah" : "Normal"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kelola Karyawan</h3>
            <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingEmployee(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Karyawan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
                  <DialogDescription>
                    {editingEmployee ? 'Perbarui data karyawan' : 'Tambahkan karyawan baru'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEmployee(new FormData(e.currentTarget));
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editingEmployee?.name || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Jabatan</Label>
                    <Input
                      id="position"
                      name="position"
                      defaultValue={editingEmployee?.position || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseSalary">Gaji Pokok</Label>
                    <Input
                      id="baseSalary"
                      name="baseSalary"
                      type="number"
                      defaultValue={editingEmployee?.baseSalary || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bonus">Bonus (Opsional)</Label>
                    <Input
                      id="bonus"
                      name="bonus"
                      type="number"
                      defaultValue={editingEmployee?.bonus || 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Tanggal Masuk</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      defaultValue={editingEmployee?.startDate?.split('T')[0] || ''}
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                      Batal
                    </Button>
                    <Button type="submit">
                      {editingEmployee ? 'Perbarui' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Daftar Karyawan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Gaji Pokok</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Tanggal Masuk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>Rp {employee.baseSalary.toLocaleString('id-ID')}</TableCell>
                      <TableCell>Rp {employee.bonus.toLocaleString('id-ID')}</TableCell>
                      <TableCell>{new Date(employee.startDate).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                          {employee.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingEmployee(employee);
                              setShowEmployeeDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteEmployee(employee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kelola Penggajian</h3>
            <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingPayroll(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Penggajian
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPayroll ? 'Edit Penggajian' : 'Tambah Penggajian'}</DialogTitle>
                  <DialogDescription>
                    {editingPayroll ? 'Perbarui data penggajian' : 'Tambahkan data penggajian baru'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSavePayroll(new FormData(e.currentTarget));
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Karyawan</Label>
                    <Select name="employeeId" defaultValue={editingPayroll?.employeeId || ''} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih karyawan" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter(emp => emp.status === 'active').map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name} - {employee.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="periodMonth">Periode Bulan</Label>
                    <Input
                      id="periodMonth"
                      name="periodMonth"
                      type="month"
                      defaultValue={editingPayroll?.periodMonth || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalSalary">Total Gaji</Label>
                    <Input
                      id="totalSalary"
                      name="totalSalary"
                      type="number"
                      defaultValue={editingPayroll?.totalSalary || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Tanggal Dibayar</Label>
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="date"
                      defaultValue={editingPayroll?.paymentDate?.split('T')[0] || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Catatan (Opsional)</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={editingPayroll?.notes || ''}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowPayrollDialog(false)}>
                      Batal
                    </Button>
                    <Button type="submit">
                      {editingPayroll ? 'Perbarui' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Riwayat Penggajian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Total Gaji</TableHead>
                    <TableHead>Tanggal Dibayar</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrolls.map((payroll) => (
                    <TableRow key={payroll.id}>
                      <TableCell>{payroll.employeeName || 'N/A'}</TableCell>
                      <TableCell>{payroll.periodMonth}</TableCell>
                      <TableCell>Rp {payroll.totalSalary.toLocaleString('id-ID')}</TableCell>
                      <TableCell>{new Date(payroll.paymentDate).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{payroll.notes || '-'}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPayroll(payroll);
                              setShowPayrollDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePayroll(payroll.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kelola Pengeluaran</h3>
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingExpense(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pengeluaran
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</DialogTitle>
                  <DialogDescription>
                    {editingExpense ? 'Perbarui data pengeluaran' : 'Tambahkan pengeluaran baru'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveExpense(new FormData(e.currentTarget));
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <Select name="category" defaultValue={editingExpense?.category || ''} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operasional">Operasional</SelectItem>
                        <SelectItem value="inventori">Inventori</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Deskripsi</Label>
                    <Input
                      id="description"
                      name="description"
                      defaultValue={editingExpense?.description || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Jumlah</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      defaultValue={editingExpense?.amount || ''}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Tanggal</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={editingExpense?.date?.split('T')[0] || ''}
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowExpenseDialog(false)}>
                      Batal
                    </Button>
                    <Button type="submit">
                      {editingExpense ? 'Perbarui' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="h-5 w-5 mr-2" />
                Daftar Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Dibuat Oleh</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>Rp {expense.amount.toLocaleString('id-ID')}</TableCell>
                      <TableCell>{new Date(expense.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{expense.createdBy}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingExpense(expense);
                              setShowExpenseDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Laba Rugi</CardTitle>
              <CardDescription>Berdasarkan periode yang dipilih ({dateFrom} - {dateTo})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Omzet */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg text-primary">Omzet</h4>
                <div className="flex justify-between">
                  <span>Total Penjualan (Harga jual x terjual)</span>
                  <span className="font-medium text-green-600">Rp {financials.omzet.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Omzet</span>
                  <span className="text-green-600">Rp {financials.omzet.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Inkaso */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg">Inkaso</h4>
                <div className="flex justify-between">
                  <span>Inkaso (Tagihan dibuat)</span>
                  <span className="font-medium text-red-600">Rp {Number(totals.inkaso || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pembayaran Inkaso</span>
                  <span className="font-medium text-green-600">Rp {Number(totals.bayar || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Tagihan (Inkaso - Pembayaran)</span>
                  <span className={`font-medium ${Number(totals.tagihan || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>Rp {Number(totals.tagihan || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Pengeluaran */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg text-destructive">Pengeluaran</h4>
                
                {/* Gaji Karyawan */}
                <div className="flex justify-between">
                  <span>Gaji Karyawan</span>
                  <span className="font-medium text-red-600">
                    Rp {payrolls
                      .filter(p => {
                        const paymentDate = new Date(p.paymentDate);
                        const fromDate = new Date(dateFrom);
                        const toDate = new Date(dateTo);
                        return paymentDate >= fromDate && paymentDate <= toDate;
                      })
                      .reduce((sum, p) => sum + p.totalSalary, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>

                {/* HPP (Harga Pokok Penjualan) */}
                <div className="flex justify-between">
                  <span>HPP (Harga Pokok Penjualan)</span>
                  <span className="font-medium text-red-600">Rp {financials.cogs.toLocaleString('id-ID')}</span>
                </div>

                {/* Diskon Penjualan */}
                <div className="flex justify-between">
                  <span>Diskon Penjualan</span>
                  <span className="font-medium text-red-600">Rp {financials.discounts.toLocaleString('id-ID')}</span>
                </div>

                {/* Pengeluaran Operasional */}
                <div className="flex justify-between">
                  <span>Pengeluaran Operasional</span>
                  <span className="font-medium text-red-600">
                    Rp {expenses
                      .filter(e => {
                        const d = new Date(e.date);
                        const fromDate = new Date(dateFrom);
                        const toDate = new Date(dateTo);
                        return d >= fromDate && d <= toDate;
                      })
                      .reduce((sum, e) => sum + e.amount, 0)
                      .toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Pengeluaran</span>
                  <span className="text-red-600">
                    Rp {(
                      financials.cogs +
                      financials.discounts +
                      payrolls
                        .filter(p => {
                          const paymentDate = new Date(p.paymentDate);
                          const fromDate = new Date(dateFrom);
                          const toDate = new Date(dateTo);
                          return paymentDate >= fromDate && paymentDate <= toDate;
                        })
                        .reduce((sum, p) => sum + p.totalSalary, 0) +
                      expenses
                        .filter(e => {
                          const d = new Date(e.date);
                          const fromDate = new Date(dateFrom);
                          const toDate = new Date(dateTo);
                          return d >= fromDate && d <= toDate;
                        })
                        .reduce((sum, e) => sum + e.amount, 0)
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Laba Bersih */}
              <div className="border-t-2 pt-4">
                <div className="flex justify-between text-xl font-bold">
                  <span>Laba Bersih</span>
                  <span className={
                    (financials.omzet - financials.cogs - financials.discounts -
                     payrolls
                       .filter(p => {
                         const paymentDate = new Date(p.paymentDate);
                         const fromDate = new Date(dateFrom);
                         const toDate = new Date(dateTo);
                         return paymentDate >= fromDate && paymentDate <= toDate;
                       })
                       .reduce((sum, p) => sum + p.totalSalary, 0) -
                      expenses
                        .filter(e => {
                          const d = new Date(e.date);
                          const fromDate = new Date(dateFrom);
                          const toDate = new Date(dateTo);
                          return d >= fromDate && d <= toDate;
                        })
                        .reduce((sum, e) => sum + e.amount, 0)) >= 0 
                    ? "text-green-600" 
                    : "text-red-600"
                  }>
                    Rp {(
                      financials.omzet - financials.cogs - financials.discounts -
                      payrolls
                        .filter(p => {
                          const paymentDate = new Date(p.paymentDate);
                          const fromDate = new Date(dateFrom);
                          const toDate = new Date(dateTo);
                          return paymentDate >= fromDate && paymentDate <= toDate;
                        })
                        .reduce((sum, p) => sum + p.totalSalary, 0) -
                      expenses
                        .filter(e => {
                          const d = new Date(e.date);
                          const fromDate = new Date(dateFrom);
                          const toDate = new Date(dateTo);
                          return d >= fromDate && d <= toDate;
                        })
                        .reduce((sum, e) => sum + e.amount, 0)
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Statistik Tambahan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <h5 className="font-medium">Statistik Penjualan</h5>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total Transaksi</span>
                      <span>{salesData.totalTransactions.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rata-rata per Transaksi</span>
                      <span>Rp {Math.round(salesData.averagePerTransaction).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="font-medium">Margin Keuntungan</h5>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Margin (%)</span>
                      <span className={
                        financials.omzet > 0 
                          ? ((financials.omzet - financials.cogs - financials.discounts -
                             payrolls
                               .filter(p => {
                                 const paymentDate = new Date(p.paymentDate);
                                 const fromDate = new Date(dateFrom);
                                 const toDate = new Date(dateTo);
                                 return paymentDate >= fromDate && paymentDate <= toDate;
                               })
                               .reduce((sum, p) => sum + p.totalSalary, 0)) / financials.omzet * 100) >= 0
                            ? "text-green-600" 
                            : "text-red-600"
                          : "text-gray-500"
                      }>
                        {financials.omzet > 0 
                          ? ((financials.omzet - financials.cogs - financials.discounts -
                             payrolls
                               .filter(p => {
                                 const paymentDate = new Date(p.paymentDate);
                                 const fromDate = new Date(dateFrom);
                                 const toDate = new Date(dateTo);
                                 return paymentDate >= fromDate && paymentDate <= toDate;
                               })
                               .reduce((sum, p) => sum + p.totalSalary, 0)) / financials.omzet * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsInterface;
  // Helper: map rows from backend (snake_case) to frontend types (camelCase)
  const mapEmployeeRow = (row: any): Employee => ({
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

  const mapPayrollRow = (row: any): Payroll => ({
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

  const mapExpenseRow = (row: any): Expense => ({
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });