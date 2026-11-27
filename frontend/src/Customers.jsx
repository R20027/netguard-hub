import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API } from './api';
import HelpTip from './HelpTip';

function MiniMapPicker({ lat, lng, nocCenter, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const initLat = lat && !isNaN(lat) ? Number(lat) : nocCenter.lat || -8.130588;
    const initLng = lng && !isNaN(lng) ? Number(lng) : nocCenter.lng || 113.540639;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [initLat, initLng],
        zoom: 16,
        maxZoom: 19,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxNativeZoom: 18,
        maxZoom: 19,
        detectRetina: false,
      }).addTo(map);

      const marker = L.circleMarker([initLat, initLng], {
        radius: 9,
        color: '#06b6d4',
        fillColor: '#22d3ee',
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);

      map.on('click', (e) => {
        const { lat: nLat, lng: nLng } = e.latlng;
        marker.setLatLng([nLat, nLng]);
        onPick(nLat.toFixed(6), nLng.toFixed(6));
      });

      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 150);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && markerRef.current && lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const nLat = Number(lat);
      const nLng = Number(lng);
      markerRef.current.setLatLng([nLat, nLng]);
      mapRef.current.setView([nLat, nLng], mapRef.current.getZoom());
    }
  }, [lat, lng]);

  return <div ref={containerRef} className="w-full h-44 rounded-xl border border-slate-700 overflow-hidden z-10" />;
}

export default function Customers({ onSwitchTab }) {
  const [customers, setCustomers] = useState([]);
  const [profiles, setProfiles] = useState(['10Mbps', '20Mbps', '50Mbps', '100Mbps', 'default']);
  const [nocCenter, setNocCenter] = useState({ lat: -8.130588, lng: 113.540639 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline' | 'isolated'

  const defaultDueDate = () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const emptyForm = () => ({
    name: '',
    phone: '',
    address: '',
    package: '10Mbps',
    pppoe_user: '',
    pppoe_pass: '',
    ip_address: '',
    due_date: defaultDueDate(),
    lat: '',
    lng: '',
  });

  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    try {
      const [resCust, resNoc] = await Promise.all([
        axios.get(`${API}/customers`),
        axios.get(`${API}/map/noc-location`).catch(() => null),
      ]);
      setCustomers(resCust.data.data || []);
      if (resNoc?.data?.lat) {
        setNocCenter({ lat: resNoc.data.lat, lng: resNoc.data.lng });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMikrotikProfiles = async () => {
    try {
      const res = await axios.get(`${API}/mikrotik/profiles`);
      const list = (res.data.data || []).map((p) => p.name).filter(Boolean);
      if (list.length > 0) {
        const merged = Array.from(new Set([...list, '10Mbps', '20Mbps', '50Mbps', '100Mbps', 'default']));
        setProfiles(merged);
      }
    } catch {
      // Abaikan jika router sedang offline
    }
  };

  useEffect(() => {
    load();
    loadMikrotikProfiles();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowMapPicker(false);
    loadMikrotikProfiles();
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      package: c.package || '10Mbps',
      pppoe_user: c.pppoe_user || '',
      pppoe_pass: c.pppoe_pass || '',
      ip_address: c.ip_address || '',
      due_date: c.due_date || defaultDueDate(),
      lat: c.lat ? String(c.lat) : '',
      lng: c.lng ? String(c.lng) : '',
    });
    setShowMapPicker(false);
    loadMikrotikProfiles();
    setShowModal(true);
  };

  const useMyGPS = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
      },
      (err) => {
        alert(`GPS tidak dapat diakses (${err.message}). Silakan aktifkan opsi "Pilih Titik di Peta" di bawah lalu klik langsung rumah pelanggan!`);
        setShowMapPicker(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      lat: form.lat !== '' && !isNaN(parseFloat(form.lat)) ? parseFloat(form.lat) : null,
      lng: form.lng !== '' && !isNaN(parseFloat(form.lng)) ? parseFloat(form.lng) : null,
    };

    try {
      if (editingId) {
        const res = await axios.patch(`${API}/customers/${editingId}`, payload);
        setShowModal(false);
        load();
        alert(`✅ ${res.data.message}`);
      } else {
        const res = await axios.post(`${API}/customers`, payload);
        setShowModal(false);
        setForm(emptyForm());
        load();
        alert(`${res.data.mikrotik_synced ? '✅' : '⚠️'} ${res.data.message}`);
      }
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteCustomer = async (id, name) => {
    if (!confirm(`⚠️ Hapus ${name}? Secret PPPoE di MikroTik dan data tagihan juga akan dihapus.`)) return;
    try {
      await axios.delete(`${API}/customers/${id}`);
      alert(`Pelanggan ${name} berhasil dihapus dari database & MikroTik!`);
      load();
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  const isolate = async (id, name) => {
    if (!confirm(`Isolir ${name}?\nAkun PPPoE di MikroTik akan di-disable, sesi aktif langsung diputus, dan IP dimasukkan ke address-list ISOLIR.`)) return;
    try {
      const res = await axios.post(`${API}/customers/${id}/isolate`);
      alert(`🔒 ${res.data.message}`);
      load();
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  const restore = async (id, name) => {
    if (!confirm(`Buka isolir ${name}?\nAkun PPPoE di MikroTik diaktifkan kembali dan IP dilepas dari isolir firewall.`)) return;
    try {
      const res = await axios.post(`${API}/customers/${id}/restore`);
      alert(`🔓 ${res.data.message}`);
      load();
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  const kickSession = async (id, user) => {
    if (!confirm(`Putuskan paksa (kick) sesi aktif PPPoE ${user} di MikroTik?`)) return;
    try {
      const res = await axios.post(`${API}/customers/${id}/kick`);
      alert(`⚡ ${res.data.message}`);
      load();
    } catch (err) {
      alert('Info: ' + (err.response?.data?.error || err.message));
    }
  };

  const syncSecret = async (id) => {
    try {
      const res = await axios.post(`${API}/customers/${id}/sync-mikrotik`);
      alert(`📡 ${res.data.message}`);
      load();
    } catch (err) {
      alert('Gagal sync: ' + (err.response?.data?.error || err.message));
    }
  };

  const testPPPoE = async (id, name) => {
    try {
      const r = await axios.post(`${API}/customers/${id}/pppoe-login`);
      const d = r.data;
      alert(
        `✅ ${name}\n${d.message}\n\n` +
        `• Status Database: ${d.db_status}\n` +
        `• RouterOS Online: ${d.mikrotik_online ? 'Ya' : 'Tidak'}\n` +
        `• Secret di MikroTik: ${d.secret_exists ? 'Ada' : 'Belum ada'}\n` +
        `• Sesi Aktif Sekarang: ${d.is_online ? `ONLINE (${d.active_ip})` : 'Offline'}`
      );
    } catch (err) {
      const d = err.response?.data || {};
      alert(`❌ ${name}\nPPPoE DITOLAK!\n\nAlasan: ${d.reason || 'Akun terisolir'}\nAction: ${d.action || 'Firewall BLOCK'}`);
    }
  };

  // KPI Calculations
  const onlineCount = customers.filter((c) => c.is_online).length;
  const activeCount = customers.filter((c) => c.status === 'active').length;
  const isolatedCount = customers.filter((c) => c.status === 'isolated').length;
  const overdueCount = customers.filter((c) => c.unpaid_invoices > 0).length;

  // Filter
  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === 'online' && !c.is_online) return false;
    if (statusFilter === 'offline' && (c.is_online || c.status === 'isolated')) return false;
    if (statusFilter === 'isolated' && c.status !== 'isolated') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.pppoe_user?.toLowerCase().includes(q) ||
        c.ip_address?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.package?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              👥 Manajemen Pelanggan PPPoE
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              ROUTEROS LIVE SYNC
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Status sesi koneksi live terbaca langsung dari tabel <code className="text-cyan-400 font-mono">/ppp/active</code> MikroTik. Klik tombol <strong className="text-cyan-400">(!)</strong> untuk panduan lengkap tiap aksi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-600/25 transition flex items-center justify-center gap-1.5"
          >
            <span>+</span>
            <span>Tambah Pelanggan</span>
          </button>
          <HelpTip
            title="Tambah Pelanggan Baru"
            text="Menambahkan data pelanggan baru beserta titik koordinat GPS rumahnya, lalu membuatkan akun secret PPPoE di MikroTik secara otomatis."
            tip="Profil paket diambil otomatis dari daftar PPP Profile RouterOS Anda."
          />
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">Total Pelanggan</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-white">{customers.length}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Terdaftar</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Online di MikroTik
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-400">{onlineCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              Sesi PPPoE Aktif
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-rose-400 text-xs font-medium">Terisolir (Firewall)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-rose-400">{isolatedCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
              Internet Blokir
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-amber-400 text-xs font-medium">Menunggak Tagihan</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-400">{overdueCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
              Perlu Ditagih
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
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Semua ({customers.length})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'online' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🟢 Online ({onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'offline' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              ⚪ Offline ({Math.max(0, activeCount - onlineCount)})
            </button>
            <button
              onClick={() => setStatusFilter('isolated')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'isolated' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🔒 Isolir ({isolatedCount})
            </button>
          </div>
          <HelpTip
            title="Filter Status Pelanggan"
            text="Online: Router pelanggan sedang aktif dial-in di MikroTik. Offline: Akun aktif namun CPE/modem mati atau kabel putus. Isolir: Akun diblokir karena tunggakan."
          />
        </div>

        <div className="w-full lg:w-72">
          <input
            type="text"
            placeholder="Cari nama, user pppoe, IP, paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* CUSTOMERS DATA DISPLAY: TABLE ON DESKTOP, TOUCH CARDS ON MOBILE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Pelanggan &amp; Lokasi</th>
                <th className="p-4">Paket</th>
                <th className="p-4">PPPoE User</th>
                <th className="p-4">
                  <span className="inline-flex items-center">
                    Status MikroTik
                    <HelpTip
                      title="Status Live MikroTik"
                      text="Menampilkan status real-time dari /ppp/active di MikroTik: apakah sedang ONLINE (lengkap dengan uptime & IP aktif), OFFLINE, atau TERISOLIR."
                    />
                  </span>
                </th>
                <th className="p-4">
                  <span className="inline-flex items-center">
                    Tagihan
                    <HelpTip
                      title="Status Tagihan"
                      text="Menampilkan jumlah tagihan pelanggan yang belum dibayar."
                    />
                  </span>
                </th>
                <th className="p-4">
                  <span className="inline-flex items-center">
                    Aksi Kontrol MikroTik
                    <HelpTip
                      title="Panduan Tombol Aksi Pelanggan"
                      text="✏️ Edit: Ubah paket, password, IP, atau lokasi GPS. ⚡ Kick: Putus paksa sesi aktif. 🔒 Isolir / 🔓 Restore: Matikan atau hidupkan internet di MikroTik. 📡 Sync: Tulis ulang akun ke secret router. 🔌 Test: Uji sinkronisasi akun ke RouterOS. 🗑️ Hapus: Hapus permanen."
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400">
                    Memuat data pelanggan &amp; memeriksa sesi live MikroTik...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-slate-400">
                    Tidak ada pelanggan yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-850/60 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.lat && c.lng ? (
                          <div className="flex items-center gap-1">
                            <span title={`GPS: ${c.lat}, ${c.lng}`} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                              📍 GPS
                            </span>
                            {onSwitchTab && (
                              <button
                                type="button"
                                onClick={() => onSwitchTab('map', { id: c.id, type: 'customer', lat: c.lat, lng: c.lng, label: c.name })}
                                title={`Buka titik GPS ${c.name} di peta`}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 transition font-semibold"
                              >
                                🗺️ Peta
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openEditModal(c)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900"
                          >
                            + Set GPS
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>📞 {c.phone || '-'}</span>
                        {c.address && <span>&bull; {c.address}</span>}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-cyan-400 font-medium">
                        {c.package || 'default'}
                      </span>
                    </td>

                    <td className="p-4 font-mono">
                      <div className="text-blue-400 font-bold">{c.pppoe_user}</div>
                      <div className="text-[11px] text-slate-500">
                        IP: {c.ip_address || 'Dynamic'}
                      </div>
                    </td>

                    <td className="p-4">
                      {c.status === 'isolated' ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            🔒 TERISOLIR (RouterOS)
                          </span>
                          <span className="text-[10px] text-rose-400/80">
                            Secret disabled / firewall block
                          </span>
                        </div>
                      ) : c.is_online ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            ONLINE (MikroTik)
                          </span>
                          <div className="text-[10px] text-emerald-400 font-mono">
                            Up: {c.active_uptime} | IP: {c.active_ip}
                          </div>
                          {c.active_caller_id && (
                            <div className="text-[9px] text-slate-500 font-mono">
                              MAC: {c.active_caller_id}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            ⚪ OFFLINE
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Akun aktif, belum dial-in
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      {c.unpaid_invoices > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          ⚠️ {c.unpaid_invoices} Menunggak
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                          ✓ Lunas
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit profil & lokasi GPS pelanggan"
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[10px] transition"
                        >
                          ✏️ Edit
                        </button>

                        {c.is_online && (
                          <button
                            onClick={() => kickSession(c.id, c.pppoe_user)}
                            title="Putuskan sesi aktif PPPoE di MikroTik"
                            className="px-2 py-1 rounded bg-amber-600/90 hover:bg-amber-500 text-white font-medium text-[10px] transition shadow"
                          >
                            ⚡ Kick
                          </button>
                        )}

                        {c.status === 'active' ? (
                          <button
                            onClick={() => isolate(c.id, c.name)}
                            title="Isolir pelanggan"
                            className="px-2 py-1 rounded bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-[10px] transition shadow"
                          >
                            🔒 Isolir
                          </button>
                        ) : (
                          <button
                            onClick={() => restore(c.id, c.name)}
                            title="Buka isolir pelanggan"
                            className="px-2 py-1 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-[10px] transition shadow"
                          >
                            🔓 Restore
                          </button>
                        )}

                        <button
                          onClick={() => syncSecret(c.id)}
                          title="Sync ke Secret MikroTik"
                          className="px-2 py-1 rounded bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 border border-cyan-700/60 font-medium text-[10px] transition"
                        >
                          📡 Sync
                        </button>

                        <button
                          onClick={() => testPPPoE(c.id, c.name)}
                          title="Cek akurasi login & status secret di MikroTik"
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                        >
                          🔌 Test
                        </button>

                        <button
                          onClick={() => deleteCustomer(c.id, c.name)}
                          title="Hapus pelanggan permanen"
                          className="px-1.5 py-1 rounded bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 text-[10px] transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Memuat data pelanggan &amp; sesi live...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Tidak ada pelanggan yang cocok dengan pencarian.
            </div>
          ) : (
            filteredCustomers.map((c) => (
              <div key={c.id} className="pt-3 first:pt-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 text-sm truncate flex items-center gap-1.5">
                      <span>{c.name}</span>
                      {c.lat && c.lng && onSwitchTab && (
                        <button
                          type="button"
                          onClick={() => onSwitchTab('map', { id: c.id, type: 'customer', lat: c.lat, lng: c.lng, label: c.name })}
                          className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold"
                        >
                          📍 Peta
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>📞 {c.phone || '-'}</span>
                      <span>&bull;</span>
                      <span className="text-cyan-400 font-semibold">{c.package || '10Mbps'}</span>
                    </div>
                  </div>
                  <div>
                    {c.status === 'isolated' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap">
                        🔒 TERISOLIR
                      </span>
                    ) : c.is_online ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        ONLINE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                        ⚪ OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-sans">User PPPoE</span>
                    <span className="text-blue-400 font-bold truncate block">{c.pppoe_user}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-sans">IP Address</span>
                    <span className="text-slate-300 truncate block">{c.active_ip || c.ip_address || 'Dynamic'}</span>
                  </div>
                  {c.is_online && c.active_uptime && (
                    <div className="col-span-2 text-[10px] text-emerald-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
                      <span>Uptime: {c.active_uptime}</span>
                      {c.active_caller_id && <span className="text-slate-500">MAC: {c.active_caller_id}</span>}
                    </div>
                  )}
                  <div className="col-span-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                    <span className="text-[11px] text-slate-400 font-sans">Tagihan:</span>
                    {c.unpaid_invoices > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 font-sans">
                        ⚠️ {c.unpaid_invoices} Menunggak
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 font-sans">
                        ✓ Lunas
                      </span>
                    )}
                  </div>
                </div>

                {/* Touch Button Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center">
                    {c.status === 'active' ? (
                      <button
                        onClick={() => isolate(c.id, c.name)}
                        className="flex-1 h-10 px-2 rounded-xl bg-rose-600 active:bg-rose-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1 shadow"
                      >
                        <span>🔒</span>
                        <span>Isolir</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => restore(c.id, c.name)}
                        className="flex-1 h-10 px-2 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1 shadow"
                      >
                        <span>🔓</span>
                        <span>Buka Isolir</span>
                      </button>
                    )}
                    <HelpTip
                      title={c.status === 'active' ? 'Isolir Pelanggan' : 'Buka Isolir'}
                      text={c.status === 'active' ? 'Memutus koneksi internet pelanggan dan menonaktifkan secret MikroTik.' : 'Mengaktifkan kembali akun internet pelanggan.'}
                    />
                  </div>

                  <div className="flex items-center">
                    {c.is_online ? (
                      <button
                        onClick={() => kickSession(c.id, c.pppoe_user)}
                        className="flex-1 h-10 px-2 rounded-xl bg-amber-600 active:bg-amber-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1 shadow"
                      >
                        <span>⚡</span>
                        <span>Kick Sesi</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => testPPPoE(c.id, c.name)}
                        className="flex-1 h-10 px-2 rounded-xl bg-slate-800 active:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1"
                      >
                        <span>🔌</span>
                        <span>Test Auth</span>
                      </button>
                    )}
                    <HelpTip
                      title={c.is_online ? 'Kick Sesi PPPoE' : 'Test Autentikasi'}
                      text={c.is_online ? 'Memutuskan paksa sesi aktif PPPoE agar modem dial-in ulang.' : 'Memeriksa status sinkronisasi secret PPPoE di router MikroTik.'}
                    />
                  </div>

                  <div className="flex items-center">
                    <button
                      onClick={() => openEditModal(c)}
                      className="flex-1 h-10 px-2 rounded-xl bg-slate-800 active:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      <span>✏️</span>
                      <span>Edit &amp; GPS</span>
                    </button>
                    <HelpTip
                      title="Edit Data & GPS Rumah"
                      text="Mengubah nama, paket bandwidth, password, atau memasang koordinat GPS akurat rumah pelanggan."
                    />
                  </div>

                  <div className="flex items-center">
                    <button
                      onClick={() => syncSecret(c.id)}
                      className="flex-1 h-10 px-2 rounded-xl bg-cyan-950/80 active:bg-cyan-900 border border-cyan-800/80 text-cyan-300 font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      <span>📡</span>
                      <span>Sync</span>
                    </button>
                    <HelpTip
                      title="Sync ke MikroTik"
                      text="Mengirim ulang akun username, password, & profile PPPoE pelanggan ini ke MikroTik."
                    />
                  </div>

                  <div className="col-span-2 flex items-center">
                    <button
                      onClick={() => deleteCustomer(c.id, c.name)}
                      className="flex-1 h-9 px-2 rounded-xl bg-slate-950 active:bg-rose-950 border border-slate-800 text-slate-400 active:text-rose-300 font-semibold text-xs transition flex items-center justify-center gap-1"
                    >
                      <span>🗑️</span>
                      <span>Hapus Pelanggan</span>
                    </button>
                    <HelpTip
                      title="Hapus Pelanggan"
                      text="Menghapus pelanggan dari database dan mencabut secret PPPoE dari MikroTik."
                      impact="Tindakan permanen, seluruh riwayat tagihan ikut terhapus."
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT PELANGGAN */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={saveCustomer}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingId ? '✏️ Edit Data & Lokasi Pelanggan' : 'Tambah Pelanggan Baru'}
                </h3>
                <p className="text-slate-400 text-xs">
                  Otomatis sinkron ke secret PPPoE di MikroTik &amp; titik koordinat Peta NOC
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Nama Lengkap *</label>
                <input
                  required
                  placeholder="Budi Santoso"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Nomor HP / WhatsApp</label>
                <input
                  placeholder="081234567890"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Alamat Pemasangan</label>
                <input
                  placeholder="Jl. Merdeka No. 45"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Paket Bandwidth (Profile)</label>
                <select
                  value={form.package}
                  onChange={(e) => setForm({ ...form, package: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {profiles.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Jatuh Tempo Tiap Bulan</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">PPPoE Username *</label>
                <input
                  required
                  placeholder="user-budi"
                  value={form.pppoe_user}
                  onChange={(e) => setForm({ ...form, pppoe_user: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">PPPoE Password *</label>
                <input
                  required
                  type="text"
                  placeholder="******"
                  value={form.pppoe_pass}
                  onChange={(e) => setForm({ ...form, pppoe_pass: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  IP Address (Static Remote-Address)
                </label>
                <input
                  placeholder="10.10.10.50 (Opsional, kosongkan untuk dynamic pool)"
                  value={form.ip_address}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* KOORDINAT GPS PELANGGAN */}
              <div className="sm:col-span-2 border-t border-slate-800 pt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-cyan-400">📍 Titik Lokasi GPS Rumah (Opsional)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={useMyGPS}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-semibold"
                    >
                      📍 GPS Saya
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[10px] font-semibold"
                    >
                      🗺️ {showMapPicker ? 'Tutup Peta' : 'Pilih di Peta'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Latitude (mis: -8.1969)"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                  />
                  <input
                    placeholder="Longitude (mis: 113.5283)"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                  />
                </div>

                {showMapPicker && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400">Klik lokasi rumah di peta untuk mengisi Lat/Lng secara akurat:</div>
                    <MiniMapPicker
                      lat={form.lat}
                      lng={form.lng}
                      nocCenter={nocCenter}
                      onPick={(nLat, nLng) => setForm((prev) => ({ ...prev, lat: nLat, lng: nLng }))}
                    />
                  </div>
                )}
              </div>
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
                {editingId ? 'Simpan Perubahan' : 'Simpan & Buat Secret di MikroTik'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
