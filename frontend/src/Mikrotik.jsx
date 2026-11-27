import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from './api';
import HelpTip from './HelpTip';

export default function Mikrotik({ onConnectedChange }) {
  const [subTab, setSubTab] = useState('secrets'); // 'secrets' | 'active' | 'interfaces' | 'terminal' | 'config'
  const [config, setConfig] = useState({ host: '', port: '8728', user: 'admin', pass: '', tls: 'false' });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routerErr, setRouterErr] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [command, setCommand] = useState('/system/resource/print');
  const [cmdOutput, setCmdOutput] = useState(null);

  const [showAddSecret, setShowAddSecret] = useState(false);
  const [newSecret, setNewSecret] = useState({
    name: '', password: '', profile: 'default', remote_address: '', comment: '',
  });

  // Auto-Deteksi Gateway Router & Cloud Backup State
  const [detectedGateway, setDetectedGateway] = useState(null);
  const [detectingGw, setDetectingGw] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const detectRouterGateway = async () => {
    setDetectingGw(true);
    try {
      const res = await axios.get(`${API}/mikrotik/detect-gateway`);
      if (res.data) {
        setDetectedGateway(res.data);
        if (res.data.detected_gateway && (!config.host || config.host === '192.168.88.1')) {
          setConfig((prev) => ({ ...prev, host: res.data.detected_gateway }));
        }
      }
    } catch (err) {
      console.error('Gagal deteksi gateway:', err);
    } finally {
      setDetectingGw(false);
    }
  };

  const handleExportBackup = () => {
    window.open(`${API}/backup/export`, '_blank');
  };

  const handleDownloadDB = () => {
    window.open(`${API}/backup/download-db`, '_blank');
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`Pulihkan seluruh database dari file cadangan "${file.name}"? Data lama akan disinkronkan.`)) return;
    setBackupLoading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await axios.post(`${API}/backup/import`, json);
      alert(res.data?.message || 'Data berhasil dipulihkan!');
      loadConfig();
    } catch (err) {
      alert('Gagal memulihkan cadangan: ' + (err.response?.data?.error || err.message));
    } finally {
      setBackupLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${API}/mikrotik/config`);
      if (res.data) setConfig(res.data);
    } catch (err) {
      console.error('Gagal load config:', err);
    }
  };

  const testConnection = async (targetConfig) => {
    setLoading(true);
    try {
      const payload = targetConfig || config;
      const res = await axios.post(`${API}/mikrotik/test`, payload);
      setTestResult(res.data);
      setRouterErr(res.data?.connected ? '' : (res.data?.error || 'Router tidak merespon'));
      if (res.data?.connected && onConnectedChange) {
        onConnectedChange();
      }
    } catch (err) {
      setTestResult({ connected: false, error: err.message });
      setRouterErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/mikrotik/config`, config);
      alert('✅ Konfigurasi MikroTik berhasil disimpan!');
      testConnection(config);
      if (onConnectedChange) {
        onConnectedChange();
      }
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mikrotik/secrets`);
      setSecrets(res.data.data || []);
      setRouterErr(res.data.error || '');
    } catch (err) {
      setRouterErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mikrotik/active`);
      setActiveUsers(res.data.data || []);
      setRouterErr(res.data.error || '');
    } catch (err) {
      setRouterErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInterfaces = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mikrotik/interfaces`);
      setInterfaces(res.data.data || []);
      setRouterErr(res.data.error || '');
    } catch (err) {
      setRouterErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const res = await axios.get(`${API}/mikrotik/profiles`);
      setProfiles(res.data.data || []);
    } catch {
      // ignore if offline
    }
  };

  const handleCreateSecret = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/mikrotik/secrets`, newSecret);
      alert(`✅ Akun PPPoE ${newSecret.name} berhasil dibuat di MikroTik!`);
      setShowAddSecret(false);
      setNewSecret({ name: '', password: '', profile: 'default', remote_address: '', comment: '' });
      loadSecrets();
    } catch (err) {
      alert('Gagal buat secret: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const deleteSecret = async (name) => {
    if (!confirm(`⚠️ HAPUS PERMANEN akun ${name} dari router MikroTik?`)) return;
    try {
      await axios.delete(`${API}/mikrotik/secrets/${encodeURIComponent(name)}`);
      alert(`Akun ${name} telah dihapus dari MikroTik.`);
      loadSecrets();
    } catch (err) {
      alert('Gagal hapus: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleSecret = async (name, currentDisabled) => {
    const actionText = currentDisabled ? 'Buka isolir' : 'Isolir';
    if (!confirm(`${actionText} akun ${name} di MikroTik?`)) return;
    try {
      await axios.post(`${API}/mikrotik/toggle-secret`, { name, disabled: !currentDisabled });
      alert(`Akun ${name} berhasil di-${actionText}!`);
      loadSecrets();
      if (!currentDisabled) loadActiveUsers();
    } catch (err) {
      alert('Gagal update: ' + (err.response?.data?.error || err.message));
    }
  };

  const kickUser = async (name) => {
    if (!confirm(`Putus paksa (kick) sesi koneksi ${name}? Pelanggan akan otomatis reconnect.`)) return;
    try {
      await axios.post(`${API}/mikrotik/kick`, { name });
      alert(`Sesi ${name} berhasil diputus!`);
      loadActiveUsers();
    } catch (err) {
      alert('Gagal disconnect: ' + (err.response?.data?.error || err.message));
    }
  };

  const importCustomers = async () => {
    if (!confirm('Impor semua akun PPPoE dari MikroTik ke database Pelanggan NetGuard Hub? Akun yang sudah ada otomatis dilewati.')) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/mikrotik/import-customers`);
      alert(res.data.message);
    } catch (err) {
      alert('Gagal mengimpor: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const exportCustomers = async () => {
    if (!confirm('Sinkronkan seluruh data pelanggan di NetGuard Hub ke MikroTik sekarang?')) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/mikrotik/export-customers`);
      alert(res.data.message);
      loadSecrets();
    } catch (err) {
      alert('Gagal ekspor: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const setupDomainOnMikrotik = async () => {
    if (!confirm('Daftarkan domain guardhub.com ke MikroTik DNS RouterOS?\nSemua HP & laptop di jaringan WiFi/LAN router otomatis bisa mengakses http://guardhub.com:8080 tanpa setting hosts manual.')) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/mikrotik/setup-domain`);
      if (res.data.success === false) {
        alert('Gagal: ' + res.data.error);
      } else {
        alert(`✅ ${res.data.message}\nDomain: ${res.data.domain} -> IP: ${res.data.ip}`);
      }
    } catch (err) {
      alert('Gagal setup domain di MikroTik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const runCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    setLoading(true);
    setCmdOutput(null);
    try {
      const res = await axios.post(`${API}/mikrotik/exec`, { command });
      setCmdOutput(res.data);
    } catch (err) {
      setCmdOutput({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    testConnection();
    detectRouterGateway();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (subTab === 'secrets') {
      loadSecrets();
      loadProfiles();
    }
    if (subTab === 'active') loadActiveUsers();
    if (subTab === 'interfaces') loadInterfaces();
  }, [subTab]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span>📡 Universal MikroTik Connector</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Konektor dinamis akses penuh (Read &amp; Write) ke router MikroTik RouterOS API. Klik <strong className="text-cyan-400">(!)</strong> untuk penjelasan tiap fitur.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => testConnection()}
            disabled={loading}
            className="flex-1 md:flex-none justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 text-white"
          >
            <span>⚡ Uji / Refresh Koneksi</span>
          </button>
          <HelpTip
            title="Uji Koneksi RouterOS"
            text="Menguji apakah server NetGuard Hub dapat login dan berkomunikasi dengan router MikroTik via API (port 8728 / SSL 8729), sekaligus membaca CPU load, uptime, dan identitas router."
          />
        </div>
      </div>

      {/* STATUS BANNER */}
      <div className={`p-4 rounded-2xl border transition ${
        testResult?.connected
          ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
          : 'bg-rose-950/40 border-rose-800/70 text-rose-200'
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
              testResult?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                {testResult?.connected
                  ? `🟢 Terhubung: ${testResult.identity} (${testResult.board || 'MikroTik Router'})`
                  : '🔴 Belum Terhubung ke MikroTik'}
              </h3>
              <p className="text-xs opacity-80">
                {testResult?.connected
                  ? `Target: ${config.host}:${config.port} | RouterOS ${testResult.version || '-'} | Uptime: ${testResult.uptime || '-'}`
                  : (testResult?.error || routerErr || 'Pastikan IP, port, dan kredensial MikroTik sudah benar di tab Pengaturan.')}
              </p>
            </div>
          </div>

          {testResult?.connected && (
            <div className="flex gap-4 text-xs font-mono bg-slate-950/60 px-3 py-2 rounded-xl border border-emerald-700/40">
              <div>
                <span className="text-slate-400 block">CPU Load:</span>
                <span className="font-bold text-white">{testResult.cpu_load}%</span>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <span className="text-slate-400 block">Free Memory:</span>
                <span className="font-bold text-white">{testResult.free_memory}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => setSubTab('secrets')}
            className={`px-3.5 py-2 font-semibold text-xs sm:text-sm rounded-t-xl transition border-b-2 ${
              subTab === 'secrets' ? 'border-cyan-500 text-cyan-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            📋 PPPoE Secrets ({secrets.length})
          </button>
          <button
            onClick={() => setSubTab('active')}
            className={`px-3.5 py-2 font-semibold text-xs sm:text-sm rounded-t-xl transition border-b-2 ${
              subTab === 'active' ? 'border-cyan-500 text-cyan-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            🟢 PPPoE Online ({activeUsers.length})
          </button>
          <button
            onClick={() => setSubTab('interfaces')}
            className={`px-3.5 py-2 font-semibold text-xs sm:text-sm rounded-t-xl transition border-b-2 ${
              subTab === 'interfaces' ? 'border-cyan-500 text-cyan-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            🌐 Interfaces ({interfaces.length})
          </button>
          <button
            onClick={() => setSubTab('terminal')}
            className={`px-3.5 py-2 font-semibold text-xs sm:text-sm rounded-t-xl transition border-b-2 ${
              subTab === 'terminal' ? 'border-cyan-500 text-cyan-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            💻 Terminal
          </button>
          <button
            onClick={() => setSubTab('config')}
            className={`px-3.5 py-2 font-semibold text-xs sm:text-sm rounded-t-xl transition border-b-2 ${
              subTab === 'config' ? 'border-cyan-500 text-cyan-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Pengaturan Router
          </button>
        </div>
        <HelpTip
          title="Menu Manajemen MikroTik"
          text="PPPoE Secrets: Semua akun pelanggan di router. PPPoE Online: User yang sedang terkoneksi detik ini. Interfaces: Status port WAN/LAN router. Terminal: Jalankan perintah RouterOS langsung. Pengaturan: Atur IP, port API, username/password router & DNS guardhub.com."
        />
      </div>

      {/* TAB 1: PPPOE SECRETS */}
      {subTab === 'secrets' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">📋 Kelola Akun PPPoE di Router</h3>
              <p className="text-xs text-slate-400">
                Akses tulis dan baca langsung ke tabel <code className="text-cyan-400">/ppp/secret</code> RouterOS
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center">
                <button
                  onClick={() => setShowAddSecret(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3 py-2 rounded-xl transition"
                >
                  + Tambah Akun
                </button>
                <HelpTip
                  title="Tambah Secret langsung ke MikroTik"
                  text="Membuat akun PPPoE langsung ke router MikroTik tanpa melalui form pelanggan penuh."
                />
              </div>
              <div className="inline-flex items-center">
                <button
                  onClick={importCustomers}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-2 rounded-xl transition"
                >
                  📥 Impor ke GuardHub
                </button>
                <HelpTip
                  title="Impor PPPoE dari MikroTik"
                  text="Menarik seluruh akun PPPoE Secret yang sudah ada di MikroTik ke dalam database Pelanggan NetGuard Hub agar langsung bisa ditagih dan dipantau."
                />
              </div>
              <div className="inline-flex items-center">
                <button
                  onClick={exportCustomers}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 py-2 rounded-xl transition"
                >
                  📤 Sync ke Router
                </button>
                <HelpTip
                  title="Ekspor Pelanggan ke MikroTik"
                  text="Menyinkronkan seluruh data pelanggan di database NetGuard Hub ke /ppp/secret pada router MikroTik."
                />
              </div>
              <div className="inline-flex items-center">
                <button
                  onClick={loadSecrets}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded-xl transition"
                >
                  🔄 Refresh
                </button>
                <HelpTip title="Refresh Secrets" text="Mengambil ulang daftar secret terbaru dari MikroTik." />
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Username</th>
                  <th className="p-3.5">Password</th>
                  <th className="p-3.5">Profil Paket</th>
                  <th className="p-3.5">IP Remote</th>
                  <th className="p-3.5">Komentar / Nama</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {secrets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      {routerErr ? `⚠️ ${routerErr}` : 'Belum ada data secret di MikroTik.'}
                    </td>
                  </tr>
                ) : (
                  secrets.map((s, idx) => {
                    const isDisabled = s.disabled === 'true';
                    return (
                      <tr key={idx} className="hover:bg-slate-850/60">
                        <td className="p-3.5 font-bold font-mono text-blue-400">{s.name}</td>
                        <td className="p-3.5 font-mono text-slate-300">{s.password || '******'}</td>
                        <td className="p-3.5 text-cyan-300">{s.profile || 'default'}</td>
                        <td className="p-3.5 font-mono">{s['remote-address'] || '-'}</td>
                        <td className="p-3.5 text-slate-300">{s.comment || '-'}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isDisabled ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                            {isDisabled ? '🔒 Disabled' : '🟢 Active'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleSecret(s.name, isDisabled)}
                              className={`text-[11px] px-2.5 py-1 rounded text-white transition ${isDisabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}`}
                            >
                              {isDisabled ? '🔓 Buka' : '🔒 Isolir'}
                            </button>
                            <button
                              onClick={() => deleteSecret(s.name)}
                              className="bg-rose-700 hover:bg-rose-600 text-white text-[11px] px-2.5 py-1 rounded transition"
                            >
                              🗑️
                            </button>
                            <HelpTip
                              title="Toggle & Hapus Secret Router"
                              text="Buka/Isolir langsung mengaktifkan atau menonaktifkan secret PPPoE di RouterOS. Ikon tempat sampah menghapus akun secara permanen dari router."
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {secrets.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {routerErr ? `⚠️ ${routerErr}` : 'Belum ada data secret di MikroTik.'}
              </div>
            ) : (
              secrets.map((s, idx) => {
                const isDisabled = s.disabled === 'true';
                return (
                  <div key={idx} className="pt-3 first:pt-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-blue-400 text-sm">{s.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Profil: <span className="text-cyan-300 font-semibold">{s.profile || 'default'}</span>
                          {s.comment && <span> &bull; {s.comment}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDisabled ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                        {isDisabled ? '🔒 ISOLIR' : '🟢 AKTIF'}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono flex items-center justify-between text-slate-300">
                      <span>IP: {s['remote-address'] || 'Dynamic'}</span>
                      <span className="text-slate-400">Pass: {s.password ? '••••••' : '-'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleSecret(s.name, isDisabled)}
                          className={`flex-1 h-10 px-2 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1 shadow ${isDisabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                        >
                          <span>{isDisabled ? '🔓' : '🔒'}</span>
                          <span>{isDisabled ? 'Buka Isolir' : 'Isolir'}</span>
                        </button>
                        <HelpTip title="Isolir / Buka Secret" text="Mengubah status disabled secret di MikroTik." />
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => deleteSecret(s.name)}
                          className="flex-1 h-10 px-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1"
                        >
                          <span>🗑️</span>
                          <span>Hapus</span>
                        </button>
                        <HelpTip title="Hapus Secret" text="Menghapus secret PPPoE permanen dari router." />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE PPPOE AKTIF */}
      {subTab === 'active' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">🟢 Pelanggan PPPoE Sedang Online</h3>
              <p className="text-xs text-slate-400">Data sesi aktif live dari <code className="text-cyan-400">/ppp/active</code></p>
            </div>
            <div className="inline-flex items-center">
              <button
                onClick={loadActiveUsers}
                className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-xl border border-slate-700 transition"
              >
                🔄 Refresh
              </button>
              <HelpTip title="Refresh Sesi Aktif" text="Mengambil daftar pelanggan yang sedang terkoneksi online di RouterOS." />
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Nama Akun</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5">MAC / Caller ID</th>
                  <th className="p-3.5">Uptime</th>
                  <th className="p-3.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      {routerErr ? `⚠️ ${routerErr}` : 'Tidak ada sesi PPPoE aktif saat ini.'}
                    </td>
                  </tr>
                ) : (
                  activeUsers.map((u, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/60">
                      <td className="p-3.5 font-bold font-mono text-blue-400">{u.name}</td>
                      <td className="p-3.5 font-mono">{u.address || '-'}</td>
                      <td className="p-3.5 font-mono text-slate-300">{u['caller-id'] || '-'}</td>
                      <td className="p-3.5 text-emerald-400 font-mono">{u.uptime || '-'}</td>
                      <td className="p-3.5">
                        <div className="inline-flex items-center">
                          <button
                            onClick={() => kickUser(u.name)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] px-3 py-1 rounded-lg transition"
                          >
                            ⚡ Putus (Kick)
                          </button>
                          <HelpTip title="Kick Sesi Online" text="Memutuskan koneksi pelanggan secara paksa agar router CPE dial ulang." />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {activeUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {routerErr ? `⚠️ ${routerErr}` : 'Tidak ada sesi PPPoE aktif saat ini.'}
              </div>
            ) : (
              activeUsers.map((u, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-400 text-sm">{u.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ONLINE
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">IP Address</span>
                      <span className="text-white font-bold">{u.address || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Uptime</span>
                      <span className="text-emerald-400">{u.uptime || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => kickUser(u.name)}
                      className="flex-1 h-10 rounded-xl bg-rose-600 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <span>⚡</span>
                      <span>Putus Sesi (Kick)</span>
                    </button>
                    <HelpTip title="Kick Sesi" text="Memutus paksa koneksi PPPoE pelanggan ini di router." />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INTERFACES */}
      {subTab === 'interfaces' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">🌐 Daftar Interface Router</h3>
              <p className="text-xs text-slate-400">Status port fisik, bridge, dan interface MikroTik yang dipantau Sentinel</p>
            </div>
            <div className="inline-flex items-center">
              <button
                onClick={loadInterfaces}
                className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-xl border border-slate-700 transition"
              >
                🔄 Refresh
              </button>
              <HelpTip title="Refresh Interfaces" text="Membaca ulang kondisi link UP/DOWN seluruh port router." />
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Nama Interface</th>
                  <th className="p-3.5">Tipe</th>
                  <th className="p-3.5">MAC Address</th>
                  <th className="p-3.5">Link Status</th>
                  <th className="p-3.5">Status Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {interfaces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      {routerErr ? `⚠️ ${routerErr}` : 'Tidak ada data interface.'}
                    </td>
                  </tr>
                ) : (
                  interfaces.map((itf, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/60">
                      <td className="p-3.5 font-bold font-mono text-white">{itf.name}</td>
                      <td className="p-3.5 text-slate-300">{itf.type}</td>
                      <td className="p-3.5 font-mono text-slate-400">{itf['mac-address'] || '-'}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${itf.running === 'true' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                          {itf.running === 'true' ? 'UP (Running)' : 'DOWN'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${itf.disabled === 'true' ? 'bg-rose-950 text-rose-300' : 'bg-cyan-950 text-cyan-300'}`}>
                          {itf.disabled === 'true' ? 'Disabled' : 'Enabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
            {interfaces.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {routerErr ? `⚠️ ${routerErr}` : 'Tidak ada data interface.'}
              </div>
            ) : (
              interfaces.map((itf, idx) => (
                <div key={idx} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">{itf.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${itf.running === 'true' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                      {itf.running === 'true' ? 'LINK UP' : 'LINK DOWN'}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono flex items-center justify-between text-slate-300">
                    <span>Tipe: {itf.type}</span>
                    <span className="text-[11px] text-slate-400">{itf['mac-address'] || '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ROUTER TERMINAL */}
      {subTab === 'terminal' && (
        <div className="bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">💻 Router Command Runner</h3>
            <p className="text-xs text-slate-400 mt-1">
              Jalankan perintah MikroTik RouterOS API langsung dari browser (mendukung argumen berpetik seperti <code className="text-cyan-400">=comment=&quot;Pak Budi&quot;</code>).
            </p>
          </div>

          <form onSubmit={runCommand} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Contoh: /system/resource/print atau /ip/address/print"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-emerald-400 focus:outline-none focus:border-cyan-500"
            />
            <div className="inline-flex items-center">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition disabled:opacity-50"
              >
                ▶️ Kirim Perintah
              </button>
              <HelpTip
                title="Eksekusi Command MikroTik"
                text="Mengirim perintah RouterOS API langsung ke MikroTik target dan menampilkan respon JSON aslinya."
                impact="Perintah seperti remove/set/reset berpengaruh langsung ke konfigurasi router."
              />
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Shortcut:</span>
            {[
              '/system/resource/print',
              '/ip/address/print',
              '/ppp/profile/print',
              '/ip/pool/print',
              '/queue/simple/print',
            ].map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setCommand(sc)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg font-mono text-cyan-300"
              >
                {sc}
              </button>
            ))}
          </div>

          <div className="bg-black/90 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 max-h-96 overflow-y-auto">
            {cmdOutput ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(cmdOutput, null, 2)}</pre>
            ) : (
              <span className="text-slate-600">Tekan Kirim Perintah untuk menjalankan command ke router...</span>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PENGATURAN KONEKSI & CLOUD BACKUP */}
      {subTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">⚙️ Konfigurasi Target MikroTik</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hubungkan NetGuard Hub ke router MikroTik mana saja (IP lokal, kantor, publik, VPN, atau domain DDNS).
              </p>
            </div>

            {/* Banner Penjelasan Bebas IP */}
            <div className="bg-cyan-950/40 border border-cyan-800/70 rounded-xl p-3 text-xs text-cyan-200 leading-relaxed">
              🌐 <strong>Bebas Menggunakan IP Apa Saja:</strong> NetGuard Hub tidak mewajibkan IP tertentu (tidak harus <code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">192.168.88.1</code>). Anda bisa memasukkan IP router kantor Anda (<code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">10.10.1.1</code>), IP gateway lokal, IP VPN WireGuard, IP Publik statis, maupun domain Cloud MikroTik (<code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">*.mynetname.net</code>).
            </div>

            <form onSubmit={saveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <label className="block text-xs font-bold text-slate-200">
                      IP Address / Hostname / Domain MikroTik:
                    </label>
                    <button
                      type="button"
                      onClick={detectRouterGateway}
                      disabled={detectingGw}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      {detectingGw ? (
                        <>
                          <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                          <span>Mendeteksi...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>Auto-Deteksi Gateway Komputer</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ketik IP apa saja (contoh: 10.10.1.1 atau 192.168.1.1)"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                    required
                  />

                  {/* Quick Preset IP Chips */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold">⚡ Pilihan Cepat:</span>
                    {detectedGateway?.detected_gateway && (
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, host: detectedGateway.detected_gateway })}
                        title="Isi dengan default gateway router yang terhubung ke komputer ini saat ini"
                        className="px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-mono font-bold hover:bg-emerald-900 transition flex items-center gap-1"
                      >
                        <span>✓ Gateway:</span>
                        <span>{detectedGateway.detected_gateway}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, host: '10.10.1.1' })}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 text-[11px] font-mono hover:bg-slate-800 transition"
                    >
                      10.10.1.1 (Kantor / Boss)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, host: '192.168.1.1' })}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono hover:bg-slate-800 transition"
                    >
                      192.168.1.1
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, host: '192.168.88.1' })}
                      className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-[11px] font-mono hover:bg-slate-800 transition"
                    >
                      192.168.88.1
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Port API</label>
                  <input
                    type="number"
                    placeholder="8728"
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Default: 8728 (API) / 8729 (SSL)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username Login</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={config.user}
                    onChange={(e) => setConfig({ ...config, user: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="Password router MikroTik"
                    value={config.pass}
                    onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tls-toggle"
                  checked={config.tls === 'true'}
                  onChange={(e) => setConfig({ ...config, tls: e.target.checked ? 'true' : 'false' })}
                  className="rounded bg-slate-950 border-slate-700"
                />
                <label htmlFor="tls-toggle" className="text-xs text-slate-300">
                  Gunakan API-SSL (TLS / Port 8729)
                </label>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <div className="inline-flex items-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition disabled:opacity-50"
                  >
                    💾 Simpan Pengaturan
                  </button>
                  <HelpTip
                    title="Simpan Konfigurasi MikroTik"
                    text="Menyimpan alamat IP, Port API, Username, Password, dan opsi TLS ke database lalu langsung menguji koneksi."
                  />
                </div>
                <div className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => testConnection(config)}
                    disabled={loading}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition disabled:opacity-50"
                  >
                    ⚡ Coba Koneksi
                  </button>
                  <HelpTip
                    title="Tes Koneksi Tanpa Menyimpan"
                    text="Mencoba konek ke router menggunakan isian form saat ini sebelum disimpan permanen."
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
            {/* FITUR CLOUD DATABASE BACKUP */}
            <div>
              <h3 className="text-base font-bold mb-1 text-white flex items-center gap-2">
                <span>☁️</span>
                <span>Penyimpanan Online &amp; Cadangan Cloud</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Unduh atau pulihkan database Anda kapan saja secara gratis agar data tiket, pelanggan, dan setting selalu aman di cloud.
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-700 text-cyan-300 text-xs font-semibold transition flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span>💾</span>
                    <span>Download Cadangan Lengkap (.json)</span>
                  </span>
                  <span>&darr;</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDB}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-700 text-emerald-300 text-xs font-semibold transition flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span>📦</span>
                    <span>Download File SQLite (netguard.db)</span>
                  </span>
                  <span>&darr;</span>
                </button>

                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Pulihkan / Restore Data dari File Cadangan (.json):
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    disabled={backupLoading}
                    className="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-300 hover:file:bg-cyan-900 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Panduan Koneksi & DNS */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                <span>💡</span>
                <span>Panduan Koneksi RouterOS</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <li><strong>IP Fleksibel:</strong> Masukkan IP apa pun yang dipakai router MikroTik Anda.</li>
                <li><strong>Aktifkan API:</strong> Di Winbox, pastikan menu <em>IP &rarr; Services &rarr; api (8728)</em> berstatus aktif (hijau).</li>
                <li><strong>User Winbox:</strong> Buat user khusus (misal <em>admin</em> grup <em>full</em>) di <em>System &rarr; Users</em>.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-cyan-400 mb-1">
                🌐 Domain Lokal <code className="text-white">guardhub.com</code>
              </h4>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Daftarkan DNS static di MikroTik agar semua HP &amp; laptop di WiFi cukup mengetik <strong className="text-white">http://guardhub.com:8080</strong>.
              </p>
              <button
                type="button"
                onClick={setupDomainOnMikrotik}
                disabled={loading || !testResult?.connected}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-xl text-xs transition shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-1.5"
              >
                <span>🚀</span>
                <span>Pasang DNS guardhub.com ke MikroTik</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH SECRET */}
      {showAddSecret && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateSecret} className="bg-slate-900 p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-white mb-2">Tambah Akun PPPoE ke MikroTik</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Username PPPoE</label>
              <input
                placeholder="Username"
                value={newSecret.name}
                onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                placeholder="Password"
                value={newSecret.password}
                onChange={(e) => setNewSecret({ ...newSecret, password: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Profil / Paket Bandwidth</label>
              <select
                value={newSecret.profile}
                onChange={(e) => setNewSecret({ ...newSecret, profile: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
              >
                <option value="default">default</option>
                {profiles.filter((p) => p.name !== 'default').map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Remote IP (Opsional)</label>
              <input
                placeholder="Misal: 10.10.10.25"
                value={newSecret.remote_address}
                onChange={(e) => setNewSecret({ ...newSecret, remote_address: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Pelanggan / Komentar</label>
              <input
                placeholder="Misal: Pak Budi - Rumah No 12"
                value={newSecret.comment}
                onChange={(e) => setNewSecret({ ...newSecret, comment: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddSecret(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 p-2.5 rounded-xl font-semibold text-xs text-slate-300 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 p-2.5 rounded-xl font-semibold text-xs text-white transition disabled:opacity-50"
              >
                Simpan ke Router
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
