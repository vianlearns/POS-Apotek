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
import { DollarSign, Receipt, Edit, Trash2 } from 'lucide-react';
import { CollectionRecord, PaymentRecord } from '../types';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
      {/* Ringkasan Inkaso/Bayar */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Inkaso</CardTitle>
          <CardDescription>Periode {dateFrom} - {dateTo}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Inkaso</span>
                <DollarSign className="h-4 w-4 text-secondary" />
              </div>
              <div className="text-xl font-bold text-secondary">Rp {totals.inkaso.toLocaleString('id-ID')}</div>
            </div>
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Bayar</span>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold text-primary">Rp {totals.bayar.toLocaleString('id-ID')}</div>
            </div>
            <div className="stats-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Tagihan</span>
                <Receipt className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-xl font-bold text-destructive">Rp {totals.tagihan.toLocaleString('id-ID')}</div>
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
              Daftar Inkaso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Jatuh Tempo</TableHead>
                  <TableHead>Inkaso</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>Rp {Number(c.amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingCollection(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteCollection(c.id)}>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Daftar Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Bayar</TableHead>
                  <TableHead>Pembayaran</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>Rp {Number(p.amount).toLocaleString('id-ID')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingPayment(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeletePayment(p.id)}>
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
      </div>
    </div>
  );
};

export default InkasoManagement;