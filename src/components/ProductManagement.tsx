import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Upload, FileText, Download, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  category: string | null;
  stock: number;
  min_stock: number;
  price: number;
  buy_price: number;
  expiry_date: string | null;
  requires_prescription: boolean;
  supplier_id: string | null;
  description: string | null;
}

// Status prioritas untuk sorting
enum StatusPriority {
  EXPIRED = 1,
  LOW_STOCK = 2,
  PRESCRIPTION = 3,
  NORMAL = 4
}

interface Supplier {
  id: string;
  name: string;
}

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<keyof Product | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    stock: 0,
    min_stock: 0,
    price: 0,
    buy_price: 0,
    expiry_date: '',
    requires_prescription: false,
    supplier_id: '',
    description: ''
  });

  const categories = ['Analgesik', 'Antibiotik', 'Vitamin', 'Obat Batuk', 'Obat Maag', 'Suplemen'];

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const data: Product[] = await fetchJSON(`${API_BASE}/products`);
      setProducts(Array.isArray(data) ? data : []);
      // Derive available categories from products
      const dbCategories = [...new Set((Array.isArray(data) ? data : []).map(p => p.category).filter(Boolean))] as string[];
      const allCategories = [...new Set([...categories, ...dbCategories])].sort();
      setAvailableCategories(allCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data produk",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data: Supplier[] = await fetchJSON(`${API_BASE}/suppliers`);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  // Categories are derived from products in fetchProducts

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Fungsi untuk mendapatkan status prioritas produk
  const getProductStatus = (product: Product): StatusPriority => {
    if (product.expiry_date && new Date(product.expiry_date) <= new Date()) {
      return StatusPriority.EXPIRED;
    } else if (product.stock <= product.min_stock) {
      return StatusPriority.LOW_STOCK;
    } else if (product.requires_prescription) {
      return StatusPriority.PRESCRIPTION;
    } else {
      return StatusPriority.NORMAL;
    }
  };

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;
    
    if (sortField === 'status') {
      const aStatus = getProductStatus(a);
      const bStatus = getProductStatus(b);
      
      if (aStatus < bStatus) return sortDirection === 'asc' ? -1 : 1;
      if (aStatus > bStatus) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }
    
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof Product | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Product | 'status') => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleSubmit = async () => {
    try {
      if (editingProduct) {
        await fetchJSON(`${API_BASE}/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            category: formData.category || null,
            stock: formData.stock,
            min_stock: formData.min_stock,
            price: formData.price,
            buy_price: formData.buy_price,
            expiry_date: formData.expiry_date || null,
            requires_prescription: formData.requires_prescription,
            supplier_id: formData.supplier_id || null,
            description: formData.description || null
          })
        });
        
        toast({
          title: "Produk berhasil diupdate",
          description: "Data produk telah disimpan",
        });
      } else {
        await fetchJSON(`${API_BASE}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            category: formData.category || null,
            stock: formData.stock,
            min_stock: formData.min_stock,
            price: formData.price,
            buy_price: formData.buy_price,
            expiry_date: formData.expiry_date || null,
            requires_prescription: formData.requires_prescription,
            supplier_id: formData.supplier_id || null,
            description: formData.description || null
          })
        });
        
        toast({
          title: "Produk berhasil ditambahkan",
          description: "Produk baru telah disimpan",
        });
      }
      
      fetchProducts();
      // Categories refreshed via fetchProducts
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan produk",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Format File Tidak Valid",
        description: "Hanya file Excel (.xlsx, .xls) yang diperbolehkan",
        variant: "destructive"
      });
      return;
    }

    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          toast({
            title: "File Kosong",
            description: "File Excel tidak mengandung data",
            variant: "destructive"
          });
          return;
        }

        setImportPreview(jsonData.slice(0, 5)); // Show first 5 rows as preview
      } catch (error) {
        console.error('Error reading Excel file:', error);
        toast({
          title: "Error",
          description: "Gagal membaca file Excel",
          variant: "destructive"
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processImport = async () => {
    if (!importFile) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          let successCount = 0;
          let errorCount = 0;

          for (const row of jsonData) {
            try {
              const productData = {
                name: row['Nama Produk'] || '',
                category: row['Kategori'] || null,
                stock: parseInt(row['Stok']) || 0,
                min_stock: parseInt(row['Stok Minimum']) || 0,
                price: parseFloat(row['Harga Jual']) || 0,
                buy_price: parseFloat(row['Harga Beli']) || 0,
                expiry_date: row['Tanggal Kadaluarsa'] || null,
                requires_prescription: row['Perlu Resep']?.toLowerCase() === 'ya' || false,
                description: row['Deskripsi'] || null
              };

              if (!productData.name) {
                errorCount++;
                continue;
              }

              const res = await fetch(`${API_BASE}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
              });
              if (!res.ok) {
                errorCount++;
                console.error('Error inserting product:', await res.text());
              } else {
                successCount++;
              }
            } catch (error) {
              errorCount++;
              console.error('Error processing row:', error);
            }
          }

          toast({
            title: "Import Selesai",
            description: `${successCount} produk berhasil diimport, ${errorCount} gagal`,
            variant: successCount > 0 ? "default" : "destructive"
          });

      if (successCount > 0) {
        fetchProducts();
      }
          
          setIsImportDialogOpen(false);
          setImportFile(null);
          setImportPreview([]);
        } catch (error) {
          console.error('Error processing import:', error);
          toast({
            title: "Error",
            description: "Gagal memproses import data",
            variant: "destructive"
          });
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      console.error('Error importing products:', error);
      toast({
        title: "Error",
        description: "Gagal mengimport produk",
        variant: "destructive"
      });
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nama Produk': 'Paracetamol 500mg',
        'Kategori': 'Analgesik',
        'Stok': 100,
        'Stok Minimum': 10,
        'Harga Jual': 5000,
        'Harga Beli': 3000,
        'Tanggal Kadaluarsa': '2025-12-31',
        'Perlu Resep': 'Tidak',
        'Deskripsi': 'Obat pereda nyeri dan demam'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');
    XLSX.writeFile(wb, 'template_produk.xlsx');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      stock: 0,
      min_stock: 0,
      price: 0,
      buy_price: 0,
      expiry_date: '',
      requires_prescription: false,
      supplier_id: '',
      description: ''
    });
    setEditingProduct(null);
    setIsAddDialogOpen(false);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      category: product.category,
      stock: product.stock,
      min_stock: product.min_stock,
      price: product.price,
      buy_price: product.buy_price,
      expiry_date: product.expiry_date || '',
      requires_prescription: product.requires_prescription,
      supplier_id: product.supplier_id || '',
      description: product.description || ''
    });
    setEditingProduct(product);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      
      fetchProducts();
      toast({
        title: "Produk berhasil dihapus",
        description: "Data produk telah dihapus dari sistem",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus produk",
        variant: "destructive"
      });
    }
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manajemen Produk</h2>
          <p className="text-muted-foreground">
            Kelola data obat dan produk farmasi
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Produk dari Excel</DialogTitle>
                <DialogDescription>
                  Upload file Excel untuk mengimport produk dalam jumlah banyak
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsInstructionDialogOpen(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Lihat Instruksi
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excel-file">Pilih File Excel</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </div>

                {importPreview.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Preview Data (5 baris pertama):</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(importPreview[0]).map(key => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.map((row, index) => (
                            <TableRow key={index}>
                              {Object.values(row).map((value: any, i) => (
                                <TableCell key={i}>{String(value)}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsImportDialogOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}>
                  Batal
                </Button>
                <Button 
                  onClick={processImport} 
                  disabled={!importFile || importPreview.length === 0}
                >
                  Import Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Produk
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </DialogTitle>
              <DialogDescription>
                Masukkan informasi lengkap produk farmasi
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Produk*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nama obat"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <div className="space-y-1">
                  <Input
                    value={formData.category || ''}
                    onChange={(e) => setFormData({...formData, category: e.target.value || null})}
                    placeholder="Ketik kategori (opsional)"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {availableCategories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Select value={formData.supplier_id} onValueChange={(value) => setFormData({...formData, supplier_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih supplier (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStock">Stok Minimum</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyPrice">Harga Beli</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  value={formData.buy_price}
                  onChange={(e) => setFormData({...formData, buy_price: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Harga Jual</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Tanggal Expired</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="prescription"
                    checked={formData.requires_prescription}
                    onCheckedChange={(checked) => setFormData({...formData, requires_prescription: checked})}
                  />
                  <Label htmlFor="prescription">Perlu Resep Dokter</Label>
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Deskripsi produk"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Batal
              </Button>
              <Button onClick={handleSubmit}>
                {editingProduct ? 'Update' : 'Simpan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
          <CardDescription>
            Total {filteredProducts.length} produk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Nama {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center">
                    Stok {getSortIcon('stock')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center">
                    Harga {getSortIcon('price')}
                  </div>
                </TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('expiry_date')}
                >
                  <div className="flex items-center">
                    Tanggal Expired {getSortIcon('expiry_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-muted-foreground">{product.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{product.stock}</span>
                      {product.stock <= product.min_stock && (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>Rp {product.price.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{getSupplierName(product.supplier_id)}</TableCell>
                  <TableCell>
                    {product.expiry_date ? (
                      <div className={`text-sm ${
                        new Date(product.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
                          ? 'text-red-600 font-medium' 
                          : 'text-muted-foreground'
                      }`}>
                        {new Date(product.expiry_date).toLocaleDateString('id-ID')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      {product.requires_prescription && (
                        <Badge variant="secondary" className="text-xs">Resep</Badge>
                      )}
                      {product.stock <= product.min_stock && (
                        <Badge variant="destructive" className="text-xs">Stok Rendah</Badge>
                      )}
                      {product.expiry_date && new Date(product.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                        <Badge variant="outline" className="text-xs">Segera Expired</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                      >
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

      {/* Instruction Dialog */}
      <Dialog open={isInstructionDialogOpen} onOpenChange={setIsInstructionDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Instruksi Import Excel</DialogTitle>
            <DialogDescription>
              Panduan format file Excel untuk import produk
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Format Kolom yang Diperlukan:</h4>
              <div className="bg-muted p-4 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Kolom</TableHead>
                      <TableHead>Tipe Data</TableHead>
                      <TableHead>Wajib</TableHead>
                      <TableHead>Contoh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Nama Produk</TableCell>
                      <TableCell>Text</TableCell>
                      <TableCell><Badge variant="destructive">Ya</Badge></TableCell>
                      <TableCell>Paracetamol 500mg</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Kategori</TableCell>
                      <TableCell>Text</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>Analgesik</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Stok</TableCell>
                      <TableCell>Number</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>100</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Stok Minimum</TableCell>
                      <TableCell>Number</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>10</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Harga Jual</TableCell>
                      <TableCell>Number</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>5000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Harga Beli</TableCell>
                      <TableCell>Number</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>3000</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Tanggal Kadaluarsa</TableCell>
                      <TableCell>Date (YYYY-MM-DD)</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>2025-12-31</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Perlu Resep</TableCell>
                      <TableCell>Text (Ya/Tidak)</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>Ya atau Tidak</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Deskripsi</TableCell>
                      <TableCell>Text</TableCell>
                      <TableCell><Badge variant="secondary">Tidak</Badge></TableCell>
                      <TableCell>Obat pereda nyeri</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Kategori yang Valid:</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Anda dapat menggunakan kategori yang sudah ada atau membuat kategori baru:
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <Badge key={cat} variant="outline">{cat}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Kategori baru akan otomatis ditambahkan ke daftar kategori yang tersedia
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Tips Penting:</h4>
              <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                <li>Pastikan nama kolom persis sama dengan format yang ditentukan</li>
                <li>Baris pertama harus berisi header/nama kolom</li>
                <li>Tanggal harus dalam format YYYY-MM-DD (contoh: 2025-12-31)</li>
                <li>Untuk kolom "Perlu Resep", gunakan "Ya" atau "Tidak"</li>
                <li>Kolom yang kosong akan diisi dengan nilai default</li>
                <li>Download template untuk memudahkan format yang benar</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsInstructionDialogOpen(false)}>
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
