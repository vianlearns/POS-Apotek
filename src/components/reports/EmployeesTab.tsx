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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, DollarSign } from 'lucide-react';
import { Employee, Payroll } from '../../types';

interface EmployeesTabProps {
    employees: Employee[];
    payrolls: Payroll[];
    showEmployeeDialog: boolean;
    setShowEmployeeDialog: (open: boolean) => void;
    showPayrollDialog: boolean;
    setShowPayrollDialog: (open: boolean) => void;
    editingEmployee: Employee | null;
    setEditingEmployee: (employee: Employee | null) => void;
    editingPayroll: Payroll | null;
    setEditingPayroll: (payroll: Payroll | null) => void;
    handleSaveEmployee: (formData: FormData) => void;
    handleSavePayroll: (formData: FormData) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeletePayroll: (id: string) => void;
}

const EmployeesTab = ({
    employees,
    payrolls,
    showEmployeeDialog,
    setShowEmployeeDialog,
    showPayrollDialog,
    setShowPayrollDialog,
    editingEmployee,
    setEditingEmployee,
    editingPayroll,
    setEditingPayroll,
    handleSaveEmployee,
    handleSavePayroll,
    handleDeleteEmployee,
    handleDeletePayroll,
}: EmployeesTabProps) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Kelola Karyawan</h3>
                <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingEmployee(null)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Karyawan
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
                            <DialogDescription>
                                {editingEmployee ? 'Perbarui data karyawan' : 'Tambahkan karyawan baru'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveEmployee(new FormData(e.currentTarget));
                        }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingEmployee?.name || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Jabatan</Label>
                                <Input
                                    id="position"
                                    name="position"
                                    defaultValue={editingEmployee?.position || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="baseSalary">Gaji Pokok</Label>
                                <Input
                                    id="baseSalary"
                                    name="baseSalary"
                                    type="number"
                                    defaultValue={editingEmployee?.baseSalary || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bonus">Bonus (Opsional)</Label>
                                <Input
                                    id="bonus"
                                    name="bonus"
                                    type="number"
                                    defaultValue={editingEmployee?.bonus || 0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Tanggal Masuk</Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    defaultValue={editingEmployee?.startDate?.split('T')[0] || ''}
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setShowEmployeeDialog(false)}>
                                    Batal
                                </Button>
                                <Button type="submit">
                                    {editingEmployee ? 'Perbarui' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Daftar Karyawan
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Jabatan</TableHead>
                                <TableHead>Gaji Pokok</TableHead>
                                <TableHead>Bonus</TableHead>
                                <TableHead>Tanggal Masuk</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.map((employee) => (
                                <TableRow key={employee.id}>
                                    <TableCell>{employee.name}</TableCell>
                                    <TableCell>{employee.position}</TableCell>
                                    <TableCell>Rp {employee.baseSalary.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>Rp {employee.bonus.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>{new Date(employee.startDate).toLocaleDateString('id-ID')}</TableCell>
                                    <TableCell>
                                        <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                                            {employee.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingEmployee(employee);
                                                    setShowEmployeeDialog(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteEmployee(employee.id)}
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

            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Kelola Penggajian</h3>
                <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingPayroll(null)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Penggajian
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingPayroll ? 'Edit Penggajian' : 'Tambah Penggajian'}</DialogTitle>
                            <DialogDescription>
                                {editingPayroll ? 'Perbarui data penggajian' : 'Tambahkan data penggajian baru'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleSavePayroll(new FormData(e.currentTarget));
                        }} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="employeeId">Karyawan</Label>
                                <Select name="employeeId" defaultValue={editingPayroll?.employeeId || ''} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih karyawan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees.filter(emp => emp.status === 'active').map((employee) => (
                                            <SelectItem key={employee.id} value={employee.id}>
                                                {employee.name} - {employee.position}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="periodMonth">Periode Bulan</Label>
                                <Input
                                    id="periodMonth"
                                    name="periodMonth"
                                    type="month"
                                    defaultValue={editingPayroll?.periodMonth || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="totalSalary">Total Gaji</Label>
                                <Input
                                    id="totalSalary"
                                    name="totalSalary"
                                    type="number"
                                    defaultValue={editingPayroll?.totalSalary || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentDate">Tanggal Dibayar</Label>
                                <Input
                                    id="paymentDate"
                                    name="paymentDate"
                                    type="date"
                                    defaultValue={editingPayroll?.paymentDate?.split('T')[0] || ''}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">Catatan (Opsional)</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    defaultValue={editingPayroll?.notes || ''}
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button type="button" variant="outline" onClick={() => setShowPayrollDialog(false)}>
                                    Batal
                                </Button>
                                <Button type="submit">
                                    {editingPayroll ? 'Perbarui' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <DollarSign className="h-5 w-5 mr-2" />
                        Riwayat Penggajian
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Karyawan</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Total Gaji</TableHead>
                                <TableHead>Tanggal Dibayar</TableHead>
                                <TableHead>Catatan</TableHead>
                                <TableHead>Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payrolls.map((payroll) => (
                                <TableRow key={payroll.id}>
                                    <TableCell>{payroll.employeeName || 'N/A'}</TableCell>
                                    <TableCell>{payroll.periodMonth}</TableCell>
                                    <TableCell>Rp {payroll.totalSalary.toLocaleString('id-ID')}</TableCell>
                                    <TableCell>{new Date(payroll.paymentDate).toLocaleDateString('id-ID')}</TableCell>
                                    <TableCell>{payroll.notes || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex space-x-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingPayroll(payroll);
                                                    setShowPayrollDialog(true);
                                                }}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeletePayroll(payroll.id)}
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

export default EmployeesTab;
