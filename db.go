package main

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	InitDBWithDSN("./netguard.db?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
}

func InitDBWithDSN(dsn string) {
	var err error
	DB, err = sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatalf("Gagal konek DB: %v", err)
	}

	query := `
	CREATE TABLE IF NOT EXISTS tickets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		priority TEXT DEFAULT 'P2',
		status TEXT DEFAULT 'open',
		device_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS customers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		address TEXT,
		phone TEXT,
		package TEXT DEFAULT '10Mbps',
		pppoe_user TEXT UNIQUE NOT NULL,
		pppoe_pass TEXT NOT NULL,
		ip_address TEXT,
		status TEXT DEFAULT 'active',
		due_date DATE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS invoices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER NOT NULL,
		period TEXT NOT NULL,
		amount INTEGER NOT NULL,
		status TEXT DEFAULT 'unpaid',
		paid_at DATETIME,
		due_date DATE NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (customer_id) REFERENCES customers(id)
	);

	CREATE TABLE IF NOT EXISTS firewall_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_id INTEGER,
		action TEXT NOT NULL,
		ip_address TEXT,
		reason TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS monitored_devices (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		ip TEXT NOT NULL,
		status TEXT DEFAULT 'up',
		last_ping DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := DB.Exec(query); err != nil {
		log.Fatalf("Gagal bikin tabel: %v", err)
	}

	// Auto-migrate kolom lat & lng untuk Peta Geolocation NOC
	_, _ = DB.Exec("ALTER TABLE tickets ADD COLUMN lat REAL")
	_, _ = DB.Exec("ALTER TABLE tickets ADD COLUMN lng REAL")
	_, _ = DB.Exec("ALTER TABLE monitored_devices ADD COLUMN lat REAL")
	_, _ = DB.Exec("ALTER TABLE monitored_devices ADD COLUMN lng REAL")
	_, _ = DB.Exec("ALTER TABLE customers ADD COLUMN lat REAL")
	_, _ = DB.Exec("ALTER TABLE customers ADD COLUMN lng REAL")

	// Inisialisasi default monitored devices jika tabel masih benar-benar kosong
	initDefaultDevices()

	// Inisialisasi default settings MikroTik & NOC jika belum ada (Presisi: Sanggrahan, Curahkalong, Bangsalsari, Jember)
	initDefaultSetting("admin_user", "admin")
	initDefaultSetting("admin_pass", "syaiful_admin")
	initDefaultSetting("mikrotik_host", "192.168.88.1")
	initDefaultSetting("mikrotik_port", "8728")
	initDefaultSetting("mikrotik_user", "admin")
	initDefaultSetting("mikrotik_pass", "")
	initDefaultSetting("mikrotik_tls", "false")
	initDefaultSetting("noc_lat", "-8.130588")
	initDefaultSetting("noc_lng", "113.540639")
	initDefaultSetting("noc_name", "PT Satelit Global Media (Sanggrahan Curahkalong)")

	// Auto-migrate password admin jika masih default lama atau rois_admin
	_, _ = DB.Exec("UPDATE settings SET value = 'syaiful_admin' WHERE key = 'admin_pass' AND (value = 'admin123' OR value = 'admin_rois' OR value = '' OR value = 'admin')")

	// Auto-migrate jika settings koordinat masih menunjuk ke titik lama (-8.1969 atau -6.1754)
	_, _ = DB.Exec("UPDATE settings SET value = '-8.130588' WHERE key = 'noc_lat' AND (value LIKE '-6.17%' OR value LIKE '-8.19%' OR value = '-6.1754' OR value = '-8.1969')")
	_, _ = DB.Exec("UPDATE settings SET value = '113.540639' WHERE key = 'noc_lng' AND (value LIKE '106.82%' OR value = '113.5283' OR value = '106.8272')")
	_, _ = DB.Exec("UPDATE settings SET value = 'PT Satelit Global Media (Sanggrahan Curahkalong)' WHERE key = 'noc_name'")

	// Auto-migrate monitored devices ke titik akurat Sanggrahan Curahkalong Bangsalsari
	_, _ = DB.Exec("UPDATE monitored_devices SET id='SW-BGS-01', name='Switch Lapangan Sanggrahan', ip='192.168.88.2', lat=-8.1298, lng=113.5408 WHERE id='SW-JKT-01' OR id='SW-BGS-01'")
	_, _ = DB.Exec("UPDATE monitored_devices SET id='ODP-BGS-01', name='ODP Curahkalong Krajan', ip='192.168.88.3', lat=-8.1285, lng=113.5406 WHERE id='RTR-SBY-01' OR id='ODP-BGS-01'")
	_, _ = DB.Exec("UPDATE monitored_devices SET id='SRV-SGM-01', name='Server PT Satelit Global Media', ip='192.168.88.10', lat=-8.130588, lng=113.540639 WHERE id='SRV-DC-01' OR id='SRV-SGM-01'")

	// Auto-migrate tiket gangguan agar presisi di Curahkalong Bangsalsari
	_, _ = DB.Exec("UPDATE tickets SET lat = -8.130588, lng = 113.540639 WHERE lat BETWEEN -8.25 AND -8.18 OR lat BETWEEN -6.3 AND -6.1")

	log.Println("✅ Database SQLite & semua tabel siap!")
}

func initDefaultDevices() {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM monitored_devices").Scan(&count)
	if count == 0 {
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "SW-BGS-01", "Switch Distribusi Bangsalsari", "192.168.88.2", "up", -8.1975, 113.5290)
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "ODP-BGS-01", "ODP Bangsal Pasar", "192.168.88.3", "up", -8.1950, 113.5270)
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "SRV-SGM-01", "Server PT Satelit Global Media", "192.168.88.10", "up", -8.1969, 113.5283)
	}
}

func initDefaultSetting(key, defValue string) {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM settings WHERE key = ?", key).Scan(&count)
	if count == 0 {
		DB.Exec("INSERT INTO settings (key, value) VALUES (?, ?)", key, defValue)
	}
}

func GetSetting(key, defValue string) string {
	var val string
	err := DB.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
	if err != nil || val == "" {
		return defValue
	}
	return val
}

func SetSetting(key, val string) error {
	_, err := DB.Exec("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, val)
	return err
}
