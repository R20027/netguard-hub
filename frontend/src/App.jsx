import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Ticket,
  MapPin,
  Users,
  Receipt,
  Shield,
  Radio,
  LogOut,
  Globe,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  Cpu,
  Clock,
  ExternalLink,
  X,
  Server
} from 'lucide-react';
import Tickets from './Tickets';
import NocMap from './NocMap';
import Customers from './Customers';
import Invoices from './Invoices';
import FirewallLogs from './FirewallLogs';
import Mikrotik from './Mikrotik';
import Login from './Login';
import { API } from './api';
import HelpTip from './HelpTip';
import { useToast } from './NotificationContext';

function App() {
  const [tab, setTab] = useState('tickets');
  const [stats, setStats] = useState(null);
  const [mtStatus, setMtStatus] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState('admin');

  const { showToast, confirmModal } = useToast();

  const handleSwitchTab = (newTab, target = null) => {
    if (target) {
      setMapFocusTarget(target);
    }
    setTab(newTab);
  };

  const loadAll = async () => {
    try {
      const [resStats, resMt, resTickets, resSrv] = await Promise.all([
        axios.get(`${API}/stats`).catch(() => null),
        axios.get(`${API}/mikrotik/status`).catch(() => null),
        axios.get(`${API}/tickets?status=open`).catch(() => null),
        axios.get(`${API}/server-info`).catch(() => null),
      ]);
      if (resStats?.data) setStats(resStats.data);
      if (resMt?.data) setMtStatus(resMt.data);
      if (resTickets?.data?.data) setOpenTicketCount(resTickets.data.data.length);
      if (resSrv?.data) setServerInfo(resSrv.data);
    } catch {
      // ignore
    }
  };

  // Verifikasi token login saat aplikasi pertama kali dimuat
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('guardhub_token');
      if (!token) {
        setAuthChecking(false);
        setIsAuthenticated(false);
        return;
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const res = await axios.get(`${API}/auth/check`);
        if (res.data?.authenticated) {
          setIsAuthenticated(true);
          setCurrentUser(res.data.username || 'admin');
          loadAll();
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAll();
    const interval = setInterval(loadAll, 6000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    const confirmed = await confirmModal({
      title: 'Konfirmasi Keluar',
      message: 'Apakah Anda yakin ingin mengakhiri sesi administrator GuardHub?',
      confirmText: 'Keluar',
      cancelText: 'Batal',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await axios.post(`${API}/auth/logout`);
    } catch {
      // ignore
    }
    localStorage.removeItem('guardhub_token');
    localStorage.removeItem('guardhub_user');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    showToast('Sesi administrator telah berakhir.', 'info');
  };

  const tabs = [
    {
      id: 'tickets',
      label: 'Tiket Insiden',
      shortLabel: 'Tiket',
      Icon: Ticket,
      badge: openTicketCount > 0 ? openTicketCount : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'map',
      label: 'Peta Topologi GIS',
      shortLabel: 'Peta',
      Icon: MapPin,
      badge: openTicketCount > 0 ? 'ALERT' : null,
      badgeColor: 'bg-rose-600',
    },
    {
      id: 'customers',
      label: 'Pelanggan PPPoE',
      shortLabel: 'Pelanggan',
      Icon: Users,
      badge: mtStatus?.connected ? `${mtStatus.active_pppoe || 0} Online` : null,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'invoices',
      label: 'Tagihan & Isolir',
      shortLabel: 'Tagihan',
      Icon: Receipt,
    },
    {
      id: 'firewall',
      label: 'Firewall RouterOS',
      shortLabel: 'Firewall',
      Icon: Shield,
    },
    {
      id: 'mikrotik',
      label: 'MikroTik Gateway',
      shortLabel: 'MikroTik',
      Icon: Radio,
    },
  ];

  const copyUrl = (url) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      showToast(`Tautan alamat disalin ke clipboard:\n${url}`, 'success', 'Tautan Tersalin');
      setTimeout(() => setCopiedUrl(null), 3000);
    }
  };

  // Tampilan loading saat verifikasi autentikasi awal
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3 selection:bg-cyan-500 selection:text-black">
        <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
        <div className="text-xs font-mono tracking-wider text-slate-400">MEMVERIFIKASI KEAMANAN NETGUARD...</div>
      </div>
    );
  }

  // Tampilkan Halaman Login jika belum terotentikasi
  if (!isAuthenticated) {
    return (
      <Login
        onLoginSuccess={(u) => {
          setIsAuthenticated(true);
          setCurrentUser(u);
          loadAll();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* TOP HEADER */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex justify-between items-center gap-2 sm:gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center shrink-0">
                  <span className="font-extrabold tracking-tight">NetGuard</span>
                  <span className="text-cyan-400 ml-0.5 font-extrabold">Hub</span>
                </h1>
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-semibold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 tracking-wide transition shrink-0 flex items-center gap-1"
                  title="Lihat alamat akses Web Server untuk semua perangkat LAN"
                >
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">Akses Web LAN</span>
                  <span className="sm:hidden">LAN</span>
                </button>
                <HelpTip
                  title="Akses Web Multi-Perangkat (Tanpa APK)"
                  text="NetGuard Hub berjalan langsung sebagai Web Server lokal. Semua HP, tablet, & laptop di jaringan Wi-Fi/LAN yang sama cukup membuka browser dan mengetik alamat IP server atau domain guardhub.com (tanpa instal aplikasi tambahan)."
                  tip="Gunakan tombol 'Akses Web LAN' untuk melihat tautan akses cepat jaringan lokal Anda."
                />
              </div>
              <p className="text-slate-400 text-[10px] sm:text-xs hidden sm:block font-mono tracking-tight">
                ROUTEROS NOC &bull; ISP BILLING WEB SERVER
              </p>
            </div>
          </div>

          {/* Quick Mobile Router Status Pill & Logout */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            {mtStatus?.connected ? (
              <button
                onClick={() => setTab('mikrotik')}
                className="flex items-center gap-1.5 text-[10px] bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-lg text-emerald-300 font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="truncate max-w-[80px]">{mtStatus.identity || 'RouterOS'}</span>
              </button>
            ) : (
              <button
                onClick={() => setTab('mikrotik')}
                className="flex items-center gap-1 text-[10px] bg-rose-950/80 border border-rose-800/80 px-2 py-1 rounded-lg text-rose-300 font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Offline</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar dari sesi administrator"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* DESKTOP TAB NAVIGATION */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            {tabs.map((t) => {
              const TabIcon = t.Icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs transition duration-150 flex items-center gap-1.5 font-medium ${
                    active
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                  {t.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white shadow-sm ${t.badgeColor}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-[11px] font-mono text-slate-300 px-2 py-1 rounded bg-slate-900 border border-slate-800 hidden lg:inline">
                {currentUser}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar dari sesi"
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-800 transition font-medium flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Keluar</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* PERSISTENT MIKROTIK NOC SYSTEM BAR */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-3 sm:px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2 sm:gap-3">
          {/* Status Router MikroTik */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {mtStatus?.connected ? (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg text-emerald-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold">{mtStatus.identity || 'RouterOS'}</span>
                <span className="text-emerald-500/50">|</span>
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  {mtStatus.cpu_load || '0'}%
                </span>
                <span className="text-emerald-500/50 hidden sm:inline">|</span>
                <span className="hidden sm:flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {mtStatus.latency_ms}ms
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-800/60 px-2.5 py-1 rounded-lg text-rose-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>MikroTik Disconnected ({mtStatus?.host || '192.168.88.1'})</span>
                <button
                  onClick={() => setTab('mikrotik')}
                  className="bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-semibold transition"
                >
                  Konfigurasi
                </button>
              </div>
            )}

            {/* Auto Sentinel Status */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sentinel: <strong className="text-slate-200">Active (20s)</strong></span>
              <HelpTip
                title="Sentinel Auto-Detector RouterOS"
                text="Engine background yang otomatis memantau status link interface, beban CPU/memori, dan error log RouterOS setiap 20 detik secara otomatis."
              />
            </div>

            {/* Auto Isolir Status */}
            <div className="hidden lg:flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
              <span className="text-slate-700">|</span>
              <Receipt className="w-3 h-3 text-emerald-400" />
              <span>Auto-Isolir: <strong className="text-slate-200">Scheduler 5m</strong></span>
              <HelpTip
                title="Scheduler Auto-Isolir"
                text="Setiap 5 menit sistem memeriksa tagihan yang jatuh tempo dan otomatis mengisolir pelanggan yang menunggak di MikroTik."
              />
            </div>
          </div>

          {/* Quick Metrics */}
          {stats && (
            <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className="text-slate-300">
                Pelanggan: <strong className="text-emerald-400">{stats.active_customers} Aktif</strong> / <strong className="text-rose-400">{stats.isolated_customers} Isolir</strong>
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-300">
                Tagihan: <strong className="text-amber-400">{stats.unpaid_invoices} Pending</strong>
                {stats.overdue_invoices > 0 && (
                  <span className="ml-1 text-rose-400 font-bold">({stats.overdue_invoices} Overdue)</span>
                )}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* MAIN VIEW CONTENT */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-6 flex-1">
        {tab === 'tickets' && <Tickets onSwitchTab={handleSwitchTab} mtStatus={mtStatus} />}
        {tab === 'map' && <NocMap focusTarget={mapFocusTarget} onClearFocusTarget={() => setMapFocusTarget(null)} />}
        {tab === 'customers' && <Customers onSwitchTab={handleSwitchTab} />}
        {tab === 'invoices' && <Invoices />}
        {tab === 'firewall' && <FirewallLogs />}
        {tab === 'mikrotik' && <Mikrotik onConnectedChange={loadAll} />}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-2xl flex items-center justify-around px-1 py-1.5">
        {tabs.map((t) => {
          const TabIcon = t.Icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition relative ${
                active ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <TabIcon className="w-5 h-5" />
                {t.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t.shortLabel}</span>
              {active && <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5"></span>}
            </button>
          );
        })}
      </nav>

      {/* MODAL AKSES SERVER WEB LAN */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Akses Web Server Jaringan Lokal</h3>
                  <p className="text-[11px] text-slate-400 font-mono">STANDALONE WEB SERVER (TANPA APK)</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 text-emerald-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-slate-300">
                  <strong className="text-emerald-300">LAN Firewall Active:</strong> Hanya perangkat dalam segmen Wi-Fi / LAN yang sama yang diizinkan mengakses. Akses dari IP publik otomatis diblokir WAF.
                </p>
              </div>

              <div className="text-slate-300 font-semibold text-xs pt-1">
                Tautan yang dapat dibuka melalui browser perangkat lain:
              </div>
              <div className="space-y-2">
                {(serverInfo?.web_urls || [`http://${window.location.hostname}:8080`, 'http://guardhub.com:8080']).map((u) => (
                  <div key={u} className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-cyan-300 text-xs">
                    <span className="truncate">{u}</span>
                    <button
                      onClick={() => copyUrl(u)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-sans font-semibold shrink-0 flex items-center gap-1 transition"
                    >
                      {copiedUrl === u ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl === u ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-[11px] text-slate-600 hidden md:block font-mono">
        NetGuard Hub &bull; {serverInfo?.web_url || 'http://localhost:8080'} &bull; guardhub.com (LAN Only)
      </footer>
    </div>
  );
}

export default App;
