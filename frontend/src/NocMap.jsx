import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  Radio,
  Building2,
  MapPin,
  Server,
  Compass,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  Eye,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Layers,
  LocateFixed
} from 'lucide-react';
import { API } from './api';
import HelpTip from './HelpTip';

// Demo Fallback Points presisi di Sanggrahan, Curahkalong, Bangsalsari, Jember (Kanca Kopi / Lapangan Sanggrahan)
const DEMO_POINTS_JEMBER = [
  {
    id: 'node-mikrotik-core',
    title: 'PT Satelit Global Media (Sanggrahan Curahkalong)',
    type: 'router',
    status: 'up',
    lat: -8.130588,
    lng: 113.540639,
    ip: '192.168.88.1',
    detail: 'Pusat Gateway & PPPoE Concentrator (Kanca Kopi / Sanggrahan)',
    location_source: 'noc_router',
  },
  {
    id: 'dev-SW-BGS-01',
    device_id: 'SW-BGS-01',
    title: 'Switch Lapangan Sanggrahan',
    type: 'device',
    status: 'up',
    lat: -8.1298,
    lng: 113.5408,
    ip: '192.168.88.2',
    detail: 'Node Distribusi Lapangan Sepak Bola Sanggrahan',
    location_source: 'gps',
  },
  {
    id: 'dev-ODP-BGS-01',
    device_id: 'ODP-BGS-01',
    title: 'ODP Curahkalong Krajan',
    type: 'device',
    status: 'up',
    lat: -8.1285,
    lng: 113.5406,
    ip: '192.168.88.3',
    detail: 'ODP Distribusi Area Toko Sembako B. Risal',
    location_source: 'gps',
  },
  {
    id: 'dev-SRV-SGM-01',
    device_id: 'SRV-SGM-01',
    title: 'Server PT Satelit Global Media',
    type: 'device',
    status: 'up',
    lat: -8.130588,
    lng: 113.540639,
    ip: '192.168.88.10',
    detail: 'Server NOC Sanggrahan Curahkalong Bangsalsari',
    location_source: 'gps',
  },
  {
    id: 'cust-1',
    customer_id: 1,
    title: 'Pelanggan: Budi Santoso (10Mbps)',
    type: 'customer',
    status: 'active',
    is_online: true,
    lat: -8.1312,
    lng: 113.5409,
    ip: '10.10.10.15',
    detail: 'PPPoE Active: budi_net • Sanggrahan Curahkalong',
    location_source: 'customer',
  },
  {
    id: 'ticket-1',
    ticket_id: 1,
    title: 'Kabel Dropcore Putus Dekat Lapangan Sanggrahan',
    type: 'ticket',
    status: 'problem',
    priority: 'P1',
    lat: -8.1295,
    lng: 113.5407,
    detail: 'Laporan gangguan kabel FO dropcore Sanggrahan Curahkalong',
    location_source: 'gps',
  },
];

// CARTO Basemaps API Key dari akun pengguna (5,000,000 req/bulan)
const CARTO_API_KEY = 'cb1_53qp_1_c5d2b45df593899aadd6df50';

// Konfigurasi Lapisan Peta (Tile Layer) yang stabil dan anti-hilang saat di-zoom
const MAP_STYLES = {
  voyager: {
    id: 'voyager',
    name: '🗺️ Voyager',
    shortName: 'Voyager',
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 18,
    maxZoom: 19,
    bg: '#e2e8f0',
  },
  osm: {
    id: 'osm',
    name: '🛣️ OSM Detail',
    shortName: 'Jalan OSM',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 18,
    maxZoom: 19,
    bg: '#e5e7eb',
  },
  satellite: {
    id: 'satellite',
    name: '🛰️ Satelit Asli',
    shortName: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri World Imagery',
    maxNativeZoom: 17,
    maxZoom: 19,
    bg: '#0f172a',
  },
  light: {
    id: 'light',
    name: '☀️ Terang',
    shortName: 'Terang',
    url: `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 18,
    maxZoom: 19,
    bg: '#f1f5f9',
  },
  dark: {
    id: 'dark',
    name: '🌙 Dark NOC',
    shortName: 'Dark',
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 18,
    maxZoom: 19,
    bg: '#1e293b',
  },
};

export default function NocMap({ focusTarget, onClearFocusTarget, isLargeText, userRole }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const linksLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersMapRef = useRef({});
  const hasCenteredInitiallyRef = useRef(false);

  // Live User GPS Location (Google Maps Style Blue Dot)
  const [userLocation, setUserLocation] = useState(null); // { lat, lng, accuracy, addressName, village, subdistrict, city }
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);

  const [points, setPoints] = useState([]);
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [unpinnedCustomers, setUnpinnedCustomers] = useState(0);

  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'problem' | 'device' | 'customer'
  const [mapStyle, setMapStyle] = useState('voyager'); // Default Voyager agar jalan/gang terlihat jelas dan tidak gelap
  const [showTopology, setShowTopology] = useState(true);
  const [nocCenter, setNocCenter] = useState({ lat: -8.130588, lng: 113.540639, name: 'PT Satelit Global Media (Sanggrahan Curahkalong)' });

  // Search Lokasi (Nominatim OSM Geocoding)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingLoc, setSearchingLoc] = useState(false);

  // Mode Kalibrasi / Klik Peta untuk set koordinat akurat
  const [pinMode, setPinMode] = useState(null); // null | { targetType: 'noc' | 'device' | 'customer' | 'ticket', targetId: string, label: string }
  const pinModeRef = useRef(null);
  pinModeRef.current = pinMode;

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCategory, setPinCategory] = useState('noc'); // 'noc' | 'customer' | 'device' | 'ticket'
  const [pinTargetId, setPinTargetId] = useState('');

  // Modal Kelola / Tambah / Edit Node Infrastruktur
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [editingDevice, setEditingDevice] = useState(null);
  const [newDevice, setNewDevice] = useState({ id: '', name: '', ip: '', lat: '', lng: '' });

  // Custom HTML Marker Generator
  const createMarkerIcon = (point) => {
    let html = '';
    const isProblem = point.status === 'problem' || point.priority === 'P0' || point.priority === 'P1';

    if (point.type === 'router') {
      const color = point.status === 'up' ? '#06b6d4' : '#f43f5e';
      html = `
        <div class="relative flex items-center justify-center">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900 border-2" style="border-color: ${color}; box-shadow: 0 0 15px ${color}">
            <span class="text-base">📡</span>
          </div>
          <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${point.status === 'up' ? 'bg-emerald-400' : 'bg-rose-500'} border-2 border-slate-900 animate-ping"></span>
        </div>
      `;
    } else if (isProblem) {
      const isP0 = point.priority === 'P0';
      const bgColor = isP0 ? 'bg-rose-600' : 'bg-amber-500';
      const ringColor = isP0 ? 'border-rose-300' : 'border-amber-200';
      html = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full ${bgColor} opacity-60 animate-ping"></span>
          <div class="relative w-8 h-8 rounded-full ${bgColor} border-2 ${ringColor} flex items-center justify-center text-white font-bold text-xs shadow-lg">
            <span>🚨</span>
          </div>
          ${point.priority ? `<span class="absolute -bottom-2 px-1 rounded text-[9px] font-black bg-slate-950 text-rose-300 border border-rose-700">${point.priority}</span>` : ''}
        </div>
      `;
    } else if (point.status === 'isolated') {
      html = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full bg-slate-900 border-2 border-rose-500 flex items-center justify-center text-xs shadow-md">
            <span>🔒</span>
          </div>
        </div>
      `;
    } else if (point.type === 'customer') {
      const isOnline = point.is_online;
      html = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full bg-slate-900 border-2 ${isOnline ? 'border-emerald-400' : 'border-slate-500'} flex items-center justify-center text-[11px] shadow-md">
            <span>${isOnline ? '🏠' : '⚪'}</span>
          </div>
        </div>
      `;
    } else {
      html = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center text-xs shadow-md">
            <span>🖥️</span>
          </div>
        </div>
      `;
    }

    return L.divIcon({
      html,
      className: 'noc-custom-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  };

  // Google Maps Style Live Pulsing Blue Dot Marker Generator
  const createUserLocationIcon = () => {
    const html = `
      <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
        <span class="absolute w-7 h-7 rounded-full bg-blue-500 opacity-40 animate-ping"></span>
        <span class="absolute w-5 h-5 rounded-full bg-cyan-400 opacity-60 animate-pulse"></span>
        <div class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center">
          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
        </div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'noc-user-location-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  // Reverse Geocode koordinat ke nama Desa, Kecamatan, dan Kota
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { timeout: 5000 }
      );
      const a = res.data?.address || {};
      const desa = a.village || a.suburb || a.neighbourhood || a.hamlet || a.quarter || '';
      const kec = a.subdistrict || a.district || a.city_district || '';
      const kota = a.city || a.town || a.county || a.regency || '';
      const prov = a.state || '';
      const parts = [
        desa ? `Desa/Kel. ${desa}` : '',
        kec ? `Kec. ${kec}` : '',
        kota,
        prov,
      ].filter(Boolean);
      return {
        addressName: parts.length > 0 ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        village: desa,
        subdistrict: kec,
        city: kota,
      };
    } catch {
      return {
        addressName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        village: '',
        subdistrict: '',
        city: '',
      };
    }
  };

  // Pasang / Update Marker Posisi Saya di Peta Leaflet
  const updateUserMarkerOnMap = (lat, lng, accuracy, addrInfo) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const popupHtml = `
      <div style="font-family: sans-serif; min-width: 220px; color: #0f172a; padding: 2px;">
        <div style="display: flex; items-center: center; gap: 6px; margin-bottom: 4px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
          <strong style="color: #0284c7; font-size: 13px;">📍 Posisi Anda Saat Ini</strong>
        </div>
        <div style="font-size: 11px; font-weight: bold; color: #1e293b; margin: 4px 0;">${addrInfo.addressName}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
          Akurasi GPS: &plusmn;${Math.round(accuracy)} meter &bull; (${lat.toFixed(5)}, ${lng.toFixed(5)})
        </div>
        <div style="margin-top: 8px; display: flex; gap: 4px;">
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noreferrer" style="font-size: 10px; color: #0284c7; text-decoration: underline;">
            🧭 Buka di Google Maps
          </a>
        </div>
      </div>
    `;

    // Update / Buat Accuracy Halo Circle
    if (userCircleRef.current) {
      userCircleRef.current.setLatLng([lat, lng]);
      userCircleRef.current.setRadius(Math.max(accuracy, 25));
    } else {
      userCircleRef.current = L.circle([lat, lng], {
        radius: Math.max(accuracy, 25),
        color: '#0284c7',
        fillColor: '#38bdf8',
        fillOpacity: 0.15,
        weight: 1.5,
      }).addTo(map);
    }

    // Update / Buat Blue Dot Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
      userMarkerRef.current.setPopupContent(popupHtml);
    } else {
      const marker = L.marker([lat, lng], {
        icon: createUserLocationIcon(),
        zIndexOffset: 2000,
      }).addTo(map);
      marker.bindPopup(popupHtml);
      userMarkerRef.current = marker;
    }
  };

  // Deteksi Live GPS Pengguna (Browser / HP Geolocation)
  const detectUserLocation = (autoFly = false) => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung fitur Geolocation GPS.');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const geo = await reverseGeocode(latitude, longitude);
        const locData = {
          lat: latitude,
          lng: longitude,
          accuracy,
          addressName: geo.addressName,
          village: geo.village,
          subdistrict: geo.subdistrict,
          city: geo.city,
        };
        setUserLocation(locData);
        updateUserMarkerOnMap(latitude, longitude, accuracy, locData);

        if (autoFly && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1.2 });
        }

        // Jika router NOC saat ini masih default Jakarta, sarankan pindah ke posisi pengguna (misal Jember)
        if (Math.abs(nocCenter.lat - (-6.1754)) < 0.05 && Math.abs(nocCenter.lng - 106.8272) < 0.05) {
          setLocationNotice({
            lat: latitude,
            lng: longitude,
            addressName: geo.addressName,
          });
        }
        setLocatingUser(false);
      },
      (err) => {
        setLocatingUser(false);
        console.warn('GPS reading error:', err.message);
        if (autoFly) {
          alert(
            `GPS belum aktif atau ditolak (${err.message}).\n\nTips:\n1. Pastikan fitur Lokasi di HP/Komputer aktif.\n2. Jika menggunakan HTTP LAN (192.168.x.x), Chrome terkadang membatasi GPS otomatis. Anda bisa langsung gunakan tombol cepat '📍 Jember Pusat' atau ketik nama desa/kecamatan pada pencarian lalu klik peta!`
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  // Pindahkan Router Pusat NOC ke Koordinat GPS Saat Ini
  const handleSetNocToCurrentGPS = async () => {
    if (!userLocation) {
      detectUserLocation(true);
      return;
    }
    if (
      !confirm(
        `Pindahkan Router Pusat NOC ke posisi Anda saat ini di:\n${userLocation.addressName}?\nLat: ${userLocation.lat.toFixed(6)}, Lng: ${userLocation.lng.toFixed(6)}`
      )
    ) {
      return;
    }
    try {
      await axios.put(`${API}/map/noc-location`, { lat: userLocation.lat, lng: userLocation.lng });
      setNocCenter({ lat: userLocation.lat, lng: userLocation.lng, name: 'MikroTik Core Router' });
      setLocationNotice(null);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      }
      alert('✅ Lokasi Router Pusat NOC berhasil dipindahkan ke posisi Anda!');
      loadMapPoints();
    } catch (err) {
      alert('Gagal memindahkan NOC: ' + (err.response?.data?.error || err.message));
    }
  };

  // Lompat Cepat ke Kota/Area Tertentu (misal Jember)
  const jumpToLocation = (lat, lng, zoom = 15, name = '') => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.0 });
    }
  };

  // Sinkronkan Router NOC langsung ke PT Satelit Global Media (Sanggrahan, Curahkalong, Bangsalsari, Jember)
  const handleSyncToPTSatellite = async () => {
    try {
      await axios.put(`${API}/map/noc-location`, {
        lat: -8.130588,
        lng: 113.540639,
        name: 'PT Satelit Global Media (Sanggrahan Curahkalong)',
      });
    } catch (e) {
      console.warn('Backend update notice:', e.message);
    }
    setNocCenter({ lat: -8.130588, lng: 113.540639, name: 'PT Satelit Global Media (Sanggrahan Curahkalong)' });
    setLocationNotice(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-8.130588, 113.540639], 17, { animate: true });
    }
    await loadMapPoints();
    alert('✅ Peta berhasil disinkronkan presisi ke PT Satelit Global Media (Sanggrahan, Curahkalong, Bangsalsari)!');
  };

  // Muat seluruh data peta + device + pelanggan + tiket
  const loadMapPoints = async () => {
    try {
      const [resMap, resDev, resCust, resTick] = await Promise.all([
        axios.get(`${API}/map/points`).catch(() => ({ data: { data: DEMO_POINTS_JEMBER, noc_center: { lat: -8.130588, lng: 113.540639, name: 'PT Satelit Global Media (Sanggrahan Curahkalong)' } } })),
        axios.get(`${API}/devices`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/customers`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/tickets?status=open`).catch(() => ({ data: { data: [] } })),
      ]);

      const rawPts = resMap.data?.data || [];
      const pts = rawPts.length > 0 ? rawPts : DEMO_POINTS_JEMBER;
      setPoints(pts);
      setUnpinnedCustomers(resMap.data?.unpinned_customers || 0);
      setDevices(resDev.data?.data || []);
      setCustomers(resCust.data?.data || []);
      setTickets(resTick.data?.data || []);

      const center = resMap.data?.noc_center || { lat: -8.130588, lng: 113.540639, name: 'PT Satelit Global Media (Sanggrahan Curahkalong)' };
      setNocCenter(center);
      if (!hasCenteredInitiallyRef.current && mapInstanceRef.current && center.lat) {
        hasCenteredInitiallyRef.current = true;
        mapInstanceRef.current.setView([center.lat, center.lng], 16);
      }
    } catch (err) {
      console.warn('Gagal ambil titik map backend, memuat titik akurat Sanggrahan Curahkalong:', err);
      setPoints(DEMO_POINTS_JEMBER);
      const defaultCenter = { lat: -8.130588, lng: 113.540639, name: 'PT Satelit Global Media (Sanggrahan Curahkalong)' };
      setNocCenter(defaultCenter);
      if (!hasCenteredInitiallyRef.current && mapInstanceRef.current) {
        hasCenteredInitiallyRef.current = true;
        mapInstanceRef.current.setView([defaultCenter.lat, defaultCenter.lng], 16);
      }
    } finally {
      setLoading(false);
    }
  };

  // Selesaikan tiket langsung dari popup
  const handleResolveTicket = async (ticketId) => {
    if (!confirm(`Selesaikan tiket #${ticketId} dari peta?`)) return;
    try {
      await axios.patch(`${API}/tickets/${ticketId}/status`, { status: 'resolved' });
      alert('✅ Tiket gangguan berhasil diselesaikan!');
      loadMapPoints();
    } catch (err) {
      alert('Gagal: ' + (err.response?.data?.error || err.message));
    }
  };

  // Ping seluruh node infrastruktur dari server
  const handlePingAll = async () => {
    setPinging(true);
    try {
      const res = await axios.post(`${API}/devices/ping-all`);
      const list = res.data.data || [];
      const downCount = list.filter((d) => d.status === 'down').length;
      alert(`📡 Ping selesai pada ${list.length} node!\n🟢 Online: ${list.length - downCount} | 🔴 Down: ${downCount}`);
      loadMapPoints();
    } catch (err) {
      alert('Gagal ping node: ' + (err.response?.data?.error || err.message));
    } finally {
      setPinging(false);
    }
  };

  // Cari lokasi via OpenStreetMap Nominatim
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingLoc(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`;
      const res = await axios.get(url);
      if (res.data && res.data.length > 0) {
        const hit = res.data[0];
        const lat = parseFloat(hit.lat);
        const lng = parseFloat(hit.lon);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
        }
      } else {
        alert(`Lokasi "${searchQuery}" tidak ditemukan. Coba nama kecamatan/kota lain atau masukkan koordinat (contoh: -6.9175, 107.6191).`);
      }
    } catch {
      alert('Gagal mencari alamat (periksa koneksi internet).');
    } finally {
      setSearchingLoc(false);
    }
  };

  // Deteksi GPS Browser/HP dan jadikan Pusat NOC Router
  const handleUseMyGPSForNoc = () => {
    if (!navigator.geolocation) {
      alert('Browser tidak mendukung Geolocation GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!confirm(`Pasang lokasi Router Pusat (NOC) ke koordinat GPS Anda saat ini?\nLat: ${latitude.toFixed(6)}\nLng: ${longitude.toFixed(6)}`)) {
          return;
        }
        try {
          await axios.put(`${API}/map/noc-location`, { lat: latitude, lng: longitude });
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });
          }
          alert('✅ Koordinat Pusat Router NOC berhasil diperbarui sesuai GPS Anda!');
          loadMapPoints();
        } catch (err) {
          alert('Gagal menyimpan koordinat: ' + (err.response?.data?.error || err.message));
        }
      },
      (err) => {
        alert(`Gagal membaca GPS (${err.message}).\nTips: Pada akses HTTP LAN non-HTTPS, sebagian browser HP memblokir GPS otomatis. Gunakan fitur "Pin Lokasi di Peta" atau cari nama daerah Anda lalu klik langsung di peta!`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Simpan koordinat hasil klik peta sesuai target yang dipilih
  const savePickedCoordinate = async (lat, lng) => {
    const mode = pinModeRef.current;
    if (!mode) return;

    try {
      if (mode.targetType === 'noc') {
        await axios.put(`${API}/map/noc-location`, { lat, lng });
      } else if (mode.targetType === 'device') {
        await axios.patch(`${API}/devices/${encodeURIComponent(mode.targetId)}`, { lat, lng });
      } else if (mode.targetType === 'customer') {
        await axios.patch(`${API}/customers/${mode.targetId}/location`, { lat, lng });
      } else if (mode.targetType === 'ticket') {
        await axios.patch(`${API}/tickets/${mode.targetId}/location`, { lat, lng });
      }
      setPinMode(null);
      await loadMapPoints();
      alert(`✅ Lokasi akurat "${mode.label}" berhasil disimpan ke (${lat.toFixed(6)}, ${lng.toFixed(6)})!`);
    } catch (err) {
      alert('Gagal menyimpan lokasi: ' + (err.response?.data?.error || err.message));
    }
  };

  // Tambah Node Infrastruktur baru
  const handleCreateDevice = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: newDevice.id.trim(),
        name: newDevice.name.trim(),
        ip: newDevice.ip.trim(),
      };
      if (newDevice.lat && newDevice.lng) {
        payload.lat = parseFloat(newDevice.lat);
        payload.lng = parseFloat(newDevice.lng);
      } else if (mapInstanceRef.current) {
        const c = mapInstanceRef.current.getCenter();
        payload.lat = c.lat;
        payload.lng = c.lng;
      }
      await axios.post(`${API}/devices`, payload);
      setNewDevice({ id: '', name: '', ip: '', lat: '', lng: '' });
      setShowDeviceModal(false);
      alert('✅ Node infrastruktur ditambahkan & dipetakan!');
      loadMapPoints();
    } catch (err) {
      alert('Gagal menambah node: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!confirm(`Hapus node infrastruktur "${id}" dari daftar monitoring & peta?`)) return;
    try {
      await axios.delete(`${API}/devices/${encodeURIComponent(id)}`);
      loadMapPoints();
    } catch (err) {
      alert('Gagal menghapus node: ' + (err.response?.data?.error || err.message));
    }
  };

  // Simpan hasil edit koordinat/nama/ip device
  const handleSaveEditDevice = async (e) => {
    e.preventDefault();
    if (!editingDevice) return;
    try {
      const payload = {
        name: editingDevice.name.trim(),
        ip: editingDevice.ip.trim(),
      };
      if (editingDevice.lat !== '' && editingDevice.lng !== '' && !isNaN(editingDevice.lat) && !isNaN(editingDevice.lng)) {
        payload.lat = parseFloat(editingDevice.lat);
        payload.lng = parseFloat(editingDevice.lng);
      }
      await axios.patch(`${API}/devices/${encodeURIComponent(editingDevice.id)}`, payload);
      alert(`✅ Titik koordinat dan info node "${editingDevice.id}" berhasil diperbarui!`);
      setEditingDevice(null);
      await loadMapPoints();
    } catch (err) {
      alert('Gagal update node: ' + (err.response?.data?.error || err.message));
    }
  };

  // Fokuskan peta ke koordinat titik device / pelanggan / tiket tertentu
  const focusOnPoint = (target) => {
    if (!mapInstanceRef.current || !target) return;
    let lat = target.lat != null ? Number(target.lat) : null;
    let lng = target.lng != null ? Number(target.lng) : null;

    if ((lat == null || lng == null || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) && target.id) {
      const d = devices.find((x) => x.id === target.id || x.name === target.id);
      if (d && d.lat && d.lng) {
        lat = Number(d.lat);
        lng = Number(d.lng);
      } else {
        const pt = points.find(
          (p) => p.device_id === target.id || p.id === target.id || p.id === `dev-${target.id}`
        );
        if (pt && pt.lat && pt.lng) {
          lat = Number(pt.lat);
          lng = Number(pt.lng);
        }
      }
    }

    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.0 });
      setTimeout(() => {
        const keys = [
          target.id,
          `dev-${target.id}`,
          `ticket-${target.id}`,
          `cust-${target.id}`,
        ];
        for (const k of keys) {
          if (markersMapRef.current[k]) {
            markersMapRef.current[k].openPopup();
            break;
          }
        }
      }, 1100);
    }
  };

  // Reaksi ketika focusTarget dipicu dari tab lain (Tickets / Customers)
  useEffect(() => {
    if (focusTarget) {
      focusOnPoint(focusTarget);
      if (onClearFocusTarget) {
        onClearFocusTarget();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget, points]);

  // Inisialisasi Map Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const worldBounds = L.latLngBounds([-85, -180], [85, 180]);
      const map = L.map(mapContainerRef.current, {
        center: [nocCenter.lat || -8.130588, nocCenter.lng || 113.540639],
        zoom: 15,
        minZoom: 3,
        maxZoom: 19,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
      });

      const styleConf = MAP_STYLES[mapStyle] || MAP_STYLES.voyager;
      const initialLayer = L.tileLayer(styleConf.url, {
        attribution: styleConf.attribution,
        maxNativeZoom: styleConf.maxNativeZoom || 18,
        maxZoom: 19,
        noWrap: true,
        detectRetina: false,
        keepBuffer: 8,
        updateWhenIdle: false,
      }).addTo(map);
      tileLayerRef.current = initialLayer;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const linksGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);
      linksLayerRef.current = linksGroup;
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      map.on('click', (ev) => {
        if (pinModeRef.current) {
          savePickedCoordinate(ev.latlng.lat, ev.latlng.lng);
        }
      });
    }

    loadMapPoints();
    detectUserLocation(false);
    const interval = setInterval(loadMapPoints, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Layer Tile ketika tema map diganti (tetap tajam & anti-hilang saat zoom)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const styleConf = MAP_STYLES[mapStyle] || MAP_STYLES.voyager;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.backgroundColor = styleConf.bg;
    }
    const newLayer = L.tileLayer(styleConf.url, {
      attribution: styleConf.attribution,
      maxNativeZoom: styleConf.maxNativeZoom || 18,
      maxZoom: 19,
      noWrap: true,
      detectRetina: false,
      keepBuffer: 8,
      updateWhenIdle: false,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Update Markers & Garis Topologi saat points/filter/topology berubah
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !linksLayerRef.current) return;

    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    const linkGroup = linksLayerRef.current;
    group.clearLayers();
    linkGroup.clearLayers();
    markersMapRef.current = {};

    const filtered = points.filter((p) => {
      if (filterType === 'problem') {
        return p.status === 'problem' || p.priority === 'P0' || p.priority === 'P1';
      }
      if (filterType === 'device') {
        return p.type === 'device' || p.type === 'router';
      }
      if (filterType === 'customer') {
        return p.type === 'customer';
      }
      return true;
    });

    const routerPoint = points.find((p) => p.type === 'router');
    const latLngs = [];

    // Gambar garis topologi jika aktif
    if (showTopology && routerPoint) {
      filtered.forEach((p) => {
        if (p.type === 'router' || !p.lat || !p.lng) return;
        const isProb = p.status === 'problem' || p.status === 'isolated';
        const lineColor = isProb ? '#f43f5e' : p.type === 'device' ? '#06b6d4' : '#10b981';
        L.polyline(
          [
            [routerPoint.lat, routerPoint.lng],
            [p.lat, p.lng],
          ],
          {
            color: lineColor,
            weight: isProb ? 2.5 : 1.5,
            opacity: isProb ? 0.85 : 0.45,
            dashArray: isProb ? '6, 6' : undefined,
          }
        ).addTo(linkGroup);
      });
    }

    filtered.forEach((p) => {
      if (!p.lat || !p.lng) return;

      const marker = L.marker([p.lat, p.lng], {
        icon: createMarkerIcon(p),
      });

      markersMapRef.current[p.id] = marker;
      if (p.device_id) {
        markersMapRef.current[`dev-${p.device_id}`] = marker;
        markersMapRef.current[p.device_id] = marker;
      }
      const tID = p.ticket_id || p.ticketID;
      if (tID) {
        markersMapRef.current[`ticket-${tID}`] = marker;
        markersMapRef.current[String(tID)] = marker;
      }
      if (p.customer_id) {
        markersMapRef.current[`cust-${p.customer_id}`] = marker;
        markersMapRef.current[String(p.customer_id)] = marker;
      }

      latLngs.push([p.lat, p.lng]);

      const locBadge =
        p.location_source === 'noc_router'
          ? '📍 Lokasi Router NOC'
          : p.location_source === 'device'
            ? '📍 Lokasi Switch/Node'
            : p.location_source === 'customer'
              ? '📍 Lokasi Rumah Pelanggan'
              : '📍 Koordinat GPS Akurat';

      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1 font-sans';
      popupDiv.innerHTML = `
        <div style="min-width: 240px; color: #0f172a; font-family: sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            <strong style="font-size: 13px; color: ${p.status === 'problem' ? '#e11d48' : '#0284c7'};">${p.title}</strong>
            ${p.priority ? `<span style="background: #e11d48; color: #fff; padding: 2px 6px; border-radius: 9999px; font-weight: bold; font-size: 10px;">${p.priority}</span>` : ''}
          </div>
          <p style="font-size: 11px; color: #334155; margin: 4px 0;">${p.detail || '-'}</p>
          ${p.ip ? `<div style="font-size: 11px; font-family: monospace; color: #0369a1; margin: 2px 0;">IP: ${p.ip}</div>` : ''}
          <div style="font-size: 10px; color: #475569; margin-top: 4px;">${locBadge}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 10px; color: #64748b;">
            <span>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
            <span style="font-weight: bold; color: ${p.status === 'problem' || p.status === 'isolated' ? '#e11d48' : '#059669'}; text-transform: uppercase;">${p.status}</span>
          </div>
          <div style="margin-top: 4px;">
            <a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noreferrer" style="display: inline-block; font-size: 10px; color: #0284c7; text-decoration: underline;">
              🧭 Buka Arah di Google Maps
            </a>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            ${tID ? `
              <button id="btn-resolve-${tID}" style="flex: 1; background: #2563eb; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
                ✓ Selesaikan #${tID}
              </button>
            ` : ''}
            <button id="btn-move-${p.id}" style="flex: 1; background: #0f172a; color: #38bdf8; border: 1px solid #334155; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
              📌 Pindah Titik
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        if (tID) {
          const btn = document.getElementById(`btn-resolve-${tID}`);
          if (btn) btn.onclick = () => handleResolveTicket(tID);
        }
        const moveBtn = document.getElementById(`btn-move-${p.id}`);
        if (moveBtn) {
          moveBtn.onclick = () => {
            marker.closePopup();
            let targetType = 'noc';
            let targetId = '';
            if (p.type === 'device' && p.device_id) {
              targetType = 'device';
              targetId = p.device_id;
            } else if (p.type === 'customer' && p.customer_id) {
              targetType = 'customer';
              targetId = String(p.customer_id);
            } else if (p.type === 'ticket' && tID) {
              targetType = 'ticket';
              targetId = String(tID);
            }
            setPinMode({ targetType, targetId, label: p.title });
          };
        }
      });

      group.addLayer(marker);
    });

    if (latLngs.length > 0 && filterType === 'problem') {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, filterType, showTopology]);

  const centerToNoc = () => {
    if (mapInstanceRef.current && nocCenter.lat) {
      mapInstanceRef.current.setView([nocCenter.lat, nocCenter.lng], 15, { animate: true });
    }
  };

  const problemPoints = points.filter(
    (p) => p.status === 'problem' || p.priority === 'P0' || p.priority === 'P1'
  );
  const deviceCount = points.filter((p) => p.type === 'device' || p.type === 'router').length;
  const customerCount = points.filter((p) => p.type === 'customer').length;

  const startManualPin = () => {
    let label = 'Router Pusat NOC';
    if (pinCategory === 'customer') {
      const c = customers.find((x) => String(x.id) === String(pinTargetId));
      if (!c) return alert('Pilih pelanggan terlebih dahulu!');
      label = `Pelanggan: ${c.name}`;
    } else if (pinCategory === 'device') {
      const d = devices.find((x) => x.id === pinTargetId);
      if (!d) return alert('Pilih node/device terlebih dahulu!');
      label = `Device: ${d.name}`;
    } else if (pinCategory === 'ticket') {
      const t = tickets.find((x) => String(x.id) === String(pinTargetId));
      if (!t) return alert('Pilih tiket terlebih dahulu!');
      label = `Tiket #${t.id}: ${t.title}`;
    }
    setPinMode({ targetType: pinCategory, targetId: pinTargetId, label });
    setShowPinModal(false);
  };

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              🗺️ Peta Titik Gangguan &amp; Topologi Jaringan
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
              LIVE GIS
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Visualisasi koordinat real-time menggunakan CARTO, OSM Jalan Detail, &amp; Satelit Esri hingga zoom rumah pelanggan. Klik <strong className="text-cyan-400">(!)</strong> di samping tombol untuk penjelasan fungsi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="inline-flex items-center">
            <button
              onClick={() => detectUserLocation(true)}
              disabled={locatingUser}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition flex items-center justify-center gap-1.5"
            >
              {locatingUser ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Mencari GPS...</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Posisi Saya (GPS)</span>
                </>
              )}
            </button>
            <HelpTip
              title="Deteksi Lokasi GPS (Google Maps Style)"
              text="Menampilkan titik biru berdenyut persis seperti Google Maps di lokasi Anda saat ini, lengkap dengan nama desa/kelurahan, kecamatan, dan akurasi meter."
              tip="Gunakan tombol ini untuk langsung menemukan posisi Anda di Jember atau lokasi kerja Anda."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={handleSetNocToCurrentGPS}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Router NOC &rarr; GPS</span>
            </button>
            <HelpTip
              title="Pindahkan Router NOC ke Titik GPS Anda"
              text="Menjadikan titik GPS Anda saat ini sebagai koordinat Router Pusat (NOC). Sangat berguna jika server Anda berada di Jember agar tidak lagi di Jakarta."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={handleSyncToPTSatellite}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/80 transition flex items-center justify-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>PT Satelit Global Media (Jember)</span>
            </button>
            <HelpTip
              title="Pusatkan ke PT Satelit Global Media"
              text="Menyelaraskan Router NOC dan seluruh koordinat jaringan langsung ke kantor PT Satelit Global Media di Sanggrahan Curahkalong Bangsalsari, Jember (-8.130588, 113.540639)."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={() => setShowPinModal(true)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Pin / Pindah Lokasi</span>
            </button>
            <HelpTip
              title="Mode Pasang / Koreksi Koordinat Peta"
              text="Memungkinkan Anda memilih Router NOC, Switch/ODP, Rumah Pelanggan, atau Tiket Gangguan lalu mengklik lokasi tepatnya langsung pada peta."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={() => setShowDeviceModal(true)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kelola Node ({devices.length})</span>
            </button>
            <HelpTip
              title="Kelola Node Infrastruktur"
              text="Menambah, melihat, ping manual, atau menghapus perangkat infrastruktur (Switch, OLT, ODP, Tower, Server) yang muncul di peta."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={centerToNoc}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Fokus NOC</span>
            </button>
            <HelpTip
              title="Pusatkan Peta ke Router NOC"
              text="Mengembalikan tampilan peta ke titik koordinat Router Pusat NOC Anda."
            />
          </div>

          <div className="inline-flex items-center">
            <button
              onClick={loadMapPoints}
              disabled={loading}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <HelpTip
              title="Refresh Titik Peta"
              text="Mengambil ulang koordinat dan status terbaru dari server."
            />
          </div>
        </div>
      </div>

      {/* BANNER LIVE GPS POSISI PENGGUNA (DESA / KECAMATAN / KOTA) */}
      {userLocation && (
        <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-cyan-950/90 border border-cyan-700/80 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400 text-blue-300 text-xl shrink-0 shadow-lg">
              <span>📍</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping"></span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                  <span>Posisi Anda (Live Blue Dot):</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold font-mono">
                  &plusmn;{Math.round(userLocation.accuracy)} meter
                </span>
              </div>
              <div className="text-sm font-black text-white tracking-tight mt-0.5 truncate">
                {userLocation.addressName}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Lat: {userLocation.lat.toFixed(6)}, Lng: {userLocation.lng.toFixed(6)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 17, { duration: 1.0 });
                }
              }}
              className="flex-1 md:flex-none px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1"
            >
              <span>🎯</span>
              <span>Pusatkan Peta</span>
            </button>

            <button
              onClick={handleSetNocToCurrentGPS}
              className="flex-1 md:flex-none px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-semibold transition flex items-center justify-center gap-1"
            >
              <span>📡</span>
              <span>Pindah NOC ke Sini</span>
            </button>

            <button
              onClick={() => {
                setNewDevice({
                  id: `NODE-${Date.now().toString().slice(-4)}`,
                  name: `Node ${userLocation.village || 'Area'}`,
                  ip: '192.168.1.1',
                  lat: userLocation.lat.toFixed(6),
                  lng: userLocation.lng.toFixed(6),
                });
                setShowDeviceModal(true);
              }}
              className="flex-1 md:flex-none px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold transition flex items-center justify-center gap-1"
            >
              <span>➕</span>
              <span>Pasang Device di Sini</span>
            </button>
          </div>
        </div>
      )}

      {/* NOTIFIKASI RELOKASI NOC DARI JAKARTA KE JEMBER / POSISI NYATA */}
      {locationNotice && (
        <div className="bg-amber-950/80 border-2 border-amber-600/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="text-xs text-amber-100 space-y-1">
            <div className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Router Pusat Masih Berada di Jakarta Default (-6.1754, 106.8272)</span>
            </div>
            <div>
              Lokasi Anda terdeteksi di: <strong>{locationNotice.addressName}</strong>. Pindahkan Router NOC ke lokasi Anda agar device, topologi, dan pelanggan muncul sesuai wilayah kerja Anda!
            </div>
          </div>
          <button
            onClick={handleSetNocToCurrentGPS}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>⚡</span>
            <span>Pindahkan Router NOC ke Sini</span>
          </button>
        </div>
      )}

      {/* SEARCH BAR + AREA PRESETS (JEMBER, SURABAYA, JAKARTA) + TOPOLOGY */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <form onSubmit={handleSearchLocation} className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari desa, kecamatan, kota (misal: Kaliwates Jember, Patrang, Sumbersari)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={searchingLoc}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shrink-0"
            >
              {searchingLoc ? 'Mencari...' : '🔍 Cari Area'}
            </button>
            <HelpTip
              title="Cari Nama Wilayah / Jalan"
              text="Memindahkan tampilan peta langsung ke kota, kecamatan, atau jalan tempat jaringan Anda beroperasi menggunakan OpenStreetMap Geocoder."
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center">
              <button
                onClick={() => setShowTopology((v) => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${showTopology
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
              >
                🔗 Garis Topologi: {showTopology ? 'ON' : 'OFF'}
              </button>
              <HelpTip
                title="Garis Jalur Topologi Jaringan"
                text="Menampilkan garis penghubung dari Router Pusat NOC ke setiap node perangkat & pelanggan. Garis merah putus-putus menandakan titik sedang bermasalah/terisolir."
              />
            </div>

            <div className="inline-flex items-center">
              <button
                onClick={handlePingAll}
                disabled={pinging}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shadow"
              >
                {pinging ? '⏳ Mengecek...' : '📡 Ping Semua Node'}
              </button>
              <HelpTip
                title="Ping Semua Node Infrastruktur"
                text="Mengetes konektivitas ICMP ping langsung dari server ke seluruh Switch/Router/Server terdaftar dan otomatis memperbarui status UP/DOWN serta tiket P0."
              />
            </div>
          </div>
        </div>

        {/* PRESET CHIP KOTA CEPAT (LOMPAT CEPAT TANPA KETIK) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs text-slate-400">
          <span className="text-[11px] font-bold text-slate-500 shrink-0">📍 Lompat Cepat:</span>
          <button
            type="button"
            onClick={() => jumpToLocation(-8.130588, 113.540639, 17, 'PT Satelit Global Media (Sanggrahan Curahkalong)')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
          >
            🏢 PT SGM (Sanggrahan Curahkalong)
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-8.1724, 113.6995, 14, 'Alun-alun Jember')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-cyan-300 text-[11px] font-semibold transition"
          >
            🏛️ Alun-alun Jember
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-8.1845, 113.6688, 14, 'Kaliwates Jember')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-slate-300 text-[11px] transition"
          >
            🏘️ Kaliwates
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-8.1633, 113.7169, 14, 'Sumbersari Jember')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-slate-300 text-[11px] transition"
          >
            🎓 Sumbersari
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-8.1517, 113.7022, 14, 'Patrang Jember')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-700 text-slate-300 text-[11px] transition"
          >
            🏥 Patrang
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-7.2575, 112.7521, 13, 'Surabaya')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-[11px] transition"
          >
            🏙️ Surabaya
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(-6.1754, 106.8272, 13, 'Jakarta')}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-[11px] transition"
          >
            🗼 Jakarta
          </button>
          {userLocation && (
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 17, { duration: 1.0 });
                }
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 text-[11px] font-bold transition flex items-center gap-1"
            >
              <span>🎯</span>
              <span>Posisi Saya ({userLocation.village || 'GPS'})</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER AKTIF SAAT MODE PIN LOKASI */}
      {pinMode && (
        <div className="bg-amber-950/90 border-2 border-amber-500 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-pulse shadow-lg">
          <div className="text-xs text-amber-100">
            <strong className="text-amber-300 text-sm block">📌 MODE PIN LOKASI AKTIF: {pinMode.label}</strong>
            Silakan geser/zoom peta ke posisi rumah/tiang sebenarnya, lalu <strong>KLIK DI ATAS PETA</strong> untuk menyimpan koordinat akurat!
          </div>
          <button
            onClick={() => setPinMode(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white border border-amber-600 text-xs font-bold shrink-0"
          >
            Batal
          </button>
        </div>
      )}

      {/* PERINGATAN PELANGGAN BELUM DIPIN */}
      {unpinnedCustomers > 0 && (
        <div className="bg-slate-900 border border-amber-800/70 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <span className="text-amber-300">
            ℹ️ Ada <strong>{unpinnedCustomers} pelanggan</strong> yang belum dipasang titik koordinat GPS rumah. Untuk menjaga akurasi, titik acak tidak ditampilkan.
          </span>
          <button
            onClick={() => {
              setPinCategory('customer');
              setShowPinModal(true);
            }}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] shrink-0"
          >
            📌 Pasang Koordinat Pelanggan
          </button>
        </div>
      )}

      {/* STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/90 border border-rose-900/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Titik Gangguan Aktif</span>
            <strong className="text-xl text-rose-400 font-black">{problemPoints.length} Titik</strong>
          </div>
          <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Node Infrastruktur</span>
            <strong className="text-xl text-cyan-400 font-black">{deviceCount} Node</strong>
          </div>
          <span className="text-xl">🖥️</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Pelanggan Terpetakan</span>
            <strong className="text-xl text-emerald-400 font-black">{customerCount} CPE</strong>
          </div>
          <span className="text-xl">🏠</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Koordinat NOC Pusat</span>
            <strong className="text-[11px] text-cyan-300 font-mono">
              {Number(nocCenter.lat || 0).toFixed(4)}, {Number(nocCenter.lng || 0).toFixed(4)}
            </strong>
          </div>
          <span className="text-xl">📡</span>
        </div>
      </div>

      {/* QUICK DEVICE MAP CHIPS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>📍 Titik Device Infrastruktur ({devices.length}):</span>
            <span className="text-[11px] text-slate-400 font-normal hidden md:inline">
              Klik device untuk langsung terbang dan memusatkan peta ke titik lokasinya
            </span>
          </div>
          <button
            onClick={() => setShowDeviceModal(true)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
          >
            <span>⚙️ Kelola Titik Node</span>
            <span>&rarr;</span>
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={centerToNoc}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-800/80 text-cyan-300 text-xs font-semibold transition shadow-sm"
          >
            <span>📡</span>
            <span>NOC Router</span>
            <span className="text-[10px] font-mono text-cyan-400/80">({Number(nocCenter.lat || 0).toFixed(4)}, {Number(nocCenter.lng || 0).toFixed(4)})</span>
          </button>
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => focusOnPoint({ id: d.id, lat: d.lat, lng: d.lng, type: 'device' })}
              title={`Fokus ke ${d.name} (${d.ip})`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm ${d.status === 'down'
                  ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-700 text-rose-300'
                  : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${d.status === 'down' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`}></span>
              <span>{d.name}</span>
              <span className="text-[10px] font-mono text-slate-400">
                {d.lat && d.lng ? `(${Number(d.lat).toFixed(4)}, ${Number(d.lng).toFixed(4)})` : '⚠️ Belum Dipin'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* MAP WRAPPER WITH CONTROLS OVERLAY */}
      <div
        className={`relative border rounded-2xl overflow-hidden shadow-2xl h-[520px] md:h-[600px] ${pinMode ? 'border-amber-500 ring-2 ring-amber-500/40 cursor-crosshair' : 'border-slate-800'
          }`}
        style={{ backgroundColor: (MAP_STYLES[mapStyle] || MAP_STYLES.voyager).bg }}
      >
        {/* MOBILE CONTROLS OVERLAY */}
        <div className="md:hidden absolute top-2.5 left-2.5 right-2.5 z-[1000] space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-950/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl text-xs font-semibold whitespace-nowrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition ${filterType === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
            >
              Semua ({points.length})
            </button>
            <button
              onClick={() => setFilterType('problem')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${filterType === 'problem' ? 'bg-rose-600 text-white shadow' : 'text-rose-400'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
              Gangguan ({problemPoints.length})
            </button>
            <button
              onClick={() => setFilterType('device')}
              className={`px-3 py-1.5 rounded-lg transition ${filterType === 'device' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'}`}
            >
              Node/Router
            </button>
            <button
              onClick={() => setFilterType('customer')}
              className={`px-3 py-1.5 rounded-lg transition ${filterType === 'customer' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}
            >
              Pelanggan
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-950/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl text-[11px] font-semibold whitespace-nowrap">
            {Object.values(MAP_STYLES).map((st) => (
              <button
                key={st.id}
                onClick={() => setMapStyle(st.id)}
                className={`px-2.5 py-1 rounded-lg transition ${mapStyle === st.id ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'}`}
              >
                {st.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP CONTROLS OVERLAY */}
        <div className="hidden md:flex absolute top-4 left-4 z-[1000] flex-wrap items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl text-xs font-semibold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Semua Titik ({points.length})
          </button>
          <button
            onClick={() => setFilterType('problem')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${filterType === 'problem' ? 'bg-rose-600 text-white shadow' : 'text-rose-400 hover:text-white'}`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
            Hanya Gangguan ({problemPoints.length})
          </button>
          <button
            onClick={() => setFilterType('device')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'device' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Infrastruktur &amp; Router
          </button>
          <button
            onClick={() => setFilterType('customer')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'customer' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Pelanggan CPE
          </button>
        </div>

        <div className="hidden md:flex absolute top-4 right-4 z-[1000] items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl text-xs font-semibold">
          {Object.values(MAP_STYLES).map((st) => (
            <button
              key={st.id}
              onClick={() => setMapStyle(st.id)}
              title={`Ubah tampilan peta ke ${st.name}`}
              className={`px-2.5 py-1.5 rounded-lg transition ${mapStyle === st.id ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {st.name}
            </button>
          ))}
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 shadow-xl text-[11px] text-slate-300 space-y-1.5 font-sans hidden sm:block">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between gap-4">
            <span>Legenda Marker</span>
            <span className="text-emerald-400 font-mono">MAX ZOOM 21</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
            <span>Merah: Gangguan / Down / Isolir</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            <span>Sian: Router NOC &amp; Switch/ODP</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            <span>Hijau: Pelanggan PPPoE Online</span>
          </div>
        </div>

        {/* Floating Google Maps Style 'My Location' FAB */}
        <button
          type="button"
          onClick={() => detectUserLocation(true)}
          disabled={locatingUser}
          title="Fokuskan ke Posisi GPS Saya Saat Ini (Live Blue Dot)"
          className="absolute bottom-5 right-5 z-[1000] w-12 h-12 rounded-full bg-slate-900/95 hover:bg-slate-800 text-cyan-400 hover:text-white border-2 border-cyan-500/80 shadow-2xl flex items-center justify-center text-xl transition transform active:scale-90"
        >
          {locatingUser ? (
            <span className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <span>🎯</span>
          )}
        </button>

        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>

      {/* MODAL PILIH TARGET UNTUK MODE PIN LOKASI AKURAT */}
      {showPinModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">📌 Pasang / Koreksi Titik di Peta</h3>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">1. Jenis Objek yang Dipindah / Dipin:</label>
                <select
                  value={pinCategory}
                  onChange={(e) => {
                    setPinCategory(e.target.value);
                    setPinTargetId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium"
                >
                  <option value="noc">📡 Router Pusat NOC (MikroTik Hub)</option>
                  <option value="customer">🏠 Rumah Pelanggan PPPoE</option>
                  <option value="device">🖥️ Node Infrastruktur (Switch / ODP / Server)</option>
                  <option value="ticket">🚨 Titik Lokasi Tiket Gangguan</option>
                </select>
              </div>

              {pinCategory === 'customer' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">2. Pilih Pelanggan:</label>
                  <select
                    value={pinTargetId}
                    onChange={(e) => setPinTargetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.pppoe_user}) {c.lat ? '📍' : '⚠️ Belum dipin'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {pinCategory === 'device' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">2. Pilih Node Infrastruktur:</label>
                  <select
                    value={pinTargetId}
                    onChange={(e) => setPinTargetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">-- Pilih Node --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.ip})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {pinCategory === 'ticket' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">2. Pilih Tiket Aktif:</label>
                  <select
                    value={pinTargetId}
                    onChange={(e) => setPinTargetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">-- Pilih Tiket --</option>
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} - {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={startManualPin}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl shadow"
              >
                Aktifkan Klik Peta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KELOLA NODE INFRASTRUKTUR (TAMBAH / EDIT / HAPUS SWITCH / ODP / SERVER) */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🖥️</span>
                  <span>Kelola &amp; Pemetaan Titik Node Device</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Atur koordinat GPS masing-masing perangkat Switch, Router, Tower, ODP, dan Server
                </p>
              </div>
              <button onClick={() => setShowDeviceModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            {/* Pencarian Node */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari ID, Nama, atau IP Device..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {deviceSearch && (
                <button
                  onClick={() => setDeviceSearch('')}
                  className="px-2.5 py-2 text-xs bg-slate-800 text-slate-300 rounded-xl hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Daftar Node Eksisting */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span>Daftar Node Terdaftar ({devices.length}):</span>
                <span className="text-[10px] text-cyan-400 font-normal">Klik '🎯 Fokus' untuk melihat titik di peta</span>
              </div>
              {devices.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 bg-slate-950 rounded-xl text-center">Belum ada node infrastruktur terdaftar.</div>
              ) : (
                <div className="divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-xl max-h-72 overflow-y-auto">
                  {devices
                    .filter((d) => {
                      if (!deviceSearch.trim()) return true;
                      const q = deviceSearch.toLowerCase();
                      return (
                        d.id.toLowerCase().includes(q) ||
                        d.name.toLowerCase().includes(q) ||
                        d.ip.toLowerCase().includes(q)
                      );
                    })
                    .map((d) => (
                      <div key={d.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-900/50 transition">
                        <div className="min-w-0">
                          <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full ${d.status === 'down' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`}></span>
                            <span className="text-sm">{d.name}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-bold">
                              {d.id}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-cyan-300">IP: {d.ip}</span>
                            <span>&bull;</span>
                            <span className={d.lat && d.lng ? 'text-emerald-400' : 'text-amber-400 font-semibold'}>
                              {d.lat && d.lng ? `📍 ${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}` : '⚠️ Titik belum dipin'}
                            </span>
                            {d.last_ping && <span>&bull; Ping: {d.last_ping}</span>}
                          </div>
                        </div>

                        {/* Aksi Cepat Device */}
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeviceModal(false);
                              focusOnPoint({ id: d.id, lat: d.lat, lng: d.lng, type: 'device' });
                            }}
                            title="Pusatkan dan zoom peta ke titik device ini"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-800 text-blue-300 text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                          >
                            <span>🎯</span>
                            <span>Fokus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowDeviceModal(false);
                              setPinMode({ targetType: 'device', targetId: d.id, label: d.name });
                            }}
                            title="Klik lokasi baru langsung di atas peta untuk device ini"
                            className="px-2.5 py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <span>📌</span>
                            <span>Pin Peta</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingDevice({
                                id: d.id,
                                name: d.name,
                                ip: d.ip,
                                lat: d.lat != null ? String(d.lat) : '',
                                lng: d.lng != null ? String(d.lng) : '',
                              });
                            }}
                            title="Edit nama, IP, atau ketik koordinat Lat/Lng manual"
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>

                          {d.lat && d.lng && (
                            <a
                              href={`https://www.google.com/maps?q=${d.lat},${d.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Buka navigasi Google Maps di HP / tab baru"
                              className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition"
                            >
                              <span>🧭</span>
                              <span className="hidden sm:inline">G-Maps</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(d.id)}
                            title="Hapus node dari pemantauan"
                            className="px-2 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-850 text-rose-300 text-[11px] font-semibold transition"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Form Tambah Node Baru */}
            <form onSubmit={handleCreateDevice} className="border-t border-slate-800 pt-4 space-y-3 text-xs">
              <div className="font-bold text-cyan-400 flex items-center justify-between">
                <span>+ Tambah Node Baru</span>
                <span className="text-[10px] text-slate-400 font-normal">Otomatis dipasang di posisi tengah peta saat ini bila Lat/Lng kosong</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  required
                  placeholder="ID Node (mis: SW-CORE-02, ODP-01)"
                  value={newDevice.id}
                  onChange={(e) => setNewDevice({ ...newDevice, id: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500"
                />
                <input
                  required
                  placeholder="Nama (mis: Switch Core Lantai 2)"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500"
                />
                <input
                  required
                  placeholder="IP Ping (mis: 192.168.10.1)"
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice({ ...newDevice, ip: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Latitude opsional (mis: -8.1724)"
                  value={newDevice.lat}
                  onChange={(e) => setNewDevice({ ...newDevice, lat: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
                <input
                  type="text"
                  placeholder="Longitude opsional (mis: 113.6995)"
                  value={newDevice.lng}
                  onChange={(e) => setNewDevice({ ...newDevice, lng: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (userLocation) {
                      setNewDevice({
                        ...newDevice,
                        lat: userLocation.lat.toFixed(6),
                        lng: userLocation.lng.toFixed(6),
                      });
                    } else {
                      detectUserLocation(false);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>📍</span>
                  <span>{userLocation ? `Pakai GPS Saya (${userLocation.village || 'Saat Ini'})` : 'Ambil Koordinat GPS Saya'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      const c = mapInstanceRef.current.getCenter();
                      setNewDevice({ ...newDevice, lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) });
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>🎯</span>
                  <span>Gunakan Tengah Peta</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow transition"
              >
                + Simpan Node Infrastruktur ke Peta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT KOORDINAT & INFO DEVICE */}
      {editingDevice && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📍</span>
                  <span>Edit Titik Lokasi Device</span>
                </h3>
                <span className="text-[11px] font-mono text-cyan-400">{editingDevice.id}</span>
              </div>
              <button
                onClick={() => setEditingDevice(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditDevice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nama Device / Node:</label>
                <input
                  required
                  type="text"
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">IP Address Monitor:</label>
                <input
                  required
                  type="text"
                  value={editingDevice.ip}
                  onChange={(e) => setEditingDevice({ ...editingDevice, ip: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Latitude (Lintang):</label>
                  <input
                    type="text"
                    placeholder="-6.2088"
                    value={editingDevice.lat}
                    onChange={(e) => setEditingDevice({ ...editingDevice, lat: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Longitude (Bujur):</label>
                  <input
                    type="text"
                    placeholder="106.8456"
                    value={editingDevice.lng}
                    onChange={(e) => setEditingDevice({ ...editingDevice, lng: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (userLocation) {
                      setEditingDevice({
                        ...editingDevice,
                        lat: userLocation.lat.toFixed(6),
                        lng: userLocation.lng.toFixed(6),
                      });
                    } else {
                      detectUserLocation(false);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>📍</span>
                  <span>{userLocation ? `Pakai GPS Saya (${userLocation.village || 'Saat Ini'})` : 'Ambil GPS Saya'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      const c = mapInstanceRef.current.getCenter();
                      setEditingDevice({
                        ...editingDevice,
                        lat: c.lat.toFixed(6),
                        lng: c.lng.toFixed(6),
                      });
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>🎯</span>
                  <span>Tengah Peta</span>
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow transition"
                >
                  Simpan Titik Peta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
