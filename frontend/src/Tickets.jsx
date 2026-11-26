import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from './api';
import HelpTip from './HelpTip';

export default function Tickets({ onSwitchTab }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('open'); // 'all' | 'open' | 'resolved'
  const [prioFilter, setPrioFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [newTicket, setNewTicket] = useState({ title: '', priority: 'P1', device_id: '' });

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/tickets`);
      setTickets(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  // Diagnostic scan on-demand ke MikroTik
  const handleDiagnose = async () => {
    setScanning(true);
    try {
      const res = await axios.post(`${API}/mikrotik/diagnose`);
      setScanResult(res.data);
      setShowScanModal(true);
      fetchTickets();
    } catch (err) {
      alert('Gagal mendiagnosis MikroTik: ' + (err.response?.data?.error || err.message));
    } finally {
      setScanning(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tickets`, newTicket);
      setShowCreateModal(false);
      setNewTicket({ title: '', priority: 'P1', device_id: '' });
      fetchTickets();
    } catch (err) {
      alert('Gagal membuat tiket: ' + err.message);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/tickets/${id}/status`, { status });
      fetchTickets();
    } catch (err) {
      alert('Gagal update tiket: ' + err.message);
    }
  };

  const deleteTicket = async (id) => {
    if (!confirm(`Hapus permanen tiket #${id}?`)) return;
    try {
      await axios.delete(`${API}/tickets/${id}`);
      fetchTickets();
    } catch (err) {
      alert('Gagal hapus tiket: ' + (err.response?.data?.error || err.message));
    }
  };

  // Format Helper
  const prioBadge = (p) => {
    switch (p) {
      case 'P0':
        return 'bg-rose-600/90 text-white border-rose-400/50 animate-pulse';
      case 'P1':
        return 'bg-amber-600/90 text-white border-amber-400/50';
      case 'P2':
        return 'bg-yellow-500/80 text-black border-yellow-300/50';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  };

  // Filtering
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (prioFilter !== 'all' && t.priority !== prioFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.device_id?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }
    return true;
  });

  // KPI Counters
  const totalOpen = tickets.filter((t) => t.status === 'open').length;
  const p0Count = tickets.filter((t) => t.status === 'open' && t.priority === 'P0').length;
  const p1Count = tickets.filter((t) => t.status === 'open' && t.priority === 'P1').length;
  const totalResolved = tickets.filter((t) => t.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* MIKROTIK SENTINEL ALERT HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-2xl shadow-inner text-cyan-400 flex-shrink-0">
              🛰️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  NOC Sentinel Auto-Detector
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse">
                  REAL-TIME ACTIVE
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
                Backend terhubung langsung ke MikroTik RouterOS: memantau link port down (WAN/LAN), CPU overload (&gt;90%), dan log error secara otomatis tiap 20 detik. Tiket otomatis terselesaikan begitu link kembali UP!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full md:w-auto">
            {onSwitchTab && (
              <div className="inline-flex items-center">
                <button
                  onClick={() => onSwitchTab('map')}
                  className="w-full sm:w-auto h-10 sm:h-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-1.5"
                >
                  <span>🗺️</span>
                  <span>Buka Peta Gangguan</span>
                </button>
                <HelpTip
                  title="Peta Gangguan NOC GIS"
                  text="Melihat titik persebaran perangkat router, kabel, dan titik komplain pelanggan di atas peta geografis berbasis CARTO. Titik yang bermasalah akan berkedip merah."
                />
              </div>
            )}

            <div className="inline-flex items-center">
              <button
                onClick={handleDiagnose}
                disabled={scanning}
                className={`w-full sm:w-auto h-10 sm:h-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg ${
                  scanning
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/30'
                }`}
              >
                <span className={scanning ? 'animate-spin' : ''}>🔍</span>
                <span>{scanning ? 'Mendiagnosis Router...' : 'Pindai Masalah MikroTik'}</span>
              </button>
              <HelpTip
                title="Pindai Masalah MikroTik"
                text="Melakukan audit dan diagnosa seketika ke RouterOS: mengecek semua interface link yang down, utilisasi CPU, memory, serta log error."
                tip="Gunakan saat terjadi keluhan internet lambat atau koneksi terputus tiba-tiba."
              />
            </div>

            <div className="inline-flex items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto h-10 sm:h-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center"
              >
                + Tiket Manual
              </button>
              <HelpTip
                title="Tiket Gangguan Manual"
                text="Membuat tiket insiden secara manual bila ada laporan teknis dari pelanggan atau teknisi lapangan yang belum terdeteksi otomatis oleh sensor."
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Tiket Terbuka (Open)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-white">{totalOpen}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Perlu Ditangani
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            P0 - Kritis (Down)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-rose-400">{p0Count}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold">
              WAN / Core Down
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-amber-400 text-xs font-medium">P1 - High (Port/CPU)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-400">{p1Count}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
              Interface Link Down
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium">Selesai / Pulih</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-400">{totalResolved}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold">
              Resolved Auto/Man
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'open'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Open ({totalOpen})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'resolved'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Resolved ({totalResolved})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua ({tickets.length})
            </button>
          </div>

          {/* Priority filter */}
          <select
            value={prioFilter}
            onChange={(e) => setPrioFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="all">Semua Prioritas</option>
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
          <HelpTip
            title="Filter Status & Prioritas Tiket"
            text="P0 Kritis: Router Utama / Interface WAN terputus atau perangkat inti down. P1 High: Interface port LAN mati, CPU overload, atau pelanggan diisolir. P2/P3: Peringatan log atau laporan ringan."
          />
        </div>

        {/* Search */}
        <div className="w-full lg:w-72">
          <input
            type="text"
            placeholder="Cari judul tiket, interface, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* TICKETS DISPLAY: DESKTOP TABLE & MOBILE INCIDENT CARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* DESKTOP TABLE (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Prioritas</th>
                <th className="p-4">Judul Gangguan / Masalah</th>
                <th className="p-4">Device / Source</th>
                <th className="p-4">Waktu Terjadi</th>
                <th className="p-4">Status &amp; Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400">
                    Memuat daftar insiden...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-4xl">🎉</span>
                      <p className="text-slate-300 font-medium">
                        Tidak ada gangguan aktif sesuai filter!
                      </p>
                      <p className="text-slate-500 text-xs">
                        MikroTik RouterOS dan jaringan beroperasi dengan normal.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const isMikrotik = t.device_id?.startsWith('mikrotik-') || t.title?.includes('[MikroTik');
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-850/60 transition duration-150"
                    >
                      <td className="p-4 font-mono font-bold text-slate-400">
                        #{t.id}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${prioBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      <td className="p-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          {isMikrotik && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold">
                              ROUTEROS
                            </span>
                          )}
                          <span>{t.title}</span>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-slate-300">
                        {t.device_id ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[11px]">
                              {t.device_id}
                            </span>
                            {onSwitchTab && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSwitchTab('map', {
                                    id: t.device_id,
                                    type: 'device',
                                    lat: t.lat,
                                    lng: t.lng,
                                    label: `${t.device_id} (${t.title})`,
                                  })
                                }
                                title={`Lihat titik lokasi ${t.device_id} di peta`}
                                className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[10px] font-semibold transition flex items-center gap-1 shadow-sm"
                              >
                                <span>📍</span>
                                <span>Peta</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="p-4 text-slate-400">
                        {formatDate(t.created_at)}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              t.status === 'open'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {t.status.toUpperCase()}
                          </span>

                          {t.status === 'open' ? (
                            <div className="inline-flex items-center">
                              <button
                                onClick={() => updateStatus(t.id, 'resolved')}
                                className="px-2.5 py-1 rounded bg-blue-600/90 hover:bg-blue-500 text-white font-medium text-[11px] transition shadow"
                              >
                                ✓ Selesaikan
                              </button>
                              <HelpTip
                                title="Selesaikan Gangguan"
                                text="Menutup tiket insiden dan mencatat waktu pemulihan jaringan."
                              />
                            </div>
                          ) : (
                            <div className="inline-flex items-center">
                              <button
                                onClick={() => updateStatus(t.id, 'open')}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] transition"
                              >
                                Buka Ulang
                              </button>
                              <HelpTip
                                title="Buka Ulang Tiket"
                                text="Membuka kembali tiket ini jika gangguan masih berulang atau belum tuntas."
                              />
                            </div>
                          )}

                          <div className="inline-flex items-center">
                            <button
                              onClick={() => deleteTicket(t.id)}
                              title="Hapus tiket permanen"
                              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 text-[10px] transition"
                            >
                              🗑️
                            </button>
                            <HelpTip
                              title="Hapus Tiket"
                              text="Menghapus catatan tiket ini secara permanen dari riwayat."
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE INCIDENT CARDS (md:hidden) - BEBAS NABRAK */}
        <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Memuat daftar insiden...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              🎉 Tidak ada gangguan aktif! Semua normal.
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isMikrotik = t.device_id?.startsWith('mikrotik-') || t.title?.includes('[MikroTik');
              return (
                <div key={t.id} className="pt-3 first:pt-0 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-400">#{t.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${prioBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      {isMikrotik && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
                          ROUTEROS
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        t.status === 'open'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-white leading-snug">
                    {t.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>Src: {t.device_id || 'System'}</span>
                      {t.device_id && onSwitchTab && (
                        <button
                          type="button"
                          onClick={() =>
                            onSwitchTab('map', {
                              id: t.device_id,
                              type: 'device',
                              lat: t.lat,
                              lng: t.lng,
                              label: `${t.device_id} (${t.title})`,
                            })
                          }
                          className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-semibold"
                        >
                          📍 Peta
                        </button>
                      )}
                    </div>
                    <span>{formatDate(t.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.status === 'open' ? (
                      <button
                        onClick={() => updateStatus(t.id, 'resolved')}
                        className="flex-1 h-10 rounded-xl bg-blue-600 active:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                      >
                        <span>✓</span>
                        <span>Selesaikan #{t.id}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(t.id, 'open')}
                        className="flex-1 h-9 rounded-xl bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition flex items-center justify-center"
                      >
                        Buka Ulang #{t.id}
                      </button>
                    )}
                    <button
                      onClick={() => deleteTicket(t.id)}
                      className="h-10 px-3 rounded-xl bg-slate-950 active:bg-rose-950 border border-slate-800 text-slate-400 active:text-rose-300 text-xs font-semibold"
                    >
                      🗑️
                    </button>
                    <HelpTip
                      title={t.status === 'open' ? 'Selesaikan atau Hapus Tiket' : 'Buka Ulang atau Hapus Tiket'}
                      text={t.status === 'open' ? 'Tombol biru menandai masalah sudah selesai; tombol tempat sampah menghapus tiket secara permanen.' : 'Mengaktifkan kembali tiket atau menghapusnya dari riwayat.'}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL SCAN HASIL DIAGNOSIS MIKROTIK */}
      {showScanModal && scanResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛰️</span>
                <h3 className="text-lg font-bold text-white">Hasil Pindaian MikroTik Sentinel</h3>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Koneksi RouterOS</span>
                <strong className={scanResult.connected ? 'text-emerald-400' : 'text-rose-400'}>
                  {scanResult.connected ? 'TERHUBUNG (Online)' : 'TERPUTUS (Offline)'}
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Interface Terdeteksi</span>
                <strong className="text-cyan-400">
                  {scanResult.interfaces_count || 0} Interfaces
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Tiket Baru Dibuat</span>
                <strong className="text-rose-400">
                  {scanResult.created_tickets || 0} Masalah Baru
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Tiket Auto-Resolved</span>
                <strong className="text-emerald-400">
                  {scanResult.resolved_tickets || 0} Link Pulih
                </strong>
              </div>
            </div>

            {/* List Masalah Terdeteksi */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Detail Pemeriksaan &amp; Masalah:
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {scanResult.issues && scanResult.issues.length > 0 ? (
                  scanResult.issues.map((iss, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-rose-300">
                      <span>⚠️</span>
                      <span>{iss}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-400 flex items-center gap-2 py-2">
                    <span>✅</span>
                    <span>Semua interface fisik aktif normal, CPU dalam batas aman, dan tidak ditemukan problem kritis pada MikroTik.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowScanModal(false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow"
              >
                Tutup &amp; Tinjau Tiket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUAT TIKET MANUAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Buat Tiket Insiden Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Judul Masalah / Deskripsi
              </label>
              <input
                type="text"
                required
                placeholder="Misal: Switch Core Lantai 2 Unreachable"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Tingkat Prioritas
              </label>
              <select
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="P0">P0 - Kritis (Total Outage / Backbone Down)</option>
                <option value="P1">P1 - High (Interface / Major Client Down)</option>
                <option value="P2">P2 - Medium (High Latency / Warning)</option>
                <option value="P3">P3 - Low (Minor / Information)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Device ID / Target (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: mikrotik-if-ether3, SW-CORE-01"
                value={newTicket.device_id}
                onChange={(e) => setNewTicket({ ...newTicket, device_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
              >
                Simpan Tiket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
