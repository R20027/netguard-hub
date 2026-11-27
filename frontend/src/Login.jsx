import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, isGitHubPages } from './api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
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
        setErrorMsg(data?.error || `Salah password 3 kali! Sistem terkunci selama ${waitSec} detik.`);
        return;
      }

      // Jika pada GitHub Pages (tanpa server backend) atau koneksi backend terputus:
      // Verifikasi langsung kredensial admin (syaiful_admin / rois_admin) agar selalu sukses masuk
      const isOnlineStatic = isGitHubPages || !err.response || err.response?.status === 404 || err.code === 'ERR_NETWORK';
      if (isOnlineStatic && u === 'admin' && (p === 'syaiful_admin' || p === 'rois_admin')) {
        const token = 'gh_' + Date.now();
        localStorage.setItem('guardhub_token', token);
        localStorage.setItem('guardhub_user', 'admin');
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        onLoginSuccess('admin');
        return;
      }

      setErrorMsg(data?.error || 'Username atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-black">
      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl -top-20 -left-20 pointer-events-none"></div>
      <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/25 border border-cyan-400/30">
            🛡️
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5 pt-1">
            <span>NetGuard</span>
            <span className="text-cyan-400">Hub</span>
          </h1>
          <p className="text-slate-400 text-xs">
            MikroTik RouterOS Automated NOC &amp; ISP Billing
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Username Admin
            </label>
            <input
              required
              type="text"
              autoComplete="username"
              disabled={lockoutSeconds > 0 || loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Password
            </label>
            <input
              required
              type="password"
              autoComplete="current-password"
              disabled={lockoutSeconds > 0 || loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password admin"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-3 text-sm text-white placeholder-slate-600 outline-none transition disabled:opacity-50"
            />
          </div>

          {/* Pesan Kesalahan / Warning */}
          {errorMsg && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                lockoutSeconds > 0
                  ? 'bg-rose-950/80 border-rose-700 text-rose-200 animate-pulse'
                  : 'bg-amber-950/80 border-amber-800 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <span>{lockoutSeconds > 0 ? '🔒 KEAMANAN ANTI-BOT AKTIF' : '⚠️ GAGAL MASUK'}</span>
              </div>
              <p>{errorMsg}</p>
              {lockoutSeconds > 0 && (
                <div className="mt-2 text-center py-1.5 bg-black/40 rounded-lg font-mono font-bold text-rose-300 text-sm">
                  {lockoutSeconds > 60
                    ? `Tunggu ${Math.floor(lockoutSeconds / 60)} menit ${lockoutSeconds % 60} detik...`
                    : `Tunggu ${lockoutSeconds} detik...`}
                </div>
              )}
            </div>
          )}

          {/* Tombol Submit */}
          <button
            type="submit"
            disabled={lockoutSeconds > 0 || loading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide text-white transition-all shadow-lg ${
              lockoutSeconds > 0
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-cyan-600/25 active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Memverifikasi...</span>
              </span>
            ) : lockoutSeconds > 0 ? (
              lockoutSeconds > 60
                ? `Terkunci (${Math.floor(lockoutSeconds / 60)}m ${lockoutSeconds % 60}s)`
                : `Terkunci (${lockoutSeconds}s)`
            ) : (
              'Masuk ke GuardHub'
            )}
          </button>
        </form>
      </div>

      <footer className="mt-6 text-xs text-slate-600 text-center">
        NetGuard Hub &bull; Keamanan Server &bull; Port 8080
      </footer>
    </div>
  );
}
