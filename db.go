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

	// Inisialisasi default settings MikroTik & NOC jika belum ada
	initDefaultSetting("admin_user", "admin")
	initDefaultSetting("admin_pass", "admin123")
	initDefaultSetting("mikrotik_host", "192.168.88.1")
	initDefaultSetting("mikrotik_port", "8728")
	initDefaultSetting("mikrotik_user", "admin")
	initDefaultSetting("mikrotik_pass", "")
	initDefaultSetting("mikrotik_tls", "false")
	initDefaultSetting("noc_lat", "-8.1969")
	initDefaultSetting("noc_lng", "113.5283")
	initDefaultSetting("noc_name", "PT Satelit Global Media (Bangsalsari Jember)")

	log.Println("✅ Database SQLite & semua tabel siap!")
}

func initDefaultDevices() {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM monitored_devices").Scan(&count)
	if count == 0 {
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "SW-JKT-01", "Switch Core JKT", "8.8.8.8", "up", -6.2088, 106.8456)
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "RTR-SBY-01", "Router Surabaya", "1.1.1.1", "up", -7.2575, 112.7521)
		DB.Exec("INSERT INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", "SRV-DC-01", "Server DC-01", "192.168.1.100", "up", -6.2928, 106.8122)
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
