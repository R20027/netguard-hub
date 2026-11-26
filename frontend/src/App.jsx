import { useEffect, useState } from 'react';
import axios from 'axios';
import Tickets from './Tickets';
import NocMap from './NocMap';
import Customers from './Customers';
import Invoices from './Invoices';
import FirewallLogs from './FirewallLogs';
import Mikrotik from './Mikrotik';
import Login from './Login';
import { API } from './api';
import HelpTip from './HelpTip';

function App() {
  const [tab, setTab] = useState('tickets');
  const [stats, setStats] = useState(null);
  const [mtStatus, setMtStatus] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);

  // Authentication & Rate-Limiting Protection State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState('admin');

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
    if (!confirm('Keluar dari GuardHub?')) return;
    try {
      await axios.post(`${API}/auth/logout`);
    } catch {
      // ignore
    }
    localStorage.removeItem('guardhub_token');
    localStorage.removeItem('guardhub_user');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
  };

  const tabs = [
    {
      id: 'tickets',
      label: '🎫 Tiket NOC',
      shortLabel: 'Tiket',
      icon: '🎫',
      badge: openTicketCount > 0 ? openTicketCount : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'map',
      label: '🗺️ Peta Gangguan',
      shortLabel: 'Peta',
      icon: '🗺️',
      badge: openTicketCount > 0 ? 'ALERT' : null,
      badgeColor: 'bg-rose-600',
    },
    {
      id: 'customers',
      label: '👥 Pelanggan PPPoE',
      shortLabel: 'Pelanggan',
      icon: '👥',
      badge: mtStatus?.connected ? `${mtStatus.active_pppoe || 0} Online` : null,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'invoices',
      label: '💰 Tagihan & Isolir',
      shortLabel: 'Tagihan',
      icon: '💰',
    },
    {
      id: 'firewall',
      label: '🛡️ Firewall RouterOS',
      shortLabel: 'Firewall',
      icon: '🛡️',
    },
    {
      id: 'mikrotik',
      label: '📡 MikroTik Hub',
      shortLabel: 'MikroTik',
      icon: '📡',
    },
  ];

  const copyUrl = (url) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      alert(`✅ Alamat disalin: ${url}`);
    }
  };

  // Tampilan loading saat verifikasi autentikasi awal
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3 selection:bg-cyan-500 selection:text-black">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
        <div className="text-xs font-mono tracking-wider text-cyan-300">Memeriksa Keamanan GuardHub...</div>
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
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center gap-2 sm:gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-base sm:text-xl border border-cyan-400/30 flex-shrink-0">
              🛡️
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center shrink-0">
                  <span className="text-white drop-shadow-sm font-black">NetGuard</span>
                  <span className="text-cyan-400 ml-1 drop-shadow-sm font-black">Hub</span>
                </h1>
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 tracking-wider transition shrink-0"
                  title="Lihat alamat akses Web Server untuk semua perangkat LAN"
                >
                  <span className="hidden sm:inline">🌐 Akses Web LAN</span>
                  <span className="sm:hidden">🌐 LAN</span>
                </button>
                <HelpTip
                  title="Akses Web Multi-Perangkat (Tanpa APK)"
                  text="NetGuard Hub berjalan langsung sebagai Web Server lokal. Semua HP, tablet, & laptop di jaringan Wi-Fi/LAN yang sama cukup membuka browser dan mengetik alamat IP server atau domain guardhub.com (tanpa instal aplikasi tambahan)."
                  tip="Klik badge biru '🌐 Akses Web LAN' untuk melihat daftar link server Anda."
                />
              </div>
              <p className="text-slate-400 text-[11px] sm:text-xs hidden sm:block">
                MikroTik RouterOS Automated NOC &amp; ISP Billing Web Server
              </p>
            </div>
          </div>

          {/* Quick Mobile Router Pill & Logout */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            {mtStatus?.connected ? (
              <button
                onClick={() => setTab('mikrotik')}
                className="flex items-center gap-1 text-[10px] bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 rounded-lg text-emerald-300 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{mtStatus.identity || 'MikroTik'}</span>
              </button>
            ) : (
              <button
                onClick={() => setTab('mikrotik')}
                className="flex items-center gap-1 text-[10px] bg-rose-950/80 border border-rose-800/80 px-2 py-1 rounded-lg text-rose-300 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Offline</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar dari akun GuardHub"
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 font-medium transition"
            >
              🚪
            </button>
          </div>

          {/* DESKTOP TAB BUTTONS */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-150 flex items-center gap-1.5 ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-600/25 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white shadow-sm ${t.badgeColor} animate-pulse`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-[11px] font-mono text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 hidden lg:inline">
                👤 {currentUser}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Keluar / Logout"
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 transition font-medium flex items-center gap-1"
              >
                <span>🚪</span>
                <span>Keluar</span>
              </button>
            </div>
            <HelpTip
              title="Navigasi Halaman NetGuard Hub"
              text="🎫 Tiket NOC: Deteksi masalah real-time. 🗺️ Peta Gangguan: Visualisasi GPS & titik problem. 👥 Pelanggan: Kontrol PPPoE live. 💰 Tagihan: Billing & Auto-Isolir. 🛡️ Firewall: Address-list ISOLIR MikroTik. 📡 MikroTik Hub: Pengaturan & terminal router."
            />
          </nav>
        </div>
      </header>

      {/* PERSISTENT MIKROTIK NOC SYSTEM BAR */}
      <section className="bg-slate-900 border-b border-slate-800/80 px-3 sm:px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2 sm:gap-3">
          {/* Status Router MikroTik */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {mtStatus?.connected ? (
              <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-semibold">📡 MikroTik: {mtStatus.identity || 'RouterOS'}</span>
                <span className="text-emerald-500/70 hidden sm:inline">|</span>
                <span className="text-emerald-400/90 font-mono text-[11px]">CPU: {mtStatus.cpu_load || '0'}%</span>
                <span className="text-emerald-500/70 hidden sm:inline">|</span>
                <span className="text-emerald-300 font-mono text-[11px] hidden sm:inline">{mtStatus.latency_ms}ms</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-800/80 px-2.5 py-1 rounded-lg text-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="font-semibold">📡 MikroTik Offline ({mtStatus?.host || '192.168.88.1'})</span>
                <button
                  onClick={() => setTab('mikrotik')}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-bold transition"
                >
                  Setting
                </button>
                <HelpTip
                  title="Atur Koneksi MikroTik"
                  text="Membuka halaman Pengaturan Router untuk mengisi IP Address, port API (8728), dan login akun MikroTik Anda."
                />
              </div>
            )}

            {/* Auto Sentinel Status */}
            <div className="hidden md:flex items-center gap-1 text-slate-300 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Sentinel: <strong className="text-cyan-400">Monitor Link (20s)</strong></span>
              <HelpTip
                title="Sentinel Auto-Detector MikroTik"
                text="Engine background yang otomatis memeriksa status link port interface, beban CPU/Memori, dan log error RouterOS tiap 20 detik. Tiket insiden otomatis dibuka saat gangguan dan ditutup saat pulih."
              />
            </div>

            {/* Auto Isolir Status */}
            <div className="hidden lg:flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <span className="text-slate-600">|</span>
              <span>Auto-Isolir: <strong className="text-emerald-400">Aktif (5m)</strong></span>
              <HelpTip
                title="Penjadwal Auto-Isolir"
                text="Setiap 5 menit sistem memeriksa tagihan yang melewati tanggal jatuh tempo dan otomatis memblokir pelanggan di MikroTik."
              />
            </div>
          </div>

          {/* Quick Metrics */}
          {stats && (
            <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className="text-slate-300">
                Pelanggan: <strong className="text-emerald-400">{stats.active_customers} Aktif</strong> / <strong className="text-rose-400">{stats.isolated_customers} Isolir</strong>
              </span>
              <span className="text-slate-600">|</span>
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
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition relative ${
              tab === t.id ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-lg relative">
              {t.icon}
              {t.badge && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </span>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t.shortLabel}</span>
            {tab === t.id && <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5"></span>}
          </button>
        ))}
      </nav>

      {/* MODAL AKSES SERVER WEB LAN */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">🌐 Akses Web Server (1 Jaringan LAN)</h3>
                <p className="text-[11px] text-slate-400">Buka langsung dari browser HP/Laptop tanpa APK</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-emerald-950/40 border border-emerald-800/70 rounded-xl p-3 text-emerald-200 text-[11px]">
                🔒 <strong>Aman dari Internet Luar:</strong> Hanya perangkat di dalam jaringan Wi-Fi / LAN yang sama yang bisa mengakses. Akses dari internet publik otomatis diblokir (HTTP 403).
              </div>

              <div className="text-slate-300 font-semibold pt-1">Alamat Web yang Bisa Dibuka dari HP / Laptop lain:</div>
              <div className="space-y-2">
                {(serverInfo?.web_urls || [`http://${window.location.hostname}:8080`, 'http://guardhub.com:8080']).map((u) => (
                  <div key={u} className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-cyan-300">
                    <span className="truncate">{u}</span>
                    <button
                      onClick={() => copyUrl(u)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-700 text-white text-[10px] font-sans font-bold shrink-0"
                    >
                      Salin
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-xs text-slate-600 hidden md:block">
        NetGuard Hub Web Server &bull; {serverInfo?.web_url || 'http://localhost:8080'} &bull; guardhub.com (LAN Only)
      </footer>
    </div>
  );
}

export default App;
