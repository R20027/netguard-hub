import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Printer,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  Percent
} from 'lucide-react';
import { useToast } from './NotificationContext';

export default function FinanceReport({ isLargeText }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchFinanceReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/finance/report`);
      if (res.data) {
        setReport(res.data);
      }
    } catch {
      // Mock data untuk GitHub Pages / offline demo
      if (isGitHubPages) {
        setReport({
          current_period: new Date().toISOString().slice(0, 7),
          total_invoices: 48,
          paid_invoices: 42,
          unpaid_invoices: 4,
          overdue_invoices: 2,
          total_gross_revenue: 6850000,
          total_ppn_11: 753500,
          total_net_revenue: 6096500,
          current_month_gross: 2450000,
          current_month_ppn: 269500,
          current_month_net: 2180500,
          current_month_paid_count: 16,
          total_unpaid_amount: 600000,
          total_overdue_amount: 350000,
          package_stats: [
            { package: 'Home 10M', count: 24, revenue: 3600000 },
            { package: 'Biz 20M', count: 18, revenue: 4500000 },
            { package: 'Dedicated 50M', count: 6, revenue: 3000000 }
          ],
          recent_payments: [
            { invoice_id: 104, customer_name: 'Budi Santoso', pppoe_user: 'budi_pppoe', period: '2026-11', amount: 150000, paid_at: '2026-11-27 10:15:00' },
            { invoice_id: 103, customer_name: 'Siti Aminah', pppoe_user: 'siti_net', period: '2026-11', amount: 200000, paid_at: '2026-11-26 14:20:00' },
            { invoice_id: 102, customer_name: 'Ahmad Dahlan', pppoe_user: 'ahmad_d', period: '2026-11', amount: 150000, paid_at: '2026-11-25 09:45:00' }
          ]
        });
      } else {
        showToast('Gagal memuat laporan keuangan. Pastikan role Anda Bendahara atau Admin.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceReport();
  }, []);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${isLargeText ? 'text-base' : 'text-sm'}`}>
      {/* Top Banner & Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ROLE: BENDAHARA &amp; KEUANGAN
            </span>
            <span className="text-slate-400 text-xs font-mono">
              Periode: {report?.current_period || 'Bulan Ini'}
            </span>
          </div>
          <h2 className={`font-black tracking-tight text-white ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            Laporan Keuangan &amp; Pajak PPN 11%
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Rekapitulasi omset penagihan pelanggan, setoran pajak PPN 11%, serta monitoring tunggakan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchFinanceReport}
            disabled={loading}
            className={`flex-1 sm:flex-initial px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition ${
              isLargeText ? 'h-12 text-base' : 'h-10 text-xs'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className={`flex-1 sm:flex-initial px-5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-950/40 flex items-center justify-center gap-2 transition ${
              isLargeText ? 'h-12 text-base' : 'h-10 text-xs'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Utama: Omset, Pajak PPN, Netto, Tunggakan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset Bruto */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="font-semibold text-xs tracking-wider uppercase">Total Omset Terbayar</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-black text-emerald-400 tracking-tight ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            {formatRupiah(report?.total_gross_revenue)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{report?.paid_invoices || 0} tagihan sukses terbayar</span>
          </div>
        </div>

        {/* Pajak PPN 11% */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="font-semibold text-xs tracking-wider uppercase">Setoran Pajak (PPN 11%)</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-black text-cyan-400 tracking-tight ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            {formatRupiah(report?.total_ppn_11)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kewajiban pajak pertambahan nilai</span>
          </div>
        </div>

        {/* Pendapatan Bersih (Netto) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="font-semibold text-xs tracking-wider uppercase">Pendapatan Bersih (Netto)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/70 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-black text-blue-400 tracking-tight ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            {formatRupiah(report?.total_net_revenue)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Omset dikurangi PPN 11%</span>
          </div>
        </div>

        {/* Tunggakan Belum Bayar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="font-semibold text-xs tracking-wider uppercase">Tunggakan &amp; Belum Bayar</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/70 border border-rose-800/80 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`font-black text-rose-400 tracking-tight ${isLargeText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
            {formatRupiah((report?.total_unpaid_amount || 0) + (report?.total_overdue_amount || 0))}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>{report?.unpaid_invoices || 0} belum bayar, {report?.overdue_invoices || 0} overdue</span>
          </div>
        </div>
      </div>

      {/* Rincian Omset Bulan Ini & Distribusi Paket */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ringkasan Bulan Ini */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Realisasi Bulan Ini</h3>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {report?.current_period}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Omset Masuk Bulan Ini</span>
              <span className="font-bold text-emerald-400 font-mono">
                {formatRupiah(report?.current_month_gross)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">PPN 11% Bulan Ini</span>
              <span className="font-bold text-cyan-400 font-mono">
                {formatRupiah(report?.current_month_ppn)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Omset Bersih (Netto)</span>
              <span className="font-black text-blue-400 font-mono">
                {formatRupiah(report?.current_month_net)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-400">Transaksi Berhasil</span>
              <span className="font-bold text-slate-200">
                {report?.current_month_paid_count || 0} Pelanggan
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300/90 leading-relaxed">
            <span className="font-bold">Pedoman Bendahara:</span> Seluruh penagihan pelanggan otomatis terintegrasi dengan isolir RouterOS MikroTik jika telah jatuh tempo.
          </div>
        </div>

        {/* Distribusi Omset per Paket Internet */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Kontribusi per Paket</h3>
          </div>

          <div className="space-y-3">
            {report?.package_stats && report.package_stats.length > 0 ? (
              report.package_stats.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm">{p.package || 'Paket Standar'}</div>
                    <div className="text-xs text-slate-400">{p.count} Pelanggan Aktif</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400 font-mono text-sm">{formatRupiah(p.revenue)}</div>
                    <div className="text-[11px] text-slate-500">Terbayar</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada data paket langganan.
              </div>
            )}
          </div>
        </div>

        {/* Riwayat Pembayaran Terakhir */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Pembayaran Terakhir</h3>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {report?.recent_payments && report.recent_payments.length > 0 ? (
              report.recent_payments.map((rp, idx) => (
                <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{rp.customer_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{rp.pppoe_user} &bull; {rp.period}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400 font-mono">{formatRupiah(rp.amount)}</div>
                    <div className="text-[10px] text-emerald-500 font-semibold">LUNAS</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada transaksi pembayaran.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
