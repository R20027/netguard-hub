import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';
import { Shield, ShieldAlert, AlertCircle, Eye, EyeOff, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setLoading(true);
    setErrorMsg('');

    const u = username.trim();
    const p = password.trim();

    try {
      const res = await axios.post(`${API}/auth/login`, {
        username: u,
        password: p,
      });

      if (res.data?.token) {
        localStorage.setItem('guardhub_token', res.data.token);
        localStorage.setItem('guardhub_user', res.data.username || u);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        onLoginSuccess(res.data.username || u);
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

      // Jika pada GitHub Pages (tanpa server backend) atau koneksi backend terputus:
      // Verifikasi langsung kredensial eksklusif admin: rois_admin
      const isOnlineStatic = isGitHubPages || !err.response || err.response?.status === 404 || err.code === 'ERR_NETWORK';
      if (isOnlineStatic && u === 'admin' && p === 'rois_admin') {
        const token = 'gh_' + Date.now();
        localStorage.setItem('guardhub_token', token);
        localStorage.setItem('guardhub_user', 'admin');
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        onLoginSuccess('admin');
        return;
      }

      setErrorMsg(data?.error || 'Kombinasi pengguna dan kata sandi tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-black">
      {/* Background Subtle Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

      <div className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1">
            <span>NetGuard</span>
            <span className="text-cyan-400">Hub</span>
          </h1>
          <p className="text-slate-400 text-xs font-mono">
            ROUTEROS NOC &amp; SUBSCRIBER MANAGEMENT
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs">
              Akun Administrator
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                required
                type="text"
                autoComplete="username"
                disabled={lockoutSeconds > 0 || loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 text-xs">
              Kata Sandi
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={lockoutSeconds > 0 || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi admin"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
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
            className={`w-full py-2.5 rounded-xl font-semibold text-xs tracking-wide text-white transition flex items-center justify-center gap-2 ${
              lockoutSeconds > 0
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 shadow-md shadow-cyan-950/50'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memverifikasi Sesi...</span>
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
      </div>

      <footer className="mt-6 text-[11px] text-slate-500 font-mono text-center">
        NetGuard Hub &bull; Protected by WAF Shield &bull; Port 8080
      </footer>
    </div>
  );
}
