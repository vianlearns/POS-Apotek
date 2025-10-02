import React, { useState, useEffect } from 'react';
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
  DollarSign
} from 'lucide-react';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

const ReportsInterface = () => {
  // Set default dates to current month
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(lastDayOfMonth.toISOString().split('T')[0]);
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
  const [stockMovement, setStockMovement] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportsData();
  }, [dateFrom, dateTo]);

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
        `${API_BASE}/transactions?from=${prevFromDate.toISOString().split('T')[0]}&to=${prevToDate.toISOString().split('T')[0]}&status=completed`
      );

      // Process sales data
      const dailySales = transactionsData?.reduce((acc: any, transaction: any) => {
        const date = transaction.date.split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, sales: 0, transactions: 0 };
        }
        acc[date].sales += Number(transaction.total);
        acc[date].transactions += 1;
        return acc;
      }, {});

      const tx = Array.isArray(transactionsData) ? transactionsData : [];
      const totalRevenue = tx.reduce((sum: number, t: any) => sum + Number(t.total), 0);
      const totalTransactions = tx.length;
      const averagePerTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Calculate previous period metrics for comparison
      const prevTx = Array.isArray(prevTransactionsData) ? prevTransactionsData : [];
      const prevTotalRevenue = prevTx.reduce((sum: number, t: any) => sum + Number(t.total), 0);
      const prevTotalTransactions = prevTx.length;
      const prevAveragePerTransaction = prevTotalTransactions > 0 ? prevTotalRevenue / prevTotalTransactions : 0;

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
        daily: Object.values(dailySales || {}),
        totalRevenue,
        totalTransactions,
        averagePerTransaction,
        trends
      });

      // Process top products
      const productSales = tx.reduce((acc: any, transaction: any) => {
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

  const exportToExcel = () => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sales Summary Sheet
      const salesSummary = [
        ['LAPORAN PENJUALAN'],
        ['Periode:', `${dateFrom} sampai ${dateTo}`],
        [''],
        ['RINGKASAN'],
        ['Total Penjualan', `Rp ${salesData.totalRevenue.toLocaleString('id-ID')}`],
        ['Total Transaksi', salesData.totalTransactions],
        ['Rata-rata per Transaksi', `Rp ${salesData.averagePerTransaction.toLocaleString('id-ID')}`],
        [''],
        ['PENJUALAN HARIAN'],
        ['Tanggal', 'Penjualan', 'Jumlah Transaksi']
      ];

      salesData.daily.forEach((day: any) => {
        salesSummary.push([
          day.date,
          `Rp ${day.sales.toLocaleString('id-ID')}`,
          day.transactions
        ]);
      });

      const wsSales = XLSX.utils.aoa_to_sheet(salesSummary);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Ringkasan Penjualan');

      // Top Products Sheet
      const topProductsData = [
        ['PRODUK TERLARIS'],
        ['Periode:', `${dateFrom} sampai ${dateTo}`],
        [''],
        ['Nama Produk', 'Kuantitas Terjual', 'Total Pendapatan']
      ];

      topProducts.forEach((product: any) => {
        topProductsData.push([
          product.name,
          product.quantity,
          `Rp ${product.revenue.toLocaleString('id-ID')}`
        ]);
      });

      const wsProducts = XLSX.utils.aoa_to_sheet(topProductsData);
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Produk Terlaris');

      // Stock Report Sheet
      const stockData = [
        ['LAPORAN STOK'],
        ['Tanggal Export:', new Date().toLocaleDateString('id-ID')],
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
      XLSX.utils.book_append_sheet(wb, wsStock, 'Laporan Stok');

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="medical-card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Penjualan Harian</h3>
                  <p className="text-sm text-muted-foreground">3 hari terakhir</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">Tanggal</TableHead>
                    <TableHead className="font-semibold">Transaksi</TableHead>
                    <TableHead className="font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.daily.map((day, index) => (
                    <TableRow key={index} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{new Date(day.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{day.transactions}</TableCell>
                      <TableCell className="font-medium text-primary">Rp {day.sales.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="medical-card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Produk Terlaris</h3>
                  <p className="text-sm text-muted-foreground">Bulan ini</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-semibold">Produk</TableHead>
                    <TableHead className="font-semibold">Qty</TableHead>
                    <TableHead className="font-semibold">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={index} className="border-border/30 hover:bg-muted/30">
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell className="font-medium text-secondary">Rp {product.revenue.toLocaleString('id-ID')}</TableCell>
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

        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Keuangan</CardTitle>
              <CardDescription>Berdasarkan periode yang dipilih</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Total Penjualan</span>
                <span className="font-medium">Rp {salesData.totalRevenue.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Transaksi</span>
                <span className="font-medium">{salesData.totalTransactions.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Rata-rata per Transaksi</span>
                <span className="text-primary">Rp {Math.round(salesData.averagePerTransaction).toLocaleString('id-ID')}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsInterface;