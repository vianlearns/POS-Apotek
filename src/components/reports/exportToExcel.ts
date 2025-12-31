import * as XLSX from 'xlsx';
import { fetchJSON, API_BASE, SalesData, StockItem, Financials } from './reportsUtils';
import { Payroll, Expense, CollectionRecord, PaymentRecord } from '../../types';

interface ExportToExcelParams {
    dateFrom: string;
    dateTo: string;
    salesData: SalesData;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    stockMovement: StockItem[];
    financials: Financials;
    payrolls: Payroll[];
    expenses: Expense[];
    collections: CollectionRecord[];
    payments: PaymentRecord[];
    onSuccess: (filename: string) => void;
    onError: (error: Error) => void;
}

export const exportToExcel = async ({
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
    onSuccess,
    onError,
}: ExportToExcelParams) => {
    try {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Fetch product data for price info
        const productsData = await fetchJSON(`${API_BASE}/products`);
        const productsArr = Array.isArray(productsData) ? productsData : [];
        const productPriceByName = new Map<string, { price: number; buy_price: number }>(
            productsArr.map((p: any) => [p.name, { price: Number(p.price) || 0, buy_price: Number(p.buy_price) || 0 }])
        );

        // Fetch transactions for transparency
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
        for (let R = 4; R <= 6; R++) {
            const cell = wsSales[XLSX.utils.encode_cell({ r: R, c: 1 })];
            if (cell && typeof cell.v === 'number') {
                cell.t = 'n';
                cell.z = '#,##0';
            }
        }
        wsSales['!cols'] = [{ wch: 20 }, { wch: 20 }];
        wsSales['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
        XLSX.utils.book_append_sheet(wb, wsSales, 'Ringkasan Penjualan');

        // Top Products Sheet
        const topProductsData: any[][] = [
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
            const omzet = sell * qty;
            const hpp = cost * qty;
            const grossProfit = Math.max(0, omzet - hpp);
            topProductsData.push([product.name, sell, cost, qty, omzet, hpp, grossProfit]);
        });

        const wsProducts = XLSX.utils.aoa_to_sheet(topProductsData);
        const rangeProducts = XLSX.utils.decode_range(wsProducts['!ref'] as string);
        for (let R = 4; R <= rangeProducts.e.r; R++) {
            for (const C of [1, 2, 3, 4, 5, 6]) {
                const cell = wsProducts[XLSX.utils.encode_cell({ r: R, c: C })];
                if (cell && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '#,##0';
                }
            }
        }
        wsProducts['!cols'] = [
            { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        ];
        wsProducts['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
        XLSX.utils.book_append_sheet(wb, wsProducts, 'Produk Terlaris');

        // Stock Report Sheet
        const stockData: any[][] = [
            ['LAPORAN STOK'],
            [`Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`],
            [''],
            ['Nama Produk', 'Stok Saat Ini', 'Stok Minimum', 'Status']
        ];

        stockMovement.forEach((item: any) => {
            stockData.push([item.product, item.remaining, item.minStock, item.status]);
        });

        const wsStock = XLSX.utils.aoa_to_sheet(stockData);
        wsStock['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
        wsStock['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
        XLSX.utils.book_append_sheet(wb, wsStock, 'Laporan Stok');

        // Profit & Loss Sheet
        const from = new Date(dateFrom);
        const to = new Date(dateTo);

        const payrollTotal = (payrolls || [])
            .filter((p: any) => {
                const d = new Date(p.payment_date || p.paymentDate);
                return d >= from && d <= to;
            })
            .reduce((sum: number, p: any) => sum + Number(p.total_salary || p.totalSalary || 0), 0);

        const expenseTotal = (expenses || [])
            .filter((e: any) => {
                const d = new Date(e.date);
                return d >= from && d <= to;
            })
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

        const collectionTotal = (collections || [])
            .filter((c: any) => {
                const d = new Date(c.date);
                return d >= from && d <= to;
            })
            .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

        const paymentTotal = (payments || [])
            .filter((p: any) => {
                const d = new Date(p.date);
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
        for (let R = 3; R <= 11; R++) {
            const cell = wsPL[XLSX.utils.encode_cell({ r: R, c: 1 })];
            if (cell && typeof cell.v === 'number') {
                cell.t = 'n';
                cell.z = '#,##0';
            }
        }
        wsPL['!cols'] = [{ wch: 36 }, { wch: 18 }];
        wsPL['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
        XLSX.utils.book_append_sheet(wb, wsPL, 'Laba Rugi');

        // Daily Sales Sheet
        const dailySalesSheet: any[][] = [
            ['PENJUALAN HARIAN'],
            [`Periode: ${dateFrom} sampai ${dateTo}`],
            [''],
            ['Tanggal', 'Penjualan', 'Jumlah Transaksi']
        ];
        (salesData.daily || []).forEach((day: any) => {
            dailySalesSheet.push([day.date, Number(day.sales || 0), Number(day.transactions || 0)]);
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
        wsDaily['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Penjualan Harian');

        // Transactions Sheet
        const txSheet: any[][] = [
            ['DATA TRANSAKSI'],
            [`Periode: ${dateFrom} sampai ${dateTo}`],
            [''],
            ['Tanggal', 'Subtotal', 'Diskon', 'Total', 'Metode', 'Kasir']
        ];
        transactionsArr.forEach((t: any) => {
            const subtotal = Number(t.subtotal || 0);
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
            for (const C of [1, 2, 3]) {
                const cell = wsTx[XLSX.utils.encode_cell({ r: R, c: C })];
                if (cell && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = '#,##0';
                }
            }
        }
        wsTx['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
        wsTx['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
        XLSX.utils.book_append_sheet(wb, wsTx, 'Transaksi');

        // Payrolls Sheet
        const payrollSheet: any[][] = [
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
        wsPayroll['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
        wsPayroll['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        XLSX.utils.book_append_sheet(wb, wsPayroll, 'Penggajian');

        // Expenses Sheet
        const expenseSheet: any[][] = [
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
        wsExpenses['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
        wsExpenses['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Pengeluaran');

        // Inkaso Sheet
        const inkasoSheet: any[][] = [
            ['DATA INKASO'],
            [`Periode: ${dateFrom} sampai ${dateTo}`],
            [''],
            ['Tanggal', 'Jenis', 'Jumlah']
        ];
        (collections || []).forEach((c: any) => {
            inkasoSheet.push([c.date || '-', 'Inkaso', Number(c.amount || 0)]);
        });
        (payments || []).forEach((p: any) => {
            inkasoSheet.push([p.date || '-', 'Pembayaran', Number(p.amount || 0)]);
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
        wsInkaso['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }];
        wsInkaso['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
        XLSX.utils.book_append_sheet(wb, wsInkaso, 'Inkaso');

        // Generate filename and save
        const today = new Date();
        const filename = `Laporan_Apotek_${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, filename);

        onSuccess(filename);
    } catch (error) {
        onError(error as Error);
    }
};
