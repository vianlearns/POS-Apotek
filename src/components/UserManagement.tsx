import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// email dan active dihapus dari UI, jadi Switch/Badge tidak diperlukan
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';
import { Search, RefreshCw, Save, Trash2, Plus } from 'lucide-react';

type Role = 'admin' | 'apoteker' | 'kasir';

const roleOptions: Role[] = ['admin', 'apoteker', 'kasir'];

const UserManagement: React.FC = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [newUser, setNewUser] = useState<{ username: string; password: string; name: string; role: Role }>({
    username: '', password: '', name: '', role: 'kasir'
  });
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/users`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat pengguna');
      setUsers((json.data || []) as User[]);
    } catch (err: any) {
      console.error('Gagal memuat pengguna:', err);
      toast({ variant: 'destructive', title: 'Gagal memuat pengguna', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => {
      const matchesTerm = term ? ((u.name || '').toLowerCase().includes(term) || (u.username || '').toLowerCase().includes(term)) : true;
      const matchesRole = roleFilter === 'all' ? true : u.role === roleFilter;
      return matchesTerm && matchesRole;
    });
  }, [users, search, roleFilter]);

  const updateLocalUser = (id: number, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)));
  };

  const handleSave = async (user: User) => {
    try {
      setSavingIds(prev => ({ ...prev, [user.id]: true }));
      const body: any = { name: user.name, role: user.role };
      const np = newPasswords[user.id];
      if (np && np.trim().length > 0) body.password = np.trim();
      const res = await fetch(`${API_BASE}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menyimpan perubahan');
      toast({ title: 'Perubahan disimpan', description: `Data pengguna diperbarui.` });
      setNewPasswords(prev => ({ ...prev, [user.id]: '' }));
    } catch (err: any) {
      console.error('Gagal menyimpan perubahan:', err);
      toast({ variant: 'destructive', title: 'Gagal menyimpan perubahan', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setSavingIds(prev => ({ ...prev, [user.id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menghapus pengguna');
      toast({ title: 'Pengguna dihapus', description: 'Data pengguna telah dihapus.' });
      fetchUsers();
    } catch (err:any) {
      console.error('Gagal menghapus pengguna:', err);
      toast({ variant: 'destructive', title: 'Gagal menghapus pengguna', description: err.message || 'Terjadi kesalahan.' });
    }
  };

  const handleCreate = async () => {
    try {
      if (!newUser.username || !newUser.password || !newUser.role) {
        return toast({ variant: 'destructive', title: 'Data tidak lengkap', description: 'Username, password, dan role wajib diisi.' });
      }
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal menambah pengguna');
      toast({ title: 'Pengguna ditambahkan', description: `User ${newUser.username} berhasil dibuat.` });
      setNewUser({ username: '', password: '', name: '', role: 'kasir' });
      fetchUsers();
    } catch (err:any) {
      console.error('Gagal menambah pengguna:', err);
      toast({ variant: 'destructive', title: 'Gagal menambah pengguna', description: err.message || 'Terjadi kesalahan.' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="medical-card">
        <CardHeader>
          <CardTitle>Manajemen Pengguna</CardTitle>
          <CardDescription>
            Kelola nama dan role pengguna. Role yang tersedia: Admin, Apoteker, Kasir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-end gap-3">
              <div className="w-full">
                <Label>Cari</Label>
                <div className="relative">
                  <Input
                    placeholder="Cari nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div>
              <Label>Filter Role</Label>
              <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="apoteker">Apoteker</SelectItem>
                  <SelectItem value="kasir">Kasir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={fetchUsers} disabled={loading} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Muat Ulang
              </Button>
            </div>
          </div>

          {/* Form tambah pengguna */}
          <div className="rounded-xl border border-border/50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Username</Label>
                <Input value={newUser.username} onChange={(e)=>setNewUser(prev=>({...prev, username: e.target.value}))} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={newUser.password} onChange={(e)=>setNewUser(prev=>({...prev, password: e.target.value}))} />
              </div>
              <div>
                <Label>Nama</Label>
                <Input value={newUser.name} onChange={(e)=>setNewUser(prev=>({...prev, name: e.target.value}))} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(val)=>setNewUser(prev=>({...prev, role: val as Role}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(r => (
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" /> Tambah Pengguna</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold">Username</TableHead>
                  <TableHead className="font-semibold">Nama</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Password Baru</TableHead>
                  <TableHead className="font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{u.username}</span>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={u.name || ''}
                        onChange={(e) => updateLocalUser(u.id, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(val) => updateLocalUser(u.id, { role: val as Role })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map(r => (
                            <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="password"
                        value={newPasswords[u.id] || ''}
                        onChange={(e)=>setNewPasswords(prev=>({...prev, [u.id]: e.target.value}))}
                        placeholder="Kosongkan jika tidak mengubah"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSave(u)}
                        disabled={!!savingIds[u.id]}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" /> Simpan
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(u.id)}
                        className="gap-2 ml-2"
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {loading ? 'Memuat data pengguna...' : 'Tidak ada data yang cocok'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">
            Total {filteredUsers.length} pengguna terdaftar
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;