import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Receipt, Edit, Trash2, Check, RotateCcw, History, Calendar } from 'lucide-react';
import { CollectionRecord, PaymentRecord } from '../types';
import { useToast } from '@/hooks/use-toast';

const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};

const mapCollectionRow = (row: any): CollectionRecord => ({
  id: row.id,
  date: row.date,
  amount: Number(row.amount),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapPaymentRow = (row: any): PaymentRecord => ({
  id: row.id,
  date: row.date,
  amount: Number(row.amount),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

interface InkasoManagementProps {
  dateFrom: string;
  dateTo: string;
}

const InkasoManagement: React.FC<InkasoManagementProps> = ({ dateFrom, dateTo }) => {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [editingCollection, setEditingCollection] = useState<CollectionRecord | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth());
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const { toast } = useToast();

  // Get current month and year for filtering
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
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

  // Filter payments to only show current month (hide paid inkaso from previous months)
  const visiblePayments = useMemo(() => {
    if (showHistory) {
      // In history mode, show payments from selected month/year
      return payments.filter(p => {
        const paymentDate = new Date(p.date);
        return paymentDate.getMonth() === historyMonth && paymentDate.getFullYear() === historyYear;
      });
    }
    // In normal mode, only show payments from current month
    return payments.filter(p => {
      const paymentDate = new Date(p.date);
      return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
    });
  }, [payments, showHistory, historyMonth, historyYear, currentMonth, currentYear]);

  // Filter collections for history view
  const visibleCollections = useMemo(() => {
    if (showHistory) {
      // In history mode, show collections from selected month/year
      return collections.filter(c => {
        const collectionDate = new Date(c.date);
        return collectionDate.getMonth() === historyMonth && collectionDate.getFullYear() === historyYear;
      });
    }
    // In normal mode, show all collections (unpaid inkaso)
    return collections;
  }, [collections, showHistory, historyMonth, historyYear]);

  // Calculate totals for history view
  const historyTotals = useMemo(() => {
    if (!showHistory) return totals;
    const inkaso = visibleCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const bayar = visiblePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { inkaso, bayar, tagihan: inkaso - bayar };
  }, [showHistory, visibleCollections, visiblePayments, totals]);

  const fetchCollections = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/collections`);
      const arr = Array.isArray(data) ? data : [];
      setCollections(arr.map(mapCollectionRow));
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data inkaso',
        variant: 'destructive',
      });
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/payments`);
      const arr = Array.isArray(data) ? data : [];
      setPayments(arr.map(mapPaymentRow));
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data pembayaran',
        variant: 'destructive',
      });
    }
  };

  const handleSaveCollection = async (formData: FormData) => {
    try {
      const amount = Number(formData.get('amount'));
      const date = formData.get('date') as string;

      if (editingCollection) {
        await fetchJSON(`${API_BASE}/collections/${editingCollection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date }),
        });
        toast({
          title: 'Sukses',
          description: 'Data inkaso berhasil diperbarui',
        });
      } else {
        await fetchJSON(`${API_BASE}/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date }),
        });
        toast({
          title: 'Sukses',
          description: 'Data inkaso berhasil ditambahkan',
        });
      }

      setEditingCollection(null);
      fetchCollections();
    } catch (error) {
      console.error('Error saving collection:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan data inkaso',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data inkaso ini?')) return;

    try {
      await fetchJSON(`${API_BASE}/collections/${id}`, { method: 'DELETE' });
      toast({
        title: 'Sukses',
        description: 'Data inkaso berhasil dihapus',
      });
      fetchCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus data inkaso',
        variant: 'destructive',
      });
    }
  };

  const handleSavePayment = async (formData: FormData) => {
    try {
      const amount = Number(formData.get('amount'));
      const date = formData.get('date') as string;

      if (editingPayment) {
        await fetchJSON(`${API_BASE}/payments/${editingPayment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date }),
        });
        toast({
          title: 'Sukses',
          description: 'Data pembayaran berhasil diperbarui',
        });
      } else {
        await fetchJSON(`${API_BASE}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, date }),
        });
        toast({
          title: 'Sukses',
          description: 'Data pembayaran berhasil ditambahkan',
        });
      }

      setEditingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error('Error saving payment:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan data pembayaran',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data pembayaran ini?')) return;

    try {
      await fetchJSON(`${API_BASE}/payments/${id}`, { method: 'DELETE' });
      toast({
        title: 'Sukses',
        description: 'Data pembayaran berhasil dihapus',
      });
      fetchPayments();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast({
        title: 'Error',
        description: 'Gagal menghapus data pembayaran',
        variant: 'destructive',
      });
    }
  };

  const handleTransferToPayment = async (collection: CollectionRecord) => {
    if (!confirm(`Apakah Anda yakin ingin memindahkan inkaso Rp ${Number(collection.amount).toLocaleString('id-ID')} tanggal ${new Date(collection.date).toLocaleDateString('id-ID')} ke pembayaran?`)) return;

    try {
      // Buat data pembayaran baru dengan data yang sama dari inkaso
      await fetchJSON(`${API_BASE}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: collection.amount,
          date: collection.date,
        }),
      });

      // Hapus data dari inkaso
      await fetchJSON(`${API_BASE}/collections/${collection.id}`, { method: 'DELETE' });

      toast({
        title: 'Sukses',
        description: 'Data inkaso berhasil dipindahkan ke pembayaran',
      });

      // Refresh data
      fetchCollections();
      fetchPayments();
    } catch (error) {
      console.error('Error transferring to payment:', error);
      toast({
        title: 'Error',
        description: 'Gagal memindahkan data ke pembayaran',
        variant: 'destructive',
      });
    }
  };

  const handleReverseToCollection = async (payment: PaymentRecord) => {
    if (!confirm(`Apakah Anda yakin ingin memindahkan pembayaran Rp ${Number(payment.amount).toLocaleString('id-ID')} tanggal ${new Date(payment.date).toLocaleDateString('id-ID')} kembali ke inkaso?`)) return;

    try {
      // Buat data inkaso baru dengan data yang sama dari pembayaran
      await fetchJSON(`${API_BASE}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payment.amount,
          date: payment.date,
        }),
      });

      // Hapus data dari pembayaran
      await fetchJSON(`${API_BASE}/payments/${payment.id}`, { method: 'DELETE' });

      toast({
        title: 'Sukses',
        description: 'Data pembayaran berhasil dipindahkan kembali ke inkaso',
      });

      // Refresh data
      fetchCollections();
      fetchPayments();
    } catch (error) {
      console.error('Error reversing to collection:', error);
      toast({
        title: 'Error',
        description: 'Gagal memindahkan data kembali ke inkaso',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Ringkasan Inkaso/Bayar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ringkasan Inkaso</CardTitle>
              <CardDescription>
                {showHistory
                  ? `History ${monthNames[historyMonth]} ${historyYear}`
                  : `Periode ${dateFrom} - ${dateTo}`
                }
              </CardDescription>
            </div>
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {showHistory ? 'Lihat Saat Ini' : 'Lihat History'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* History Month/Year Selector */}
          {showHistory && (
            <div className="flex gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pilih Periode:</span>
              </div>
              <Select value={historyMonth.toString()} onValueChange={(v) => setHistoryMonth(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={historyYear.toString()} onValueChange={(v) => setHistoryYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Inkaso</span>
                <DollarSign className="h-4 w-4 text-secondary" />
              </div>
              <div className="text-xl font-bold text-secondary">Rp {(showHistory ? historyTotals : totals).inkaso.toLocaleString('id-ID')}</div>
            </div>
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Bayar</span>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary">Rp {(showHistory ? historyTotals : totals).bayar.toLocaleString('id-ID')}</div>
            </div>
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Tagihan</span>
                <Receipt className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-xl font-bold text-destructive">Rp {(showHistory ? historyTotals : totals).tagihan.toLocaleString('id-ID')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Inkaso & Bayar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Form Inkaso</CardTitle>
            <CardDescription>Input tanggal dan jumlah inkaso</CardDescription>
          </CardHeader>
          <CardContent>
            <form key={editingCollection?.id || 'new-collection'} onSubmit={(e) => { e.preventDefault(); handleSaveCollection(new FormData(e.currentTarget)); e.currentTarget.reset(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="collectionDate">Tanggal Jatuh Tempo</Label>
                <Input id="collectionDate" name="date" type="date" defaultValue={editingCollection?.date?.split('T')[0] || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collectionAmount">Inkaso</Label>
                <Input id="collectionAmount" name="amount" type="number" defaultValue={editingCollection?.amount ?? ''} required />
              </div>
              <div className="flex justify-end space-x-2">
                {editingCollection && (
                  <Button type="button" variant="outline" onClick={() => setEditingCollection(null)}>Batal</Button>
                )}
                <Button type="submit">{editingCollection ? 'Perbarui' : 'Simpan'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Bayar</CardTitle>
            <CardDescription>Input tanggal dan jumlah pembayaran</CardDescription>
          </CardHeader>
          <CardContent>
            <form key={editingPayment?.id || 'new-payment'} onSubmit={(e) => { e.preventDefault(); handleSavePayment(new FormData(e.currentTarget)); e.currentTarget.reset(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Tanggal Bayar</Label>
                <Input id="paymentDate" name="date" type="date" defaultValue={editingPayment?.date?.split('T')[0] || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Pembayaran</Label>
                <Input id="paymentAmount" name="amount" type="number" defaultValue={editingPayment?.amount ?? ''} required />
              </div>
              <div className="flex justify-end space-x-2">
                {editingPayment && (
                  <Button type="button" variant="outline" onClick={() => setEditingPayment(null)}>Batal</Button>
                )}
                <Button type="submit">{editingPayment ? 'Perbarui' : 'Simpan'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Daftar Inkaso & Pembayaran */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Daftar Inkaso {showHistory ? `(${monthNames[historyMonth]} ${historyYear})` : '(Belum Bayar)'}
            </CardTitle>
            <CardDescription>
              {showHistory
                ? `Inkaso pada ${monthNames[historyMonth]} ${historyYear}`
                : 'Semua inkaso yang belum dibayar'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleCollections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {showHistory ? 'Tidak ada inkaso pada periode ini' : 'Tidak ada inkaso yang belum dibayar'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal Jatuh Tempo</TableHead>
                    <TableHead>Inkaso</TableHead>
                    {!showHistory && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCollections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{new Date(c.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>Rp {Number(c.amount).toLocaleString('id-ID')}</TableCell>
                      {!showHistory && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleTransferToPayment(c)} title="Tandai sudah bayar">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingCollection(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteCollection(c.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Daftar Pembayaran {showHistory ? `(${monthNames[historyMonth]} ${historyYear})` : '(Bulan Ini)'}
            </CardTitle>
            <CardDescription>
              {showHistory
                ? `Pembayaran pada ${monthNames[historyMonth]} ${historyYear}`
                : `Pembayaran ${monthNames[currentMonth]} ${currentYear}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visiblePayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {showHistory ? 'Tidak ada pembayaran pada periode ini' : 'Belum ada pembayaran bulan ini'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal Bayar</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    {!showHistory && <TableHead>Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>Rp {Number(p.amount).toLocaleString('id-ID')}</TableCell>
                      {!showHistory && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleReverseToCollection(p)} title="Kembalikan ke inkaso">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingPayment(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeletePayment(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InkasoManagement;