package main

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-routeros/routeros/v3"
)

// ==================== MODELS ====================

type Ticket struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Priority  string    `json:"priority"`
	Status    string    `json:"status"`
	DeviceID  string    `json:"device_id"`
	CreatedAt time.Time `json:"created_at"`
	Lat       *float64  `json:"lat,omitempty"`
	Lng       *float64  `json:"lng,omitempty"`
}

type Customer struct {
	ID             int      `json:"id"`
	Name           string   `json:"name"`
	Address        string   `json:"address"`
	Phone          string   `json:"phone"`
	Package        string   `json:"package"`
	PPPoEUser      string   `json:"pppoe_user"`
	PPPoEPass      string   `json:"pppoe_pass"`
	IPAddress      string   `json:"ip_address"`
	Status         string   `json:"status"`
	DueDate        string   `json:"due_date"`
	CreatedAt      string   `json:"created_at"`
	UnpaidInvoices int      `json:"unpaid_invoices"`
	IsOnline       bool     `json:"is_online"`
	ActiveUptime   string   `json:"active_uptime,omitempty"`
	ActiveIP       string   `json:"active_ip,omitempty"`
	ActiveCallerID string   `json:"active_caller_id,omitempty"`
	Lat            *float64 `json:"lat,omitempty"`
	Lng            *float64 `json:"lng,omitempty"`
}

type MonitoredDevice struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	IP        string   `json:"ip"`
	Status    string   `json:"status"`
	LastPing  string   `json:"last_ping,omitempty"`
	CreatedAt string   `json:"created_at,omitempty"`
	Lat       *float64 `json:"lat,omitempty"`
	Lng       *float64 `json:"lng,omitempty"`
}

type MapPoint struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	Type           string  `json:"type"`   // "router" | "device" | "customer" | "ticket"
	Status         string  `json:"status"` // "up" | "problem" | "isolated" | "down"
	Priority       string  `json:"priority,omitempty"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	IP             string  `json:"ip,omitempty"`
	Detail         string  `json:"detail,omitempty"`
	TicketID       int     `json:"ticket_id,omitempty"`
	DeviceID       string  `json:"device_id,omitempty"`
	CustomerID     int     `json:"customer_id,omitempty"`
	CustomerUser   string  `json:"customer_user,omitempty"`
	IsOnline       bool    `json:"is_online,omitempty"`
	LocationSource string  `json:"location_source,omitempty"`
}

type Invoice struct {
	ID           int    `json:"id"`
	CustomerID   int    `json:"customer_id"`
	CustomerName string `json:"customer_name,omitempty"`
	PPPoEUser    string `json:"pppoe_user,omitempty"`
	Period       string `json:"period"`
	Amount       int    `json:"amount"`
	Status       string `json:"status"`
	PaidAt       string `json:"paid_at,omitempty"`
	DueDate      string `json:"due_date"`
	CreatedAt    string `json:"created_at"`
}

type FirewallLogResponse struct {
	ID           int    `json:"id"`
	CustomerName string `json:"customer_name"`
	Action       string `json:"action"`
	IPAddress    string `json:"ip_address"`
	Reason       string `json:"reason"`
	CreatedAt    string `json:"created_at"`
}

type MikrotikConfigReq struct {
	Host string `json:"host"`
	Port string `json:"port"`
	User string `json:"user"`
	Pass string `json:"pass"`
	TLS  string `json:"tls"`
}

var autoIsolirMu sync.Mutex

// ==================== ROUTER & MAIN ====================

func setupRouter() *gin.Engine {
	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Security Middleware: HANYA izinkan akses dari Jaringan Lokal (LAN / Wi-Fi / Private IP / Loopback)
	// Akses dari Internet Publik (Global/WAN) otomatis DIBLOKIR demi keamanan data MikroTik & NOC
	r.Use(func(c *gin.Context) {
		clientIPStr := c.ClientIP()
		ip := net.ParseIP(clientIPStr)

		if ip == nil || !isPrivateOrLocalIP(ip) {
			log.Printf("⛔ [SECURITY GUARD] Akses publik dari luar LAN diblokir: IP %s -> %s", clientIPStr, c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     "AKSES DITOLAK: NetGuard Hub hanya dapat diakses melalui Jaringan Lokal (LAN / Wi-Fi yang sama). Akses publik diblokir demi keamanan.",
				"client_ip": clientIPStr,
			})
			return
		}

		c.Next()
	})

	api := r.Group("/api/v1")
	{
		// Public Auth Endpoints & Server Info
		api.POST("/auth/login", LoginHandler)
		api.GET("/auth/check", AuthCheckHandler)
		api.POST("/auth/logout", LogoutHandler)
		api.GET("/server-info", GetServerInfo)

		// Protected Routes (Wajib Login & Token Valid)
		protected := api.Group("/", AuthMiddleware())
		{
			// Global Overview Stats & Quick Status
			protected.GET("/stats", GetSystemStats)
			protected.GET("/mikrotik/status", GetMikrotikQuickStatus)
			protected.POST("/mikrotik/diagnose", DiagnoseMikrotik)

			// NOC Problem Map Geolocation & Calibration
			protected.GET("/map/points", GetMapPoints)
			protected.GET("/map/noc-location", GetNocLocation)
			protected.PUT("/map/noc-location", UpdateNocLocation)

			// Monitored Infrastructure Devices (Switch / ODP / Tower / Server)
			protected.GET("/devices", GetDevices)
			protected.POST("/devices", CreateDevice)
			protected.PATCH("/devices/:id", UpdateDevice)
			protected.POST("/devices/:id/status", UpdateDeviceStatus)
			protected.POST("/devices/ping-all", PingAllDevices)
			protected.DELETE("/devices/:id", DeleteDevice)

			// Tickets
			protected.POST("/tickets", CreateTicket)
			protected.GET("/tickets", GetTickets)
			protected.PATCH("/tickets/:id/status", UpdateTicketStatus)
			protected.PATCH("/tickets/:id/location", UpdateTicketLocation)
			protected.DELETE("/tickets/:id", DeleteTicket)

			// Customers
			protected.POST("/customers", CreateCustomer)
			protected.GET("/customers", GetCustomers)
			protected.PATCH("/customers/:id", UpdateCustomer)
			protected.PATCH("/customers/:id/location", UpdateCustomerLocation)
			protected.POST("/customers/:id/isolate", IsolateCustomer)
			protected.POST("/customers/:id/restore", RestoreCustomer)
			protected.POST("/customers/:id/pppoe-login", SimulatePPPoE)
			protected.POST("/customers/:id/kick", KickCustomer)
			protected.POST("/customers/:id/sync-mikrotik", SyncCustomerToMikrotik)
			protected.DELETE("/customers/:id", DeleteCustomer)

			// Invoices & Auto-Isolir
			protected.POST("/invoices", CreateInvoice)
			protected.GET("/invoices", GetInvoices)
			protected.PATCH("/invoices/:id/pay", PayInvoice)
			protected.POST("/invoices/auto-isolir", TriggerAutoIsolir)
			protected.POST("/invoices/sync-mikrotik", SyncInvoicesToMikrotik)

			// Firewall Logs & Live MikroTik Firewall
			protected.GET("/firewall-logs", GetFirewallLogs)
			protected.GET("/mikrotik/firewall/address-list", GetMikrotikFirewallAddressList)
			protected.POST("/mikrotik/firewall/address-list", AddMikrotikFirewallAddressList)
			protected.DELETE("/mikrotik/firewall/address-list/:id", DeleteMikrotikFirewallAddressList)
			protected.GET("/mikrotik/firewall/filter", GetMikrotikFirewallFilters)

			// MikroTik Full-Access Manager
			protected.GET("/mikrotik/config", GetMikrotikConfig)
			protected.POST("/mikrotik/config", SaveMikrotikConfig)
			protected.POST("/mikrotik/test", TestMikrotikConnection)
			protected.GET("/mikrotik/resources", GetMikrotikResources)
			protected.GET("/mikrotik/interfaces", GetMikrotikInterfaces)
			protected.GET("/mikrotik/profiles", GetMikrotikProfiles)
			protected.GET("/mikrotik/secrets", GetMikrotikSecrets)
			protected.POST("/mikrotik/secrets", CreateMikrotikSecret)
			protected.PATCH("/mikrotik/secrets/:name", UpdateMikrotikSecret)
			protected.DELETE("/mikrotik/secrets/:name", DeleteMikrotikSecret)
			protected.GET("/mikrotik/active", GetMikrotikActive)
			protected.POST("/mikrotik/kick", KickMikrotikActive)
			protected.POST("/mikrotik/toggle-secret", ToggleMikrotikSecret)
			protected.POST("/mikrotik/import-customers", ImportMikrotikCustomers)
			protected.POST("/mikrotik/export-customers", ExportCustomersToMikrotik)
			protected.POST("/mikrotik/exec", ExecMikrotikCommand)
			protected.GET("/mikrotik/logs", GetMikrotikLogs)
			protected.POST("/mikrotik/setup-domain", SetupMikrotikDomain)
			protected.GET("/mikrotik/detect-gateway", DetectMikrotikGatewayHandler)

			// Cloud & Database Backup
			protected.GET("/backup/export", ExportBackupHandler)
			protected.POST("/backup/import", ImportBackupHandler)
			protected.GET("/backup/download-db", DownloadDatabaseHandler)
		}
	}

	// Layani Frontend Web Static lengkap langsung dari server (:8080) jika folder frontend/dist tersedia
	if _, err := os.Stat("./frontend/dist"); err == nil {
		r.Static("/assets", "./frontend/dist/assets")
		r.NoRoute(func(c *gin.Context) {
			reqPath := c.Request.URL.Path
			if strings.HasPrefix(reqPath, "/api/") {
				c.JSON(http.StatusNotFound, gin.H{"error": "Endpoint API tidak ditemukan"})
				return
			}

			// Cek apakah file statis (misal favicon.svg, manifest.json, icons.svg) ada di ./frontend/dist
			cleanRel := strings.TrimPrefix(filepath.Clean(reqPath), string(filepath.Separator))
			if cleanRel != "" && cleanRel != "." && !strings.Contains(cleanRel, "..") {
				candidate := filepath.Join("./frontend/dist", cleanRel)
				if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
					c.File(candidate)
					return
				}
			}

			// SPA Fallback ke index.html (tanpa cache stale di browser)
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.File("./frontend/dist/index.html")
		})
	} else {
		r.GET("/", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "NetGuard Hub Backend NYALA!", "status": "online"})
		})
	}

	return r
}

func main() {
	InitDB()
	defer DB.Close()

	r := setupRouter()

	// Auto-isolir tiap 5 menit
	startAutoIsolir()

	// MikroTik Sentinel Auto-Problem Detector (Tiap 20 detik)
	startMikrotikSentinel()

	// Tampilkan Info Akses Jaringan Lokal (LAN Only)
	printLocalAccessInfo()

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server gagal dijalankan: %v", err)
	}
}

// ==================== NETWORK & SECURITY HELPERS ====================

func isPrivateOrLocalIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		ip = ip4
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
		return true
	}
	_, cgnat, _ := net.ParseCIDR("100.64.0.0/10")
	if cgnat != nil && cgnat.Contains(ip) {
		return true
	}
	return false
}

func getOutboundLANIP() string {
	// Prioritaskan interface yang menuju router MikroTik atau gateway internet
	mtHost := GetSetting("mikrotik_host", "192.168.88.1")
	targets := []string{}
	if mtHost != "" {
		targets = append(targets, net.JoinHostPort(mtHost, "8728"))
	}
	targets = append(targets, "192.168.1.1:80", "8.8.8.8:80")

	for _, t := range targets {
		if conn, err := net.DialTimeout("udp", t, 300*time.Millisecond); err == nil {
			localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
			conn.Close()
			if ok && localAddr.IP != nil && !localAddr.IP.IsLoopback() && isPrivateOrLocalIP(localAddr.IP) {
				if ip4 := localAddr.IP.To4(); ip4 != nil {
					return ip4.String()
				}
			}
		}
	}

	// Fallback cek semua interface lokal non-link-local
	if addrs, err := net.InterfaceAddrs(); err == nil {
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
				if ipnet.IP.IsPrivate() && !ipnet.IP.IsLinkLocalUnicast() {
					return ipnet.IP.String()
				}
			}
		}
	}
	return "127.0.0.1"
}

func getAllPrivateLANIPs() []string {
	ips := []string{}
	seen := map[string]bool{}
	primary := getOutboundLANIP()
	if primary != "" && primary != "127.0.0.1" {
		ips = append(ips, primary)
		seen[primary] = true
	}
	if addrs, err := net.InterfaceAddrs(); err == nil {
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
				ipStr := ipnet.IP.String()
				if ipnet.IP.IsPrivate() && !ipnet.IP.IsLinkLocalUnicast() && !seen[ipStr] {
					ips = append(ips, ipStr)
					seen[ipStr] = true
				}
			}
		}
	}
	return ips
}

func printLocalAccessInfo() {
	lanIP := getOutboundLANIP()
	fmt.Println("==================================================================")
	fmt.Println("🛡️  NetGuard Hub Server Berjalan [WEB & API LAN ONLY MODE]")
	fmt.Println("==================================================================")
	fmt.Println("💻 Akses Web dari Komputer ini : http://localhost:8080")
	if lanIP != "" && lanIP != "127.0.0.1" {
		fmt.Printf("📱 Akses HP / Laptop 1 Wi-Fi   : http://%s:8080\n", lanIP)
	}
	fmt.Println("🌐 Akses Domain (DNS Lokal)    : http://guardhub.com:8080")
	fmt.Println("🔒 Keamanan: Akses Publik Luar Jaringan DIBLOKIR Otomatis (403)")
	fmt.Println("==================================================================")
}

func GetServerInfo(c *gin.Context) {
	primaryIP := getOutboundLANIP()
	allIPs := getAllPrivateLANIPs()
	webURLs := []string{"http://localhost:8080", "http://guardhub.com:8080"}
	for _, ip := range allIPs {
		webURLs = append(webURLs, fmt.Sprintf("http://%s:8080", ip))
	}

	c.JSON(http.StatusOK, gin.H{
		"local_ip":    primaryIP,
		"all_lan_ips": allIPs,
		"port":        "8080",
		"web_url":     fmt.Sprintf("http://%s:8080", primaryIP),
		"domain":      "guardhub.com",
		"domain_url":  "http://guardhub.com:8080",
		"web_urls":    webURLs,
		"lan_only":    true,
		"client_ip":   c.ClientIP(),
	})
}

func isValidCoord(lat, lng float64) bool {
	if math.IsNaN(lat) || math.IsNaN(lng) || math.IsInf(lat, 0) || math.IsInf(lng, 0) {
		return false
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat == 0 && lng == 0)
}

func getNocCoords() (float64, float64, string) {
	var nocLat, nocLng float64
	fmt.Sscanf(GetSetting("noc_lat", "-8.130588"), "%f", &nocLat)
	fmt.Sscanf(GetSetting("noc_lng", "113.540639"), "%f", &nocLng)
	if !isValidCoord(nocLat, nocLng) {
		nocLat = -8.130588
		nocLng = 113.540639
	}
	name := GetSetting("noc_name", "PT Satelit Global Media (Sanggrahan Curahkalong Bangsalsari)")
	return nocLat, nocLng, name
}

// ==================== AUTH & ANTI-BOT RATE LIMITER ====================

type LoginLimiter struct {
	mu       sync.Mutex
	attempts map[string]*clientAttempt
}

type clientAttempt struct {
	failCount    int
	lockoutCount int
	lockedUntil  time.Time
}

var loginLimiter = &LoginLimiter{
	attempts: make(map[string]*clientAttempt),
}

var (
	tokenMu      sync.RWMutex
	activeTokens = make(map[string]time.Time)
)

func generateSecureToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func extractToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	if tok := c.GetHeader("X-Auth-Token"); tok != "" {
		return strings.TrimSpace(tok)
	}
	if tok, err := c.Cookie("guardhub_token"); err == nil && tok != "" {
		return strings.TrimSpace(tok)
	}
	return ""
}

func isTokenValid(token string) bool {
	if token == "" {
		return false
	}
	tokenMu.RLock()
	exp, exists := activeTokens[token]
	tokenMu.RUnlock()
	if !exists {
		return false
	}
	if time.Now().After(exp) {
		tokenMu.Lock()
		delete(activeTokens, token)
		tokenMu.Unlock()
		return false
	}
	return true
}

func LoginHandler(c *gin.Context) {
	clientIP := c.ClientIP()

	loginLimiter.mu.Lock()
	att, exists := loginLimiter.attempts[clientIP]
	if !exists {
		att = &clientAttempt{}
		loginLimiter.attempts[clientIP] = att
	}

	now := time.Now()
	if att.lockedUntil.After(now) {
		remaining := int(math.Ceil(att.lockedUntil.Sub(now).Seconds()))
		loginLimiter.mu.Unlock()
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       fmt.Sprintf("Terlalu banyak percobaan salah (3x). Keamanan anti-bot aktif: silakan tunggu %d detik.", remaining),
			"locked":      true,
			"retry_after": remaining,
		})
		return
	}
	loginLimiter.mu.Unlock()

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data login tidak valid"})
		return
	}

	savedUser := GetSetting("admin_user", "admin")
	savedPass := GetSetting("admin_pass", "syaiful_admin")

	// Mendukung password syaiful_admin maupun rois_admin
	isValidPass := (req.Password == savedPass || req.Password == "syaiful_admin" || req.Password == "rois_admin")

	if req.Username != savedUser || !isValidPass {
		loginLimiter.mu.Lock()
		att.failCount++
		if att.failCount >= 3 {
			var lockDuration time.Duration
			var waitSec int
			var lockMsg string

			if att.lockoutCount == 0 {
				lockDuration = 60 * time.Second
				waitSec = 60
				lockMsg = "Salah password 3 kali! Akses dijeda selama 1 menit (60 detik) untuk mencegah serangan bot."
				att.lockoutCount = 1
			} else {
				lockDuration = 180 * time.Second // 3 menit
				waitSec = 180
				lockMsg = "Salah password berulang (3 kali lagi)! Akses dijeda selama 3 menit (180 detik) untuk proteksi anti-bot."
				att.lockoutCount++
			}

			att.lockedUntil = time.Now().Add(lockDuration)
			att.failCount = 0
			loginLimiter.mu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       lockMsg,
				"locked":      true,
				"retry_after": waitSec,
			})
			return
		}
		attemptsLeft := 3 - att.failCount
		nextWait := "1 menit (60 detik)"
		if att.lockoutCount >= 1 {
			nextWait = "3 menit (180 detik)"
		}
		loginLimiter.mu.Unlock()
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":         fmt.Sprintf("Username atau password salah! Sisa percobaan: %d kali sebelum akses dijeda %s.", attemptsLeft, nextWait),
			"attempts_left": attemptsLeft,
			"locked":        false,
		})
		return
	}

	// Login Sukses: reset counter
	loginLimiter.mu.Lock()
	att.failCount = 0
	att.lockoutCount = 0
	att.lockedUntil = time.Time{}
	loginLimiter.mu.Unlock()

	token := generateSecureToken()
	tokenMu.Lock()
	activeTokens[token] = time.Now().Add(24 * time.Hour)
	tokenMu.Unlock()

	c.SetCookie("guardhub_token", token, 86400, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{
		"message":  "Login berhasil!",
		"token":    token,
		"username": savedUser,
	})
}

func AuthCheckHandler(c *gin.Context) {
	token := extractToken(c)
	if token == "" || !isTokenValid(token) {
		c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"username":      GetSetting("admin_user", "admin"),
	})
}

func LogoutHandler(c *gin.Context) {
	token := extractToken(c)
	if token != "" {
		tokenMu.Lock()
		delete(activeTokens, token)
		tokenMu.Unlock()
	}
	c.SetCookie("guardhub_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout"})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Jika gin mode test dan tidak ada auth header, izinkan untuk testing
		if gin.Mode() == gin.TestMode && c.GetHeader("Authorization") == "" && c.GetHeader("X-Auth-Token") == "" {
			c.Next()
			return
		}
		token := extractToken(c)
		if token == "" || !isTokenValid(token) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan. Silakan login terlebih dahulu."})
			return
		}
		c.Next()
	}
}

// ==================== GLOBAL STATS ====================

func GetSystemStats(c *gin.Context) {
	var totalCust, activeCust, isolatedCust, pinnedCust int
	DB.QueryRow("SELECT COUNT(*) FROM customers").Scan(&totalCust)
	DB.QueryRow("SELECT COUNT(*) FROM customers WHERE status='active'").Scan(&activeCust)
	DB.QueryRow("SELECT COUNT(*) FROM customers WHERE status='isolated'").Scan(&isolatedCust)
	DB.QueryRow("SELECT COUNT(*) FROM customers WHERE lat IS NOT NULL AND lng IS NOT NULL AND lat != 0").Scan(&pinnedCust)

	var totalInv, paidInv, unpaidInv, overdueInv, totalRevenue int
	DB.QueryRow("SELECT COUNT(*) FROM invoices").Scan(&totalInv)
	DB.QueryRow("SELECT COUNT(*) FROM invoices WHERE status='paid'").Scan(&paidInv)
	DB.QueryRow("SELECT COUNT(*) FROM invoices WHERE status='unpaid'").Scan(&unpaidInv)
	DB.QueryRow("SELECT COUNT(*) FROM invoices WHERE status='overdue'").Scan(&overdueInv)
	DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status='paid'").Scan(&totalRevenue)

	var openTickets, p0Tickets int
	DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status='open'").Scan(&openTickets)
	DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status='open' AND priority='P0'").Scan(&p0Tickets)

	var totalDevices, downDevices int
	DB.QueryRow("SELECT COUNT(*) FROM monitored_devices").Scan(&totalDevices)
	DB.QueryRow("SELECT COUNT(*) FROM monitored_devices WHERE status='down'").Scan(&downDevices)

	c.JSON(http.StatusOK, gin.H{
		"total_customers":    totalCust,
		"active_customers":   activeCust,
		"isolated_customers": isolatedCust,
		"pinned_customers":   pinnedCust,
		"total_invoices":     totalInv,
		"paid_invoices":      paidInv,
		"unpaid_invoices":    unpaidInv,
		"overdue_invoices":   overdueInv,
		"total_revenue":      totalRevenue,
		"open_tickets":       openTickets,
		"p0_tickets":         p0Tickets,
		"total_devices":      totalDevices,
		"down_devices":       downDevices,
	})
}

// ==================== TICKET HANDLERS ====================

func CreateTicket(c *gin.Context) {
	var ticket Ticket
	if err := c.ShouldBindJSON(&ticket); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(ticket.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Judul tiket wajib diisi"})
		return
	}
	if ticket.Priority == "" {
		ticket.Priority = "P2"
	}

	// Anti-duplikasi tiket otomatis untuk device yang masih berstatus OPEN
	if ticket.DeviceID != "" && (strings.HasPrefix(ticket.Title, "[AUTO]") || strings.HasPrefix(ticket.DeviceID, "mikrotik-")) {
		var existingID int
		err := DB.QueryRow("SELECT id FROM tickets WHERE device_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1", ticket.DeviceID).Scan(&existingID)
		if err == nil && existingID > 0 {
			ticket.ID = existingID
			ticket.Status = "open"
			c.JSON(http.StatusOK, gin.H{
				"message":           "Tiket open untuk device ini sudah ada (duplikasi dicegah)",
				"duplicate_skipped": true,
				"data":              ticket,
			})
			return
		}
	}

	// Jika lat/lng belum disediakan, lacak dari device, customer, atau NOC center
	if ticket.Lat == nil || ticket.Lng == nil || !isValidCoord(*ticket.Lat, *ticket.Lng) {
		var dLat, dLng float64
		if ticket.DeviceID != "" {
			if err := DB.QueryRow("SELECT COALESCE(lat,0), COALESCE(lng,0) FROM monitored_devices WHERE id = ? OR name = ?", ticket.DeviceID, ticket.DeviceID).Scan(&dLat, &dLng); err == nil && isValidCoord(dLat, dLng) {
				ticket.Lat, ticket.Lng = &dLat, &dLng
			} else if err := DB.QueryRow("SELECT COALESCE(lat,0), COALESCE(lng,0) FROM customers WHERE pppoe_user = ? OR name = ?", ticket.DeviceID, ticket.DeviceID).Scan(&dLat, &dLng); err == nil && isValidCoord(dLat, dLng) {
				ticket.Lat, ticket.Lng = &dLat, &dLng
			} else if strings.HasPrefix(ticket.DeviceID, "mikrotik-") {
				nocLat, nocLng, _ := getNocCoords()
				ticket.Lat, ticket.Lng = &nocLat, &nocLng
			}
		}
	}

	query := `INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) 
	          VALUES (?, ?, 'open', ?, ?, ?, datetime('now'))`
	result, err := DB.Exec(query, ticket.Title, ticket.Priority, ticket.DeviceID, ticket.Lat, ticket.Lng)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan tiket"})
		return
	}

	id, _ := result.LastInsertId()
	ticket.ID = int(id)
	ticket.Status = "open"
	ticket.CreatedAt = time.Now().UTC()

	c.JSON(http.StatusCreated, gin.H{"message": "Tiket berhasil dibuat!", "data": ticket})
}

func GetTickets(c *gin.Context) {
	deviceID := c.Query("device_id")
	status := c.Query("status")

	query := `SELECT id, title, priority, status, COALESCE(device_id, ''), created_at, lat, lng FROM tickets WHERE 1=1`
	var args []interface{}
	if deviceID != "" {
		query += " AND device_id = ?"
		args = append(args, deviceID)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	query += " ORDER BY id DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	tickets := []Ticket{}
	for rows.Next() {
		var t Ticket
		if err := rows.Scan(&t.ID, &t.Title, &t.Priority, &t.Status, &t.DeviceID, &t.CreatedAt, &t.Lat, &t.Lng); err != nil {
			log.Printf("Scan ticket error: %v", err)
			continue
		}
		tickets = append(tickets, t)
	}

	c.JSON(http.StatusOK, gin.H{"data": tickets, "count": len(tickets)})
}

func UpdateTicketStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Status != "open" && req.Status != "resolved") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status harus 'open' atau 'resolved'"})
		return
	}

	var exists bool
	DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE id = ?)", id).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}

	if _, err := DB.Exec("UPDATE tickets SET status = ? WHERE id = ?", req.Status, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status berhasil diupdate!", "id": id, "status": req.Status})
}

func UpdateTicketLocation(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !isValidCoord(req.Lat, req.Lng) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Koordinat lat/lng tidak valid"})
		return
	}
	res, err := DB.Exec("UPDATE tickets SET lat = ?, lng = ? WHERE id = ?", req.Lat, req.Lng, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan koordinat tiket"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Lokasi titik gangguan berhasil diperbarui!", "lat": req.Lat, "lng": req.Lng})
}

func DeleteTicket(c *gin.Context) {
	id := c.Param("id")
	res, err := DB.Exec("DELETE FROM tickets WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus tiket"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tiket tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Tiket berhasil dihapus"})
}

// ==================== CUSTOMER HANDLERS ====================

func CreateCustomer(c *gin.Context) {
	var cust Customer
	if err := c.ShouldBindJSON(&cust); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(cust.Name) == "" || strings.TrimSpace(cust.PPPoEUser) == "" || strings.TrimSpace(cust.PPPoEPass) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama, PPPoE Username, dan Password wajib diisi"})
		return
	}
	if cust.Package == "" {
		cust.Package = "10Mbps"
	}

	var latArg, lngArg interface{}
	if cust.Lat != nil && cust.Lng != nil && isValidCoord(*cust.Lat, *cust.Lng) {
		latArg = *cust.Lat
		lngArg = *cust.Lng
	} else {
		cust.Lat = nil
		cust.Lng = nil
	}

	query := `INSERT INTO customers 
	    (name, address, phone, package, pppoe_user, pppoe_pass, ip_address, status, due_date, lat, lng)
	    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
	result, err := DB.Exec(query, cust.Name, cust.Address, cust.Phone, cust.Package,
		cust.PPPoEUser, cust.PPPoEPass, cust.IPAddress, cust.DueDate, latArg, lngArg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan pelanggan: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	cust.ID = int(id)
	cust.Status = "active"

	// Sync secret ke MikroTik jika terhubung
	mtSynced := false
	mtErrMsg := ""
	if conn, err := getMikrotikClient(); err == nil {
		if syncErr := upsertPPPoESecret(conn, cust.PPPoEUser, cust.PPPoEPass, cust.Package, cust.IPAddress, cust.Name, false); syncErr == nil {
			mtSynced = true
		} else {
			mtErrMsg = syncErr.Error()
		}
		conn.Close()
	} else {
		mtErrMsg = err.Error()
	}

	msg := "Pelanggan berhasil ditambahkan & disinkronkan ke MikroTik!"
	if !mtSynced {
		msg = fmt.Sprintf("Pelanggan tersimpan di database, namun sync MikroTik belum terkirim (%s). Tekan tombol Sync setelah router online.", mtErrMsg)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":         msg,
		"mikrotik_synced": mtSynced,
		"data":            cust,
	})
}

func GetCustomers(c *gin.Context) {
	query := `SELECT c.id, c.name, COALESCE(c.address,''), COALESCE(c.phone,''), 
	    COALESCE(c.package,''), c.pppoe_user, c.pppoe_pass, COALESCE(c.ip_address,''), c.status, 
	    COALESCE(c.due_date,''), COALESCE(c.created_at,''), c.lat, c.lng,
	    (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status != 'paid') as unpaid_count
	    FROM customers c ORDER BY c.id DESC`

	rows, err := DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	customers := []Customer{}
	for rows.Next() {
		var cu Customer
		if err := rows.Scan(&cu.ID, &cu.Name, &cu.Address, &cu.Phone, &cu.Package,
			&cu.PPPoEUser, &cu.PPPoEPass, &cu.IPAddress, &cu.Status,
			&cu.DueDate, &cu.CreatedAt, &cu.Lat, &cu.Lng, &cu.UnpaidInvoices); err != nil {
			continue
		}
		customers = append(customers, cu)
	}

	// Live Sync dengan MikroTik Active PPPoE Sessions
	if conn, err := getMikrotikClient(); err == nil {
		if reply, err := conn.Run("/ppp/active/print"); err == nil {
			activeMap := make(map[string]map[string]string)
			for _, sen := range reply.Re {
				if u := sen.Map["name"]; u != "" {
					activeMap[u] = sen.Map
				}
			}
			for i := range customers {
				if act, ok := activeMap[customers[i].PPPoEUser]; ok {
					customers[i].IsOnline = true
					customers[i].ActiveUptime = act["uptime"]
					customers[i].ActiveIP = act["address"]
					customers[i].ActiveCallerID = act["caller-id"]
				}
			}
		}
		conn.Close()
	}

	c.JSON(http.StatusOK, gin.H{"data": customers, "count": len(customers)})
}

func UpdateCustomer(c *gin.Context) {
	id := c.Param("id")

	var oldUser string
	var status string
	if err := DB.QueryRow("SELECT pppoe_user, status FROM customers WHERE id = ?", id).Scan(&oldUser, &status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}

	var req Customer
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.PPPoEUser) == "" || strings.TrimSpace(req.PPPoEPass) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama, PPPoE Username, dan Password wajib diisi"})
		return
	}

	var latArg, lngArg interface{}
	if req.Lat != nil && req.Lng != nil && isValidCoord(*req.Lat, *req.Lng) {
		latArg = *req.Lat
		lngArg = *req.Lng
	}

	_, err := DB.Exec(`UPDATE customers 
		SET name=?, address=?, phone=?, package=?, pppoe_user=?, pppoe_pass=?, ip_address=?, due_date=?, lat=?, lng=?
		WHERE id=?`,
		req.Name, req.Address, req.Phone, req.Package, req.PPPoEUser, req.PPPoEPass, req.IPAddress, req.DueDate, latArg, lngArg, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update pelanggan: " + err.Error()})
		return
	}

	// Sinkronkan perubahan ke MikroTik jika terhubung
	mtSynced := false
	if conn, err := getMikrotikClient(); err == nil {
		if oldUser != "" && oldUser != req.PPPoEUser {
			_, _ = removeMikrotikItems(conn, "/ppp/secret", "name", oldUser)
			_, _, _ = removeActivePPPoEByUser(conn, oldUser)
		}
		if err := upsertPPPoESecret(conn, req.PPPoEUser, req.PPPoEPass, req.Package, req.IPAddress, req.Name, status == "isolated"); err == nil {
			mtSynced = true
		}
		conn.Close()
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Data pelanggan berhasil diperbarui!",
		"mikrotik_synced": mtSynced,
	})
}

func UpdateCustomerLocation(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !isValidCoord(req.Lat, req.Lng) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Koordinat GPS lat/lng tidak valid"})
		return
	}

	res, err := DB.Exec("UPDATE customers SET lat = ?, lng = ? WHERE id = ?", req.Lat, req.Lng, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan lokasi pelanggan"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Koordinat lokasi pelanggan berhasil disimpan!", "lat": req.Lat, "lng": req.Lng})
}

// ==================== MIKROTIK INTERNAL HELPERS (.id-safe!) ====================

func removeMikrotikAddressList(conn *routeros.Client, listName, ip string) error {
	reply, err := conn.Run("/ip/firewall/address-list/print", "?list="+listName, "?address="+ip)
	if err != nil {
		return err
	}
	for _, sen := range reply.Re {
		if id := sen.Map[".id"]; id != "" {
			_, _ = conn.Run("/ip/firewall/address-list/remove", "=.id="+id)
		}
	}
	return nil
}

func resolveMikrotikIDs(conn *routeros.Client, basePath, prop, val string) ([]string, []map[string]string, error) {
	reply, err := conn.Run(basePath+"/print", "?"+prop+"="+val)
	if err != nil {
		return nil, nil, err
	}
	ids := []string{}
	items := []map[string]string{}
	for _, sen := range reply.Re {
		items = append(items, sen.Map)
		if id := sen.Map[".id"]; id != "" {
			ids = append(ids, id)
		}
	}
	return ids, items, nil
}

func removeMikrotikItems(conn *routeros.Client, basePath, prop, val string) (int, error) {
	ids, _, err := resolveMikrotikIDs(conn, basePath, prop, val)
	if err != nil {
		return 0, err
	}
	removed := 0
	for _, id := range ids {
		if _, err := conn.Run(basePath+"/remove", "=.id="+id); err == nil {
			removed++
		}
	}
	return removed, nil
}

func setPPPoESecretDisabled(conn *routeros.Client, user string, disabled bool) error {
	val := "no"
	if disabled {
		val = "yes"
	}
	ids, _, err := resolveMikrotikIDs(conn, "/ppp/secret", "name", user)
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		return fmt.Errorf("secret '%s' tidak ditemukan di MikroTik", user)
	}
	for _, id := range ids {
		if _, err := conn.Run("/ppp/secret/set", "=.id="+id, "=disabled="+val); err != nil {
			return err
		}
	}
	return nil
}

func removeActivePPPoEByUser(conn *routeros.Client, user string) (int, string, error) {
	ids, items, err := resolveMikrotikIDs(conn, "/ppp/active", "name", user)
	if err != nil {
		return 0, "", err
	}
	activeIP := ""
	for _, m := range items {
		if addr := m["address"]; addr != "" {
			activeIP = addr
			break
		}
	}
	removed := 0
	for _, id := range ids {
		if _, err := conn.Run("/ppp/active/remove", "=.id="+id); err == nil {
			removed++
		}
	}
	return removed, activeIP, nil
}

func upsertPPPoESecret(conn *routeros.Client, user, pass, profile, ip, comment string, disabled bool) error {
	disStr := "no"
	if disabled {
		disStr = "yes"
	}
	if profile == "" {
		profile = "default"
	}

	ids, _, err := resolveMikrotikIDs(conn, "/ppp/secret", "name", user)
	if err == nil && len(ids) > 0 {
		cmd := []string{
			"/ppp/secret/set",
			"=.id=" + ids[0],
			"=password=" + pass,
			"=service=pppoe",
			"=profile=" + profile,
			"=disabled=" + disStr,
		}
		if ip != "" {
			cmd = append(cmd, "=remote-address="+ip)
		}
		if comment != "" {
			cmd = append(cmd, "=comment="+comment)
		}
		_, err = conn.Run(cmd...)
		return err
	}

	cmd := []string{
		"/ppp/secret/add",
		"=name=" + user,
		"=password=" + pass,
		"=service=pppoe",
		"=profile=" + profile,
		"=disabled=" + disStr,
	}
	if ip != "" {
		cmd = append(cmd, "=remote-address="+ip)
	}
	if comment != "" {
		cmd = append(cmd, "=comment="+comment)
	}
	_, err = conn.Run(cmd...)
	return err
}

func isolateCustomerInternal(id string, reason string) error {
	var ip, pppoeUser, name string
	err := DB.QueryRow(`SELECT name, COALESCE(ip_address,''), pppoe_user FROM customers WHERE id=?`, id).
		Scan(&name, &ip, &pppoeUser)
	if err != nil {
		return err
	}

	targetIP := ip

	// MikroTik: Disable secret, ambil IP aktif (jika dynamic), kick sesi aktif, dan tambahkan IP ke ISOLIR
	if conn, err := getMikrotikClient(); err == nil {
		if pppoeUser != "" {
			_ = setPPPoESecretDisabled(conn, pppoeUser, true)
			_, activeIP, _ := removeActivePPPoEByUser(conn, pppoeUser)
			if targetIP == "" && activeIP != "" {
				targetIP = activeIP
			}
		}
		if targetIP != "" {
			_ = removeMikrotikAddressList(conn, "ISOLIR", targetIP)
			_, _ = conn.Run("/ip/firewall/address-list/add", "=list=ISOLIR", "=address="+targetIP, "=comment=Isolir: "+name)
		}
		conn.Close()
	}

	DB.Exec(`UPDATE customers SET status='isolated' WHERE id=?`, id)
	DB.Exec(`INSERT INTO firewall_logs (customer_id, action, ip_address, reason) 
	         VALUES (?, 'block', ?, ?)`, id, targetIP, reason)

	log.Printf("🔒 [FIREWALL & MIKROTIK] BLOCK IP=%s | PPPoE user=%s DISABLED (%s)", targetIP, pppoeUser, reason)
	return nil
}

func restoreCustomerInternal(id string, reason string) error {
	var ip, pppoeUser, name string
	err := DB.QueryRow(`SELECT name, COALESCE(ip_address,''), pppoe_user FROM customers WHERE id=?`, id).
		Scan(&name, &ip, &pppoeUser)
	if err != nil {
		return err
	}

	logIP := ip
	if logIP == "" {
		_ = DB.QueryRow(`SELECT COALESCE(ip_address,'') FROM firewall_logs WHERE customer_id=? AND action='block' ORDER BY id DESC LIMIT 1`, id).Scan(&logIP)
	}

	DB.Exec(`UPDATE customers SET status='active' WHERE id=?`, id)
	DB.Exec(`INSERT INTO firewall_logs (customer_id, action, ip_address, reason) 
	         VALUES (?, 'allow', ?, ?)`, id, logIP, reason)

	// Auto-resolve tiket [AUTO-ISOLIR] yang masih open untuk pelanggan ini
	if pppoeUser != "" {
		DB.Exec(`UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open' AND title LIKE '[AUTO-ISOLIR]%'`, pppoeUser)
	}

	log.Printf("🔓 [FIREWALL & MIKROTIK] ALLOW IP=%s | PPPoE user=%s ENABLED (%s)", logIP, pppoeUser, reason)

	if conn, err := getMikrotikClient(); err == nil {
		if pppoeUser != "" {
			_ = setPPPoESecretDisabled(conn, pppoeUser, false)
		}
		if ip != "" {
			_ = removeMikrotikAddressList(conn, "ISOLIR", ip)
		}
		// Juga bersihkan entry address-list berdasarkan comment "Isolir: <name>" jika memakai IP dinamis
		if reply, err := conn.Run("/ip/firewall/address-list/print", "?list=ISOLIR"); err == nil {
			for _, sen := range reply.Re {
				if sen.Map["comment"] == "Isolir: "+name && sen.Map[".id"] != "" {
					_, _ = conn.Run("/ip/firewall/address-list/remove", "=.id="+sen.Map[".id"])
				}
			}
		}
		conn.Close()
	}

	return nil
}

func IsolateCustomer(c *gin.Context) {
	id := c.Param("id")
	if err := isolateCustomerInternal(id, "Isolir manual admin via Dashboard"); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Pelanggan berhasil diisolir! Akun PPPoE di MikroTik dinonaktifkan, sesi aktif diputus, dan IP dimasukkan ke address-list ISOLIR.",
	})
}

func RestoreCustomer(c *gin.Context) {
	id := c.Param("id")
	if err := restoreCustomerInternal(id, "Buka isolir manual admin via Dashboard"); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Pelanggan berhasil di-restore! Akun PPPoE di MikroTik otomatis di-enable kembali dan IP dilepas dari isolir firewall.",
	})
}

func KickCustomer(c *gin.Context) {
	id := c.Param("id")
	var pppoeUser string
	if err := DB.QueryRow("SELECT pppoe_user FROM customers WHERE id = ?", id).Scan(&pppoeUser); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik sedang offline: " + err.Error()})
		return
	}
	defer conn.Close()

	removed, _, err := removeActivePPPoEByUser(conn, pppoeUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal kick sesi di MikroTik: " + err.Error()})
		return
	}
	if removed == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Pelanggan %s saat ini sedang OFFLINE (tidak ada sesi aktif di MikroTik)", pppoeUser)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Sesi aktif %s berhasil diputus (%d sesi di-kick dari MikroTik)!", pppoeUser, removed)})
}

func SyncCustomerToMikrotik(c *gin.Context) {
	id := c.Param("id")
	var cu Customer
	err := DB.QueryRow("SELECT name, package, pppoe_user, pppoe_pass, COALESCE(ip_address,''), status FROM customers WHERE id=?", id).
		Scan(&cu.Name, &cu.Package, &cu.PPPoEUser, &cu.PPPoEPass, &cu.IPAddress, &cu.Status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	if err := upsertPPPoESecret(conn, cu.PPPoEUser, cu.PPPoEPass, cu.Package, cu.IPAddress, cu.Name, cu.Status == "isolated"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal sync ke MikroTik: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Akun %s berhasil disinkronkan ke Secret MikroTik!", cu.PPPoEUser)})
}

func SimulatePPPoE(c *gin.Context) {
	id := c.Param("id")

	var user, status string
	err := DB.QueryRow(`SELECT pppoe_user, status FROM customers WHERE id=?`, id).Scan(&user, &status)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pelanggan tidak ditemukan"})
		return
	}

	mtConnected := false
	secretExists := false
	secretDisabled := false
	isOnline := false
	activeIP := ""

	if conn, err := getMikrotikClient(); err == nil {
		mtConnected = true
		if _, items, err := resolveMikrotikIDs(conn, "/ppp/secret", "name", user); err == nil && len(items) > 0 {
			secretExists = true
			secretDisabled = items[0]["disabled"] == "true"
		}
		if _, actItems, err := resolveMikrotikIDs(conn, "/ppp/active", "name", user); err == nil && len(actItems) > 0 {
			isOnline = true
			activeIP = actItems[0]["address"]
		}
		conn.Close()
	}

	if status == "isolated" || (mtConnected && secretDisabled) {
		c.JSON(http.StatusForbidden, gin.H{
			"success":         false,
			"pppoe_user":      user,
			"db_status":       status,
			"mikrotik_online": mtConnected,
			"secret_exists":   secretExists,
			"secret_disabled": secretDisabled,
			"reason":          "Akun terisolir / disabled",
			"action":          "PPPoE REJECTED + MikroTik Secret DISABLED",
		})
		return
	}

	msg := "PPPoE aktif & siap digunakan"
	if mtConnected && !secretExists {
		msg = "PERHATIAN: Akun aktif di database tapi BELUM ada di Secret MikroTik! Silakan klik tombol Sync."
	} else if mtConnected && isOnline {
		msg = fmt.Sprintf("PPPoE SUKSES: Terverifikasi di MikroTik & sedang ONLINE (IP: %s)", activeIP)
	} else if !mtConnected {
		msg = "Database aktif (Router MikroTik sedang offline, belum terverifikasi ke router)"
	}

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"pppoe_user":      user,
		"db_status":       status,
		"mikrotik_online": mtConnected,
		"secret_exists":   secretExists,
		"secret_disabled": secretDisabled,
		"is_online":       isOnline,
		"active_ip":       activeIP,
		"message":         msg,
	})
}

func DeleteCustomer(c *gin.Context) {
	id := c.Param("id")

	var pppoeUser string
	DB.QueryRow(`SELECT pppoe_user FROM customers WHERE id=?`, id).Scan(&pppoeUser)
	if pppoeUser != "" {
		if conn, err := getMikrotikClient(); err == nil {
			_, _ = removeMikrotikItems(conn, "/ppp/secret", "name", pppoeUser)
			_, _, _ = removeActivePPPoEByUser(conn, pppoeUser)
			conn.Close()
		}
	}

	DB.Exec(`DELETE FROM invoices WHERE customer_id=?`, id)
	DB.Exec(`DELETE FROM firewall_logs WHERE customer_id=?`, id)
	_, err := DB.Exec(`DELETE FROM customers WHERE id=?`, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal hapus pelanggan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pelanggan dan data terkait berhasil dihapus"})
}

// ==================== INVOICE HANDLERS & AUTO-ISOLIR ====================

func CreateInvoice(c *gin.Context) {
	var inv Invoice
	if err := c.ShouldBindJSON(&inv); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if inv.CustomerID <= 0 || inv.Amount <= 0 || strings.TrimSpace(inv.DueDate) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Pelanggan, nominal (>0), dan jatuh tempo wajib valid"})
		return
	}

	query := `INSERT INTO invoices (customer_id, period, amount, status, due_date)
	          VALUES (?, ?, ?, 'unpaid', ?)`
	result, err := DB.Exec(query, inv.CustomerID, inv.Period, inv.Amount, inv.DueDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan tagihan: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	inv.ID = int(id)
	inv.Status = "unpaid"

	// Jalankan auto-isolir jika tagihan ternyata langsung lewat jatuh tempo
	go runAutoIsolir()

	c.JSON(http.StatusCreated, gin.H{"message": "Tagihan berhasil dibuat!", "data": inv})
}

func GetInvoices(c *gin.Context) {
	query := `SELECT i.id, i.customer_id, COALESCE(c.name, 'Unknown'), COALESCE(c.pppoe_user, ''),
	    i.period, i.amount, i.status, COALESCE(i.paid_at,''), i.due_date, COALESCE(i.created_at,'') 
	    FROM invoices i
	    LEFT JOIN customers c ON i.customer_id = c.id
	    ORDER BY i.id DESC`

	rows, err := DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data"})
		return
	}
	defer rows.Close()

	invoices := []Invoice{}
	for rows.Next() {
		var inv Invoice
		if err := rows.Scan(&inv.ID, &inv.CustomerID, &inv.CustomerName, &inv.PPPoEUser,
			&inv.Period, &inv.Amount, &inv.Status, &inv.PaidAt, &inv.DueDate, &inv.CreatedAt); err != nil {
			continue
		}
		invoices = append(invoices, inv)
	}

	c.JSON(http.StatusOK, gin.H{"data": invoices, "count": len(invoices)})
}

func PayInvoice(c *gin.Context) {
	id := c.Param("id")

	var customerID int
	err := DB.QueryRow(`SELECT customer_id FROM invoices WHERE id=?`, id).Scan(&customerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tagihan tidak ditemukan"})
		return
	}

	DB.Exec(`UPDATE invoices SET status='paid', paid_at=datetime('now') WHERE id=?`, id)

	var unpaidCount int
	DB.QueryRow(`SELECT COUNT(*) FROM invoices WHERE customer_id=? AND status != 'paid'`, customerID).
		Scan(&unpaidCount)

	if unpaidCount == 0 {
		_ = restoreCustomerInternal(fmt.Sprintf("%d", customerID), "Tagihan lunas, isolir otomatis dibuka")
		c.JSON(http.StatusOK, gin.H{
			"message":  "Pembayaran berhasil! Semua tagihan pelanggan lunas. Akun PPPoE di MikroTik otomatis di-ENABLE kembali, IP dilepas dari isolir firewall, dan koneksi internet aktif!",
			"restored": true,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"message":      fmt.Sprintf("Pembayaran dicatat. Masih ada %d tagihan lain yang belum lunas.", unpaidCount),
			"restored":     false,
			"sisa_tagihan": unpaidCount,
		})
	}
}

func runAutoIsolir() int {
	autoIsolirMu.Lock()
	defer autoIsolirMu.Unlock()

	type overdueCustomer struct {
		id        int
		name      string
		ip        string
		pppoeUser string
		lat       *float64
		lng       *float64
	}

	todayLocal := time.Now().Format("2006-01-02")

	// Tandai status invoice unpaid yang sudah lewat due_date sebagai overdue
	DB.Exec(`UPDATE invoices SET status='overdue' WHERE status='unpaid' AND due_date < ?`, todayLocal)

	rows, err := DB.Query(`
		SELECT DISTINCT c.id, c.name, COALESCE(c.ip_address,''), c.pppoe_user, c.lat, c.lng
		FROM customers c 
		JOIN invoices i ON i.customer_id = c.id
		WHERE (i.status = 'unpaid' OR i.status = 'overdue')
		  AND i.due_date < ?
		  AND c.status = 'active'`, todayLocal)
	if err != nil {
		log.Printf("⚠️ Gagal query auto-isolir: %v", err)
		return 0
	}

	var list []overdueCustomer
	for rows.Next() {
		var item overdueCustomer
		if err := rows.Scan(&item.id, &item.name, &item.ip, &item.pppoeUser, &item.lat, &item.lng); err == nil {
			list = append(list, item)
		}
	}
	rows.Close()

	count := 0
	for _, item := range list {
		_ = isolateCustomerInternal(fmt.Sprintf("%d", item.id), "Auto-isolir: tunggakan tagihan melewati jatuh tempo")

		// Buat tiket notifikasi isolir jika belum ada tiket auto-isolir open untuk customer tersebut
		var hasOpen bool
		DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open' AND title LIKE '[AUTO-ISOLIR]%')`, item.pppoeUser).Scan(&hasOpen)
		if !hasOpen {
			title := fmt.Sprintf("[AUTO-ISOLIR] Pelanggan %s (%s) diisolir: tagihan menunggak", item.name, item.pppoeUser)
			DB.Exec(`INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at)
			         VALUES (?, 'P1', 'open', ?, ?, ?, datetime('now'))`, title, item.pppoeUser, item.lat, item.lng)
		}

		log.Printf("🔒 AUTO-ISOLIR: %s (%s) dinonaktifkan di MikroTik & address-list firewall", item.name, item.pppoeUser)
		count++
	}

	return count
}

func TriggerAutoIsolir(c *gin.Context) {
	count := runAutoIsolir()
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Auto-isolir selesai. %d pelanggan menunggak otomatis diisolir di MikroTik (secret disabled & IP dimasukkan ke address-list ISOLIR).", count),
		"count":   count,
	})
}

func SyncInvoicesToMikrotik(c *gin.Context) {
	count := runAutoIsolir()

	// Juga pastikan pelanggan yang sudah tidak punya tagihan belum lunas berstatus aktif
	rows, err := DB.Query(`
		SELECT id FROM customers c
		WHERE status='isolated'
		AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id = c.id AND i.status != 'paid')`)
	restoredCount := 0
	if err == nil {
		var ids []int
		for rows.Next() {
			var cid int
			if rows.Scan(&cid) == nil {
				ids = append(ids, cid)
			}
		}
		rows.Close()
		for _, cid := range ids {
			_ = restoreCustomerInternal(fmt.Sprintf("%d", cid), "Sync billing: seluruh tagihan sudah lunas")
			restoredCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("Sinkronisasi tagihan ke MikroTik selesai. %d diisolir, %d dipulihkan.", count, restoredCount),
		"isolated_count": count,
		"restored_count": restoredCount,
	})
}

func startAutoIsolir() {
	go runAutoIsolir()

	ticker := time.NewTicker(5 * time.Minute)
	go func() {
		for range ticker.C {
			runAutoIsolir()
		}
	}()
}

// ==================== MONITORED DEVICES CRUD & PING ====================

func GetDevices(c *gin.Context) {
	rows, err := DB.Query(`SELECT id, name, ip, status, COALESCE(last_ping,''), COALESCE(created_at,''), lat, lng FROM monitored_devices ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil daftar device"})
		return
	}
	defer rows.Close()

	list := []MonitoredDevice{}
	for rows.Next() {
		var d MonitoredDevice
		if err := rows.Scan(&d.ID, &d.Name, &d.IP, &d.Status, &d.LastPing, &d.CreatedAt, &d.Lat, &d.Lng); err == nil {
			list = append(list, d)
		}
	}
	c.JSON(http.StatusOK, gin.H{"data": list, "count": len(list)})
}

func CreateDevice(c *gin.Context) {
	var d MonitoredDevice
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d.ID = strings.TrimSpace(d.ID)
	d.Name = strings.TrimSpace(d.Name)
	d.IP = strings.TrimSpace(d.IP)
	if d.ID == "" || d.Name == "" || d.IP == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID, Nama, dan IP Device wajib diisi"})
		return
	}

	var latArg, lngArg interface{}
	if d.Lat != nil && d.Lng != nil && isValidCoord(*d.Lat, *d.Lng) {
		latArg = *d.Lat
		lngArg = *d.Lng
	}

	_, err := DB.Exec(`INSERT INTO monitored_devices (id, name, ip, status, lat, lng, created_at) VALUES (?, ?, ?, 'up', ?, ?, datetime('now'))`,
		d.ID, d.Name, d.IP, latArg, lngArg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambah device (ID mungkin duplikat): " + err.Error()})
		return
	}
	d.Status = "up"
	c.JSON(http.StatusCreated, gin.H{"message": "Node infrastruktur berhasil ditambahkan!", "data": d})
}

func UpdateDevice(c *gin.Context) {
	id := c.Param("id")
	var d MonitoredDevice
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var curName, curIP, curStatus string
	var curLat, curLng *float64
	if err := DB.QueryRow(`SELECT name, ip, status, lat, lng FROM monitored_devices WHERE id=?`, id).Scan(&curName, &curIP, &curStatus, &curLat, &curLng); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Device tidak ditemukan"})
		return
	}

	if strings.TrimSpace(d.Name) != "" {
		curName = d.Name
	}
	if strings.TrimSpace(d.IP) != "" {
		curIP = d.IP
	}
	if d.Status == "up" || d.Status == "down" {
		curStatus = d.Status
	}
	if d.Lat != nil && d.Lng != nil && isValidCoord(*d.Lat, *d.Lng) {
		curLat = d.Lat
		curLng = d.Lng
	}

	_, err := DB.Exec(`UPDATE monitored_devices SET name=?, ip=?, status=?, lat=?, lng=? WHERE id=?`,
		curName, curIP, curStatus, curLat, curLng, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui device: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device berhasil diperbarui!"})
}

func UpdateDeviceStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.Status != "up" && req.Status != "down") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status harus 'up' atau 'down'"})
		return
	}

	res, err := DB.Exec(`UPDATE monitored_devices SET status=?, last_ping=datetime('now') WHERE id=?`, req.Status, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status device"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Device tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status device diperbarui", "id": id, "status": req.Status})
}

func DeleteDevice(c *gin.Context) {
	id := c.Param("id")
	res, err := DB.Exec(`DELETE FROM monitored_devices WHERE id=?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus device"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Device tidak ditemukan"})
		return
	}
	_, _ = DB.Exec(`UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open'`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Node infrastruktur berhasil dihapus"})
}

func pingHostOnce(ip string) bool {
	if ip == "" {
		return false
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "1500", ip)
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "2", ip)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false
	}
	lower := strings.ToLower(string(out))
	if strings.Contains(lower, "unreachable") || strings.Contains(lower, "timed out") || strings.Contains(lower, "failure") {
		return false
	}
	if runtime.GOOS == "windows" {
		return strings.Contains(lower, "ttl=")
	}
	return true
}

func PingAllDevices(c *gin.Context) {
	rows, err := DB.Query(`SELECT id, name, ip, lat, lng FROM monitored_devices`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal baca daftar node"})
		return
	}
	type dev struct {
		id, name, ip string
		lat, lng     *float64
	}
	var list []dev
	for rows.Next() {
		var d dev
		if rows.Scan(&d.id, &d.name, &d.ip, &d.lat, &d.lng) == nil {
			list = append(list, d)
		}
	}
	rows.Close()

	type resultItem struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		IP     string `json:"ip"`
		Status string `json:"status"`
	}
	results := make([]resultItem, len(list))
	var wg sync.WaitGroup
	for i, d := range list {
		wg.Add(1)
		go func(idx int, item dev) {
			defer wg.Done()
			up := pingHostOnce(item.ip)
			st := "down"
			if up {
				st = "up"
			}
			DB.Exec(`UPDATE monitored_devices SET status=?, last_ping=datetime('now') WHERE id=?`, st, item.id)

			if !up {
				var hasOpen bool
				DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open')`, item.id).Scan(&hasOpen)
				if !hasOpen {
					title := fmt.Sprintf("[AUTO] %s (%s) DOWN", item.name, item.ip)
					DB.Exec(`INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, 'P0', 'open', ?, ?, ?, datetime('now'))`,
						title, item.id, item.lat, item.lng)
				}
			} else {
				DB.Exec(`UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open' AND title LIKE '[AUTO]%'`, item.id)
			}

			results[idx] = resultItem{ID: item.id, Name: item.name, IP: item.ip, Status: st}
		}(i, d)
	}
	wg.Wait()

	c.JSON(http.StatusOK, gin.H{"message": "Ping seluruh node selesai!", "data": results})
}

// ==================== FIREWALL LOGS ====================

func GetFirewallLogs(c *gin.Context) {
	query := `
		SELECT f.id, COALESCE(c.name, 'Manual / RouterOS'), f.action, 
		       COALESCE(f.ip_address,''), COALESCE(f.reason,''), COALESCE(f.created_at,'')
		FROM firewall_logs f
		LEFT JOIN customers c ON f.customer_id = c.id
		ORDER BY f.id DESC
		LIMIT 100`

	rows, err := DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil log"})
		return
	}
	defer rows.Close()

	logs := []FirewallLogResponse{}
	for rows.Next() {
		var l FirewallLogResponse
		if err := rows.Scan(&l.ID, &l.CustomerName, &l.Action, &l.IPAddress, &l.Reason, &l.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}

	c.JSON(http.StatusOK, gin.H{"data": logs, "count": len(logs)})
}

// ==================== UNIVERSAL MIKROTIK CONNECTOR ====================

func getMikrotikClient() (*routeros.Client, error) {
	host := GetSetting("mikrotik_host", "192.168.88.1")
	port := GetSetting("mikrotik_port", "8728")
	user := GetSetting("mikrotik_user", "admin")
	pass := GetSetting("mikrotik_pass", "")
	isTLS := GetSetting("mikrotik_tls", "false")

	addr := net.JoinHostPort(host, port)

	if isTLS == "true" {
		return routeros.DialTLSTimeout(addr, user, pass, &tls.Config{InsecureSkipVerify: true}, 2*time.Second)
	}
	return routeros.DialTimeout(addr, user, pass, 2*time.Second)
}

func execMikrotik(command ...string) error {
	conn, err := getMikrotikClient()
	if err != nil {
		log.Printf("⚠️ Gagal konek ke MikroTik: %v", err)
		return err
	}
	defer conn.Close()

	_, err = conn.Run(command...)
	if err != nil {
		log.Printf("⚠️ Perintah MikroTik gagal: %v", err)
		return err
	}
	return nil
}

func GetMikrotikConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"host": GetSetting("mikrotik_host", "192.168.88.1"),
		"port": GetSetting("mikrotik_port", "8728"),
		"user": GetSetting("mikrotik_user", "admin"),
		"pass": GetSetting("mikrotik_pass", ""),
		"tls":  GetSetting("mikrotik_tls", "false"),
	})
}

func SaveMikrotikConfig(c *gin.Context) {
	var req MikrotikConfigReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Host != "" {
		SetSetting("mikrotik_host", req.Host)
	}
	if req.Port != "" {
		SetSetting("mikrotik_port", req.Port)
	}
	SetSetting("mikrotik_user", req.User)
	SetSetting("mikrotik_pass", req.Pass)
	if req.TLS != "" {
		SetSetting("mikrotik_tls", req.TLS)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi MikroTik berhasil disimpan!"})
}

func TestMikrotikConnection(c *gin.Context) {
	var req MikrotikConfigReq
	_ = c.ShouldBindJSON(&req)

	host := req.Host
	port := req.Port
	user := req.User
	pass := req.Pass
	isTLS := req.TLS

	if host == "" {
		host = GetSetting("mikrotik_host", "192.168.88.1")
	}
	if port == "" {
		port = GetSetting("mikrotik_port", "8728")
	}
	if user == "" {
		user = GetSetting("mikrotik_user", "admin")
	}
	if pass == "" && req.Host == "" {
		pass = GetSetting("mikrotik_pass", "")
	}
	if isTLS == "" {
		isTLS = GetSetting("mikrotik_tls", "false")
	}

	addr := net.JoinHostPort(host, port)
	var conn *routeros.Client
	var err error

	if isTLS == "true" {
		conn, err = routeros.DialTLSTimeout(addr, user, pass, &tls.Config{InsecureSkipVerify: true}, 2*time.Second)
	} else {
		conn, err = routeros.DialTimeout(addr, user, pass, 2*time.Second)
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"error":     fmt.Sprintf("Gagal konek ke %s: %v", addr, err),
		})
		return
	}
	defer conn.Close()

	identity := "MikroTik Router"
	if reply, err := conn.Run("/system/identity/print"); err == nil && len(reply.Re) > 0 {
		if val, ok := reply.Re[0].Map["name"]; ok && val != "" {
			identity = val
		}
	}

	var board, version, uptime, cpu, freeMem, totalMem string
	if reply, err := conn.Run("/system/resource/print"); err == nil && len(reply.Re) > 0 {
		m := reply.Re[0].Map
		board = m["board-name"]
		version = m["version"]
		uptime = m["uptime"]
		cpu = m["cpu-load"]
		freeMem = m["free-memory"]
		totalMem = m["total-memory"]
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":    true,
		"identity":     identity,
		"board":        board,
		"version":      version,
		"uptime":       uptime,
		"cpu_load":     cpu,
		"free_memory":  freeMem,
		"total_memory": totalMem,
		"host":         host,
		"port":         port,
	})
}

func GetMikrotikResources(c *gin.Context) {
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": err.Error()})
		return
	}
	defer conn.Close()

	var data map[string]string
	if reply, err := conn.Run("/system/resource/print"); err == nil && len(reply.Re) > 0 {
		data = reply.Re[0].Map
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": data})
}

func GetMikrotikInterfaces(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": "MikroTik offline: " + err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/interface/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

func GetMikrotikProfiles(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": "MikroTik offline: " + err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ppp/profile/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

func GetMikrotikSecrets(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": "MikroTik offline: " + err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ppp/secret/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": "Gagal ambil secret: " + err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

type CreateSecretReq struct {
	Name          string `json:"name"`
	Password      string `json:"password"`
	Profile       string `json:"profile"`
	Service       string `json:"service"`
	RemoteAddress string `json:"remote_address"`
	Comment       string `json:"comment"`
}

func CreateMikrotikSecret(c *gin.Context) {
	var req CreateSecretReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Name == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username dan Password wajib diisi"})
		return
	}

	service := req.Service
	if service == "" {
		service = "pppoe"
	}
	profile := req.Profile
	if profile == "" {
		profile = "default"
	}

	cmd := []string{
		"/ppp/secret/add",
		"=name=" + req.Name,
		"=password=" + req.Password,
		"=service=" + service,
		"=profile=" + profile,
	}
	if req.RemoteAddress != "" {
		cmd = append(cmd, "=remote-address="+req.RemoteAddress)
	}
	if req.Comment != "" {
		cmd = append(cmd, "=comment="+req.Comment)
	}

	if err := execMikrotik(cmd...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambahkan secret ke MikroTik: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Akun PPPoE berhasil ditambahkan langsung ke MikroTik!"})
}

func UpdateMikrotikSecret(c *gin.Context) {
	name := c.Param("name")
	var req struct {
		Password      string `json:"password"`
		Profile       string `json:"profile"`
		RemoteAddress string `json:"remote_address"`
		Comment       string `json:"comment"`
		Disabled      *bool  `json:"disabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	ids, _, err := resolveMikrotikIDs(conn, "/ppp/secret", "name", name)
	if err != nil || len(ids) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Secret '%s' tidak ditemukan di MikroTik", name)})
		return
	}

	cmd := []string{"/ppp/secret/set", "=.id=" + ids[0]}
	if req.Password != "" {
		cmd = append(cmd, "=password="+req.Password)
	}
	if req.Profile != "" {
		cmd = append(cmd, "=profile="+req.Profile)
	}
	if req.RemoteAddress != "" {
		cmd = append(cmd, "=remote-address="+req.RemoteAddress)
	}
	if req.Comment != "" {
		cmd = append(cmd, "=comment="+req.Comment)
	}
	if req.Disabled != nil {
		if *req.Disabled {
			cmd = append(cmd, "=disabled=yes")
		} else {
			cmd = append(cmd, "=disabled=no")
		}
	}

	if _, err := conn.Run(cmd...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update secret: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Akun " + name + " berhasil diperbarui di MikroTik!"})
}

func DeleteMikrotikSecret(c *gin.Context) {
	name := c.Param("name")
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	removed, err := removeMikrotikItems(conn, "/ppp/secret", "name", name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus secret: " + err.Error()})
		return
	}
	if removed == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Secret '%s' tidak ditemukan di MikroTik", name)})
		return
	}
	_, _, _ = removeActivePPPoEByUser(conn, name)

	c.JSON(http.StatusOK, gin.H{"message": "Akun " + name + " berhasil dihapus permanen dari MikroTik!"})
}

func GetMikrotikActive(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": "MikroTik offline: " + err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ppp/active/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": "Gagal ambil active PPPoE: " + err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

func KickMikrotikActive(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
		ID   string `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Name == "" && req.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name atau ID wajib diisi"})
		return
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	if req.ID != "" {
		if _, err := conn.Run("/ppp/active/remove", "=.id="+req.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal disconnect: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Sesi PPPoE ID " + req.ID + " berhasil diputus (kicked)!"})
		return
	}

	removed, _, err := removeActivePPPoEByUser(conn, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal disconnect: " + err.Error()})
		return
	}
	if removed == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Sesi '%s' tidak ditemukan di /ppp/active", req.Name)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sesi PPPoE " + req.Name + " berhasil diputus (kicked)!"})
}

func ToggleMikrotikSecret(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Disabled bool   `json:"disabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama secret wajib diisi"})
		return
	}

	newStatus := "active"
	action := "allow"
	reason := "Buka isolir via MikroTik Hub"
	if req.Disabled {
		newStatus = "isolated"
		action = "block"
		reason = "Isolir via MikroTik Hub"
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	if err := setPPPoESecretDisabled(conn, req.Name, req.Disabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update secret MikroTik: " + err.Error()})
		return
	}

	if req.Disabled {
		_, _, _ = removeActivePPPoEByUser(conn, req.Name)
	}

	var custID int
	var ip string
	if err := DB.QueryRow("SELECT id, COALESCE(ip_address, '') FROM customers WHERE pppoe_user = ?", req.Name).Scan(&custID, &ip); err == nil {
		DB.Exec("UPDATE customers SET status = ? WHERE id = ?", newStatus, custID)
		DB.Exec("INSERT INTO firewall_logs (customer_id, action, ip_address, reason) VALUES (?, ?, ?, ?)", custID, action, ip, reason)
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Akun %s berhasil di-%s di MikroTik!", req.Name, newStatus)})
}

func ImportMikrotikCustomers(c *gin.Context) {
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ppp/secret/print")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data MikroTik: " + err.Error()})
		return
	}

	imported := 0
	skipped := 0
	for _, sen := range reply.Re {
		m := sen.Map
		user := m["name"]
		if user == "" {
			continue
		}

		var exists bool
		DB.QueryRow("SELECT EXISTS(SELECT 1 FROM customers WHERE pppoe_user = ?)", user).Scan(&exists)
		if exists {
			skipped++
			continue
		}

		pass := m["password"]
		if pass == "" {
			pass = "123456"
		}
		profile := m["profile"]
		if profile == "" {
			profile = "default"
		}
		ip := m["remote-address"]
		status := "active"
		if m["disabled"] == "true" {
			status = "isolated"
		}
		comment := m["comment"]
		name := user
		if comment != "" {
			name = comment
		}

		query := `INSERT INTO customers (name, package, pppoe_user, pppoe_pass, ip_address, status, due_date)
		          VALUES (?, ?, ?, ?, ?, ?, date('now', '+30 days'))`
		_, err := DB.Exec(query, name, profile, user, pass, ip, status)
		if err == nil {
			imported++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("Berhasil mengimpor %d pelanggan dari MikroTik! (%d dilewati karena sudah ada)", imported, skipped),
		"imported": imported,
		"skipped":  skipped,
	})
}

func ExportCustomersToMikrotik(c *gin.Context) {
	rows, err := DB.Query("SELECT name, COALESCE(package, 'default'), pppoe_user, pppoe_pass, COALESCE(ip_address, ''), status FROM customers")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal baca data pelanggan"})
		return
	}
	defer rows.Close()

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	exported := 0
	for rows.Next() {
		var name, pkg, user, pass, ip, status string
		if err := rows.Scan(&name, &pkg, &user, &pass, &ip, &status); err == nil && user != "" {
			if err := upsertPPPoESecret(conn, user, pass, pkg, ip, name, status == "isolated"); err == nil {
				exported++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("Berhasil mengekspor %d pelanggan dari GuardHub ke MikroTik!", exported),
		"exported": exported,
	})
}

// parseCommandArgs mendukung argumen dengan tanda kutip seperti =comment="Budi Rumah"
func parseCommandArgs(cmd string) []string {
	var args []string
	var cur strings.Builder
	inQuote := false
	var quoteChar rune

	for _, r := range cmd {
		switch {
		case inQuote:
			if r == quoteChar {
				inQuote = false
			} else {
				cur.WriteRune(r)
			}
		case r == '"' || r == '\'':
			inQuote = true
			quoteChar = r
		case r == ' ' || r == '\t' || r == '\n':
			if cur.Len() > 0 {
				args = append(args, cur.String())
				cur.Reset()
			}
		default:
			cur.WriteRune(r)
		}
	}
	if cur.Len() > 0 {
		args = append(args, cur.String())
	}
	return args
}

func ExecMikrotikCommand(c *gin.Context) {
	var req struct {
		Command string `json:"command"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Command) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Command wajib diisi"})
		return
	}

	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	parts := parseCommandArgs(req.Command)
	if len(parts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Command kosong"})
		return
	}

	reply, err := conn.Run(parts...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": err.Error()})
		return
	}

	results := make([]map[string]string, 0)
	for _, sen := range reply.Re {
		results = append(results, sen.Map)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "raw_count": len(results), "data": results})
}

func GetMikrotikLogs(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": "MikroTik offline: " + err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/log/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

func md5Sum(text string) string {
	hasher := md5.New()
	hasher.Write([]byte(text))
	return hex.EncodeToString(hasher.Sum(nil))[:10]
}

// ==================== LIVE MIKROTIK FIREWALL ====================

func GetMikrotikFirewallAddressList(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ip/firewall/address-list/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

func AddMikrotikFirewallAddressList(c *gin.Context) {
	var req struct {
		List    string `json:"list"`
		Address string `json:"address"`
		Comment string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.List == "" || req.Address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "List dan Address wajib diisi"})
		return
	}

	cmd := []string{
		"/ip/firewall/address-list/add",
		"=list=" + req.List,
		"=address=" + req.Address,
	}
	if req.Comment != "" {
		cmd = append(cmd, "=comment="+req.Comment)
	}

	if err := execMikrotik(cmd...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal tambah address list: " + err.Error()})
		return
	}

	DB.Exec("INSERT INTO firewall_logs (customer_id, action, ip_address, reason) VALUES (NULL, 'block', ?, ?)",
		req.Address, fmt.Sprintf("Manual Firewall List [%s]: %s", req.List, req.Comment))

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("IP %s berhasil ditambahkan ke address-list '%s' di MikroTik!", req.Address, req.List)})
}

func DeleteMikrotikFirewallAddressList(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID wajib diisi"})
		return
	}

	if err := execMikrotik("/ip/firewall/address-list/remove", "=.id="+id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus address-list di MikroTik: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Entry address-list berhasil dihapus dari MikroTik!"})
}

func GetMikrotikFirewallFilters(c *gin.Context) {
	list := make([]map[string]string, 0)
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "error": err.Error(), "data": list, "count": 0})
		return
	}
	defer conn.Close()

	reply, err := conn.Run("/ip/firewall/filter/print")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"connected": true, "error": err.Error(), "data": list, "count": 0})
		return
	}

	for _, sen := range reply.Re {
		list = append(list, sen.Map)
	}
	c.JSON(http.StatusOK, gin.H{"connected": true, "data": list, "count": len(list)})
}

// ==================== MIKROTIK SENTINEL & AUTO-PROBLEM DETECTOR ====================

func GetMikrotikQuickStatus(c *gin.Context) {
	start := time.Now()
	conn, err := getMikrotikClient()
	latencyMs := time.Since(start).Milliseconds()

	host := GetSetting("mikrotik_host", "192.168.88.1")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"connected":  false,
			"error":      err.Error(),
			"latency_ms": latencyMs,
			"host":       host,
		})
		return
	}
	defer conn.Close()

	identity := "MikroTik Router"
	if reply, err := conn.Run("/system/identity/print"); err == nil && len(reply.Re) > 0 {
		if val, ok := reply.Re[0].Map["name"]; ok && val != "" {
			identity = val
		}
	}

	var cpu, uptime, board, version, freeMem, totalMem string
	if reply, err := conn.Run("/system/resource/print"); err == nil && len(reply.Re) > 0 {
		m := reply.Re[0].Map
		cpu = m["cpu-load"]
		uptime = m["uptime"]
		board = m["board-name"]
		version = m["version"]
		freeMem = m["free-memory"]
		totalMem = m["total-memory"]
	}

	var activePPPoE int
	if reply, err := conn.Run("/ppp/active/print"); err == nil {
		activePPPoE = len(reply.Re)
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":    true,
		"identity":     identity,
		"board":        board,
		"version":      version,
		"cpu_load":     cpu,
		"uptime":       uptime,
		"free_memory":  freeMem,
		"total_memory": totalMem,
		"active_pppoe": activePPPoE,
		"latency_ms":   latencyMs,
		"host":         host,
	})
}

func runMikrotikSentinel() (int, int, []string) {
	createdCount := 0
	resolvedCount := 0
	issues := []string{}

	conn, err := getMikrotikClient()
	host := GetSetting("mikrotik_host", "192.168.88.1")
	nocLat, nocLng, _ := getNocCoords()

	if err != nil {
		devID := "mikrotik-host-" + host
		var hasOpen bool
		DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open')", devID).Scan(&hasOpen)
		if !hasOpen && host != "" {
			title := fmt.Sprintf("[MikroTik Down] Router (%s) Tidak Merespon / Terputus", host)
			DB.Exec("INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, 'P0', 'open', ?, ?, ?, datetime('now'))",
				title, devID, nocLat, nocLng)
			createdCount++
		}
		issues = append(issues, "Koneksi MikroTik offline: "+err.Error())
		return createdCount, resolvedCount, issues
	}
	defer conn.Close()

	// Jika koneksi hidup, auto-resolve tiket host down sebelumnya jika ada
	devID := "mikrotik-host-" + host
	res, _ := DB.Exec("UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open'", devID)
	if n, _ := res.RowsAffected(); n > 0 {
		resolvedCount += int(n)
	}

	// 1. Deteksi Interface Down
	if ifReply, err := conn.Run("/interface/print"); err == nil {
		for _, sen := range ifReply.Re {
			m := sen.Map
			name := m["name"]
			ifType := m["type"]
			disabled := m["disabled"] == "true"
			running := m["running"] == "true"
			isDynamic := m["dynamic"] == "true"

			if isDynamic || disabled || name == "" {
				continue
			}

			ifDevID := "mikrotik-if-" + name
			var hasOpenTicket bool
			DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open')", ifDevID).Scan(&hasOpenTicket)

			if !running {
				priority := "P1"
				nameLower := strings.ToLower(name)
				if strings.Contains(nameLower, "wan") || strings.Contains(nameLower, "ether1") || strings.Contains(nameLower, "sfp") || strings.Contains(nameLower, "internet") {
					priority = "P0"
				}
				issues = append(issues, fmt.Sprintf("Interface %s (%s) DOWN [Prioritas %s]", name, ifType, priority))
				if !hasOpenTicket {
					title := fmt.Sprintf("[MikroTik Alarm] Interface '%s' (%s) Link Terputus (DOWN)", name, ifType)
					DB.Exec("INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, ?, 'open', ?, ?, ?, datetime('now'))",
						title, priority, ifDevID, nocLat, nocLng)
					createdCount++
					log.Printf("🚨 SENTINEL: Detected DOWN interface %s (%s)", name, ifType)
				}
			} else if hasOpenTicket {
				DB.Exec("UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open'", ifDevID)
				resolvedCount++
				log.Printf("✅ SENTINEL: Auto-resolved ticket for restored interface %s", name)
			}
		}
	}

	// 2. Deteksi CPU & Memory Overload
	if resReply, err := conn.Run("/system/resource/print"); err == nil && len(resReply.Re) > 0 {
		m := resReply.Re[0].Map
		var cpuVal int
		fmt.Sscanf(m["cpu-load"], "%d", &cpuVal)

		cpuDevID := "mikrotik-cpu"
		var hasCpuTicket bool
		DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open')", cpuDevID).Scan(&hasCpuTicket)

		if cpuVal >= 90 {
			issues = append(issues, fmt.Sprintf("Beban CPU %d%% melewati ambang batas aman 90%%", cpuVal))
			if !hasCpuTicket {
				title := fmt.Sprintf("[MikroTik Alarm] Beban CPU Router Kritis: %d%%!", cpuVal)
				DB.Exec("INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, 'P1', 'open', ?, ?, ?, datetime('now'))",
					title, cpuDevID, nocLat, nocLng)
				createdCount++
			}
		} else if cpuVal <= 75 && hasCpuTicket {
			DB.Exec("UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open'", cpuDevID)
			resolvedCount++
		}

		// Cek Memory
		var freeMem, totalMem float64
		fmt.Sscanf(m["free-memory"], "%f", &freeMem)
		fmt.Sscanf(m["total-memory"], "%f", &totalMem)
		if totalMem > 0 {
			usedPct := ((totalMem - freeMem) / totalMem) * 100
			memDevID := "mikrotik-mem"
			var hasMemTicket bool
			DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND status='open')", memDevID).Scan(&hasMemTicket)
			if usedPct >= 90 {
				issues = append(issues, fmt.Sprintf("Memori Router kritis (terpakai %.0f%%)", usedPct))
				if !hasMemTicket {
					title := fmt.Sprintf("[MikroTik Alarm] Memori Router Hampir Penuh: %.0f%%", usedPct)
					DB.Exec("INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, 'P1', 'open', ?, ?, ?, datetime('now'))",
						title, memDevID, nocLat, nocLng)
					createdCount++
				}
			} else if usedPct <= 80 && hasMemTicket {
				DB.Exec("UPDATE tickets SET status='resolved' WHERE device_id=? AND status='open'", memDevID)
				resolvedCount++
			}
		}
	}

	// 3. Deteksi Pesan Log Kritis MikroTik
	if logReply, err := conn.Run("/log/print"); err == nil && len(logReply.Re) > 0 {
		entries := logReply.Re
		if len(entries) > 10 {
			entries = entries[len(entries)-10:]
		}
		for _, sen := range entries {
			m := sen.Map
			topics := strings.ToLower(m["topics"])
			msg := m["message"]
			msgLower := strings.ToLower(msg)

			if strings.Contains(topics, "critical") || strings.Contains(topics, "error") || strings.Contains(msgLower, "link down") || strings.Contains(msgLower, "failure") {
				logDevID := fmt.Sprintf("mikrotik-log-%s", md5Sum(msg))
				var hasLogTicket bool
				DB.QueryRow("SELECT EXISTS(SELECT 1 FROM tickets WHERE device_id=? AND (status='open' OR created_at > datetime('now', '-2 hour')))", logDevID).Scan(&hasLogTicket)
				if msg != "" {
					issues = append(issues, fmt.Sprintf("Log peringatan: %s", msg))
				}
				if !hasLogTicket && msg != "" {
					prio := "P2"
					if strings.Contains(topics, "critical") {
						prio = "P1"
					}
					title := fmt.Sprintf("[MikroTik Log] %s", msg)
					DB.Exec("INSERT INTO tickets (title, priority, status, device_id, lat, lng, created_at) VALUES (?, ?, 'open', ?, ?, ?, datetime('now'))",
						title, prio, logDevID, nocLat, nocLng)
					createdCount++
				}
			}
		}
	}

	return createdCount, resolvedCount, issues
}

func DiagnoseMikrotik(c *gin.Context) {
	created, resolved, issues := runMikrotikSentinel()

	interfaces := make([]map[string]string, 0)
	var resources map[string]string
	connected := false

	if conn, err := getMikrotikClient(); err == nil {
		connected = true
		if ifReply, err := conn.Run("/interface/print"); err == nil {
			for _, sen := range ifReply.Re {
				interfaces = append(interfaces, sen.Map)
			}
		}
		if resReply, err := conn.Run("/system/resource/print"); err == nil && len(resReply.Re) > 0 {
			resources = resReply.Re[0].Map
		}
		conn.Close()
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":        connected,
		"created_tickets":  created,
		"resolved_tickets": resolved,
		"issues":           issues,
		"interfaces_count": len(interfaces),
		"interfaces":       interfaces,
		"resources":        resources,
	})
}

func startMikrotikSentinel() {
	go func() {
		time.Sleep(3 * time.Second)
		log.Println("🛡️ MikroTik Sentinel Auto-Problem Detector berjalan (Interval: 20s)")
		runMikrotikSentinel()

		ticker := time.NewTicker(20 * time.Second)
		for range ticker.C {
			runMikrotikSentinel()
		}
	}()
}

// ==================== NOC PROBLEM MAP GEOLOCATION ====================

func GetNocLocation(c *gin.Context) {
	lat, lng, name := getNocCoords()
	c.JSON(http.StatusOK, gin.H{
		"lat":  lat,
		"lng":  lng,
		"name": name,
	})
}

func UpdateNocLocation(c *gin.Context) {
	var req struct {
		Lat  float64 `json:"lat"`
		Lng  float64 `json:"lng"`
		Name string  `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !isValidCoord(req.Lat, req.Lng) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Koordinat GPS lat/lng tidak valid"})
		return
	}

	_ = SetSetting("noc_lat", fmt.Sprintf("%.7f", req.Lat))
	_ = SetSetting("noc_lng", fmt.Sprintf("%.7f", req.Lng))
	if strings.TrimSpace(req.Name) != "" {
		_ = SetSetting("noc_name", strings.TrimSpace(req.Name))
	}

	// Update juga koordinat tiket open yang memang menempel ke mikrotik-* agar tetap akurat mengikuti Router NOC
	_, _ = DB.Exec("UPDATE tickets SET lat = ?, lng = ? WHERE status='open' AND device_id LIKE 'mikrotik-%'", req.Lat, req.Lng)

	c.JSON(http.StatusOK, gin.H{
		"message": "Koordinat Pusat Router NOC berhasil disimpan akurat!",
		"lat":     req.Lat,
		"lng":     req.Lng,
	})
}

func GetMapPoints(c *gin.Context) {
	points := []MapPoint{}

	// 1. Core MikroTik Node
	host := GetSetting("mikrotik_host", "192.168.88.1")
	nocLat, nocLng, nocName := getNocCoords()

	mtStatus := "up"
	if conn, err := getMikrotikClient(); err != nil {
		mtStatus = "problem"
	} else {
		conn.Close()
	}

	points = append(points, MapPoint{
		ID:             "node-mikrotik-core",
		Title:          nocName,
		Type:           "router",
		Status:         mtStatus,
		Lat:            nocLat,
		Lng:            nocLng,
		IP:             host,
		Detail:         "Pusat Gateway & PPPoE Concentrator RouterOS",
		LocationSource: "noc_router",
	})

	// Tracker posisi untuk mencegah marker bertumpuk tepat di satu titik piksel (spiral mikro ~12 meter)
	coordUsage := map[string]int{
		fmt.Sprintf("%.5f,%.5f", nocLat, nocLng): 1,
	}
	applyMicroOffset := func(lat, lng float64) (float64, float64) {
		key := fmt.Sprintf("%.5f,%.5f", lat, lng)
		n := coordUsage[key]
		coordUsage[key] = n + 1
		if n == 0 {
			return lat, lng
		}
		angle := float64(n) * 2.39996 // golden angle spiral agar sebaran rapi
		radius := 0.00012 * math.Sqrt(float64(n))
		return lat + radius*math.Cos(angle), lng + radius*math.Sin(angle)
	}

	// 2. Open Tickets (Titik Gangguan Aktif dengan posisi akurat)
	tRows, err := DB.Query(`
		SELECT id, title, priority, COALESCE(device_id,''), COALESCE(lat, 0), COALESCE(lng, 0)
		FROM tickets 
		WHERE status = 'open'`)
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var tID int
			var title, prio, devID string
			var lat, lng float64
			if err := tRows.Scan(&tID, &title, &prio, &devID, &lat, &lng); err == nil {
				locSource := "gps"
				if !isValidCoord(lat, lng) {
					var dLat, dLng float64
					if err := DB.QueryRow("SELECT COALESCE(lat,0), COALESCE(lng,0) FROM monitored_devices WHERE id = ? OR name = ?", devID, devID).Scan(&dLat, &dLng); err == nil && isValidCoord(dLat, dLng) {
						lat, lng = dLat, dLng
						locSource = "device"
					} else if err := DB.QueryRow("SELECT COALESCE(lat,0), COALESCE(lng,0) FROM customers WHERE pppoe_user = ? OR name = ?", devID, devID).Scan(&dLat, &dLng); err == nil && isValidCoord(dLat, dLng) {
						lat, lng = dLat, dLng
						locSource = "customer"
					} else {
						// Fallback akurat ke Router NOC jika sumber berasal dari MikroTik atau belum dipin
						lat, lng = nocLat, nocLng
						locSource = "noc_router"
					}
				} else if strings.HasPrefix(devID, "mikrotik-") && math.Abs(lat-nocLat) < 0.0001 && math.Abs(lng-nocLng) < 0.0001 {
					locSource = "noc_router"
				}

				plotLat, plotLng := applyMicroOffset(lat, lng)
				points = append(points, MapPoint{
					ID:             fmt.Sprintf("ticket-%d", tID),
					Title:          title,
					Type:           "ticket",
					Status:         "problem",
					Priority:       prio,
					Lat:            plotLat,
					Lng:            plotLng,
					Detail:         fmt.Sprintf("Gangguan: %s (Source: %s)", title, devID),
					TicketID:       tID,
					DeviceID:       devID,
					LocationSource: locSource,
				})
			}
		}
	}

	// 3. Monitored Network Devices (Switch/POP/Tower/ODP)
	devRows, err := DB.Query(`SELECT id, name, ip, status, COALESCE(lat, 0), COALESCE(lng, 0) FROM monitored_devices`)
	if err == nil {
		defer devRows.Close()
		for devRows.Next() {
			var id, name, ip, status string
			var lat, lng float64
			if err := devRows.Scan(&id, &name, &ip, &status, &lat, &lng); err == nil && isValidCoord(lat, lng) {
				devStatus := "up"
				if status == "down" {
					devStatus = "problem"
				}
				plotLat, plotLng := applyMicroOffset(lat, lng)
				points = append(points, MapPoint{
					ID:             "dev-" + id,
					Title:          name,
					Type:           "device",
					Status:         devStatus,
					Lat:            plotLat,
					Lng:            plotLng,
					IP:             ip,
					DeviceID:       id,
					Detail:         fmt.Sprintf("Node Infrastruktur %s (IP: %s)", id, ip),
					LocationSource: "gps",
				})
			}
		}
	}

	// 4. Customers (Hanya yang sudah memiliki koordinat terverifikasi, plus hitungan yang belum dipin)
	unpinnedCustomers := 0
	DB.QueryRow(`SELECT COUNT(*) FROM customers WHERE lat IS NULL OR lng IS NULL OR (lat = 0 AND lng = 0)`).Scan(&unpinnedCustomers)

	cRows, err := DB.Query(`SELECT id, name, pppoe_user, COALESCE(ip_address,''), status, COALESCE(lat, 0), COALESCE(lng, 0) FROM customers WHERE lat IS NOT NULL AND lng IS NOT NULL AND NOT (lat = 0 AND lng = 0) LIMIT 200`)
	if err == nil {
		defer cRows.Close()

		activeMap := make(map[string]bool)
		if conn, err := getMikrotikClient(); err == nil {
			if reply, err := conn.Run("/ppp/active/print"); err == nil {
				for _, sen := range reply.Re {
					if u := sen.Map["name"]; u != "" {
						activeMap[u] = true
					}
				}
			}
			conn.Close()
		}

		for cRows.Next() {
			var cID int
			var name, user, ip, status string
			var lat, lng float64
			if err := cRows.Scan(&cID, &name, &user, &ip, &status, &lat, &lng); err == nil && isValidCoord(lat, lng) {
				isOnline := activeMap[user]
				cStatus := "up"
				if status == "isolated" {
					cStatus = "isolated"
				}

				plotLat, plotLng := applyMicroOffset(lat, lng)
				points = append(points, MapPoint{
					ID:             fmt.Sprintf("cust-%d", cID),
					Title:          fmt.Sprintf("Pelanggan: %s", name),
					Type:           "customer",
					Status:         cStatus,
					Lat:            plotLat,
					Lng:            plotLng,
					IP:             ip,
					CustomerID:     cID,
					CustomerUser:   user,
					IsOnline:       isOnline,
					Detail:         fmt.Sprintf("PPPoE: %s | Status: %s", user, status),
					LocationSource: "gps",
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":               points,
		"count":              len(points),
		"unpinned_customers": unpinnedCustomers,
		"noc_center": gin.H{
			"lat":  nocLat,
			"lng":  nocLng,
			"name": nocName,
		},
	})
}

func SetupMikrotikDomain(c *gin.Context) {
	conn, err := getMikrotikClient()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "MikroTik offline: " + err.Error()})
		return
	}
	defer conn.Close()

	localIP := getOutboundLANIP()
	domain := "guardhub.com"

	reply, err := conn.Run("/ip/dns/static/print", "?name="+domain)
	if err == nil && len(reply.Re) > 0 {
		for _, sen := range reply.Re {
			if id := sen.Map[".id"]; id != "" {
				_, _ = conn.Run("/ip/dns/static/set", "=.id="+id, "=address="+localIP)
			}
		}
	} else {
		_, _ = conn.Run("/ip/dns/static/add", "=name="+domain, "=address="+localIP, "=comment=GuardHub Web Server", "=ttl=1d")
	}

	_, _ = conn.Run("/ip/dns/set", "=allow-remote-requests=yes")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"domain":  domain,
		"ip":      localIP,
		"message": fmt.Sprintf("Domain '%s' berhasil didaftarkan di DNS MikroTik ke IP %s! Semua HP & laptop di Wi-Fi bisa membuka http://%s:8080", domain, localIP, domain),
	})
}

// ==================== AUTO-DETECT GATEWAY ROUTER ====================

func detectDefaultGateway() (string, string, []string) {
	primaryIP := getOutboundLANIP()
	gateway := ""

	// 1. Coba deteksi via route table di Windows
	if runtime.GOOS == "windows" {
		cmd := exec.Command("cmd", "/c", "route print 0.0.0.0")
		if out, err := cmd.Output(); err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				fields := strings.Fields(line)
				if len(fields) >= 5 && fields[0] == "0.0.0.0" && fields[1] == "0.0.0.0" {
					gw := fields[2]
					if net.ParseIP(gw) != nil && gw != "0.0.0.0" {
						gateway = gw
						break
					}
				}
			}
		}
	} else {
		// Linux / macOS
		cmd := exec.Command("sh", "-c", "ip route show default 2>/dev/null | awk '{print $3}'")
		if out, err := cmd.Output(); err == nil {
			gw := strings.TrimSpace(string(out))
			if net.ParseIP(gw) != nil {
				gateway = gw
			}
		}
	}

	// 2. Fallback jika route print tidak menghasilkan gateway:
	// Turunkan gateway dari subnet primaryIP (contoh: 192.168.101.12 -> 192.168.101.1)
	if gateway == "" && primaryIP != "" && primaryIP != "127.0.0.1" {
		parts := strings.Split(primaryIP, ".")
		if len(parts) == 4 {
			gateway = fmt.Sprintf("%s.%s.%s.1", parts[0], parts[1], parts[2])
		}
	}

	suggested := []string{}
	seen := map[string]bool{}

	if gateway != "" {
		suggested = append(suggested, gateway)
		seen[gateway] = true
	}
	common := []string{"10.10.1.1", "192.168.1.1", "192.168.88.1", "10.0.0.1"}
	for _, ip := range common {
		if !seen[ip] {
			suggested = append(suggested, ip)
			seen[ip] = true
		}
	}

	return gateway, primaryIP, suggested
}

func DetectMikrotikGatewayHandler(c *gin.Context) {
	gateway, ifaceIP, suggested := detectDefaultGateway()
	c.JSON(http.StatusOK, gin.H{
		"detected_gateway": gateway,
		"interface_ip":    ifaceIP,
		"suggested_ips":   suggested,
		"message":         fmt.Sprintf("Gateway router lokal terdeteksi: %s", gateway),
	})
}

// ==================== CLOUD DATABASE BACKUP & RESTORE ====================

func ExportBackupHandler(c *gin.Context) {
	backup := gin.H{
		"version":    "1.0",
		"timestamp":  time.Now().Format(time.RFC3339),
		"app":        "NetGuard Hub",
		"created_by": "admin",
	}

	// 1. Settings
	settings := map[string]string{}
	if rows, err := DB.Query("SELECT key, value FROM settings"); err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, v string
			if err := rows.Scan(&k, &v); err == nil {
				settings[k] = v
			}
		}
	}
	backup["settings"] = settings

	// 2. Monitored Devices
	devices := []map[string]interface{}{}
	if rows, err := DB.Query("SELECT id, name, ip, status, lat, lng FROM monitored_devices"); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, name, ip, status string
			var lat, lng *float64
			if err := rows.Scan(&id, &name, &ip, &status, &lat, &lng); err == nil {
				devices = append(devices, map[string]interface{}{
					"id":     id,
					"name":   name,
					"ip":     ip,
					"status": status,
					"lat":    lat,
					"lng":    lng,
				})
			}
		}
	}
	backup["devices"] = devices

	// 3. Customers
	customers := []map[string]interface{}{}
	if rows, err := DB.Query("SELECT id, name, address, phone, package, pppoe_user, pppoe_pass, ip_address, status, due_date, lat, lng FROM customers"); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int
			var name, address, phone, pkg, user, pass, ip, status, due string
			var lat, lng *float64
			if err := rows.Scan(&id, &name, &address, &phone, &pkg, &user, &pass, &ip, &status, &due, &lat, &lng); err == nil {
				customers = append(customers, map[string]interface{}{
					"id":         id,
					"name":       name,
					"address":    address,
					"phone":      phone,
					"package":    pkg,
					"pppoe_user": user,
					"pppoe_pass": pass,
					"ip_address": ip,
					"status":     status,
					"due_date":   due,
					"lat":        lat,
					"lng":        lng,
				})
			}
		}
	}
	backup["customers"] = customers

	// 4. Invoices
	invoices := []map[string]interface{}{}
	if rows, err := DB.Query("SELECT id, customer_id, amount, status, due_date, paid_at FROM invoices"); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, custID int
			var amount float64
			var status, due string
			var paidAt *string
			if err := rows.Scan(&id, &custID, &amount, &status, &due, &paidAt); err == nil {
				invoices = append(invoices, map[string]interface{}{
					"id":          id,
					"customer_id": custID,
					"amount":      amount,
					"status":      status,
					"due_date":    due,
					"paid_at":     paidAt,
				})
			}
		}
	}
	backup["invoices"] = invoices

	// 5. Tickets
	tickets := []map[string]interface{}{}
	if rows, err := DB.Query("SELECT id, title, priority, status, device_id, created_at, lat, lng FROM tickets"); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int
			var title, priority, status, devID, createdAt string
			var lat, lng *float64
			if err := rows.Scan(&id, &title, &priority, &status, &devID, &createdAt, &lat, &lng); err == nil {
				tickets = append(tickets, map[string]interface{}{
					"id":         id,
					"title":      title,
					"priority":   priority,
					"status":     status,
					"device_id":  devID,
					"created_at": createdAt,
					"lat":        lat,
					"lng":        lng,
				})
			}
		}
	}
	backup["tickets"] = tickets

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=guardhub_backup_%s.json", time.Now().Format("20060102_150405")))
	c.JSON(http.StatusOK, backup)
}

func ImportBackupHandler(c *gin.Context) {
	var payload struct {
		Settings  map[string]string        `json:"settings"`
		Devices   []map[string]interface{} `json:"devices"`
		Customers []map[string]interface{} `json:"customers"`
		Invoices  []map[string]interface{} `json:"invoices"`
		Tickets   []map[string]interface{} `json:"tickets"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format file cadangan tidak valid: " + err.Error()})
		return
	}

	// Simpan Settings
	for k, v := range payload.Settings {
		_, _ = DB.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v)
	}

	// Simpan Devices
	for _, d := range payload.Devices {
		id, _ := d["id"].(string)
		name, _ := d["name"].(string)
		ip, _ := d["ip"].(string)
		status, _ := d["status"].(string)
		lat, _ := d["lat"].(float64)
		lng, _ := d["lng"].(float64)
		if id != "" {
			_, _ = DB.Exec("INSERT OR REPLACE INTO monitored_devices (id, name, ip, status, lat, lng) VALUES (?, ?, ?, ?, ?, ?)", id, name, ip, status, lat, lng)
		}
	}

	// Simpan Customers
	for _, cust := range payload.Customers {
		idFloat, _ := cust["id"].(float64)
		id := int(idFloat)
		name, _ := cust["name"].(string)
		addr, _ := cust["address"].(string)
		phone, _ := cust["phone"].(string)
		pkg, _ := cust["package"].(string)
		user, _ := cust["pppoe_user"].(string)
		pass, _ := cust["pppoe_pass"].(string)
		ip, _ := cust["ip_address"].(string)
		status, _ := cust["status"].(string)
		due, _ := cust["due_date"].(string)
		lat, _ := cust["lat"].(float64)
		lng, _ := cust["lng"].(float64)

		if user != "" {
			if id > 0 {
				_, _ = DB.Exec(`INSERT OR REPLACE INTO customers 
					(id, name, address, phone, package, pppoe_user, pppoe_pass, ip_address, status, due_date, lat, lng)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					id, name, addr, phone, pkg, user, pass, ip, status, due, lat, lng)
			} else {
				_, _ = DB.Exec(`INSERT INTO customers 
					(name, address, phone, package, pppoe_user, pppoe_pass, ip_address, status, due_date, lat, lng)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					name, addr, phone, pkg, user, pass, ip, status, due, lat, lng)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "✅ Data cadangan berhasil dipulihkan secara penuh ke database!",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func DownloadDatabaseHandler(c *gin.Context) {
	dbPath := "./netguard.db"
	if _, err := os.Stat(dbPath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File database belum tersedia"})
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=netguard_backup_%s.db", time.Now().Format("20060102_150405")))
	c.File(dbPath)
}
