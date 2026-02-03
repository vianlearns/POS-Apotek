import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Calendar, Download } from 'lucide-react';
import { Employee, Payroll, Expense, CollectionRecord, PaymentRecord } from '../types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Import utilities and sub-components
import {
  fetchJSON,
  formatDateToWIB,
  formatTransactionDateToWIB, // Import the new helper
  monthNames,
  mapEmployeeRow,
  mapPayrollRow,
  mapExpenseRow,
  mapCollectionRow,
  mapPaymentRow,
  API_BASE,
  SalesData,
  Financials,
  StockItem,
  Totals,
} from './reports/reportsUtils';
import SalesTab from './reports/SalesTab';
import StockTab from './reports/StockTab';
import EmployeesTab from './reports/EmployeesTab';
import ExpensesTab from './reports/ExpensesTab';
import ProfitTab from './reports/ProfitTab';
import { exportToExcel } from './reports/exportToExcel';

const ReportsInterface = () => {
  // Set default dates to last 30 days (WIB timezone)
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(currentDate);
  thirtyDaysAgo.setDate(currentDate.getDate() - 30);

  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState(formatDateToWIB(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDateToWIB(currentDate));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState<'month' | 'manual'>('month');
  const [loading, setLoading] = useState(true);

  // Data states
  const [salesData, setSalesData] = useState<SalesData>({
    daily: [],
    totalRevenue: 0,
    totalTransactions: 0,
    averagePerTransaction: 0,
    trends: {
      revenue: { percentage: 0, isPositive: true },
      transactions: { percentage: 0, isPositive: true },
      averageTransaction: { percentage: 0, isPositive: true }
    }
  });
  const [financials, setFinancials] = useState<Financials>({ omzet: 0, cogs: 0, discounts: 0 });
  const [stockMovement, setStockMovement] = useState<StockItem[]>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Monthly revenue chart state
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<Array<{ month: string; monthIndex: number; revenue: number }>>([]);

  // Dialog states
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showPayrollDialog, setShowPayrollDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Update dates based on month/year selection
  const updateDatesFromMonthYear = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    setDateFrom(formatDateToWIB(firstDay));
    setDateTo(formatDateToWIB(lastDay));
  };

  useEffect(() => {
    if (filterMode === 'month') {
      updateDatesFromMonthYear(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear, filterMode]);

  useEffect(() => {
    fetchReportsData();
    fetchEmployees();
    fetchPayrolls();
    fetchExpenses();
    fetchCollections();
    fetchPayments();
  }, [dateFrom, dateTo]);

  // Fetch monthly revenue data when chart year changes
  useEffect(() => {
    fetchMonthlyRevenueData(chartYear);
  }, [chartYear]);

  const totals = useMemo<Totals>(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const inkaso = (collections || [])
      .filter((c) => {
        const d = new Date(c.date);
        return d >= from && d <= to;
      })
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const bayar = (payments || [])
      .filter((p) => {
        const d = new Date(p.date);
        return d >= from && d <= to;
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { inkaso, bayar, tagihan: inkaso - bayar };
  }, [dateFrom, dateTo, collections, payments]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      const periodLength = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

      const prevToDate = new Date(fromDate);
      prevToDate.setDate(prevToDate.getDate() - 1);
      const prevFromDate = new Date(prevToDate);
      prevFromDate.setDate(prevFromDate.getDate() - periodLength + 1);

      // Fetch current and previous period data
      const [transactionsData, prevTransactionsData] = await Promise.all([
        fetchJSON(`${API_BASE}/transactions?from=${dateFrom}&to=${dateTo}&status=completed`),
        fetchJSON(`${API_BASE}/transactions?from=${formatDateToWIB(prevFromDate)}&to=${formatDateToWIB(prevToDate)}&status=completed`)
      ]);

      // Process daily sales
      const processDailySales = (data: any[]) => {
        const map: Record<string, { date: string; sales: number; transactions: number }> = {};
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            let dateKey = '';
            try {
              if (item.date) {
                // Use the robust formatter that handles mixed UTC/WIB data
                dateKey = formatTransactionDateToWIB(item.date);
              }
            } catch { return; }
            if (!dateKey) return;
            if (!map[dateKey]) map[dateKey] = { date: dateKey, sales: 0, transactions: 0 };
            map[dateKey].sales += Number(item.sales || item.total || 0);
            map[dateKey].transactions += Number(item.transactions || 1);
          });
        }
        return Object.values(map).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      };

      const sortedDailySales = processDailySales(transactionsData);
      const sortedPrevDailySales = processDailySales(prevTransactionsData);

      const totalRevenue = sortedDailySales.reduce((sum, day) => sum + day.sales, 0);
      const totalTransactions = sortedDailySales.reduce((sum, day) => sum + day.transactions, 0);
      const averagePerTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      const prevTotalRevenue = sortedPrevDailySales.reduce((sum, day) => sum + day.sales, 0);
      const prevTotalTransactions = sortedPrevDailySales.reduce((sum, day) => sum + day.transactions, 0);
      const prevAveragePerTransaction = prevTotalTransactions > 0 ? prevTotalRevenue / prevTotalTransactions : 0;

      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return { percentage: 0, isPositive: true };
        const change = ((current - previous) / previous) * 100;
        return { percentage: Math.abs(change), isPositive: change >= 0 };
      };

      setSalesData({
        daily: sortedDailySales,
        totalRevenue,
        totalTransactions,
        averagePerTransaction,
        trends: {
          revenue: calculateTrend(totalRevenue, prevTotalRevenue),
          transactions: calculateTrend(totalTransactions, prevTotalTransactions),
          averageTransaction: calculateTrend(averagePerTransaction, prevAveragePerTransaction)
        }
      });

      // Process top products
      const rawTransactionsData = Array.isArray(transactionsData) ? transactionsData : [];
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      rawTransactionsData.forEach((transaction: any) => {
        transaction.transaction_items?.forEach((item: any) => {
          if (!productSales[item.product_name]) {
            productSales[item.product_name] = { name: item.product_name, quantity: 0, revenue: 0 };
          }
          productSales[item.product_name].quantity += item.quantity;
          productSales[item.product_name].revenue += Number(item.total);
        });
      });
      setTopProducts(Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

      // Fetch products and calculate financials
      const productsData = await fetchJSON(`${API_BASE}/products`);
      const productsArr = Array.isArray(productsData) ? productsData : [];
      const buyPriceMap = new Map<string, number>(productsArr.map((p: any) => [String(p.id), Number(p.buy_price) || 0]));

      const omzet = rawTransactionsData.reduce((sum: number, t: any) => {
        if (Array.isArray(t.transaction_items)) {
          return sum + t.transaction_items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        }
        return sum + Number(t.subtotal || 0);
      }, 0);

      const cogs = rawTransactionsData.reduce((sum: number, t: any) => {
        if (Array.isArray(t.transaction_items)) {
          return sum + t.transaction_items.reduce((s: number, i: any) => {
            return s + (Number(i.quantity || 0) * (buyPriceMap.get(String(i.product_id)) || 0));
          }, 0);
        }
        return sum;
      }, 0);

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
      setStockMovement(productsArr.map(product => ({
        product: product.name,
        remaining: product.stock,
        minStock: product.min_stock,
        status: Number(product.stock) <= Number(product.min_stock) ? 'low' as const : 'normal' as const
      })));
    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast({ title: "Error", description: "Gagal memuat data laporan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/employees`);
      setEmployees((Array.isArray(data) ? data : []).map(mapEmployeeRow));
    } catch (error) { console.error('Error fetching employees:', error); }
  };

  const fetchPayrolls = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/payrolls`);
      setPayrolls((Array.isArray(data) ? data : []).map(mapPayrollRow));
    } catch (error) { console.error('Error fetching payrolls:', error); }
  };

  const fetchExpenses = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/expenses`);
      setExpenses((Array.isArray(data) ? data : []).map(mapExpenseRow));
    } catch (error) { console.error('Error fetching expenses:', error); }
  };

  const fetchCollections = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/collections`);
      setCollections((Array.isArray(data) ? data : []).map(mapCollectionRow));
    } catch (error) { console.error('Error fetching collections:', error); }
  };

  const fetchPayments = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/payments`);
      setPayments((Array.isArray(data) ? data : []).map(mapPaymentRow));
    } catch (error) { console.error('Error fetching payments:', error); }
  };

  const fetchMonthlyRevenueData = async (year: number) => {
    try {
      // Fetch all transactions for the selected year
      const fromDate = `${year}-01-01`;
      const toDate = `${year}-12-31`;
      const transactionsData = await fetchJSON(`${API_BASE}/transactions?from=${fromDate}&to=${toDate}&status=completed`);

      // Process transactions to get monthly totals
      const monthlyTotals: Record<number, number> = {};

      if (Array.isArray(transactionsData)) {
        transactionsData.forEach((transaction: any) => {
          try {
            const dateStr = transaction.date;
            if (!dateStr) return;

            // Parse the date and get the month
            const date = new Date(dateStr);
            const month = date.getMonth();

            // Calculate total from transaction items or use transaction total
            let transactionTotal = 0;
            if (Array.isArray(transaction.transaction_items)) {
              transactionTotal = transaction.transaction_items.reduce(
                (sum: number, item: any) => sum + Number(item.total || 0),
                0
              );
            } else {
              transactionTotal = Number(transaction.total || 0);
            }

            if (!monthlyTotals[month]) monthlyTotals[month] = 0;
            monthlyTotals[month] += transactionTotal;
          } catch (e) {
            console.error('Error processing transaction for monthly chart:', e);
          }
        });
      }

      // Convert to array format for the chart
      const monthlyData = monthNames.map((month, index) => ({
        month,
        monthIndex: index,
        revenue: monthlyTotals[index] || 0
      }));

      setMonthlyRevenueData(monthlyData);
    } catch (error) {
      console.error('Error fetching monthly revenue data:', error);
    }
  };

  // CRUD handlers
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
        await fetchJSON(`${API_BASE}/employees/${editingEmployee.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(employeeData) });
        toast({ title: "Berhasil", description: "Data karyawan berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(employeeData) });
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
        await fetchJSON(`${API_BASE}/payrolls/${editingPayroll.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payrollData) });
        toast({ title: "Berhasil", description: "Data penggajian berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/payrolls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payrollData) });
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
        await fetchJSON(`${API_BASE}/expenses/${editingExpense.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expenseData) });
        toast({ title: "Berhasil", description: "Data pengeluaran berhasil diperbarui" });
      } else {
        await fetchJSON(`${API_BASE}/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expenseData) });
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

  const handleExportToExcel = () => {
    exportToExcel({
      dateFrom,
      dateTo,
      salesData,
      topProducts,
      stockMovement,
      financials,
      payrolls,
      expenses,
      collections,
      payments,
      onSuccess: (filename) => toast({ title: "Export Berhasil", description: `Laporan telah diexport ke file ${filename}` }),
      onError: (error) => {
        console.error('Error exporting to Excel:', error);
        toast({ title: "Error", description: "Gagal mengexport laporan", variant: "destructive" });
      }
    });
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
            <p className="text-muted-foreground font-medium">Analisis penjualan dan keuangan apotek</p>
          </div>
        </div>
        <Button onClick={handleExportToExcel} className="bg-accent hover:bg-accent/90 shadow-md hover:shadow-lg transition-all duration-200">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="medical-card p-6 slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Filter Periode</h3>
              <p className="text-sm text-muted-foreground">
                {filterMode === 'month' ? `${monthNames[selectedMonth]} ${selectedYear}` : `${dateFrom} sampai ${dateTo}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { const now = new Date(); setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); if (filterMode === 'manual') setFilterMode('month'); }} className="h-8 px-3" title="Reset ke bulan ini">
              Bulan Ini
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setFilterMode(filterMode === 'month' ? 'manual' : 'month')} className="h-8">
              {filterMode === 'month' ? 'Tanggal Manual' : 'Pilih Bulan'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {filterMode === 'month' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="monthSelect" className="font-medium">Bulan</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger id="monthSelect" className="h-12 bg-background/50 border-border/60"><SelectValue placeholder="Pilih Bulan" /></SelectTrigger>
                  <SelectContent>{monthNames.map((month, index) => (<SelectItem key={index} value={index.toString()}>{month}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearSelect" className="font-medium">Tahun</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger id="yearSelect" className="h-12 bg-background/50 border-border/60"><SelectValue placeholder="Pilih Tahun" /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 10 }, (_, i) => { const year = new Date().getFullYear() - 5 + i; return (<SelectItem key={year} value={year.toString()}>{year}</SelectItem>); })}</SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="dateFrom" className="font-medium">Dari Tanggal</Label>
                <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-12 bg-background/50 border-border/60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo" className="font-medium">Sampai Tanggal</Label>
                <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-12 bg-background/50 border-border/60" />
              </div>
            </>
          )}
          <Button onClick={fetchReportsData} className="h-12 bg-primary hover:bg-primary-hover">Terapkan Filter</Button>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-6 slide-up" style={{ animationDelay: '0.2s' }}>
        <TabsList className="bg-card/60 p-1">
          <TabsTrigger value="sales" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Penjualan</TabsTrigger>
          <TabsTrigger value="stock" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Stok</TabsTrigger>
          <TabsTrigger value="employees" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Karyawan</TabsTrigger>
          <TabsTrigger value="expenses" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">Pengeluaran</TabsTrigger>
          <TabsTrigger value="profit" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Laba Rugi</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesTab
            salesData={salesData}
            monthlyRevenueData={monthlyRevenueData}
            selectedChartYear={chartYear}
            onChartYearChange={setChartYear}
          />
        </TabsContent>
        <TabsContent value="stock"><StockTab stockMovement={stockMovement} /></TabsContent>
        <TabsContent value="employees">
          <EmployeesTab
            employees={employees}
            payrolls={payrolls}
            showEmployeeDialog={showEmployeeDialog}
            setShowEmployeeDialog={setShowEmployeeDialog}
            showPayrollDialog={showPayrollDialog}
            setShowPayrollDialog={setShowPayrollDialog}
            editingEmployee={editingEmployee}
            setEditingEmployee={setEditingEmployee}
            editingPayroll={editingPayroll}
            setEditingPayroll={setEditingPayroll}
            handleSaveEmployee={handleSaveEmployee}
            handleSavePayroll={handleSavePayroll}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeletePayroll={handleDeletePayroll}
          />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab
            expenses={expenses}
            showExpenseDialog={showExpenseDialog}
            setShowExpenseDialog={setShowExpenseDialog}
            editingExpense={editingExpense}
            setEditingExpense={setEditingExpense}
            handleSaveExpense={handleSaveExpense}
            handleDeleteExpense={handleDeleteExpense}
          />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitTab
            financials={financials}
            salesData={salesData}
            payrolls={payrolls}
            expenses={expenses}
            totals={totals}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsInterface;