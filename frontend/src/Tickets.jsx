import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Radio,
  MapPin,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  X,
  RefreshCw,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { API } from './api';
import HelpTip from './HelpTip';
import { useToast } from './NotificationContext';

export default function Tickets({ onSwitchTab, mtStatus, isLargeText, userRole }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('open');
  const [prioFilter, setPrioFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [newTicket, setNewTicket] = useState({ title: '', priority: 'P1', device_id: '' });

  const { showToast, confirmModal } = useToast();

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
      showToast('Pindaian diagnostik MikroTik selesai dievaluasi.', 'info', 'Audit Selesai');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Diagnostik Gagal');
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
      showToast('Tiket insiden manual berhasil ditambahkan ke antrean.', 'success');
    } catch (err) {
      showToast(err.message, 'error', 'Gagal Membuat Tiket');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/tickets/${id}/status`, { status });
      fetchTickets();
      showToast(status === 'resolved' ? `Tiket #${id} telah diselesaikan.` : `Tiket #${id} dibuka kembali.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteTicket = async (id) => {
    const confirmed = await confirmModal({
      title: 'Hapus Tiket Insiden',
      message: `Apakah Anda yakin ingin menghapus permanen tiket #${id}? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus Tiket',
      cancelText: 'Batal',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/tickets/${id}`);
      fetchTickets();
      showToast(`Tiket #${id} berhasil dihapus dari database.`, 'info');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Menghapus');
    }
  };

  // Format Helper
  const prioBadge = (p) => {
    switch (p) {
      case 'P0':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'P1':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'P2':
        return 'bg-sky-950/80 text-sky-300 border-sky-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Sentinel Auto-Detector &amp; Incident Dispatch
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  REAL-TIME ACTIVE
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
                Pemantauan otomatis link port interface (WAN/LAN), CPU overload, dan log anomali RouterOS setiap 20 detik. Tiket tertutup otomatis begitu jalur kembali UP.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
            {onSwitchTab && (
              <button
                onClick={() => onSwitchTab('map')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Peta Insiden</span>
              </button>
            )}

            {userRole === 'admin' && (
              <button
                onClick={handleDiagnose}
                disabled={scanning}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm ${
                  scanning
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Audit Berjalan...' : 'Audit Router'}</span>
              </button>
            )}

            {userRole !== 'noc' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className={`px-3.5 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 ${
                  isLargeText ? 'h-11 text-sm' : 'py-2 text-xs'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{userRole === 'teknisi' ? 'Catat Gangguan Lapangan' : 'Tiket Manual'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between card-interactive">
          <span className="text-slate-400 text-xs font-medium">Tiket Terbuka</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalOpen}</span>
            <span className="text-[11px] font-mono text-slate-400">
              Antrean
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-4 flex flex-col justify-between card-interactive hover:border-rose-700">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            P0 Kritis
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-400">{p0Count}</span>
            <span className="text-[11px] font-mono text-rose-400/80">
              Core / WAN
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-4 flex flex-col justify-between card-interactive hover:border-amber-700">
          <span className="text-amber-400 text-xs font-medium">P1 High</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{p1Count}</span>
            <span className="text-[11px] font-mono text-amber-400/80">
              Port / CPU
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between card-interactive hover:border-emerald-700">
          <span className="text-emerald-400 text-xs font-medium">Selesai / Pulih</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{totalResolved}</span>
            <span className="text-[11px] font-mono text-emerald-400/80">
              Tuntas
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                statusFilter === 'open'
                  ? 'bg-slate-800 text-rose-300 border border-rose-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Open ({totalOpen})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                statusFilter === 'resolved'
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Resolved ({totalResolved})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
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
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="all">Semua Prioritas</option>
            <option value="P0">P0 - Kritis</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
          <HelpTip
            title="Klasifikasi Prioritas Insiden"
            text="P0 Kritis: Jalur utama WAN / Router putus. P1 High: Interface port mati atau CPU overload. P2/P3: Peringatan latensi atau pelaporan reguler."
          />
        </div>

        {/* Search */}
        <div className="w-full lg:w-72 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari ID tiket, interface, node..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
      </div>

      {/* TICKETS DISPLAY: DESKTOP TABLE & MOBILE CARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Prioritas</th>
                <th className="p-3.5">Masalah / Deskripsi</th>
                <th className="p-3.5">Sumber Perangkat</th>
                <th className="p-3.5">Waktu Terdeteksi</th>
                <th className="p-3.5">Status &amp; Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400">
                    Memuat antrean insiden...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-400" />
                      <p className="text-slate-200 font-semibold text-sm">
                        Tidak ada insiden aktif sesuai filter
                      </p>
                      <p className="text-slate-400 text-xs font-mono">
                        Seluruh interface dan layanan router beroperasi normal.
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
                      className="hover:bg-slate-850/40 transition duration-150"
                    >
                      <td className="p-3.5 font-mono text-slate-400">
                        #{t.id}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${prioBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      <td className="p-3.5 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          {isMikrotik && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-800/80 text-cyan-300 text-[10px] font-mono">
                              ROUTEROS
                            </span>
                          )}
                          <span>{t.title}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {t.device_id ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
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
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-semibold transition flex items-center gap-1"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Peta</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {formatDate(t.created_at)}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              t.status === 'open'
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {t.status.toUpperCase()}
                          </span>

                          {t.status === 'open' ? (
                            <button
                              onClick={() => updateStatus(t.id, 'resolved')}
                              className="px-2.5 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-[11px] transition flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesaikan</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => updateStatus(t.id, 'open')}
                              className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Buka Ulang</span>
                            </button>
                          )}

                          <button
                            onClick={() => deleteTicket(t.id)}
                            title="Hapus tiket permanen"
                            className="p-1 rounded-md bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE INCIDENT CARDS */}
        <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Memuat daftar insiden...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              <span>Tidak ada insiden aktif. Semua normal.</span>
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isMikrotik = t.device_id?.startsWith('mikrotik-') || t.title?.includes('[MikroTik');
              return (
                <div key={t.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">#{t.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${prioBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      {isMikrotik && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-800 text-cyan-300 text-[9px] font-mono">
                          ROUTEROS
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        t.status === 'open'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-white leading-snug">
                    {t.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>{t.device_id || 'System'}</span>
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
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px] font-semibold flex items-center gap-0.5"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          <span>Peta</span>
                        </button>
                      )}
                    </div>
                    <span>{formatDate(t.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {t.status === 'open' ? (
                      <button
                        onClick={() => updateStatus(t.id, 'resolved')}
                        className="flex-1 py-2 rounded-lg bg-emerald-600/90 active:bg-emerald-600 text-white font-medium text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selesaikan #{t.id}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(t.id, 'open')}
                        className="flex-1 py-1.5 rounded-lg bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Buka Ulang</span>
                      </button>
                    )}
                    <button
                      onClick={() => deleteTicket(t.id)}
                      className="p-2 rounded-lg bg-slate-800 active:bg-rose-950 text-slate-400 active:text-rose-300 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-cyan-800 text-cyan-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white">Hasil Pindaian Diagnostik RouterOS</h3>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-sans">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Status Koneksi</span>
                <strong className={scanResult.connected ? 'text-emerald-400' : 'text-rose-400'}>
                  {scanResult.connected ? 'Terhubung (Online)' : 'Terputus (Offline)'}
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Interface Fisik</span>
                <strong className="text-cyan-400 font-mono">
                  {scanResult.interfaces_count || 0} Ports
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Insiden Terdeteksi</span>
                <strong className="text-rose-400 font-mono">
                  {scanResult.created_tickets || 0} Masalah
                </strong>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Auto-Resolved</span>
                <strong className="text-emerald-400 font-mono">
                  {scanResult.resolved_tickets || 0} Pulih
                </strong>
              </div>
            </div>

            {/* List Masalah Terdeteksi */}
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                Log Pemeriksaan:
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
                {scanResult.issues && scanResult.issues.length > 0 ? (
                  scanResult.issues.map((iss, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                      <span>{iss}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-emerald-400 flex items-center gap-2 py-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Semua interface fisik aktif normal, CPU dalam batas aman, dan tidak ditemukan problem kritis.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowScanModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs px-4 py-2 rounded-xl transition"
              >
                Tutup
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
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white">Buat Tiket Insiden Manual</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Deskripsi Insiden / Keluhan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Port switch distribusi offline"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Klasifikasi Prioritas
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
                <label className="text-slate-300 font-medium block mb-1">
                  Target Device ID (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: mikrotik-if-ether2, SW-CORE-01"
                  value={newTicket.device_id}
                  onChange={(e) => setNewTicket({ ...newTicket, device_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
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
