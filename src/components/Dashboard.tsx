import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import logo from '@/assets/logo.png';

// Component imports - we'll create these
import ProductManagement from './ProductManagement';
import SalesInterface from './SalesInterface';
import ReportsInterface from './ReportsInterface';
import PrescriptionManagement from './PrescriptionManagement';
// UserManagement removed - will be managed manually
import SupplierManagement from './SupplierManagement';
import UserManagement from './UserManagement';

type ActiveTab =
  | 'dashboard'
  | 'products'
  | 'sales'
  | 'prescriptions'
  | 'suppliers'
  | 'reports'
  | 'users'
  | 'settings';

type DashboardStats = {
  todaySales: number;
  lowStock: number;
  expiringProducts: number;
  pendingPrescriptions: number;
  salesTrend: { percentage: number; isPositive: boolean };
};

const Dashboard = () => {
  const { user, userProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const fetchJSON = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok || (json && json.ok === false)) {
      throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    return typeof json?.data !== 'undefined' ? json.data : json;
  };

  // Real data from Supabase
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    lowStock: 0,
    expiringProducts: 0,
    pendingPrescriptions: 0,
    salesTrend: { percentage: 0, isPositive: true },
  });

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        // Helper dates (gunakan batas bawah & atas hari untuk akurasi)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString().split('T')[0];

        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const tomorrowISO = tomorrowStart.toISOString().split('T')[0];

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayISO = yesterdayStart.toISOString().split('T')[0];

        // === Sales Today (completed only) ===
        const todaySalesData: Array<{ total: number }> = await fetchJSON(
          `${API_BASE}/transactions?from=${todayISO}&to=${tomorrowISO}&status=completed`
        );
        const todayArr = Array.isArray(todaySalesData) ? todaySalesData : [];
        const todaySales = todayArr.reduce((sum, t) => sum + Number(t.total || 0), 0);

        // === Sales Yesterday (completed only) ===
        const yesterdaySalesData: Array<{ total: number }> = await fetchJSON(
          `${API_BASE}/transactions?from=${yesterdayISO}&to=${todayISO}&status=completed`
        );
        const yesterdayArr = Array.isArray(yesterdaySalesData) ? yesterdaySalesData : [];
        const yesterdaySales = yesterdayArr.reduce((sum, t) => sum + Number(t.total || 0), 0);

        // === Trend calculation (today vs yesterday) ===
        const calculateTrend = (current: number, previous: number) => {
          if (previous === 0) {
            // Jika kemarin 0, tampilkan 0% (tidak misleading) dan anggap positif
            return { percentage: 0, isPositive: true };
          }
          const change = ((current - previous) / previous) * 100;
          return { percentage: Math.abs(change), isPositive: change >= 0 };
        };

        const salesTrend = calculateTrend(todaySales, yesterdaySales);

        // === Low stock products ===
        const allProducts: Array<{ id: string; stock: number; min_stock: number; expiry_date?: string | null }> = await fetchJSON(
          `${API_BASE}/products`
        );
        const productsArr = Array.isArray(allProducts) ? allProducts : [];
        const lowStockProducts = productsArr.filter((p) => Number(p.stock) <= Number(p.min_stock));

        // === Expiring products (within 30 days) ===
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const expiringData = productsArr.filter(
          (p) => p.expiry_date && p.expiry_date <= thirtyDaysFromNow.toISOString().split('T')[0]
        );

        // === Pending prescriptions ===
        const pendingPrescriptions: Array<{ id: string }> = await fetchJSON(
          `${API_BASE}/prescriptions?status=active`
        );
        const pendingArr = Array.isArray(pendingPrescriptions) ? pendingPrescriptions : [];

        setStats({
          todaySales,
          lowStock: lowStockProducts.length,
          expiringProducts: expiringData.length,
          pendingPrescriptions: pendingArr.length,
          salesTrend,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchDashboardStats();
  }, []);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'apoteker', 'kasir'] },
    { id: 'sales', label: 'Penjualan', icon: ShoppingCart, roles: ['admin', 'apoteker', 'kasir'] },
    { id: 'products', label: 'Produk', icon: Package, roles: ['admin', 'apoteker'] },
    { id: 'prescriptions', label: 'Resep', icon: FileText, roles: ['admin', 'apoteker'] },
    { id: 'suppliers', label: 'Supplier', icon: Users, roles: ['admin', 'apoteker'] },
    { id: 'reports', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
    { id: 'users', label: 'Pengguna', icon: Settings, roles: ['admin'] },
  ];

  const allowedItems = navigationItems.filter(item =>
    item.roles.includes(userProfile?.role || 'kasir')
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return <ProductManagement />;
      case 'sales':
        return <SalesInterface />;
      case 'prescriptions':
        return <PrescriptionManagement />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'reports':
        return <ReportsInterface />;
      case 'users':
        return <UserManagement />;
      default:
        return (
          <div className="space-y-8 fade-in">
            {/* Welcome Header */}
            <div className="gradient-hero rounded-2xl p-8 text-white">
              <h1 className="text-3xl font-bold mb-2">Selamat Datang di Hanum Farma POS</h1>
              <p className="text-lg opacity-90">Dashboard sistem manajemen apotek terdepan</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div
                className="stats-card p-6 slide-up"
                onClick={() => setActiveTab('reports')}
                style={{animationDelay: '0.1s'}}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium">Penjualan Hari Ini</p>
                    <div className="text-2xl font-bold text-primary">
                      Rp {stats.todaySales.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  {stats.salesTrend.isPositive ? (
                    <TrendingUp className="h-4 w-4 mr-1 text-secondary" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1 text-destructive" />
                  )}
                  {stats.salesTrend.isPositive ? '+' : '-'}
                  {stats.salesTrend.percentage.toFixed(1)}% dari kemarin
                </div>
              </div>

              <div
                className="stats-card p-6 slide-up"
                onClick={() => setActiveTab('products')}
                style={{animationDelay: '0.2s'}}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-warning/10">
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium">Stok Menipis</p>
                    <div className="text-2xl font-bold text-warning">
                      {stats.lowStock}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Bell className="h-4 w-4 mr-1 text-warning" />
                  Produk perlu restok
                </div>
              </div>

              <div
                className="stats-card p-6 slide-up"
                onClick={() => setActiveTab('products')}
                style={{animationDelay: '0.3s'}}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-destructive/10">
                    <Bell className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium">Hampir Expired</p>
                    <div className="text-2xl font-bold text-destructive">
                      {stats.expiringProducts}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 mr-1 text-destructive" />
                  Dalam 30 hari
                </div>
              </div>

              <div
                className="stats-card p-6 slide-up"
                onClick={() => setActiveTab('prescriptions')}
                style={{animationDelay: '0.4s'}}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-secondary/10">
                    <FileText className="h-6 w-6 text-secondary" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium">Resep Pending</p>
                    <div className="text-2xl font-bold text-secondary">
                      {stats.pendingPrescriptions}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Settings className="h-4 w-4 mr-1 text-secondary" />
                  Menunggu verifikasi
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="medical-card p-8 slide-up" style={{animationDelay: '0.5s'}}>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">Aksi Cepat</h3>
                <p className="text-muted-foreground mt-1">
                  Akses fitur yang sering digunakan
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <button
                  className="group p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105"
                  onClick={() => setActiveTab('sales')}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Transaksi Baru</span>
                  </div>
                </button>

                <button
                  className="group p-6 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10 border border-secondary/20 hover:border-secondary/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  onClick={() => setActiveTab('products')}
                  disabled={!['admin', 'apoteker'].includes(userProfile?.role || '')}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 rounded-full bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                      <Package className="h-6 w-6 text-secondary" />
                    </div>
                    <span className="font-medium text-foreground">Kelola Produk</span>
                  </div>
                </button>

                <button
                  className="group p-6 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 hover:border-accent/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  onClick={() => setActiveTab('prescriptions')}
                  disabled={!['admin', 'apoteker'].includes(userProfile?.role || '')}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 rounded-full bg-accent/10 group-hover:bg-accent/20 transition-colors">
                      <FileText className="h-6 w-6 text-accent" />
                    </div>
                    <span className="font-medium text-foreground">Input Resep</span>
                  </div>
                </button>

                <button
                  className="group p-6 rounded-xl bg-gradient-to-br from-muted/30 to-muted/50 border border-border hover:border-border/60 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  onClick={() => setActiveTab('reports')}
                  disabled={!['admin'].includes(userProfile?.role || '')}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 rounded-full bg-foreground/10 group-hover:bg-foreground/20 transition-colors">
                      <BarChart3 className="h-6 w-6 text-foreground" />
                    </div>
                    <span className="font-medium text-foreground">Lihat Laporan</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border/50 p-6 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src={logo}
              alt="Hanum Farma Logo"
              className="h-7 w-7"
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Hanum Farma</h1>
              <p className="text-sm text-muted-foreground font-medium">
                {user?.username} • {userProfile?.role?.charAt(0).toUpperCase() + (userProfile?.role?.slice(1) || '')}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={signOut}
            className="hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-card/60 backdrop-blur-sm border-r border-border/50 min-h-[calc(100vh-80px)]">
          <nav className="p-6 space-y-3">
            {allowedItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 text-left ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : 'hover:bg-muted/60 text-foreground hover:scale-102'
                  }`}
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  style={{animationDelay: `${index * 0.1}s`}}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 bg-gradient-to-br from-background/50 to-muted/30">
          <div className="fade-in">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
