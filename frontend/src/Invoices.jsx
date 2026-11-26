import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from './api';
import HelpTip from './HelpTip';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unpaid' | 'overdue' | 'paid'
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    customer_id: '',
    period: new Date().toISOString().slice(0, 7),
    amount: '150000',
    due_date: new Date().toISOString().slice(0, 10),
  });

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
      alert('✅ Tagihan berhasil dibuat!');
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  const pay = async (id, custName) => {
    if (
      !confirm(
        `Tandai tagihan #${id} (${custName}) LUNAS?\nJika semua tagihan pelanggan ini lunas, akun PPPoE di MikroTik otomatis di-ENABLE kembali dan IP dilepas dari isolir firewall!`
      )
    )
      return;
    try {
      const r = await axios.patch(`${API}/invoices/${id}/pay`);
      alert(r.data.message);
      load();
    } catch (err) {
      alert('Gagal bayar: ' + (err.response?.data?.error || err.message));
    }
  };

  const triggerAutoIsolir = async () => {
    if (
      !confirm(
        'Jalankan Auto-Isolir MikroTik sekarang?\nSistem akan menonaktifkan akun PPPoE di MikroTik, memutus sesi online-nya, dan memasukkan IP-nya ke firewall address-list ISOLIR untuk semua pelanggan yang tagihannya sudah lewat jatuh tempo.'
      )
    )
      return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/invoices/auto-isolir`);
      alert(`⚡ ${r.data.message}`);
      load();
    } catch (err) {
      alert('Gagal auto-isolir: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const syncToMikrotik = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/invoices/sync-mikrotik`);
      alert(`🔄 ${r.data.message}`);
      load();
    } catch (err) {
      alert('Gagal sync: ' + (err.response?.data?.error || err.message));
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
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              💰 Billing, Invoices &amp; Auto-Isolir MikroTik
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
              CRON ENGINE 5M
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Tagihan terintegrasi langsung dengan MikroTik: ketika pelanggan terlambat membayar (overdue), sistem otomatis mengisolir akun PPPoE dan memblokir internet. Pembayaran tagihan otomatis memulihkan internet kembali!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="inline-flex items-center">
            <button
              onClick={triggerAutoIsolir}
              disabled={loading}
              className="w-full sm:w-auto h-10 sm:h-auto px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-1.5"
            >
              <span>⚡</span>
              <span>Eksekusi Auto-Isolir</span>
            </button>
            <HelpTip
              title="Eksekusi Auto-Isolir Sekarang"
              text="Menjalankan audit isolir seketika: mematikan secret PPPoE di MikroTik, memutus koneksi online-nya, dan memasukkan IP-nya ke firewall address-list ISOLIR untuk semua pelanggan yang menunggak tagihan (overdue)."
              impact="Pelanggan yang menunggak akan langsung terputus dari internet."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={syncToMikrotik}
              disabled={loading}
              className="w-full sm:w-auto h-10 sm:h-auto px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <span>🔄</span>
              <span>Sync ke RouterOS</span>
            </button>
            <HelpTip
              title="Sinkronisasi Tagihan ke MikroTik"
              text="Memverifikasi status seluruh tagihan ke MikroTik. Pelanggan yang sudah lunas dibuka blokirnya, dan yang masih berhutang dipastikan terisolir."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto h-10 sm:h-auto px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-600/25 transition flex items-center justify-center"
            >
              + Buat Tagihan
            </button>
            <HelpTip
              title="Buat Tagihan Baru"
              text="Menerbitkan invoice bulanan baru untuk pelanggan. Nominal dan tanggal jatuh tempo dapat ditentukan."
            />
          </div>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Total Tagihan &amp; Revenue</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-white">{formatRupiah(totalPaidRevenue)}</span>
            <div className="text-[11px] text-slate-400 mt-0.5">
              dari {invoices.length} tagihan ({formatRupiah(totalAmount)})
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium">Lunas (Paid)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-400">{paidCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              Internet Normal
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-amber-400 text-xs font-medium">Belum Lunas (Unpaid)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-400">{unpaidCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
              Menunggu Bayar
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            Lewat Jatuh Tempo (Overdue)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-rose-400">{overdueCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
              Target Isolir
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'unpaid'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Belum Lunas ({unpaidCount})
            </button>
            <button
              onClick={() => setStatusFilter('overdue')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'overdue'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overdue ({overdueCount})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Lunas ({paidCount})
            </button>
          </div>
          <HelpTip
            title="Filter Status Tagihan"
            text="Belum Lunas: Menunggu bayar namun belum jatuh tempo. Overdue: Lewat tanggal jatuh tempo dan menjadi target Auto-Isolir MikroTik. Lunas: Sudah dibayar."
          />
        </div>

        <div className="w-full lg:w-72">
          <input
            type="text"
            placeholder="Cari pelanggan, user, periode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* INVOICES DISPLAY: DESKTOP TABLE & MOBILE CARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* DESKTOP TABLE (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Inv #</th>
                <th className="p-4">Pelanggan</th>
                <th className="p-4">Periode</th>
                <th className="p-4">Nominal</th>
                <th className="p-4">Jatuh Tempo</th>
                <th className="p-4">Status &amp; MikroTik</th>
                <th className="p-4">Aksi Pembayaran</th>
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
                    Tidak ada tagihan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const cust = getCust(inv.customer_id);
                  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                  const isOverdue = inv.status === 'overdue' || (inv.status === 'unpaid' && inv.due_date && inv.due_date < todayLocal);
                  const isIsolated = cust?.status === 'isolated';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-850/60 transition">
                      <td className="p-4 font-mono font-bold text-slate-400">
                        #{inv.id}
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-200">
                          {inv.customer_name || cust?.name || `ID ${inv.customer_id}`}
                        </div>
                        <div className="text-[11px] text-blue-400 font-mono">
                          {inv.pppoe_user || cust?.pppoe_user}
                        </div>
                      </td>

                      <td className="p-4 font-mono font-medium text-slate-300">
                        {inv.period}
                      </td>

                      <td className="p-4 font-bold text-emerald-400 font-mono">
                        {formatRupiah(inv.amount)}
                      </td>

                      <td className="p-4 font-mono text-slate-400">
                        {inv.due_date}
                      </td>

                      {/* STATUS & SINKRONISASI MIKROTIK */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {inv.status === 'paid' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              ✓ LUNAS
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                              ⚠️ OVERDUE
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              PENDING
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400 font-mono">
                            RouterOS:{' '}
                            <strong className={isIsolated ? 'text-rose-400' : 'text-emerald-400'}>
                              {isIsolated ? 'ISOLIR' : 'AKTIF'}
                            </strong>
                          </span>
                        </div>
                      </td>

                      {/* AKSI */}
                      <td className="p-4">
                        {inv.status === 'paid' ? (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Lunas: {inv.paid_at ? inv.paid_at.slice(0, 16) : '-'}
                          </div>
                        ) : (
                          <div className="inline-flex items-center">
                            <button
                              onClick={() => pay(inv.id, inv.customer_name || cust?.name)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5"
                            >
                              <span>✓</span>
                              <span>Bayar &amp; Buka Isolir</span>
                            </button>
                            <HelpTip
                              title="Bayar & Buka Isolir Otomatis"
                              text="Mencatat pembayaran tagihan menjadi LUNAS. Jika seluruh tagihan pelanggan sudah beres, sistem langsung mengaktifkan kembali secret PPPoE di MikroTik dan mencabut IP dari blacklist firewall."
                              tip="Internet pelanggan langsung pulih seketika."
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE INVOICE CARDS (md:hidden) - BEBAS NABRAK */}
        <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Memuat data tagihan...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Tidak ada tagihan yang sesuai.
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const cust = getCust(inv.customer_id);
              const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
              const isOverdue = inv.status === 'overdue' || (inv.status === 'unpaid' && inv.due_date && inv.due_date < todayLocal);
              const isIsolated = cust?.status === 'isolated';

              return (
                <div key={inv.id} className="pt-3 first:pt-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-400">#{inv.id}</span>
                        <div className="font-bold text-slate-100 text-sm">
                          {inv.customer_name || cust?.name || `ID ${inv.customer_id}`}
                        </div>
                      </div>
                      <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                        {inv.pppoe_user || cust?.pppoe_user} &bull; Periode: {inv.period}
                      </div>
                    </div>
                    <div>
                      {inv.status === 'paid' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
                          ✓ LUNAS
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap animate-pulse">
                          ⚠️ OVERDUE
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 whitespace-nowrap">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans">Nominal Tagihan</span>
                      <span className="text-emerald-400 font-bold text-sm">{formatRupiah(inv.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans">Jatuh Tempo</span>
                      <span className="text-slate-300 text-xs">{inv.due_date}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">Status MikroTik:</span>
                      <span className="font-bold font-mono">
                        RouterOS: <strong className={isIsolated ? 'text-rose-400' : 'text-emerald-400'}>{isIsolated ? 'ISOLIR' : 'AKTIF'}</strong>
                      </span>
                    </div>
                  </div>

                  <div>
                    {inv.status === 'paid' ? (
                      <div className="text-center py-2 text-[11px] text-slate-500 font-mono bg-slate-950/50 rounded-xl border border-slate-800/50">
                        Lunas pada: {inv.paid_at ? inv.paid_at.slice(0, 16) : '-'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => pay(inv.id, inv.customer_name || cust?.name)}
                          className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 active:from-emerald-700 active:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                        >
                          <span>✓</span>
                          <span>Bayar &amp; Buka Isolir RouterOS</span>
                        </button>
                        <HelpTip
                          title="Bayar & Buka Isolir"
                          text="Membayar tagihan ini menjadi Lunas. Akun di MikroTik langsung diaktifkan kembali dan firewall isolir dibuka."
                        />
                      </div>
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
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Buat Tagihan Pelanggan</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
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
              <label className="text-xs font-medium text-slate-300 block mb-1">
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
              <label className="text-xs font-medium text-slate-300 block mb-1">
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
              <label className="text-xs font-medium text-slate-300 block mb-1">
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

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs p-2.5 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs p-2.5 rounded-xl transition shadow"
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
