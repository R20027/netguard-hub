import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from './api';
import HelpTip from './HelpTip';

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
      alert('✅ Entry berhasil ditambahkan langsung ke MikroTik Firewall Address-List!');
    } catch (err) {
      alert('Gagal menambah address list: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteAddress = async (id, addr, list) => {
    if (!confirm(`Hapus IP ${addr} dari list '${list}' di MikroTik?`)) return;
    try {
      await axios.delete(`${API}/mikrotik/firewall/address-list/${id}`);
      alert(`Entry ${addr} berhasil dihapus dari MikroTik!`);
      loadData();
    } catch (err) {
      alert('Gagal menghapus: ' + (err.response?.data?.error || err.message));
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              🛡️ Firewall &amp; Address-List RouterOS
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
              LIVE MIKROTIK SYNC
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Terhubung langsung dengan <code className="text-cyan-400 font-mono">/ip/firewall/address-list</code> di router. IP pelanggan yang menunggak tagihan otomatis masuk ke list <strong className="text-rose-400">ISOLIR</strong> dan diblokir dari akses internet.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="inline-flex items-center">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none h-10 sm:h-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-600/25 transition flex items-center justify-center"
            >
              + Tambah IP ke RouterOS
            </button>
            <HelpTip
              title="Tambah IP ke Address-List MikroTik"
              text="Memasukkan IP atau subnet secara manual ke /ip/firewall/address-list di router MikroTik (misalnya ke daftar ISOLIR atau BLOCK)."
              impact="Jika IP dimasukkan ke list ISOLIR dan firewall filter drop aktif di MikroTik, akses internet IP tersebut langsung terblokir."
            />
          </div>
          <div className="inline-flex items-center">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex-1 sm:flex-none h-10 sm:h-auto px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
            <HelpTip
              title="Refresh Data Firewall"
              text="Mengambil ulang data live Address-List, Filter Rules dari MikroTik, dan riwayat audit database."
            />
          </div>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            IP Address List ISOLIR
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-rose-400">{isolirCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
              Live di RouterOS
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Total Entry Address-List</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-cyan-400">{addressLists.length}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Semua List
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Firewall Filter Rules</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-white">{filters.length}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Active Rules
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium">Audit History Logs</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-400">{logs.length}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              Log Recorded
            </span>
          </div>
        </div>
      </div>

      {/* SUBTAB SELECTION & SEARCH */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setSubTab('mikrotik')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                subTab === 'mikrotik'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔥 Live MikroTik Address-List ({addressLists.length})
            </button>
            <button
              onClick={() => setSubTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                subTab === 'audit'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Riwayat Audit Firewall ({logs.length})
            </button>
          </div>
          <HelpTip
            title="Perbedaan Address-List Live vs Riwayat Audit"
            text="Live Address-List membaca tabel aktif yang sedang terpasang di router MikroTik saat ini. Riwayat Audit menampilkan catatan historis siapa saja yang pernah diisolir (BLOCK) atau dipulihkan (ALLOW)."
          />
        </div>

        <div className="w-full lg:w-72">
          <input
            type="text"
            placeholder={subTab === 'mikrotik' ? 'Cari IP, nama list, comment...' : 'Cari riwayat audit...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* VIEW 1: LIVE MIKROTIK ADDRESS-LIST */}
      {subTab === 'mikrotik' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">List Name</th>
                  <th className="p-4">IP Address Terdaftar</th>
                  <th className="p-4">Tipe / Dinamis</th>
                  <th className="p-4">Keterangan (Comment)</th>
                  <th className="p-4">Aksi Hapus dari MikroTik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {loading && addressLists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      Mengambil data live dari MikroTik...
                    </td>
                  </tr>
                ) : filteredAddressList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-slate-400">
                      Tidak ada IP address-list terdaftar di MikroTik.
                    </td>
                  </tr>
                ) : (
                  filteredAddressList.map((item, idx) => {
                    const isIsolir = item.list === 'ISOLIR';
                    return (
                      <tr key={item['.id'] || idx} className="hover:bg-slate-850/60 transition">
                        <td className="p-4 font-mono">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                              isIsolir
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            }`}
                          >
                            {item.list}
                          </span>
                        </td>

                        <td className="p-4 font-mono font-bold text-slate-200 text-sm">
                          {item.address}
                        </td>

                        <td className="p-4 text-slate-400">
                          {item.dynamic === 'true' ? (
                            <span className="text-amber-400 font-mono text-[11px]">Dynamic</span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">Static</span>
                          )}
                        </td>

                        <td className="p-4 text-slate-300">
                          {item.comment ? (
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                              {item.comment}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="inline-flex items-center">
                            <button
                              onClick={() => handleDeleteAddress(item['.id'], item.address, item.list)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-[11px] transition shadow"
                            >
                              Hapus dari MikroTik
                            </button>
                            <HelpTip
                              title="Hapus IP dari Address-List MikroTik"
                              text="Mencabut IP address ini dari daftar address-list di router MikroTik."
                              impact="Jika IP ada di daftar ISOLIR, akses internet IP tersebut langsung terbuka kembali."
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE ADDRESS-LIST CARDS (md:hidden) */}
          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {loading && addressLists.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Mengambil data live dari MikroTik...
              </div>
            ) : filteredAddressList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Tidak ada IP address-list terdaftar di MikroTik.
              </div>
            ) : (
              filteredAddressList.map((item, idx) => {
                const isIsolir = item.list === 'ISOLIR';
                return (
                  <div key={item['.id'] || idx} className="pt-3 first:pt-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isIsolir
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {item.list}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.dynamic === 'true' ? 'Dynamic' : 'Static'}
                      </span>
                    </div>

                    <div className="font-mono font-bold text-white text-base">
                      {item.address}
                    </div>

                    {item.comment && (
                      <div className="text-xs text-slate-400 bg-slate-950/80 border border-slate-800 rounded-lg p-2">
                        {item.comment}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteAddress(item['.id'], item.address, item.list)}
                        className="flex-1 h-10 rounded-xl bg-rose-600/90 active:bg-rose-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1.5"
                      >
                        <span>🗑️</span>
                        <span>Hapus IP dari MikroTik</span>
                      </button>
                      <HelpTip
                        title="Hapus IP dari Address-List"
                        text="Menghapus IP ini dari daftar firewall di MikroTik (misal melepas blokir ISOLIR)."
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT LOGS (DATABASE) */}
      {subTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Waktu</th>
                  <th className="p-4">Pelanggan</th>
                  <th className="p-4">Aksi Firewall</th>
                  <th className="p-4">Target IP Address</th>
                  <th className="p-4">Alasan &amp; Pemicu</th>
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
                    <tr key={l.id} className="hover:bg-slate-850/60 transition">
                      <td className="p-4 text-slate-400 font-mono">
                        {formatDate(l.created_at)}
                      </td>

                      <td className="p-4 font-bold text-slate-200">
                        {l.customer_name}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            l.action === 'block'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {l.action === 'block' ? '🔒 BLOCK (ISOLIR)' : '🔓 ALLOW (PULIH)'}
                        </span>
                      </td>

                      <td className="p-4 font-mono text-slate-300">
                        {l.ip_address || '-'}
                      </td>

                      <td className="p-4 text-slate-300">
                        {l.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE AUDIT CARDS (md:hidden) */}
          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Belum ada riwayat audit firewall tercatat.
              </div>
            ) : (
              filteredLogs.map((l) => (
                <div key={l.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-sm">{l.customer_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        l.action === 'block'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {l.action === 'block' ? '🔒 BLOCK' : '🔓 ALLOW'}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>IP: <strong className="text-slate-200">{l.ip_address || '-'}</strong></span>
                      <span>{formatDate(l.created_at)}</span>
                    </div>
                    <div className="text-[11px] text-cyan-300 font-sans border-t border-slate-800/80 pt-1">
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
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Tambah IP ke MikroTik Address-List</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Nama Address List *
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
              <label className="text-xs font-medium text-slate-300 block mb-1">
                IP Address / Subnet *
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
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Catatan (Comment)
              </label>
              <input
                placeholder="Misal: Blokir isolir manual pelanggan X"
                value={newEntry.comment}
                onChange={(e) => setNewEntry({ ...newEntry, comment: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
              >
                Kirim ke RouterOS
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
