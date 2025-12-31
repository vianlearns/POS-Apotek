import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    DollarSign,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Calendar
} from 'lucide-react';
import { SalesData } from './reportsUtils';

interface SalesTabProps {
    salesData: SalesData;
}

const SalesTab = ({ salesData }: SalesTabProps) => {
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
