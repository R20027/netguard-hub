import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  X,
  Flame,
  FileText,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { API } from './api';
import HelpTip from './HelpTip';
import { useToast } from './NotificationContext';

export default function FirewallLogs() {
  const [subTab, setSubTab] = useState('mikrotik'); // 'mikrotik' | 'audit'
  const [logs, setLogs] = useState([]);
  const [addressLists, setAddressLists] = useState([]);
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal Tambah Entry Address List
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    list: 'ISOLIR',
    address: '',
    comment: '',
  });

  const { showToast, confirmModal } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [resLogs, resAddr, resFilter] = await Promise.all([
        axios.get(`${API}/firewall-logs`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/mikrotik/firewall/address-list`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/mikrotik/firewall/filter`).catch(() => ({ data: { data: [] } })),
      ]);
      setLogs(resLogs.data.data || []);
      setAddressLists(resAddr.data.data || []);
      setFilters(resFilter.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/mikrotik/firewall/address-list`, newEntry);
      setShowAddModal(false);
      setNewEntry({ list: 'ISOLIR', address: '', comment: '' });
      loadData();
      showToast(`Entry IP ${newEntry.address} berhasil didaftarkan ke address-list ${newEntry.list} di MikroTik.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Menambah Address-List');
    }
  };

  const handleDeleteAddress = async (id, addr, list) => {
    const confirmed = await confirmModal({
      title: 'Hapus Entry Firewall',
      message: `Hapus IP ${addr} dari daftar address-list '${list}' di MikroTik? Akses internet IP ini akan dibuka jika terisolir.`,
      confirmText: 'Hapus dari Router',
      cancelText: 'Batal',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/mikrotik/firewall/address-list/${id}`);
      showToast(`Entry ${addr} berhasil dihapus dari router MikroTik.`, 'info');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Menghapus');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  };

  // Filtering
  const filteredAddressList = addressLists.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.address?.toLowerCase().includes(q) ||
      item.list?.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    );
  });

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.customer_name?.toLowerCase().includes(q) ||
      l.ip_address?.toLowerCase().includes(q) ||
      l.reason?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q)
    );
  });

  const isolirCount = addressLists.filter((a) => a.list === 'ISOLIR').length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Firewall &amp; Isolation Engine RouterOS
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                LIVE ADDRESS-LIST
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
              Sinkronisasi instan dengan <code className="text-cyan-400 font-mono text-[11px]">/ip/firewall/address-list</code> MikroTik. Pelanggan menunggak otomatis masuk daftar <strong className="text-rose-400">ISOLIR</strong> dan trafik internetnya diblokir.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah IP Manual</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sinkronkan</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Address-List ISOLIR
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-400">{isolirCount}</span>
            <span className="text-[11px] font-mono text-rose-400/80">
              Router Active
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-cyan-400" />
            Total Address-List
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{addressLists.length}</span>
            <span className="text-[11px] font-mono text-slate-400">
              Semua List
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Filter Rules
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{filters.length}</span>
            <span className="text-[11px] font-mono text-slate-400">
              Active Rules
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            Audit History
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{logs.length}</span>
            <span className="text-[11px] font-mono text-emerald-400/80">
              Log Tercatat
            </span>
          </div>
        </div>
      </div>

      {/* SUBTAB SELECTION & SEARCH */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setSubTab('mikrotik')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                subTab === 'mikrotik'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Address-List ({addressLists.length})</span>
            </button>
            <button
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                subTab === 'audit'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Audit Log ({logs.length})</span>
            </button>
          </div>
          <HelpTip
            title="Address-List vs Riwayat Audit"
            text="Address-List Live merefleksikan entri aktual di router MikroTik. Riwayat Audit mencatat jejak kapan isolir diaktifkan atau dipulihkan."
          />
        </div>

        <div className="w-full lg:w-72 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder={subTab === 'mikrotik' ? 'Cari IP, nama list, comment...' : 'Cari riwayat audit...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
      </div>

      {/* VIEW 1: LIVE MIKROTIK ADDRESS-LIST */}
      {subTab === 'mikrotik' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">List Name</th>
                  <th className="p-3.5">IP Address Terdaftar</th>
                  <th className="p-3.5">Tipe Alokasi</th>
                  <th className="p-3.5">Keterangan / Comment</th>
                  <th className="p-3.5">Aksi RouterOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {loading && addressLists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      Memuat daftar address-list dari MikroTik...
                    </td>
                  </tr>
                ) : filteredAddressList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-slate-400">
                      Tidak ada entri address-list sesuai kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredAddressList.map((item, idx) => {
                    const isIsolir = item.list === 'ISOLIR';
                    return (
                      <tr key={item['.id'] || idx} className="hover:bg-slate-850/40 transition">
                        <td className="p-3.5 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] font-mono border ${
                              isIsolir
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                            }`}
                          >
                            {item.list}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono font-bold text-slate-200">
                          {item.address}
                        </td>

                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                          {item.dynamic === 'true' ? 'Dynamic' : 'Static'}
                        </td>

                        <td className="p-3.5 text-slate-300">
                          {item.comment ? (
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono">
                              {item.comment}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          <button
                            onClick={() => handleDeleteAddress(item['.id'], item.address, item.list)}
                            className="px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-[11px] transition flex items-center gap-1 shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Entry</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE ADDRESS-LIST CARDS */}
          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {loading && addressLists.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Mengambil data dari router...
              </div>
            ) : filteredAddressList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Tidak ada entri address-list ditemukan.
              </div>
            ) : (
              filteredAddressList.map((item, idx) => {
                const isIsolir = item.list === 'ISOLIR';
                return (
                  <div key={item['.id'] || idx} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] font-mono border ${
                          isIsolir
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                            : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                        }`}
                      >
                        {item.list}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.dynamic === 'true' ? 'Dynamic' : 'Static'}
                      </span>
                    </div>

                    <div className="font-mono font-bold text-white text-sm">
                      {item.address}
                    </div>

                    {item.comment && (
                      <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono">
                        {item.comment}
                      </div>
                    )}

                    <button
                      onClick={() => handleDeleteAddress(item['.id'], item.address, item.list)}
                      className="w-full py-2 rounded-lg bg-rose-600/90 active:bg-rose-600 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus dari Router</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT LOGS (DATABASE) */}
      {subTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Waktu Eksekusi</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Aksi Firewall</th>
                  <th className="p-3.5">Target IP Address</th>
                  <th className="p-3.5">Alasan &amp; Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-slate-400">
                      Belum ada riwayat audit firewall tercatat.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-850/40 transition">
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {formatDate(l.created_at)}
                      </td>

                      <td className="p-3.5 font-bold text-slate-200">
                        {l.customer_name}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] font-mono flex items-center gap-1 w-fit border ${
                            l.action === 'block'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {l.action === 'block' ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>BLOCK (ISOLIR)</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>ALLOW (PULIH)</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {l.ip_address || '-'}
                      </td>

                      <td className="p-3.5 text-slate-300">
                        {l.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE AUDIT CARDS */}
          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Belum ada riwayat audit tercatat.
              </div>
            ) : (
              filteredLogs.map((l) => (
                <div key={l.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs">{l.customer_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] font-mono border ${
                        l.action === 'block'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {l.action === 'block' ? 'BLOCK' : 'ALLOW'}
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono space-y-1">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>IP: <strong className="text-slate-200">{l.ip_address || '-'}</strong></span>
                      <span>{formatDate(l.created_at)}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-sans border-t border-slate-800 pt-1">
                      {l.reason}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MANUAL IP KE ADDRESS LIST */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAddAddress}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white">Tambah IP ke Address-List Router</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Nama Address-List *
                </label>
                <input
                  required
                  placeholder="ISOLIR"
                  value={newEntry.list}
                  onChange={(e) => setNewEntry({ ...newEntry, list: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Target IP Address / Subnet *
                </label>
                <input
                  required
                  placeholder="10.10.10.25 atau 192.168.1.0/24"
                  value={newEntry.address}
                  onChange={(e) => setNewEntry({ ...newEntry, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Keterangan / Comment (Opsional)
                </label>
                <input
                  placeholder="Contoh: Isolir manual tagihan"
                  value={newEntry.comment}
                  onChange={(e) => setNewEntry({ ...newEntry, comment: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
              >
                Simpan ke Router
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
