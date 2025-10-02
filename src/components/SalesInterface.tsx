import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  DialogTitle 
} from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, Search, Receipt, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  requires_prescription: boolean;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Transaction {
  id: string;
  date: string;
  cashier_id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  payment_method: string;
  status: string;
}

interface Prescription {
  id: string;
  doctor_name: string;
  patient_name: string;
  date: string;
  status: string;
  prescription_medications: Array<{
    id: string;
    product_id: string;
    quantity: number;
    dosage: string;
    instructions: string;
    products: { name: string };
  }>;
}

const SalesInterface = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<string>('none');
  const { toast } = useToast();
  const { user } = useAuth();

  // Format tanggal/jam ke WIB (Asia/Jakarta)
  const formatWIB = (input: string) => {
    const normalized = /Z|\+\d{2}:?\d{2}$/.test(input) ? input : `${input}Z`;
    const d = new Date(normalized);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta'
    }).format(d);
  };

  useEffect(() => {
    fetchProducts();
    fetchPrescriptions();
  }, []);

  const fetchProducts = async () => {
    try {
      // Prefer API with stock filter, fallback to all then filter client-side
      try {
        const data: Product[] = await fetchJSON(`${API_BASE}/products?inStock=true`);
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        const all: Product[] = await fetchJSON(`${API_BASE}/products`);
        setProducts((Array.isArray(all) ? all : []).filter((p) => Number(p.stock) > 0));
      }
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

  const fetchPrescriptions = async () => {
    try {
      // Fetch active prescriptions including medications; support multiple backend shapes
      let data: any[] = [];
      try {
        data = await fetchJSON(`${API_BASE}/prescriptions?status=active`);
      } catch {
        data = await fetchJSON(`${API_BASE}/prescriptions`);
        data = (Array.isArray(data) ? data : []).filter((p: any) => (p.status || 'active') === 'active');
      }
      const src = Array.isArray(data) ? data : [];
      const formatted: Prescription[] = src.map((p: any) => ({
        id: p.id,
        doctor_name: p.doctor_name,
        patient_name: p.patient_name,
        date: p.date,
        status: p.status || 'active',
        prescription_medications: (p.medications || p.prescription_medications || []).map((m: any) => ({
          id: m.id,
          product_id: m.product_id,
          quantity: m.quantity,
          dosage: m.dosage,
          instructions: m.instructions,
          products: { name: m.product_name || m.products?.name || '' }
        }))
      }));

      setPrescriptions(formatted);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.requires_prescription && (!selectedPrescription || selectedPrescription === 'none')) {
      toast({
        title: "Perlu Resep Dokter",
        description: "Pilih resep terlebih dahulu untuk produk yang memerlukan resep",
        variant: "destructive"
      });
      return;
    }

    // If prescription is selected, validate that this product is in the prescription
    if (product.requires_prescription && selectedPrescription && selectedPrescription !== 'none') {
      const prescription = prescriptions.find(p => p.id === selectedPrescription);
      const medicationInPrescription = prescription?.prescription_medications.find(
        med => med.product_id === product.id
      );
      
      if (!medicationInPrescription) {
        toast({
          title: "Produk Tidak Sesuai Resep",
          description: "Produk ini tidak ada dalam resep yang dipilih",
          variant: "destructive"
        });
        return;
      }
    }

    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast({
          title: "Stok Tidak Cukup",
          description: "Jumlah melebihi stok yang tersedia",
          variant: "destructive"
        });
        return;
      }
      
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
      toast({
        title: "Stok Tidak Cukup",
        description: "Jumlah melebihi stok yang tersedia",
        variant: "destructive"
      });
      return;
    }

    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const processTransaction = async () => {
    if (cart.length === 0) {
      toast({
        title: "Keranjang Kosong",
        description: "Tambahkan produk ke keranjang terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    try {
      const subtotal = calculateSubtotal();
      
      // Create transaction via Express API
      const transactionData = await fetchJSON(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashier_id: user.id,
          subtotal,
          total: subtotal,
          payment_method: 'cash',
          status: 'completed',
          prescription_id: (selectedPrescription && selectedPrescription !== 'none') ? selectedPrescription : null
        })
      });

      // Create transaction items
      const transactionItems = cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }));

      await fetchJSON(`${API_BASE}/transactions/${transactionData.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionItems)
      });

      // Update product stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await fetchJSON(`${API_BASE}/products/${item.product_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: product.stock - item.quantity })
          });
        }
      }

      // Update prescription status if used
      if (selectedPrescription && selectedPrescription !== 'none') {
        await fetchJSON(`${API_BASE}/prescriptions/${selectedPrescription}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'used' })
        });
      }

      const transaction: Transaction = {
        id: transactionData.id,
        date: transactionData.date,
        cashier_id: transactionData.cashier_id,
        items: cart,
        subtotal: transactionData.subtotal,
        total: transactionData.total,
        payment_method: transactionData.payment_method,
        status: transactionData.status
      };

      setLastTransaction(transaction);
      setCart([]);
      setSelectedPrescription('none');
      setIsReceiptDialogOpen(true);
      fetchProducts(); // Refresh products to update stock
      fetchPrescriptions(); // Refresh prescriptions to update status
      
      toast({
        title: "Transaksi Berhasil",
        description: `Total: Rp ${transaction.total.toLocaleString('id-ID')}`,
      });
    } catch (error) {
      console.error('Error processing transaction:', error);
      toast({
        title: "Error",
        description: "Gagal memproses transaksi",
        variant: "destructive"
      });
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fade-in">
      {/* Product Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="slide-up">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Penjualan</h2>
              <p className="text-muted-foreground">
                Pilih produk untuk ditambahkan ke transaksi
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative slide-up" style={{animationDelay: '0.1s'}}>
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari produk atau kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 bg-card/50 border-border/60 focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((product, index) => (
            <div 
              key={product.id} 
              className="product-card p-5 slide-up" 
              style={{animationDelay: `${0.2 + index * 0.05}s`}}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{product.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{product.category}</p>
                </div>
                {product.requires_prescription && (
                  <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                    <FileText className="h-3 w-3 mr-1" />
                    Resep
                  </Badge>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xl font-bold text-primary">Rp {product.price.toLocaleString('id-ID')}</p>
                  <p className="text-sm text-muted-foreground">
                    Stok: <span className={`font-medium ${product.stock <= 10 ? 'text-warning' : 'text-accent'}`}>
                      {product.stock}
                    </span>
                  </p>
                </div>
                <Button
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  size="sm"
                  className="bg-primary hover:bg-primary-hover shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shopping Cart */}
      <div className="space-y-6">
        {/* Prescription Selection */}
        <div className="medical-card p-6 slide-up" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Pilih Resep</h3>
              <p className="text-sm text-muted-foreground">
                Pilih resep untuk produk yang memerlukan resep dokter
              </p>
            </div>
          </div>
          
          <Select value={selectedPrescription} onValueChange={setSelectedPrescription}>
            <SelectTrigger className="h-12 bg-background/50 border-border/60 hover:border-primary/40">
              <SelectValue placeholder="Pilih resep..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada resep</SelectItem>
              {prescriptions.map((prescription) => (
                <SelectItem key={prescription.id} value={prescription.id}>
                  <div className="flex flex-col py-1">
                    <span className="font-medium">
                      {prescription.patient_name} - Dr. {prescription.doctor_name}
                    </span>
                    <span className="text-sm text-muted-foreground">{prescription.date}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedPrescription && selectedPrescription !== 'none' && (
            <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <p className="text-sm font-medium mb-3 text-accent">Obat dalam resep:</p>
              <div className="space-y-2">
                {prescriptions.find(p => p.id === selectedPrescription)?.prescription_medications.map(med => (
                  <div key={med.id} className="text-sm text-muted-foreground flex items-center">
                    <div className="w-2 h-2 rounded-full bg-accent/60 mr-2" />
                    {med.products.name} - {med.quantity} pcs ({med.dosage})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="medical-card p-6 slide-up" style={{animationDelay: '0.4s'}}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Keranjang</h3>
              <span className="text-sm text-muted-foreground">{cart.length} item</span>
            </div>
          </div>
          
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Keranjang masih kosong</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div 
                  key={item.product_id} 
                  className="flex items-center justify-between space-x-3 p-3 rounded-lg bg-background/50 border border-border/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromCart(item.product_id)}
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction Summary */}
        {cart.length > 0 && (
          <div className="medical-card p-6 slide-up" style={{animationDelay: '0.5s'}}>
            <h3 className="font-semibold text-lg text-foreground mb-4">Total Transaksi</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">Rp {calculateSubtotal().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-xl font-bold text-primary">
                <span>Total:</span>
                <span>Rp {calculateSubtotal().toLocaleString('id-ID')}</span>
              </div>
              <Button 
                className="w-full h-12 bg-primary hover:bg-primary-hover shadow-md hover:shadow-lg transition-all duration-200 font-medium" 
                onClick={processTransaction}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Proses Transaksi
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Struk Transaksi
            </DialogTitle>
            <DialogDescription>
              Transaksi berhasil diproses
            </DialogDescription>
          </DialogHeader>
          
          {lastTransaction && (
            <div className="space-y-6" id="receipt-print-area">
              <div className="text-center p-4 border-b border-border/50">
                <img src={logo} alt="Hanum Farma" className="mx-auto h-12 mb-2" />
                <h3 className="font-bold text-lg">HANUM FARMA</h3>
                <p className="text-sm text-muted-foreground">Alamat: Jl. Nenggolo, RT 04, RW 10, Curugsewu, Patean, Kendal, Jawa Tengah, Indonesia</p>
                <p className="text-sm text-muted-foreground">Tel: (62) 85777330094</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No:</span>
                  <span className="font-mono">{lastTransaction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span>{formatWIB(lastTransaction.date)}</span>
                </div>
              </div>
              
              <div className="border-t border-b border-border/50 py-4">
                <Table>
                  <TableBody>
                    {lastTransaction.items.map((item, index) => (
                      <TableRow key={index} className="border-none">
                        <TableCell className="py-2 px-0">
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-0 text-right font-medium">
                          Rp {item.total.toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span className="text-primary">Rp {lastTransaction.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tunai</span>
                  <span>Rp {lastTransaction.total.toLocaleString('id-ID')}</span>
                </div>
              </div>
              
              <div className="text-center text-sm text-muted-foreground border-t border-border/50 pt-4">
                <p className="font-medium">Terima kasih atas kunjungan Anda</p>
                <p>Semoga lekas sembuh</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsReceiptDialogOpen(false)}>
              Tutup
            </Button>
            <Button onClick={printReceipt} className="bg-primary hover:bg-primary-hover">
              <Receipt className="h-4 w-4 mr-2" />
              Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesInterface;