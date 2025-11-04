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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Edit, RotateCcw, Eye, Receipt, Calendar, User, CreditCard, Plus, Minus, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction, TransactionItem } from '@/types';
import logo from '@/assets/logo.png';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
};

type TransactionManagementProps = {
  initialDateFilter?: string;
};

const TransactionManagement = ({ initialDateFilter }: TransactionManagementProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [prescriptionFilter, setPrescriptionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    paymentMethod: 'cash',
    status: 'completed',
    discount: 0,
    discountType: 'percentage' as 'percentage' | 'fixed',
    items: [] as TransactionItem[]
  });
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [stockChanges, setStockChanges] = useState<{[key: string]: {oldQty: number, newQty: number, productName: string}}>({});
  const [showStockWarning, setShowStockWarning] = useState(false);

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

  const { toast } = useToast();
  const { userProfile } = useAuth();

  const canModify = userProfile?.role === 'admin' || userProfile?.role === 'apoteker';

  // Print receipt function
  const printReceipt = () => {
    window.print();
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await fetchJSON(`${API_BASE}/transactions`);
      if (data.ok) {
        // Map API response to frontend format
        const mappedTransactions = (data.data || []).map((transaction: any) => ({
          ...transaction,
          items: transaction.transaction_items || [],
          cashierId: transaction.cashier_id,
          paymentMethod: transaction.payment_method,
          prescriptionId: transaction.prescription_id,
          discount: transaction.discount || 0,
          discountType: transaction.discount_type || 'percentage',
          subtotal: transaction.subtotal || transaction.total
        }));
        setTransactions(mappedTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data transaksi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Apply initial date filter when provided (e.g., navigated from Reports)
  useEffect(() => {
    if (initialDateFilter && initialDateFilter !== dateFilter) {
      setDateFilter(initialDateFilter);
    }
  }, [initialDateFilter]);

  const fetchProducts = async () => {
    try {
      const data = await fetchJSON(`${API_BASE}/products`);
      if (data.ok) {
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addProductToTransaction = (product: any) => {
    const existingItemIndex = editForm.items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // If product already exists, check if we can increase quantity
      const currentQuantity = editForm.items[existingItemIndex].quantity;
      
      // Check if adding 1 more would exceed available stock
      if (currentQuantity >= product.stock) {
        toast({
          title: "Stok Tidak Mencukupi",
          description: `Stok ${product.name} hanya tersisa ${product.stock} unit`,
          variant: "destructive",
        });
        return;
      }
      
      const newItems = [...editForm.items];
      newItems[existingItemIndex].quantity += 1;
      newItems[existingItemIndex].total = newItems[existingItemIndex].quantity * newItems[existingItemIndex].price;
      
      // Track stock changes
      const productId = product.id;
      const productName = product.name;
      setStockChanges(prev => ({
        ...prev,
        [productId]: {
          oldQty: prev[productId]?.oldQty || (currentQuantity),
          newQty: newItems[existingItemIndex].quantity,
          productName
        }
      }));
      setShowStockWarning(true);
      
      setEditForm({...editForm, items: newItems});
    } else {
      // Add new product - check if stock is available
      if (product.stock < 1) {
        toast({
          title: "Stok Tidak Tersedia",
          description: `${product.name} sedang tidak tersedia`,
          variant: "destructive",
        });
        return;
      }
      
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        productName: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      };
      
      // Track stock changes for new item
      setStockChanges(prev => ({
        ...prev,
        [product.id]: {
          oldQty: 0,
          newQty: 1,
          productName: product.name
        }
      }));
      setShowStockWarning(true);
      
      setEditForm({...editForm, items: [...editForm.items, newItem]});
    }
    
    setProductSearch('');
    setShowProductSelector(false);
  };

  useEffect(() => {
    fetchTransactions();
    fetchProducts();
  }, []);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || transaction.paymentMethod === paymentFilter;
    const matchesPrescription = prescriptionFilter === 'all' || 
                               (prescriptionFilter === 'with' && transaction.prescriptionId) ||
                               (prescriptionFilter === 'without' && !transaction.prescriptionId);
    
    if (dateFilter) {
      const transactionDate = new Date(transaction.date).toDateString();
      const filterDate = new Date(dateFilter).toDateString();
      return matchesSearch && matchesStatus && matchesPayment && matchesPrescription && transactionDate === filterDate;
    }
    
    return matchesSearch && matchesStatus && matchesPayment && matchesPrescription;
  });

  const handleViewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditForm({
      paymentMethod: transaction.paymentMethod || 'cash',
      status: transaction.status || 'completed',
      discount: transaction.discount || 0,
      discountType: transaction.discountType || 'percentage',
      items: transaction.items || []
    });
    setStockChanges({});
    setShowStockWarning(false);
    setIsEditDialogOpen(true);
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const submitEdit = async () => {
    if (!selectedTransaction) return;

    try {
      setLoading(true);
      
      // Calculate new totals
      const subtotal = editForm.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const discountAmount = editForm.discountType === 'percentage' 
        ? (subtotal * editForm.discount) / 100
        : editForm.discount;
      const newTotal = Math.max(0, subtotal - discountAmount);

      const response = await fetchJSON(`${API_BASE}/transactions/${selectedTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: editForm.paymentMethod,
          discount: editForm.discount,
          discount_type: editForm.discountType,
          items: editForm.items,
          subtotal: subtotal,
          total: newTotal
        })
      });

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Transaksi berhasil diperbarui",
        });
        setIsEditDialogOpen(false);
        setStockChanges({});
        setShowStockWarning(false);
        fetchTransactions();
      } else {
        throw new Error(response.error || 'Gagal memperbarui transaksi');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui transaksi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitDelete = async () => {
    if (!selectedTransaction) return;

    try {
      setLoading(true);
      const response = await fetchJSON(`${API_BASE}/transactions/${selectedTransaction.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Berhasil",
          description: "Transaksi berhasil dikembalikan",
        });
        setIsDeleteDialogOpen(false);
        fetchTransactions();
      } else {
        throw new Error(response.error || 'Gagal mengembalikan transaksi');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengembalikan transaksi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Manajemen Transaksi
          </CardTitle>
          <CardDescription>
            Kelola dan pantau semua transaksi penjualan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Cari ID transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[200px]"
              />
            </div>

            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pembayaran</SelectItem>
                <SelectItem value="cash">Tunai</SelectItem>
              </SelectContent>
            </Select>

            <Select value={prescriptionFilter} onValueChange={setPrescriptionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Resep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="with">Dengan Resep</SelectItem>
                <SelectItem value="without">Tanpa Resep</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
            />
          </div>

          {/* Transactions Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Transaksi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pembayaran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resep</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Tidak ada transaksi ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {transaction.id}
                      </TableCell>
                      <TableCell>{formatWIB(transaction.date)}</TableCell>
                      <TableCell>{transaction.cashierId}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(transaction.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.paymentMethod === 'cash' ? 'Tunai' : 'Transfer'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          transaction.status === 'completed' ? 'default' :
                          transaction.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {transaction.status === 'completed' ? 'Selesai' :
                           transaction.status === 'pending' ? 'Pending' : 'Dibatalkan'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaction.prescriptionId ? (
                          <Badge variant="secondary">
                            {transaction.prescriptionId.slice(0, 8)}...
                          </Badge>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewTransaction(transaction)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canModify && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTransaction(transaction)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog - Receipt Format */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Struk Transaksi
            </DialogTitle>
            <DialogDescription>
              Detail transaksi dalam format struk
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
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
                  <span className="font-mono">{selectedTransaction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal:</span>
                  <span>{formatWIB(selectedTransaction.date)}</span>
                </div>
              </div>
              
              <div className="border-t border-b border-border/50 py-4">
                <Table>
                  <TableBody>
                    {selectedTransaction.items?.map((item, index) => (
                      <TableRow key={index} className="border-none">
                        <TableCell className="py-2 px-0">
                          <div>
                            <div className="font-medium">{item.product_name || item.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.quantity} x Rp {(item.price || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-0 text-right font-medium">
                          Rp {(item.total || (item.quantity * (item.price || 0))).toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="space-y-2">
                {selectedTransaction.discount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>Rp {selectedTransaction.subtotal?.toLocaleString('id-ID') || selectedTransaction.total.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-sm text-secondary">
                      <span>
                        Diskon ({selectedTransaction.discountType === 'percentage' ? `${selectedTransaction.discount}%` : `Rp ${selectedTransaction.discount.toLocaleString('id-ID')}`})
                      </span>
                      <span>
                        - Rp {(selectedTransaction.discountType === 'percentage' 
                          ? (selectedTransaction.subtotal * selectedTransaction.discount) / 100
                          : selectedTransaction.discount
                        ).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-border/50 pt-2">
                  <span>TOTAL</span>
                  <span className="text-primary">Rp {selectedTransaction.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tunai</span>
                  <span>Rp {selectedTransaction.total.toLocaleString('id-ID')}</span>
                </div>
              </div>
              
              <div className="text-center text-sm text-muted-foreground border-t border-border/50 pt-4">
                <p className="font-medium">Terima kasih atas kunjungan Anda</p>
                <p>Semoga lekas sembuh</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
            <Button onClick={printReceipt} className="bg-primary hover:bg-primary-hover">
              <Receipt className="h-4 w-4 mr-2" />
              Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaksi</DialogTitle>
            <DialogDescription>
              Ubah informasi transaksi, diskon, dan item
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>ID:</strong> {selectedTransaction.id}</p>
                  <p><strong>Tanggal:</strong> {formatDate(selectedTransaction.date)}</p>
                </div>
                <div>
                  <p><strong>Total Asli:</strong> {formatCurrency(selectedTransaction.total)}</p>
                  <p><strong>Kasir:</strong> {selectedTransaction.cashierId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Payment & Discount */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                    <Select value={editForm.paymentMethod} onValueChange={(value) => setEditForm({...editForm, paymentMethod: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Tunai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Discount Section */}
                  <div className="space-y-3">
                    <Label>Diskon</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={editForm.discount}
                        onChange={(e) => setEditForm({...editForm, discount: Number(e.target.value)})}
                        className="flex-1"
                      />
                      <Select value={editForm.discountType} onValueChange={(value: 'percentage' | 'fixed') => setEditForm({...editForm, discountType: value})}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">Rp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editForm.discount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Diskon: Rp {(editForm.discountType === 'percentage' 
                          ? (editForm.items.reduce((sum, item) => sum + (item.total || 0), 0) * editForm.discount) / 100
                          : editForm.discount
                        ).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  

                </div>

                {/* Right Column - Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Item Transaksi</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProductSelector(!showProductSelector)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Produk
                    </Button>
                  </div>
                  
                  {/* Product Selector */}
                  {showProductSelector && (
                    <div className="border rounded-lg p-3 bg-muted/50">
                      <div className="space-y-2">
                        <Input
                          placeholder="Cari produk..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="w-full"
                        />
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {products
                            .filter(product => 
                              product.name.toLowerCase().includes(productSearch.toLowerCase()) &&
                              product.stock > 0
                            )
                            .slice(0, 10)
                            .map(product => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between p-2 hover:bg-background rounded cursor-pointer"
                                onClick={() => addProductToTransaction(product)}
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Stok: {product.stock} | Rp {product.price.toLocaleString('id-ID')}
                                  </p>
                                </div>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            ))}
                          {productSearch && products.filter(product => 
                            product.name.toLowerCase().includes(productSearch.toLowerCase()) &&
                            product.stock > 0
                          ).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Tidak ada produk ditemukan
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {showStockWarning && Object.keys(stockChanges).length > 0 && (
                    <Alert className="mb-4">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Informasi Perubahan Stok</AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-1">
                          {Object.entries(stockChanges).map(([productId, change]) => {
                            const stockDiff = change.newQty - change.oldQty;
                            return (
                              <div key={productId} className="text-sm">
                                <span className="font-medium">{change.productName}</span>: 
                                {stockDiff > 0 ? (
                                  <span className="text-red-600 ml-1">
                                    Stok akan berkurang {Math.abs(stockDiff)} unit
                                  </span>
                                ) : (
                                  <span className="text-green-600 ml-1">
                                    Stok akan bertambah {Math.abs(stockDiff)} unit
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="border rounded-lg p-4 max-h-80 overflow-y-auto">
                    {editForm.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 mb-3 p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product_name || item.productName}</p>
                          <p className="text-xs text-muted-foreground">Rp {(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItems = [...editForm.items];
                              if (newItems[index].quantity > 1) {
                                const oldQty = newItems[index].quantity;
                                newItems[index].quantity -= 1;
                                newItems[index].total = newItems[index].quantity * (newItems[index].price || 0);
                                
                                // Track stock changes
                                const productId = newItems[index].product_id;
                                const productName = newItems[index].product_name || newItems[index].productName;
                                setStockChanges(prev => ({
                                  ...prev,
                                  [productId]: {
                                    oldQty: prev[productId]?.oldQty || oldQty,
                                    newQty: newItems[index].quantity,
                                    productName
                                  }
                                }));
                                setShowStockWarning(true);
                                
                                setEditForm({...editForm, items: newItems});
                              }
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItems = [...editForm.items];
                              const currentItem = newItems[index];
                              const productId = currentItem.product_id;
                              
                              // Find the product to check stock
                              const product = products.find(p => p.id === productId);
                              if (!product) {
                                toast({
                                  title: "Error",
                                  description: "Produk tidak ditemukan",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              // Check if increasing quantity would exceed available stock
                              if (currentItem.quantity >= product.stock) {
                                toast({
                                  title: "Stok Tidak Mencukupi",
                                  description: `Stok ${product.name} hanya tersisa ${product.stock} unit`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              const oldQty = newItems[index].quantity;
                              newItems[index].quantity += 1;
                              newItems[index].total = newItems[index].quantity * (newItems[index].price || 0);
                              
                              // Track stock changes
                              const productName = newItems[index].product_name || newItems[index].productName;
                              setStockChanges(prev => ({
                                ...prev,
                                [productId]: {
                                  oldQty: prev[productId]?.oldQty || oldQty,
                                  newQty: newItems[index].quantity,
                                  productName
                                }
                              }));
                              setShowStockWarning(true);
                              
                              setEditForm({...editForm, items: newItems});
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItems = editForm.items.filter((_, i) => i !== index);
                              setEditForm({...editForm, items: newItems});
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-sm font-medium w-20 text-right">
                          Rp {(item.total || (item.quantity * (item.price || 0))).toLocaleString('id-ID')}
                        </div>
                      </div>
                    ))}
                    
                    {editForm.items.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Tidak ada item</p>
                    )}
                  </div>
                  
                  {/* Summary */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>Rp {editForm.items.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('id-ID')}</span>
                    </div>
                    {editForm.discount > 0 && (
                      <div className="flex justify-between text-sm text-secondary">
                        <span>Diskon:</span>
                        <span>- Rp {(editForm.discountType === 'percentage' 
                          ? (editForm.items.reduce((sum, item) => sum + (item.total || 0), 0) * editForm.discount) / 100
                          : editForm.discount
                        ).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold">
                      <span>Total Baru:</span>
                      <span>Rp {Math.max(0, editForm.items.reduce((sum, item) => sum + (item.total || 0), 0) - (editForm.discountType === 'percentage' 
                        ? (editForm.items.reduce((sum, item) => sum + (item.total || 0), 0) * editForm.discount) / 100
                        : editForm.discount
                      )).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={submitEdit} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kembalikan Transaksi</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin mengembalikan transaksi ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-2">
              <p><strong>ID:</strong> {selectedTransaction.id}</p>
              <p><strong>Total:</strong> {formatCurrency(selectedTransaction.total)}</p>
              <p><strong>Tanggal:</strong> {formatDate(selectedTransaction.date)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={loading}>
              {loading ? 'Mengembalikan...' : 'Kembalikan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionManagement;