import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';
import {
  UserCheck,
  UserPlus,
  Shield,
  KeyRound,
  Trash2,
  Edit2,
  Phone,
  RefreshCw,
  Lock,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { useToast } from './NotificationContext';

export default function UserManagement({ isLargeText }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form New User
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('teknisi');
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Form Edit User
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('teknisi');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const { showToast, confirmModal } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/users`);
      if (res.data?.data) {
        setUsers(res.data.data);
      }
    } catch {
      // Mock data untuk GitHub Pages / offline demo
      if (isGitHubPages) {
        setUsers([
          { id: 1, username: 'admin', role: 'admin', full_name: 'Super Administrator (Rois)', phone: '081234567890', created_at: '2026-11-20 08:00:00' },
          { id: 2, username: 'noc', role: 'noc', full_name: 'NOC Monitoring Specialist', phone: '081234567891', created_at: '2026-11-20 08:00:00' },
          { id: 3, username: 'teknisi', role: 'teknisi', full_name: 'Teknisi Lapangan & PSB', phone: '081234567892', created_at: '2026-11-20 08:00:00' },
          { id: 4, username: 'bendahara', role: 'bendahara', full_name: 'Bendahara & Billing Specialist', phone: '081234567893', created_at: '2026-11-20 08:00:00' },
        ]);
      } else {
        showToast('Gagal memuat daftar pengguna. Pastikan Anda masuk sebagai Administrator.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formUsername || !formPassword || !formFullName) {
      showToast('Harap lengkapi username, kata sandi, dan nama lengkap.', 'warning');
      return;
    }

    try {
      await axios.post(`${API}/users`, {
        username: formUsername.trim().toLowerCase(),
        password: formPassword.trim(),
        role: formRole,
        full_name: formFullName.trim(),
        phone: formPhone.trim(),
      });
      showToast(`Pengguna ${formUsername} (${formRole.toUpperCase()}) berhasil dibuat!`, 'success');
      setShowAddModal(false);
      setFormUsername('');
      setFormPassword('');
      setFormFullName('');
      setFormPhone('');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menambahkan pengguna baru.', 'error');
    }
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setEditFullName(u.full_name);
    setEditRole(u.role);
    setEditPhone(u.phone || '');
    setEditPassword('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await axios.patch(`${API}/users/${editingUser.id}`, {
        full_name: editFullName.trim(),
        role: editRole,
        phone: editPhone.trim(),
        password: editPassword.trim() || undefined,
      });
      showToast(`Data pengguna ${editingUser.username} berhasil diperbarui!`, 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal memperbarui pengguna.', 'error');
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      showToast('Akun super admin utama tidak dapat dihapus!', 'warning');
      return;
    }

    const confirmed = await confirmModal({
      title: 'Hapus Akun Pengguna',
      message: `Apakah Anda yakin ingin menghapus pengguna "${u.username}" (${u.full_name})? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus Akun',
      cancelText: 'Batal',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/users/${u.id}`);
      showToast(`Akun ${u.username} berhasil dihapus.`, 'info');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus pengguna.', 'error');
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
            SUPER ADMIN (Semua Menu)
          </span>
        );
      case 'noc':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            NOC (All API Read-Only)
          </span>
        );
      case 'teknisi':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            TEKNISI (Mapping, PSB, Tiket)
          </span>
        );
      case 'bendahara':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
            BENDAHARA (Keuangan, Tagihan, Pajak)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
            {role}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 ${isLargeText ? 'text-base' : 'text-sm'}`}>
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
              ROLE-BASED ACCESS CONTROL (RBAC)
            </span>
          </div>
          <h2 className={`font-black tracking-tight text-white ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            Kelola Pengguna &amp; Hak Akses
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Atur wewenang staf: NOC (Monitoring Read-Only), Teknisi (PSB &amp; Lapangan), Bendahara (Keuangan &amp; Pajak), Admin (Semua Menu).
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className={`px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition ${
              isLargeText ? 'h-12 text-base' : 'h-10 text-xs'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className={`px-5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 flex items-center justify-center gap-2 transition ${
              isLargeText ? 'h-12 text-base' : 'h-10 text-xs'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Tabel Daftar Pengguna */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Daftar Akun Terdaftar</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Total: {users.length} Akun</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Hak Akses Role</th>
                <th className="py-3 px-4">Kontak HP/WA</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-bold font-mono text-cyan-300 text-sm">@{u.username}</div>
                    <div className="text-[11px] text-slate-500">ID #{u.id}</div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-100">
                    {u.full_name}
                  </td>
                  <td className="py-3.5 px-4">
                    {getRoleBadge(u.role)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                    {u.phone || '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit</span>
                    </button>
                    {u.username !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH USER BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Tambah Pengguna &amp; Hak Akses
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Lengkap Petugas</label>
                <input
                  required
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Contoh: Roisul Amin (Teknisi)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username Login</label>
                  <input
                    required
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="misal: teknisi_jember"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kata Sandi</label>
                  <input
                    required
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Kata sandi aman"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role / Wewenang Sistem</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
                >
                  <option value="teknisi">TEKNISI (Mapping Pelanggan, PSB, Tiket Lapangan)</option>
                  <option value="bendahara">BENDAHARA (Laporan Keuangan, Tagihan, Pajak PPN 11%)</option>
                  <option value="noc">NOC (All API Read-Only / Monitoring Peta &amp; Traffic)</option>
                  <option value="admin">ADMIN (Akses Penuh Semua Menu &amp; Router)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nomor HP / WhatsApp</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                Edit Pengguna @{editingUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Lengkap</label>
                <input
                  required
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role / Hak Akses</label>
                <select
                  disabled={editingUser.username === 'admin'}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  <option value="admin">ADMIN (Akses Penuh Semua Menu)</option>
                  <option value="noc">NOC (All API Read-Only / Monitoring)</option>
                  <option value="teknisi">TEKNISI (Mapping, PSB, Tiket Lapangan)</option>
                  <option value="bendahara">BENDAHARA (Keuangan, Tagihan, Pajak PPN)</option>
                </select>
                {editingUser.username === 'admin' && (
                  <p className="text-[11px] text-slate-500 mt-1">Akun super admin utama harus selalu memiliki role 'admin'.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ganti Kata Sandi (Opsional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nomor HP / WA</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
