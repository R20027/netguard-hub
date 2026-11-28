import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';
import { Shield, ShieldAlert, AlertCircle, Eye, EyeOff, Lock, User, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';

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

  // Countdown timer saat salah password 3x
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
        setErrorMsg(data?.error || `Akses dijeda selama ${waitSec} detik demi keamanan.`);
        return;
      }

      // Fallback offline / static demo
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

      setErrorMsg(data?.error || 'Username atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-black">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative z-10 space-y-5 animate-scale-in">
        {/* Header Logo & Simple Switch Theme */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-500 animate-pulse-glow">
              <Shield className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center">
                <span>NetGuard</span>
                <span className="text-cyan-500 ml-0.5">Hub</span>
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition text-xs flex items-center gap-1 btn-interactive hover:scale-105 active:scale-90"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform duration-300 hover:rotate-90" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-600 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-white tracking-tight">Masuk Akun</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Silakan masukkan kredensial Anda.
          </p>
        </div>

        {/* Form Login Sederhana */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-sans">
          <div>
            <label className="block text-slate-300 font-medium mb-1 text-xs">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-3.5 h-3.5" />
              </span>
              <input
                required
                type="text"
                autoComplete="username"
                disabled={lockoutSeconds > 0 || loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1 text-xs">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={lockoutSeconds > 0 || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 outline-none transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Pesan Kesalahan */}
          {errorMsg && (
            <div
              className={`p-2.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2 animate-fade-in-down ${
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
                <p>{errorMsg}</p>
                {lockoutSeconds > 0 && (
                  <div className="mt-1 font-mono text-rose-300 font-bold text-xs">
                    Tunggu {lockoutSeconds} detik...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tombol Masuk */}
          <button
            type="submit"
            disabled={lockoutSeconds > 0 || loading}
            className={`w-full py-2.5 rounded-xl font-bold text-xs tracking-wide text-white transition flex items-center justify-center gap-1.5 btn-interactive ${
              lockoutSeconds > 0
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 shadow-sm hover:scale-[1.01]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Memverifikasi...</span>
              </>
            ) : lockoutSeconds > 0 ? (
              <span>Sistem Ditangguhkan</span>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      <footer className="mt-4 text-[11px] text-slate-500 font-mono text-center">
        NetGuard Hub &bull; Bangsalsari Jember
      </footer>
    </div>
  );
}
