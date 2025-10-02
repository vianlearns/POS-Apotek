import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Building, Plus, Search, Edit, Trash2, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    address: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const data: Supplier[] = await fetchJSON(`${API_BASE}/suppliers`);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data supplier",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (supplier.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    try {
      if (editingSupplier) {
        await fetchJSON(`${API_BASE}/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            contact: formData.contact || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null
          })
        });
        
        toast({
          title: "Supplier berhasil diupdate",
          description: "Data supplier telah disimpan",
        });
      } else {
        await fetchJSON(`${API_BASE}/suppliers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            contact: formData.contact || null,
            address: formData.address || null,
            phone: formData.phone || null,
            email: formData.email || null
          })
        });
        
        toast({
          title: "Supplier berhasil ditambahkan",
          description: "Supplier baru telah disimpan",
        });
      }
      
      fetchSuppliers();
      resetForm();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan supplier",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact: '',
      address: '',
      phone: '',
      email: ''
    });
    setEditingSupplier(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact: supplier.contact || '',
      address: supplier.address || '',
      phone: supplier.phone || '',
      email: supplier.email || ''
    });
    setEditingSupplier(supplier);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      
      fetchSuppliers();
      toast({
        title: "Supplier berhasil dihapus",
        description: "Data supplier telah dihapus dari sistem",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus supplier",
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
          <div className="p-3 rounded-xl bg-secondary/10">
            <Building className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Manajemen Supplier</h2>
            <p className="text-muted-foreground font-medium">
              Kelola data supplier dan distributor farmasi
            </p>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => resetForm()}
              className="bg-secondary hover:bg-secondary-hover shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}
              </DialogTitle>
              <DialogDescription>
                Masukkan informasi lengkap supplier
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Perusahaan</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="PT Nama Perusahaan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Nama Kontak</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  placeholder="Nama person in charge"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="021-1234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="info@supplier.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Alamat lengkap supplier"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Batal
              </Button>
              <Button onClick={handleSubmit}>
                {editingSupplier ? 'Update' : 'Simpan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4 slide-up" style={{animationDelay: '0.2s'}}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 bg-card/50 border-border/60 focus:border-secondary/60 transition-colors"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="medical-card p-0 slide-up" style={{animationDelay: '0.3s'}}>
        <div className="p-6 border-b border-border/50">
          <h3 className="text-xl font-semibold text-foreground">Daftar Supplier</h3>
          <p className="text-muted-foreground mt-1">
            Total {filteredSuppliers.length} supplier terdaftar
          </p>
        </div>
        <div className="p-6">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="font-semibold">Nama Perusahaan</TableHead>
                <TableHead className="font-semibold">Kontak</TableHead>
                <TableHead className="font-semibold">Telepon</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier, index) => (
                <TableRow 
                  key={supplier.id} 
                  className="border-border/30 hover:bg-muted/30 transition-colors"
                  style={{animationDelay: `${0.4 + index * 0.05}s`}}
                >
                  <TableCell className="font-medium text-foreground">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.contact ? (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        {supplier.contact}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.email ? (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        {supplier.email}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                        className="hover:bg-secondary/10 hover:border-secondary hover:text-secondary"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(supplier.id)}
                        className="hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default SupplierManagement;