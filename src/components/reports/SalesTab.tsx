import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DollarSign,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Calendar
} from 'lucide-react';
import { SalesData } from './reportsUtils';

interface MonthlyRevenueData {
    month: string;
    monthIndex: number;
    revenue: number;
}

interface SalesTabProps {
    salesData: SalesData;
    monthlyRevenueData?: MonthlyRevenueData[];
    selectedChartYear?: number;
    onChartYearChange?: (year: number) => void;
}

const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const SalesTab = ({ salesData, monthlyRevenueData = [], selectedChartYear, onChartYearChange }: SalesTabProps) => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // 2 years back, current, 2 years forward

    // Calculate max revenue for scaling the chart bars
    const maxRevenue = Math.max(...monthlyRevenueData.map(d => d.revenue), 1);

    return (
        <div className="space-y-6">
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

            {/* Monthly Revenue Chart */}
            <Card className="medical-card">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-secondary/10">
                                <BarChart3 className="h-5 w-5 text-secondary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-semibold text-foreground">Pemasukan Bulanan</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">
                                    Pemasukan per bulan (Januari - Desember)
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Tahun:</span>
                            <Select
                                value={selectedChartYear?.toString() || currentYear.toString()}
                                onValueChange={(value) => onChartYearChange?.(parseInt(value))}
                            >
                                <SelectTrigger className="w-[100px] h-9">
                                    <SelectValue placeholder="Pilih Tahun" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((year) => (
                                        <SelectItem key={year} value={year.toString()}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Simple Bar Chart */}
                    <div className="space-y-3">
                        {monthNames.map((month, index) => {
                            const data = monthlyRevenueData.find(d => d.monthIndex === index);
                            const revenue = data?.revenue || 0;
                            const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

                            return (
                                <div key={index} className="flex items-center gap-4">
                                    <div className="w-24 text-sm font-medium text-muted-foreground">
                                        {month.substring(0, 3)}
                                    </div>
                                    <div className="flex-1 h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-lg transition-all duration-500 ease-out"
                                            style={{ width: `${Math.max(percentage, 0)}%` }}
                                        />
                                        {revenue > 0 && (
                                            <div className="absolute inset-0 flex items-center px-3">
                                                <span className={`text-xs font-medium ${percentage > 40 ? 'text-primary-foreground' : 'text-foreground'}`}>
                                                    Rp {revenue.toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Summary */}
                    <div className="mt-6 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Total Pemasukan Tahun {selectedChartYear || currentYear}</span>
                            <span className="text-lg font-bold text-primary">
                                Rp {monthlyRevenueData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
        </div>
    );
};

export default SalesTab;

