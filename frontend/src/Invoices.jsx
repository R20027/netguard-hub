import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Receipt,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  Plus,
  Search,
  X,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { API } from './api';
import HelpTip from './HelpTip';
import { useToast } from './NotificationContext';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    customer_id: '',
    period: new Date().toISOString().slice(0, 7),
    amount: '150000',
    due_date: new Date().toISOString().slice(0, 10),
  });

  const { showToast, confirmModal } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [inv, cus] = await Promise.all([
        axios.get(`${API}/invoices`),
        axios.get(`${API}/customers`),
      ]);
      setInvoices(inv.data.data || []);
      setCustomers(cus.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/invoices`, {
        ...form,
        customer_id: parseInt(form.customer_id, 10),
        amount: parseInt(form.amount, 10),
      });
      setShowModal(false);
      setForm({
        customer_id: '',
        period: new Date().toISOString().slice(0, 7),
        amount: '150000',
        due_date: new Date().toISOString().slice(0, 10),
      });
      load();
      showToast('Tagihan berhasil diterbitkan.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Membuat Tagihan');
    }
  };

  const pay = async (id, custName) => {
    const confirmed = await confirmModal({
      title: 'Konfirmasi Pembayaran Tagihan',
      message: `Tandai tagihan #${id} (${custName}) LUNAS?\nJika seluruh tagihan pelanggan ini lunas, akun PPPoE di MikroTik otomatis di-ENABLE dan IP dicabut dari isolir firewall.`,
      confirmText: 'Konfirmasi Lunas',
      cancelText: 'Batal',
      isDestructive: false,
    });
    if (!confirmed) return;

    try {
      const r = await axios.patch(`${API}/invoices/${id}/pay`);
      showToast(r.data.message || 'Pembayaran berhasil dikonfirmasi.', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Bayar');
    }
  };

  const triggerAutoIsolir = async () => {
    const confirmed = await confirmModal({
      title: 'Eksekusi Auto-Isolir Scheduler',
      message: 'Jalankan audit auto-isolir sekarang?\nSistem akan menonaktifkan akun PPPoE di MikroTik, memutus sesi aktif, dan memasukkan IP ke firewall address-list ISOLIR untuk semua pelanggan yang tagihannya melewati jatuh tempo.',
      confirmText: 'Jalankan Isolir',
      cancelText: 'Batal',
      isDestructive: true,
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const r = await axios.post(`${API}/invoices/auto-isolir`);
      showToast(r.data.message, 'info', 'Auto-Isolir Selesai');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Auto-Isolir');
    } finally {
      setLoading(false);
    }
  };

  const syncToMikrotik = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/invoices/sync-mikrotik`);
      showToast(r.data.message, 'success', 'Sinkronisasi Selesai');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error', 'Gagal Sync');
    } finally {
      setLoading(false);
    }
  };

  const getCust = (cid) => customers.find((c) => c.id === cid);

  // Stats calculation
  const totalAmount = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaidRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length;
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  const filteredInvoices = invoices.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const c = getCust(i.customer_id);
      return (
        i.period?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.pppoe_user?.toLowerCase().includes(q) ||
        c?.name?.toLowerCase().includes(q) ||
        String(i.id).includes(q)
      );
    }
    return true;
  });

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Billing &amp; MikroTik Auto-Isolir Scheduler
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                CRON ENGINE 5M
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
              Tagihan terintegrasi langsung dengan MikroTik: ketika pelanggan terlambat membayar (overdue), sistem otomatis mengisolir akun PPPoE dan memutus koneksi. Pembayaran tagihan otomatis memulihkan akses internet.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={triggerAutoIsolir}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Eksekusi Auto-Isolir</span>
          </button>

          <button
            onClick={syncToMikrotik}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync ke Router</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Tagihan</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Total Penerimaan (Lunas)</span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{formatRupiah(totalPaidRevenue)}</span>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              dari {invoices.length} inv ({formatRupiah(totalAmount)})
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lunas
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{paidCount}</span>
            <span className="text-[11px] font-mono text-emerald-400/80">
              Normal
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Belum Lunas
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{unpaidCount}</span>
            <span className="text-[11px] font-mono text-amber-400/80">
              Pending
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Lewat Jatuh Tempo
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-400">{overdueCount}</span>
            <span className="text-[11px] font-mono text-rose-400/80">
              Target Isolir
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'unpaid'
                  ? 'bg-slate-800 text-amber-300 border border-amber-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Belum Lunas ({unpaidCount})
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'overdue'
                  ? 'bg-slate-800 text-rose-300 border border-rose-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overdue ({overdueCount})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-md transition ${
                statusFilter === 'paid'
                  ? 'bg-slate-800 text-emerald-300 border border-emerald-800/60 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Lunas ({paidCount})
            </button>
          </div>
          <HelpTip
            title="Siklus Status Tagihan"
            text="Belum Lunas: Tagihan menunggu pelunasan. Overdue: Melewati jatuh tempo dan otomatis masuk daftar isolir. Lunas: Tagihan selesai dan akun router aktif normal."
          />
        </div>

        <div className="w-full lg:w-72 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Cari pelanggan, username, periode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>
      </div>

      {/* INVOICES DISPLAY: DESKTOP TABLE & MOBILE CARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Inv #</th>
                <th className="p-3.5">Pelanggan</th>
                <th className="p-3.5">Periode</th>
                <th className="p-3.5">Nominal</th>
                <th className="p-3.5">Jatuh Tempo</th>
                <th className="p-3.5">Status &amp; RouterOS</th>
                <th className="p-3.5">Aksi Pelunasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-400">
                    Memuat data tagihan...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12 text-slate-400">
                    Tidak ada tagihan yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const cust = getCust(inv.customer_id);
                  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                  const isOverdue = inv.status === 'overdue' || (inv.status === 'unpaid' && inv.due_date && inv.due_date < todayLocal);
                  const isIsolated = cust?.status === 'isolated';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-850/40 transition">
                      <td className="p-3.5 font-mono text-slate-400">
                        #{inv.id}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-200">
                          {inv.customer_name || cust?.name || `ID ${inv.customer_id}`}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono">
                          {inv.pppoe_user || cust?.pppoe_user}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">
                        {inv.period}
                      </td>

                      <td className="p-3.5 font-bold text-emerald-400 font-mono">
                        {formatRupiah(inv.amount)}
                      </td>

                      <td className="p-3.5 font-mono text-slate-400">
                        {inv.due_date}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          {inv.status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                              LUNAS
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                              PENDING
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400 font-mono">
                            Router:{' '}
                            <strong className={isIsolated ? 'text-rose-400' : 'text-emerald-400'}>
                              {isIsolated ? 'ISOLIR' : 'AKTIF'}
                            </strong>
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {inv.status === 'paid' ? (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Lunas: {inv.paid_at ? inv.paid_at.slice(0, 16) : '-'}
                          </div>
                        ) : (
                          <button
                            onClick={() => pay(inv.id, inv.customer_name || cust?.name)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Bayar &amp; Buka Isolir</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE INVOICE CARDS */}
        <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Memuat data tagihan...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Tidak ada tagihan ditemukan.
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const cust = getCust(inv.customer_id);
              const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
              const isOverdue = inv.status === 'overdue' || (inv.status === 'unpaid' && inv.due_date && inv.due_date < todayLocal);
              const isIsolated = cust?.status === 'isolated';

              return (
                <div key={inv.id} className="pt-3 first:pt-0 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{inv.id}</span>
                        <div className="font-bold text-slate-100 text-xs sm:text-sm">
                          {inv.customer_name || cust?.name || `ID ${inv.customer_id}`}
                        </div>
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                        {inv.pppoe_user || cust?.pppoe_user} &bull; {inv.period}
                      </div>
                    </div>
                    <div>
                      {inv.status === 'paid' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          LUNAS
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Nominal</span>
                      <span className="text-emerald-400 font-bold text-xs">{formatRupiah(inv.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Jatuh Tempo</span>
                      <span className="text-slate-300 text-xs">{inv.due_date}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-800 pt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">Status RouterOS:</span>
                      <strong className={isIsolated ? 'text-rose-400' : 'text-emerald-400'}>
                        {isIsolated ? 'ISOLIR' : 'AKTIF'}
                      </strong>
                    </div>
                  </div>

                  <div>
                    {inv.status === 'paid' ? (
                      <div className="text-center py-1.5 text-[11px] text-slate-500 font-mono bg-slate-950/50 rounded-lg border border-slate-800">
                        Lunas pada: {inv.paid_at ? inv.paid_at.slice(0, 16) : '-'}
                      </div>
                    ) : (
                      <button
                        onClick={() => pay(inv.id, inv.customer_name || cust?.name)}
                        className="w-full py-2 rounded-lg bg-emerald-600/90 active:bg-emerald-600 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Bayar &amp; Buka Isolir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL BUAT TAGIHAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={create}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white">Buat Tagihan Pelanggan Baru</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Pilih Pelanggan *
                </label>
                <select
                  required
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.pppoe_user}) - {c.package}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Periode Tagihan (YYYY-MM) *
                </label>
                <input
                  type="month"
                  required
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Nominal Tagihan (Rp) *
                </label>
                <input
                  type="number"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Tanggal Jatuh Tempo *
                </label>
                <input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
              >
                Simpan Tagihan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
