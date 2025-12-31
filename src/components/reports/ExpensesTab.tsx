import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Receipt } from 'lucide-react';
import { Expense } from '../../types';

interface ExpensesTabProps {
    expenses: Expense[];
    showExpenseDialog: boolean;
    setShowExpenseDialog: (open: boolean) => void;
    editingExpense: Expense | null;
    setEditingExpense: (expense: Expense | null) => void;
    handleSaveExpense: (formData: FormData) => void;
    handleDeleteExpense: (id: string) => void;
}

const ExpensesTab = ({
    expenses,
    showExpenseDialog,
    setShowExpenseDialog,
    editingExpense,
    setEditingExpense,
    handleSaveExpense,
    handleDeleteExpense,
}: ExpensesTabProps) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Kelola Pengeluaran</h3>
                <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingExpense(null)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Pengeluaran
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingExpense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</DialogTitle>
                            <DialogDescription>
                                {editingExpense ? 'Perbarui data pengeluaran' : 'Tambahkan pengeluaran baru'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveExpense(new FormData(e.currentTarget));
                        }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Kategori</Label>
                                <Select name="category" defaultValue={editingExpense?.category || ''} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="operasional">Operasional</SelectItem>
                                        <SelectItem value="inventori">Inventori</SelectItem>
                                        <SelectItem value="marketing">Marketing</SelectItem>
                                        <SelectItem value="maintenance">Maintenance</SelectItem>
                                        <SelectItem value="utilities">Utilities</SelectItem>
                                        <SelectItem value="lainnya">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={editingExpense?.description || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Jumlah</Label>
                                <Input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    defaultValue={editingExpense?.amount || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Tanggal</Label>
                                <Input
                                    id="date"
                                    name="date"
                                    type="date"
                                    defaultValue={editingExpense?.date?.split('T')[0] || ''}
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setShowExpenseDialog(false)}>
                                    Batal
                                </Button>
                                <Button type="submit">
                                    {editingExpense ? 'Perbarui' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Receipt className="h-5 w-5 mr-2" />
                        Daftar Pengeluaran
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Dibuat Oleh</TableHead>
                                <TableHead>Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {expense.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{expense.description}</TableCell>
                                    <TableCell>Rp {expense.amount.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>{new Date(expense.date).toLocaleDateString('id-ID')}</TableCell>
                                    <TableCell>{expense.createdBy}</TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingExpense(expense);
                                                    setShowExpenseDialog(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteExpense(expense.id)}
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
        </div>
    );
};

export default ExpensesTab;
