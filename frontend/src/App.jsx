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
  Server,
  TrendingUp,
  UserCheck,
  Eye,
  Type,
  Sun,
  Moon
} from 'lucide-react';
import Tickets from './Tickets';
import NocMap from './NocMap';
import Customers from './Customers';
import Invoices from './Invoices';
import FinanceReport from './FinanceReport';
import UserManagement from './UserManagement';
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

  // Authentication & Role State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState('admin');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('guardhub_role') || 'admin');
  const [userFullName, setUserFullName] = useState(() => localStorage.getItem('guardhub_fullname') || 'Administrator');

  // Age-Adaptive & Field Accessibility Mode (Ukuran Teks Ramah Mata)
  const [isLargeText, setIsLargeText] = useState(() => {
    return localStorage.getItem('guardhub_large_text') === 'true';
  });

  // Minimalist Theme Engine (Light & Dark Mode)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('guardhub_theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('guardhub_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(nextTheme === 'dark' ? 'Tampilan beralih ke Mode Gelap' : 'Tampilan beralih ke Mode Terang', 'info');
  };

  const { showToast, confirmModal } = useToast();

  const toggleLargeText = () => {
    const nextVal = !isLargeText;
    setIsLargeText(nextVal);
    localStorage.setItem('guardhub_large_text', String(nextVal));
    showToast(
      nextVal
        ? 'Mode Tampilan Ramah Mata & Lapangan aktif (Font diperbesar, tombol lebih lega)'
        : 'Mode Tampilan Normal aktif',
      'info'
    );
  };

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
          const u = res.data.username || 'admin';
          const r = res.data.role || 'admin';
          const fn = res.data.full_name || u;
          setCurrentUser(u);
          setUserRole(r);
          setUserFullName(fn);
          localStorage.setItem('guardhub_user', u);
          localStorage.setItem('guardhub_role', r);
          localStorage.setItem('guardhub_fullname', fn);
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
      message: `Apakah Anda yakin ingin mengakhiri sesi pengguna (${currentUser} - ${userRole.toUpperCase()})?`,
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
    localStorage.removeItem('guardhub_role');
    localStorage.removeItem('guardhub_fullname');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    showToast('Sesi Anda telah berhasil diakhiri.', 'info');
  };

  // DAFTAR TAB SESUAI ROLE PENGGUNA (ERGONOMIS & TANPA CLUTTER)
  let tabs = [];
  if (userRole === 'teknisi') {
    tabs = [
      {
        id: 'map',
        label: 'Peta Topologi & GPS Rumah',
        shortLabel: 'Peta Lapangan',
        Icon: MapPin,
        badge: openTicketCount > 0 ? 'ALERT' : null,
        badgeColor: 'bg-rose-600',
      },
      {
        id: 'customers',
        label: 'Laporan Pasang Baru (PSB)',
        shortLabel: 'Laporan PSB',
        Icon: Users,
      },
      {
        id: 'tickets',
        label: 'Tiket Insiden & Perbaikan',
        shortLabel: 'Tiket Gangguan',
        Icon: Ticket,
        badge: openTicketCount > 0 ? openTicketCount : null,
        badgeColor: 'bg-rose-500',
      },
    ];
  } else if (userRole === 'bendahara') {
    tabs = [
      {
        id: 'finance',
        label: 'Laporan Keuangan & Pajak PPN',
        shortLabel: 'Keuangan & Pajak',
        Icon: TrendingUp,
      },
      {
        id: 'invoices',
        label: 'Tagihan Pelanggan & Isolir',
        shortLabel: 'Tagihan & Isolir',
        Icon: Receipt,
      },
      {
        id: 'customers',
        label: 'Daftar Pelanggan (Billing)',
        shortLabel: 'Pelanggan',
        Icon: Users,
      },
    ];
  } else if (userRole === 'noc') {
    tabs = [
      {
        id: 'map',
        label: 'Peta Topologi GIS (Monitor)',
        shortLabel: 'Peta NOC',
        Icon: MapPin,
        badge: openTicketCount > 0 ? 'ALERT' : null,
        badgeColor: 'bg-rose-600',
      },
      {
        id: 'tickets',
        label: 'Tiket Gangguan (View Only)',
        shortLabel: 'Tiket NOC',
        Icon: Ticket,
        badge: openTicketCount > 0 ? openTicketCount : null,
        badgeColor: 'bg-rose-500',
      },
      {
        id: 'customers',
        label: 'Pelanggan PPPoE (View)',
        shortLabel: 'Pelanggan',
        Icon: Users,
      },
      {
        id: 'firewall',
        label: 'Firewall RouterOS (Logs)',
        shortLabel: 'Firewall',
        Icon: Shield,
      },
      {
        id: 'mikrotik',
        label: 'MikroTik Gateway (Monitor)',
        shortLabel: 'MikroTik',
        Icon: Radio,
      },
    ];
  } else {
    // Role 'admin': Semua menu ada
    tabs = [
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
        id: 'finance',
        label: 'Laporan Keuangan & Pajak',
        shortLabel: 'Keuangan',
        Icon: TrendingUp,
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
      {
        id: 'users',
        label: 'Kelola Pengguna',
        shortLabel: 'Pengguna',
        Icon: UserCheck,
      },
    ];
  }

  // Pastikan tab aktif valid untuk role yang sedang login
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [userRole]);

  const copyUrl = (url) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      showToast(`Tautan alamat disalin ke clipboard:\n${url}`, 'success', 'Tautan Tersalin');
      setTimeout(() => setCopiedUrl(null), 3000);
    }
  };

  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    localStorage.setItem('guardhub_role', newRole);
    const roleNames = {
      admin: 'Super Admin (Semua Menu)',
      noc: 'NOC (Monitoring Read-Only)',
      teknisi: 'Teknisi (Mapping & PSB)',
      bendahara: 'Bendahara (Keuangan & Tagihan)',
    };
    showToast(`Peran dialihkan ke: ${roleNames[newRole] || newRole}`, 'info');
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
        onLoginSuccess={(u, r, fn) => {
          setIsAuthenticated(true);
          setCurrentUser(u);
          setUserRole(r || 'admin');
          setUserFullName(fn || u);
          loadAll();
        }}
      />
    );
  }

  const ROLES = [
    { id: 'admin', label: 'Admin', desc: 'Semua Menu', icon: '👑' },
    { id: 'noc', label: 'NOC', desc: 'Monitor & Read-Only', icon: '🖥️' },
    { id: 'teknisi', label: 'Teknisi', desc: 'Peta & PSB', icon: '🛠️' },
    { id: 'bendahara', label: 'Bendahara', desc: 'Keuangan & Tagihan', icon: '💰' },
  ];

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black ${
      isLargeText ? 'text-base font-normal' : 'text-sm font-normal'
    }`}>
      {/* TOP HEADER */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex justify-between items-center gap-2 sm:gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-500 shrink-0">
              <ShieldCheck className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight text-white flex items-center shrink-0">
                <span>NetGuard</span>
                <span className="text-cyan-500 ml-0.5">Hub</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                PT Satelit Global Media &bull; Bangsalsari Jember
              </p>
            </div>
          </div>

          {/* Quick Controls: Theme Switcher, Large Text Toggle & Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Minimalist Switch Light / Dark Mode */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl font-semibold flex items-center gap-1.5 transition text-xs border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
              title={theme === 'dark' ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline text-xs">Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline text-xs">Gelap</span>
                </>
              )}
            </button>

            {/* Tombol Aksesibilitas: Teks Besar */}
            <button
              type="button"
              onClick={toggleLargeText}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl font-bold flex items-center gap-1.5 transition text-xs border ${
                isLargeText
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
              }`}
              title="Perbesar teks untuk kemudahan membaca"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">
                {isLargeText ? 'Teks Besar' : 'Teks'}
              </span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-200 transition text-xs flex items-center gap-1"
              title="Keluar dari sesi saat ini"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline text-xs">Keluar</span>
            </button>
          </div>
        </div>

        {/* ROLE PILIH DI DALAM (PROMINENT SEGMENTED CONTROL) */}
        <div className="border-t border-slate-800/80 bg-slate-950/70 px-3 sm:px-6 py-1.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                Pilih Role:
              </span>
              <div className="inline-flex bg-slate-900 p-0.5 rounded-xl border border-slate-800/90 gap-0.5 w-full sm:w-auto">
                {ROLES.map((r) => {
                  const active = userRole === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleRoleChange(r.id)}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        active
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                      title={`${r.label}: ${r.desc}`}
                    >
                      <span className="text-xs">{r.icon}</span>
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role Info badge */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Aktif: <strong className="text-cyan-300 font-bold uppercase">{userRole}</strong> ({ROLES.find(r => r.id === userRole)?.desc})</span>
            </div>
          </div>
        </div>

        {/* DESKTOP NAVIGATION TABS */}
        <div className="border-t border-slate-800/80 hidden md:block bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1">
            {tabs.map((t) => {
              const TabIcon = t.Icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                  {t.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white ${t.badgeColor || 'bg-rose-500'}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* QUICK STATUS BAR (MINIMALIST & CLEAN) */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-3 sm:px-6 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          {/* Status Router MikroTik & Role Mode */}
          <div className="flex items-center gap-2">
            {mtStatus?.connected ? (
              <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-lg text-emerald-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{mtStatus.identity || 'RouterOS'} Online</span>
                <span className="text-emerald-500/50">({mtStatus.latency_ms}ms)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-800/60 px-2 py-0.5 rounded-lg text-rose-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>MikroTik Terputus ({mtStatus?.host || '192.168.88.1'})</span>
              </div>
            )}

            {userRole === 'noc' && (
              <span className="text-cyan-400 font-mono text-[11px] hidden sm:inline">
                &bull; Mode Baca Saja (Read-Only)
              </span>
            )}
          </div>

          {/* Quick Metrics Sederhana */}
          {stats && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
              <span>{stats.active_customers} Pelanggan Aktif</span>
              {stats.unpaid_invoices > 0 && (
                <span className="text-amber-400">&bull; {stats.unpaid_invoices} Tagihan Pending</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MAIN VIEW CONTENT */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-6 flex-1">
        {tab === 'tickets' && <Tickets onSwitchTab={handleSwitchTab} mtStatus={mtStatus} isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'map' && <NocMap focusTarget={mapFocusTarget} onClearFocusTarget={() => setMapFocusTarget(null)} isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'customers' && <Customers onSwitchTab={handleSwitchTab} isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'invoices' && <Invoices isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'finance' && <FinanceReport isLargeText={isLargeText} />}
        {tab === 'firewall' && <FirewallLogs isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'mikrotik' && <Mikrotik onConnectedChange={loadAll} isLargeText={isLargeText} userRole={userRole} />}
        {tab === 'users' && <UserManagement isLargeText={isLargeText} />}
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
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition relative ${
                active ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <TabIcon className="w-5 h-5" />
                {t.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium truncate max-w-[65px]">{t.shortLabel}</span>
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
                  <strong className="text-emerald-300">LAN Firewall Active:</strong> Hanya perangkat dalam segmen Wi-Fi / LAN yang sama yang diizinkan mengakses.
                </p>
              </div>

              <div className="text-slate-300 font-semibold text-xs pt-1">
                Tautan akses browser jaringan lokal Anda:
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
        NetGuard Hub &bull; {serverInfo?.web_url || 'http://localhost:8080'} &bull; Role: {userRole.toUpperCase()} &bull; Sanggrahan Bangsalsari
      </footer>
    </div>
  );
}

export default App;
