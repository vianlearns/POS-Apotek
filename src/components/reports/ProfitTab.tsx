import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Financials, SalesData, Totals } from './reportsUtils';
import { Expense, Payroll } from '../../types';

interface ProfitTabProps {
    financials: Financials;
    salesData: SalesData;
    payrolls: Payroll[];
    expenses: Expense[];
    totals: Totals;
    dateFrom: string;
    dateTo: string;
}

const ProfitTab = ({
    financials,
    salesData,
    payrolls,
    expenses,
    totals,
    dateFrom,
    dateTo,
}: ProfitTabProps) => {
    // Filter payrolls and expenses within date range
    const filteredPayrollTotal = payrolls
        .filter(p => {
            const paymentDate = new Date(p.paymentDate);
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            return paymentDate >= fromDate && paymentDate <= toDate;
        })
        .reduce((sum, p) => sum + p.totalSalary, 0);

    const filteredExpenseTotal = expenses
        .filter(e => {
            const d = new Date(e.date);
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            return d >= fromDate && d <= toDate;
        })
        .reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = financials.cogs + financials.discounts + filteredPayrollTotal + filteredExpenseTotal;
    const netProfit = financials.omzet - totalExpenses;
    const marginPercent = financials.omzet > 0
        ? ((financials.omzet - financials.cogs - financials.discounts - filteredPayrollTotal) / financials.omzet * 100)
        : 0;

    return (
        <div className="space-y-4">
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
                            <span className={`font-medium ${Number(totals.tagihan || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                Rp {Number(totals.tagihan || 0).toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>

                    {/* Pengeluaran */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-lg text-destructive">Pengeluaran</h4>

                        <div className="flex justify-between">
                            <span>Gaji Karyawan</span>
                            <span className="font-medium text-red-600">
                                Rp {filteredPayrollTotal.toLocaleString('id-ID')}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span>HPP (Harga Pokok Penjualan)</span>
                            <span className="font-medium text-red-600">Rp {financials.cogs.toLocaleString('id-ID')}</span>
                        </div>

                        <div className="flex justify-between">
                            <span>Diskon Penjualan</span>
                            <span className="font-medium text-red-600">Rp {financials.discounts.toLocaleString('id-ID')}</span>
                        </div>

                        <div className="flex justify-between">
                            <span>Pengeluaran Operasional</span>
                            <span className="font-medium text-red-600">
                                Rp {filteredExpenseTotal.toLocaleString('id-ID')}
                            </span>
                        </div>

                        <div className="flex justify-between border-t pt-2 font-semibold">
                            <span>Total Pengeluaran</span>
                            <span className="text-red-600">
                                Rp {totalExpenses.toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>

                    {/* Laba Bersih */}
                    <div className="border-t-2 pt-4">
                        <div className="flex justify-between text-xl font-bold">
                            <span>Laba Bersih</span>
                            <span className={netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                                Rp {netProfit.toLocaleString('id-ID')}
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
                                    <span className={marginPercent >= 0 ? "text-green-600" : "text-red-600"}>
                                        {marginPercent.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProfitTab;
