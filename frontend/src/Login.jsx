import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';
import { Shield, ShieldAlert, AlertCircle, Eye, EyeOff, Lock, User, ArrowRight, Loader2, Sparkles, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Theme state for login screen
  const [theme, setTheme] = useState(() => localStorage.getItem('guardhub_theme') || 'dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('guardhub_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Countdown timer saat sistem terkunci karena salah 3x
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const selectRoleShortcut = (u, p) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setLoading(true);
    setErrorMsg('');

    const u = username.trim().toLowerCase();
    const p = password.trim();

    try {
      const res = await axios.post(`${API}/auth/login`, {
        username: u,
        password: p,
      });

      if (res.data?.token) {
        const token = res.data.token;
        const uname = res.data.username || u;
        const role = res.data.role || 'admin';
        const fullName = res.data.full_name || uname;

        localStorage.setItem('guardhub_token', token);
        localStorage.setItem('guardhub_user', uname);
        localStorage.setItem('guardhub_role', role);
        localStorage.setItem('guardhub_fullname', fullName);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        onLoginSuccess(uname, role, fullName);
        return;
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 429 || data?.locked) {
        const waitSec = data?.retry_after || 60;
        setLockoutSeconds(waitSec);
        setErrorMsg(data?.error || `Percobaan login gagal berulang. Akses ditangguhkan selama ${waitSec} detik demi keamanan.`);
        return;
      }

      // Jika pada GitHub Pages (tanpa server backend) atau offline demo:
      const isOnlineStatic = isGitHubPages || !err.response || err.response?.status === 404 || err.code === 'ERR_NETWORK';
      if (isOnlineStatic) {
        let validRole = null;
        let fullName = '';
        if (u === 'admin' && p === 'rois_admin') {
          validRole = 'admin';
          fullName = 'Super Administrator (Rois)';
        } else if (u === 'noc' && p === 'noc_admin') {
          validRole = 'noc';
          fullName = 'NOC Specialist (Monitoring)';
        } else if (u === 'teknisi' && p === 'teknisi_admin') {
          validRole = 'teknisi';
          fullName = 'Teknisi Lapangan & PSB';
        } else if (u === 'bendahara' && p === 'bendahara_admin') {
          validRole = 'bendahara';
          fullName = 'Bendahara & Billing Specialist';
        }

        if (validRole) {
          const token = 'gh_' + Date.now();
          localStorage.setItem('guardhub_token', token);
          localStorage.setItem('guardhub_user', u);
          localStorage.setItem('guardhub_role', validRole);
          localStorage.setItem('guardhub_fullname', fullName);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          onLoginSuccess(u, validRole, fullName);
          return;
        }
      }

      setErrorMsg(data?.error || 'Kombinasi pengguna dan kata sandi tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-black">
      <div className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative z-10 space-y-6">
        {/* Top Header Controls: Theme Switcher */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-500">
              <Shield className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1">
                <span>NetGuard</span>
                <span className="text-cyan-500">Hub</span>
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition text-xs flex items-center gap-1.5"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold">Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[11px] font-semibold">Gelap</span>
              </>
            )}
          </button>
        </div>

        {/* Subtitle */}
        <div className="text-left space-y-1 border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-white tracking-tight">Masuk ke Sistem</h2>
          <p className="text-slate-400 text-xs">
            Portal manajemen MikroTik RouterOS &amp; kontrol peran (RBAC).
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs">
              Nama Pengguna (Username)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                required
                type="text"
                autoComplete="username"
                disabled={lockoutSeconds > 0 || loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / noc / teknisi / bendahara"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition disabled:opacity-50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs">
              Kata Sandi (Password)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={lockoutSeconds > 0 || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi akun"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition disabled:opacity-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Pesan Kesalahan / Warning */}
          {errorMsg && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                lockoutSeconds > 0
                  ? 'bg-rose-950/70 border-rose-800 text-rose-200'
                  : 'bg-amber-950/70 border-amber-800 text-amber-200'
              }`}
            >
              {lockoutSeconds > 0 ? (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold text-[11px] uppercase tracking-wider mb-0.5">
                  {lockoutSeconds > 0 ? 'Proteksi Keamanan Aktif' : 'Autentikasi Gagal'}
                </div>
                <p>{errorMsg}</p>
                {lockoutSeconds > 0 && (
                  <div className="mt-2 text-center py-1.5 bg-black/40 rounded-lg font-mono font-bold text-rose-300 text-xs">
                    {lockoutSeconds > 60
                      ? `Jeda keamanan: ${Math.floor(lockoutSeconds / 60)} menit ${lockoutSeconds % 60} detik`
                      : `Jeda keamanan: ${lockoutSeconds} detik`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tombol Submit */}
          <button
            type="submit"
            disabled={lockoutSeconds > 0 || loading}
            className={`w-full py-2.5 rounded-xl font-bold text-sm tracking-wide text-white transition flex items-center justify-center gap-2 ${
              lockoutSeconds > 0
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 shadow-sm'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memverifikasi Akses...</span>
              </>
            ) : lockoutSeconds > 0 ? (
              <span>Sistem Ditangguhkan</span>
            ) : (
              <>
                <span>Masuk Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Petunjuk Cepat 4 Role (Minimalist & Ergonomis) */}
        <div className="border-t border-slate-800 pt-3.5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span className="font-medium text-slate-400">Pilih Akun Cepat (Demo):</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => selectRoleShortcut('admin', 'rois_admin')}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
            >
              <div className="font-bold text-rose-400">Admin</div>
              <div className="text-[10px] text-slate-400">Semua menu</div>
            </button>

            <button
              type="button"
              onClick={() => selectRoleShortcut('noc', 'noc_admin')}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
            >
              <div className="font-bold text-cyan-400">NOC</div>
              <div className="text-[10px] text-slate-400">Read-Only Monitor</div>
            </button>

            <button
              type="button"
              onClick={() => selectRoleShortcut('teknisi', 'teknisi_admin')}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
            >
              <div className="font-bold text-emerald-400">Teknisi</div>
              <div className="text-[10px] text-slate-400">Mapping &amp; PSB</div>
            </button>

            <button
              type="button"
              onClick={() => selectRoleShortcut('bendahara', 'bendahara_admin')}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition"
            >
              <div className="font-bold text-amber-400">Bendahara</div>
              <div className="text-[10px] text-slate-400">Keuangan &amp; PPN</div>
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-5 text-[11px] text-slate-500 font-mono text-center">
        NetGuard Hub &bull; Protected by WAF Shield &bull; Port 8080
      </footer>
    </div>
  );
}
