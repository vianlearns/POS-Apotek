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
import { Prescription, PrescriptionMedication } from '@/types';
import { FileText, Plus, Search, Eye, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const fetchJSON = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return typeof json?.data !== 'undefined' ? json.data : json;
};

interface SimpleProduct {
  id: string;
  name: string;
  requiresPrescription: boolean;
}

const PrescriptionManagement = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<Prescription | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchPrescriptions();
    fetchProducts();
  }, []);

  const [formData, setFormData] = useState({
    doctorName: '',
    patientName: '',
    medications: [{
      productId: '',
      productName: '',
      quantity: 0,
      dosage: '',
      instructions: ''
    }]
  });

  const [editForm, setEditForm] = useState({
    doctor_name: '',
    patient_name: '',
    date: '',
    status: 'active' as 'active' | 'used',
    medications: [] as PrescriptionMedication[]
  });

  const fetchPrescriptions = async () => {
    try {
      const prescriptionsData = await fetchJSON(`${API_BASE}/prescriptions`);
      const src = Array.isArray(prescriptionsData) ? prescriptionsData : [];
      const formattedPrescriptions: Prescription[] = src.map((p: any) => ({
        id: p.id,
        doctorName: p.doctor_name,
        patientName: p.patient_name,
        date: p.date,
        status: (p.status || 'active') as 'active' | 'used',
        medications: (p.medications || p.prescription_medications || []).map((med: any) => ({
          productId: med.product_id,
          productName: med.product_name || med.products?.name || '',
          quantity: med.quantity,
          dosage: med.dosage,
          instructions: med.instructions
        }))
      }));
      setPrescriptions(formattedPrescriptions);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data resep",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      // Prefer filtered API if available, fallback to all products then filter
      try {
        const data = await fetchJSON(`${API_BASE}/products?requires_prescription=true`);
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        const all = await fetchJSON(`${API_BASE}/products`);
        const filtered = (Array.isArray(all) ? all : []).filter((p: any) => p.requires_prescription);
        setProducts(filtered);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredPrescriptions = prescriptions.filter(prescription =>
    prescription.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prescription.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prescription.id.includes(searchTerm)
  );

  const addMedicationRow = () => {
    setFormData({
      ...formData,
      medications: [
        ...formData.medications,
        { productId: '', productName: '', quantity: 0, dosage: '', instructions: '' }
      ]
    });
  };

  const updateMedication = (index: number, field: string, value: any) => {
    const updatedMedications = formData.medications.map((med, i) => {
      if (i === index) {
        if (field === 'productId') {
          const selectedProduct = products.find(p => p.id === value);
          return { 
            ...med, 
            productId: value, 
            productName: selectedProduct?.name || '' 
          };
        }
        return { ...med, [field]: value };
      }
      return med;
    });
    setFormData({ ...formData, medications: updatedMedications });
  };

  const handleSubmit = async () => {
    try {
      // Insert prescription
      const prescriptionData = await fetchJSON(`${API_BASE}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: formData.doctorName,
          patient_name: formData.patientName,
          created_by: user?.id || null
        })
      });

      // Insert medications
      const medicationsToInsert = formData.medications
        .filter(med => med.productId && med.quantity > 0)
        .map(med => ({
          prescription_id: prescriptionData.id,
          product_id: med.productId,
          quantity: med.quantity,
          dosage: med.dosage,
          instructions: med.instructions
        }));

      if (medicationsToInsert.length > 0) {
        await fetchJSON(`${API_BASE}/prescriptions/${prescriptionData.id}/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(medicationsToInsert)
        });
      }

      fetchPrescriptions();
      resetForm();
      
      toast({
        title: "Resep berhasil ditambahkan",
        description: "Data resep telah disimpan",
      });
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan resep",
        variant: "destructive"
      });
    }
  };

  const handleEditPrescription = (prescription: Prescription) => {
    setEditingPrescription(prescription);
    setEditForm({
      doctor_name: prescription.doctorName,
      patient_name: prescription.patientName,
      date: prescription.date,
      status: prescription.status,
      medications: prescription.medications || []
    });
    setIsEditDialogOpen(true);
  };

  const handleAddEditMedication = () => {
    setEditForm(prev => ({
      ...prev,
      medications: [...prev.medications, {
        productId: '',
        productName: '',
        quantity: 1,
        dosage: '',
        instructions: ''
      }]
    }));
  };

  const handleRemoveEditMedication = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleEditMedicationChange = (index: number, field: keyof PrescriptionMedication, value: any) => {
    setEditForm(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) => 
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const handleUpdatePrescription = async () => {
    if (!editingPrescription) return;

    try {
      await fetchJSON(`${API_BASE}/prescriptions/${editingPrescription.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: editForm.doctor_name,
          patient_name: editForm.patient_name,
          status: editForm.status,
          medications: editForm.medications.map(med => ({
            product_id: med.productId,
            quantity: med.quantity,
            dosage: med.dosage,
            instructions: med.instructions
          }))
        })
      });

      fetchPrescriptions();
      setIsEditDialogOpen(false);
      setEditingPrescription(null);
      
      toast({
        title: "Resep berhasil diperbarui",
        description: "Data resep telah disimpan",
      });
    } catch (error) {
      console.error('Error updating prescription:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui resep",
        variant: "destructive"
      });
    }
  };

  const handleDeletePrescription = async (id: string) => {
    try {
      await fetchJSON(`${API_BASE}/prescriptions/${id}`, {
        method: 'DELETE'
      });

      fetchPrescriptions();
      setDeleteConfirmOpen(false);
      setPrescriptionToDelete(null);
      
      toast({
        title: "Resep berhasil dihapus",
        description: "Data resep telah dihapus",
      });
    } catch (error) {
      console.error('Error deleting prescription:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus resep",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      doctorName: '',
      patientName: '',
      medications: [{
        productId: '',
        productName: '',
        quantity: 0,
        dosage: '',
        instructions: ''
      }]
    });
    setIsAddDialogOpen(false);
  };

  const markAsUsed = async (id: string) => {
    try {
      await fetchJSON(`${API_BASE}/prescriptions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'used' })
      });

      fetchPrescriptions();
      toast({
        title: "Resep telah digunakan",
        description: "Status resep diperbarui",
      });
    } catch (error) {
      console.error('Error updating prescription:', error);
      toast({
        title: "Error",
        description: "Gagal mengupdate status resep",
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
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Manajemen Resep</h2>
            <p className="text-muted-foreground font-medium">
              Kelola resep dokter dan penjualan obat keras
            </p>
          </div>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => resetForm()}
              className="bg-primary hover:bg-primary-hover shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Input Resep
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Input Resep Dokter</DialogTitle>
              <DialogDescription>
                Masukkan data resep dari dokter
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doctorName">Nama Dokter</Label>
                  <Input
                    id="doctorName"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({...formData, doctorName: e.target.value})}
                    placeholder="Dr. Nama Dokter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientName">Nama Pasien</Label>
                  <Input
                    id="patientName"
                    value={formData.patientName}
                    onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                    placeholder="Nama Pasien"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Daftar Obat</Label>
                  <Button variant="outline" size="sm" onClick={addMedicationRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Obat
                  </Button>
                </div>

                {formData.medications.map((medication, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Obat</Label>
                          <Select 
                            value={medication.productId} 
                            onValueChange={(value) => updateMedication(index, 'productId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih obat" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Jumlah</Label>
                          <Input
                            type="number"
                            value={medication.quantity}
                            onChange={(e) => updateMedication(index, 'quantity', parseInt(e.target.value) || 0)}
                            placeholder="Jumlah"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dosis</Label>
                          <Input
                            value={medication.dosage}
                            onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                            placeholder="3x1, 2x1, dll"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Instruksi</Label>
                          <Input
                            value={medication.instructions}
                            onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                            placeholder="Sesudah makan, dll"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Batal
              </Button>
              <Button onClick={handleSubmit}>
                Simpan Resep
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari resep..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Prescriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Resep</CardTitle>
          <CardDescription>
            Total {filteredPrescriptions.length} resep
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Resep</TableHead>
                <TableHead>Dokter</TableHead>
                <TableHead>Pasien</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="font-mono">{prescription.id}</TableCell>
                  <TableCell>{prescription.doctorName}</TableCell>
                  <TableCell>{prescription.patientName}</TableCell>
                  <TableCell>
                    {new Date(prescription.date).toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      prescription.status === 'active' ? 'default' : 'secondary'
                    }>
                      {prescription.status === 'active' && <Clock className="h-3 w-3 mr-1" />}
                      {prescription.status === 'used' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {prescription.status === 'active' ? 'Aktif' : 'Terpakai'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingPrescription(prescription)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPrescription(prescription)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {prescription.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markAsUsed(prescription.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPrescriptionToDelete(prescription.id);
                          setDeleteConfirmOpen(true);
                        }}
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

      {/* View Prescription Dialog */}
      <Dialog open={!!viewingPrescription} onOpenChange={() => setViewingPrescription(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Resep</DialogTitle>
            <DialogDescription>
              Informasi lengkap resep dokter
            </DialogDescription>
          </DialogHeader>
          
          {viewingPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>No. Resep</Label>
                  <p className="font-mono">{viewingPrescription.id}</p>
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <p>{new Date(viewingPrescription.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <Label>Dokter</Label>
                  <p>{viewingPrescription.doctorName}</p>
                </div>
                <div>
                  <Label>Pasien</Label>
                  <p>{viewingPrescription.patientName}</p>
                </div>
              </div>

              <div>
                <Label>Daftar Obat</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obat</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Dosis</TableHead>
                      <TableHead>Instruksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPrescription.medications.map((med, index) => (
                      <TableRow key={index}>
                        <TableCell>{med.productName}</TableCell>
                        <TableCell>{med.quantity}</TableCell>
                        <TableCell>{med.dosage}</TableCell>
                        <TableCell>{med.instructions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingPrescription(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Prescription Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resep</DialogTitle>
            <DialogDescription>
              Perbarui informasi resep dokter
            </DialogDescription>
          </DialogHeader>
          
          {editingPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editDoctorName">Nama Dokter</Label>
                  <Input
                    id="editDoctorName"
                    value={editForm.doctor_name}
                    onChange={(e) => setEditForm({...editForm, doctor_name: e.target.value})}
                    placeholder="Dr. Nama Dokter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPatientName">Nama Pasien</Label>
                  <Input
                    id="editPatientName"
                    value={editForm.patient_name}
                    onChange={(e) => setEditForm({...editForm, patient_name: e.target.value})}
                    placeholder="Nama Pasien"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editForm.status} 
                  onValueChange={(value: 'active' | 'used') => setEditForm({...editForm, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="used">Terpakai</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Medications Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Obat-obatan</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddEditMedication}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Obat
                  </Button>
                </div>

                {editForm.medications.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Belum ada obat. Klik "Tambah Obat" untuk menambahkan.
                  </div>
                ) : (
                  editForm.medications.map((medication, index) => (
                    <div key={`edit-med-${index}-${medication.productId || 'new'}`} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Obat {index + 1}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveEditMedication(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Produk</Label>
                        <Select
                          value={medication.productId}
                          onValueChange={(value) => {
                            const product = products.find(p => p.id === value);
                            handleEditMedicationChange(index, 'productId', value);
                            handleEditMedicationChange(index, 'productName', product?.name || '');
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih produk" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Jumlah</Label>
                        <Input
                          type="number"
                          min="1"
                          value={medication.quantity}
                          onChange={(e) => handleEditMedicationChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Dosis</Label>
                        <Input
                          value={medication.dosage}
                          onChange={(e) => handleEditMedicationChange(index, 'dosage', e.target.value)}
                          placeholder="3x1 tablet"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Instruksi</Label>
                        <Input
                          value={medication.instructions}
                          onChange={(e) => handleEditMedicationChange(index, 'instructions', e.target.value)}
                          placeholder="Sesudah makan"
                        />
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdatePrescription}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus resep ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => prescriptionToDelete && handleDeletePrescription(prescriptionToDelete)}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrescriptionManagement;