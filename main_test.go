package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// ==================== MOCK ROUTEROS BINARY API SERVER ====================

type mockRouterOS struct {
	mu             sync.Mutex
	listener       net.Listener
	addr           string
	host           string
	port           string
	identity       string
	cpuLoad        string
	freeMem        string
	totalMem       string
	wanRunning     bool
	secrets        []map[string]string
	active         []map[string]string
	addressList    []map[string]string
	logs           []map[string]string
	dnsStatic      []map[string]string
	dnsAllowRemote string
	commandsSeen   [][]string
	nextID         int
}

func startMockRouterOS(t *testing.T) *mockRouterOS {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen mock routeros: %v", err)
	}
	host, port, _ := net.SplitHostPort(ln.Addr().String())
	m := &mockRouterOS{
		listener:   ln,
		addr:       ln.Addr().String(),
		host:       host,
		port:       port,
		identity:   "MikroTik-Lab-Core",
		cpuLoad:    "18",
		freeMem:    "400000000",
		totalMem:   "512000000",
		wanRunning: true,
		secrets: []map[string]string{
			{".id": "*1", "name": "budi_pppoe", "password": "secret", "profile": "20Mbps", "remote-address": "", "disabled": "false", "comment": "Budi Santoso"},
		},
		active: []map[string]string{
			{".id": "*A1", "name": "budi_pppoe", "address": "10.10.20.99", "uptime": "01:15:00", "caller-id": "AA:BB:CC:DD:EE:01"},
		},
		addressList: []map[string]string{},
		logs: []map[string]string{
			{"topics": "system,info", "message": "router booted cleanly"},
		},
		dnsStatic: []map[string]string{},
		nextID:    10,
	}

	go m.serve()
	t.Cleanup(func() { _ = m.listener.Close() })
	return m
}

func (m *mockRouterOS) serve() {
	for {
		conn, err := m.listener.Accept()
		if err != nil {
			return
		}
		go m.handleConn(conn)
	}
}

func readROSLength(r *bufio.Reader) (int, error) {
	b1, err := r.ReadByte()
	if err != nil {
		return 0, err
	}
	if b1&0x80 == 0 {
		return int(b1), nil
	}
	b2, err := r.ReadByte()
	if err != nil {
		return 0, err
	}
	if b1&0xC0 == 0x80 {
		return (int(b1&0x3F) << 8) | int(b2), nil
	}
	b3, err := r.ReadByte()
	if err != nil {
		return 0, err
	}
	if b1&0xE0 == 0xC0 {
		return (int(b1&0x1F) << 16) | (int(b2) << 8) | int(b3), nil
	}
	b4, err := r.ReadByte()
	if err != nil {
		return 0, err
	}
	return (int(b1&0x0F) << 24) | (int(b2) << 16) | (int(b3) << 8) | int(b4), nil
}

func writeROSWord(buf *bytes.Buffer, word string) {
	l := len(word)
	if l < 0x80 {
		buf.WriteByte(byte(l))
	} else if l < 0x4000 {
		var b [2]byte
		binary.BigEndian.PutUint16(b[:], uint16(l)|0x8000)
		buf.Write(b[:])
	} else {
		var b [4]byte
		binary.BigEndian.PutUint32(b[:], uint32(l)|0xC0000000)
		buf.Write(b[:])
	}
	buf.WriteString(word)
}

func writeROSSentence(w io.Writer, words []string) error {
	var buf bytes.Buffer
	for _, wd := range words {
		writeROSWord(&buf, wd)
	}
	buf.WriteByte(0)
	_, err := w.Write(buf.Bytes())
	return err
}

func readROSSentence(r *bufio.Reader) ([]string, error) {
	var words []string
	for {
		l, err := readROSLength(r)
		if err != nil {
			return nil, err
		}
		if l == 0 {
			return words, nil
		}
		data := make([]byte, l)
		if _, err := io.ReadFull(r, data); err != nil {
			return nil, err
		}
		words = append(words, string(data))
	}
}

func (m *mockRouterOS) handleConn(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	for {
		sent, err := readROSSentence(r)
		if err != nil {
			return
		}
		if len(sent) == 0 {
			continue
		}
		cmd := sent[0]
		attrs := map[string]string{}
		queries := map[string]string{}
		tag := ""
		for _, w := range sent[1:] {
			if strings.HasPrefix(w, ".tag=") {
				tag = w
			} else if strings.HasPrefix(w, "=") {
				kv := strings.SplitN(w[1:], "=", 2)
				k := kv[0]
				v := ""
				if len(kv) == 2 {
					v = kv[1]
				}
				attrs[k] = v
			} else if strings.HasPrefix(w, "?") {
				kv := strings.SplitN(w[1:], "=", 2)
				if len(kv) == 2 {
					queries[kv[0]] = kv[1]
				}
			}
		}

		m.mu.Lock()
		m.commandsSeen = append(m.commandsSeen, sent)
		replies := [][]string{}
		errMsg := ""

		switch cmd {
		case "/login":
			// post-6.43 immediate login success
		case "/system/identity/print":
			replies = append(replies, []string{"!re", "=name=" + m.identity})
		case "/system/resource/print":
			replies = append(replies, []string{
				"!re",
				"=board-name=RB4011iGS+",
				"=version=7.14.3",
				"=uptime=3d04:22:10",
				"=cpu-load=" + m.cpuLoad,
				"=free-memory=" + m.freeMem,
				"=total-memory=" + m.totalMem,
			})
		case "/interface/print":
			wanStr := "false"
			if m.wanRunning {
				wanStr = "true"
			}
			replies = append(replies,
				[]string{"!re", "=.id=*I1", "=name=ether1-WAN", "=type=ether", "=running=" + wanStr, "=disabled=false", "=dynamic=false", "=mac-address=00:11:22:33:44:55"},
				[]string{"!re", "=.id=*I2", "=name=ether2-LAN", "=type=ether", "=running=true", "=disabled=false", "=dynamic=false", "=mac-address=00:11:22:33:44:66"},
			)
		case "/ppp/profile/print":
			replies = append(replies,
				[]string{"!re", "=name=default"},
				[]string{"!re", "=name=20Mbps"},
				[]string{"!re", "=name=50Mbps"},
			)
		case "/ppp/secret/print":
			for _, s := range m.secrets {
				if matchQueries(s, queries) {
					replies = append(replies, mapToRe(s))
				}
			}
		case "/ppp/secret/add":
			m.nextID++
			dis := attrs["disabled"]
			if dis == "yes" {
				dis = "true"
			} else if dis == "no" || dis == "" {
				dis = "false"
			}
			item := map[string]string{
				".id":            fmt.Sprintf("*%d", m.nextID),
				"name":           attrs["name"],
				"password":       attrs["password"],
				"profile":        attrs["profile"],
				"remote-address": attrs["remote-address"],
				"comment":        attrs["comment"],
				"disabled":       dis,
			}
			m.secrets = append(m.secrets, item)
		case "/ppp/secret/set":
			id := attrs[".id"]
			if id == "" {
				errMsg = "strict mock requires =.id= instead of =numbers="
				break
			}
			found := false
			for _, s := range m.secrets {
				if s[".id"] == id {
					found = true
					for k, v := range attrs {
						if k == ".id" {
							continue
						}
						if k == "disabled" {
							if v == "yes" {
								v = "true"
							} else if v == "no" {
								v = "false"
							}
						}
						s[k] = v
					}
				}
			}
			if !found {
				errMsg = "no such secret id: " + id
			}
		case "/ppp/secret/remove":
			id := attrs[".id"]
			if id == "" {
				errMsg = "strict mock requires =.id= instead of =numbers="
				break
			}
			m.secrets = removeByID(m.secrets, id)
		case "/ppp/active/print":
			for _, a := range m.active {
				if matchQueries(a, queries) {
					replies = append(replies, mapToRe(a))
				}
			}
		case "/ppp/active/remove":
			id := attrs[".id"]
			if id == "" {
				errMsg = "strict mock requires =.id= instead of =numbers="
				break
			}
			m.active = removeByID(m.active, id)
		case "/ip/firewall/address-list/print":
			for _, al := range m.addressList {
				if matchQueries(al, queries) {
					replies = append(replies, mapToRe(al))
				}
			}
		case "/ip/firewall/address-list/add":
			m.nextID++
			m.addressList = append(m.addressList, map[string]string{
				".id":     fmt.Sprintf("*L%d", m.nextID),
				"list":    attrs["list"],
				"address": attrs["address"],
				"comment": attrs["comment"],
				"dynamic": "false",
			})
		case "/ip/firewall/address-list/remove":
			m.addressList = removeByID(m.addressList, attrs[".id"])
		case "/ip/firewall/filter/print":
			replies = append(replies, []string{"!re", "=.id=*F1", "=chain=forward", "=action=drop", "=src-address-list=ISOLIR"})
		case "/log/print":
			for _, lg := range m.logs {
				replies = append(replies, mapToRe(lg))
			}
		case "/ip/dns/static/print":
			for _, d := range m.dnsStatic {
				if matchQueries(d, queries) {
					replies = append(replies, mapToRe(d))
				}
			}
		case "/ip/dns/static/add":
			m.nextID++
			m.dnsStatic = append(m.dnsStatic, map[string]string{
				".id":     fmt.Sprintf("*D%d", m.nextID),
				"name":    attrs["name"],
				"address": attrs["address"],
				"comment": attrs["comment"],
			})
		case "/ip/dns/static/set":
			for _, d := range m.dnsStatic {
				if d[".id"] == attrs[".id"] {
					if attrs["address"] != "" {
						d["address"] = attrs["address"]
					}
				}
			}
		case "/ip/dns/set":
			m.dnsAllowRemote = attrs["allow-remote-requests"]
		}
		m.mu.Unlock()

		for _, rep := range replies {
			if tag != "" {
				rep = append(rep, tag)
			}
			if err := writeROSSentence(conn, rep); err != nil {
				return
			}
		}

		if errMsg != "" {
			trap := []string{"!trap", "=message=" + errMsg}
			if tag != "" {
				trap = append(trap, tag)
			}
			_ = writeROSSentence(conn, trap)
		}

		done := []string{"!done"}
		if tag != "" {
			done = append(done, tag)
		}
		if err := writeROSSentence(conn, done); err != nil {
			return
		}
	}
}

func matchQueries(item, queries map[string]string) bool {
	for k, v := range queries {
		if item[k] != v {
			return false
		}
	}
	return true
}

func mapToRe(m map[string]string) []string {
	out := []string{"!re"}
	for k, v := range m {
		out = append(out, "="+k+"="+v)
	}
	return out
}

func removeByID(items []map[string]string, id string) []map[string]string {
	res := make([]map[string]string, 0, len(items))
	for _, it := range items {
		if it[".id"] != id {
			res = append(res, it)
		}
	}
	return res
}

// ==================== TEST HARNESS ====================

func setupTestEnv(t *testing.T) (*gin.Engine, *mockRouterOS) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	InitDBWithDSN(dbPath)
	t.Cleanup(func() {
		if DB != nil {
			_ = DB.Close()
		}
	})

	mockMT := startMockRouterOS(t)
	_ = SetSetting("mikrotik_host", mockMT.host)
	_ = SetSetting("mikrotik_port", mockMT.port)
	_ = SetSetting("mikrotik_user", "admin")
	_ = SetSetting("mikrotik_pass", "pass")
	_ = SetSetting("mikrotik_tls", "false")

	return setupRouter(), mockMT
}

func doReq(r *gin.Engine, method, path string, body interface{}, remoteAddr string) *httptest.ResponseRecorder {
	var bodyReader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, path, bodyReader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if remoteAddr == "" {
		remoteAddr = "192.168.101.55:12345"
	}
	req.RemoteAddr = remoteAddr
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ==================== TESTS ====================

func TestLANOnlySecurityMiddleware(t *testing.T) {
	r, _ := setupTestEnv(t)

	allowedIPs := []string{
		"127.0.0.1:4000",
		"[::1]:4000",
		"192.168.101.12:4000",
		"10.10.1.25:4000",
		"172.16.5.9:4000",
		"100.64.20.5:4000",
		"[::ffff:192.168.1.9]:4000",
	}
	for _, addr := range allowedIPs {
		w := doReq(r, "GET", "/api/v1/stats", nil, addr)
		if w.Code != http.StatusOK {
			t.Errorf("expected LAN IP %s allowed (200), got %d (%s)", addr, w.Code, w.Body.String())
		}
	}

	blockedIPs := []string{
		"8.8.8.8:4000",
		"1.1.1.1:4000",
		"203.0.113.10:4000",
		"[2001:4860:4860::8888]:4000",
	}
	for _, addr := range blockedIPs {
		w := doReq(r, "GET", "/api/v1/stats", nil, addr)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected public IP %s blocked (403), got %d", addr, w.Code)
		}
	}
}

func TestStaticWebServingFromServer(t *testing.T) {
	r, _ := setupTestEnv(t)

	if _, err := os.Stat("./frontend/dist/index.html"); err != nil {
		t.Skip("frontend/dist not present, skipping static serve test")
	}

	w := doReq(r, "GET", "/", nil, "192.168.101.50:5555")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "<title>NetGuard Hub") {
		t.Fatalf("expected / to serve index.html, got %d", w.Code)
	}

	wFav := doReq(r, "GET", "/favicon.svg", nil, "192.168.101.50:5555")
	if wFav.Code != http.StatusOK || !strings.Contains(wFav.Body.String(), "<svg") {
		t.Fatalf("expected /favicon.svg to serve SVG file, got %d: %s", wFav.Code, wFav.Body.String())
	}

	w404 := doReq(r, "GET", "/api/v1/does-not-exist", nil, "192.168.101.50:5555")
	if w404.Code != http.StatusNotFound {
		t.Fatalf("expected missing /api route to return 404, got %d", w404.Code)
	}
}

func TestMapLocationAccuracyAndDeviceCRUD(t *testing.T) {
	r, _ := setupTestEnv(t)

	// Invalid NOC coordinates must be rejected
	wBad := doReq(r, "PUT", "/api/v1/map/noc-location", map[string]float64{"lat": 999, "lng": 107.6}, "")
	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid coords 400, got %d", wBad.Code)
	}

	// Set real NOC router coordinate (e.g. Bandung)
	wOK := doReq(r, "PUT", "/api/v1/map/noc-location", map[string]interface{}{
		"lat": -6.9175, "lng": 107.6191, "name": "MikroTik Core Bandung",
	}, "")
	if wOK.Code != http.StatusOK {
		t.Fatalf("expected NOC update 200, got %d: %s", wOK.Code, wOK.Body.String())
	}

	// Create a monitored device (ODP) and mark it DOWN
	wDev := doReq(r, "POST", "/api/v1/devices", map[string]interface{}{
		"id": "ODP-BDG-01", "name": "ODP Dago 01", "ip": "10.10.1.5", "lat": -6.8850, "lng": 107.6135,
	}, "")
	if wDev.Code != http.StatusCreated {
		t.Fatalf("create device failed: %d %s", wDev.Code, wDev.Body.String())
	}

	wStat := doReq(r, "POST", "/api/v1/devices/ODP-BDG-01/status", map[string]string{"status": "down"}, "")
	if wStat.Code != http.StatusOK {
		t.Fatalf("device status update failed: %d %s", wStat.Code, wStat.Body.String())
	}

	// Create customer WITHOUT coordinates and customer WITH accurate coordinates
	wC1 := doReq(r, "POST", "/api/v1/customers", map[string]interface{}{
		"name": "Pelanggan Unpinned", "pppoe_user": "unpinned1", "pppoe_pass": "123",
	}, "")
	if wC1.Code != http.StatusCreated {
		t.Fatalf("create customer1 failed: %d %s", wC1.Code, wC1.Body.String())
	}

	wC2 := doReq(r, "POST", "/api/v1/customers", map[string]interface{}{
		"name": "Pelanggan Akurat", "pppoe_user": "akurat1", "pppoe_pass": "123", "lat": -6.9123, "lng": 107.6188,
	}, "")
	if wC2.Code != http.StatusCreated {
		t.Fatalf("create customer2 failed: %d %s", wC2.Code, wC2.Body.String())
	}

	// Create a ticket tied to the MikroTik router and confirm it inherits exact NOC location
	wTick := doReq(r, "POST", "/api/v1/tickets", map[string]interface{}{
		"title": "[MikroTik Alarm] Link Down test", "priority": "P0", "device_id": "mikrotik-if-ether1",
	}, "")
	if wTick.Code != http.StatusCreated {
		t.Fatalf("create ticket failed: %d %s", wTick.Code, wTick.Body.String())
	}

	// Check /map/points payload
	wMap := doReq(r, "GET", "/api/v1/map/points", nil, "")
	if wMap.Code != http.StatusOK {
		t.Fatalf("get map points failed: %d", wMap.Code)
	}
	var resp struct {
		Data              []MapPoint `json:"data"`
		UnpinnedCustomers int        `json:"unpinned_customers"`
		NocCenter         struct {
			Lat float64 `json:"lat"`
			Lng float64 `json:"lng"`
		} `json:"noc_center"`
	}
	if err := json.Unmarshal(wMap.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json from /map/points: %v", err)
	}
	if resp.UnpinnedCustomers != 1 {
		t.Errorf("expected unpinned_customers=1, got %d", resp.UnpinnedCustomers)
	}
	if resp.NocCenter.Lat != -6.9175 || resp.NocCenter.Lng != 107.6191 {
		t.Errorf("expected updated noc_center (-6.9175, 107.6191), got (%v, %v)", resp.NocCenter.Lat, resp.NocCenter.Lng)
	}

	foundODPDown := false
	foundTicketWithID := false
	foundCust2Exact := false
	for _, pt := range resp.Data {
		if pt.DeviceID == "ODP-BDG-01" {
			foundODPDown = true
			if pt.Status != "problem" {
				t.Errorf("expected ODP-BDG-01 status='problem' when down, got %q", pt.Status)
			}
		}
		if pt.Type == "ticket" && pt.TicketID > 0 {
			foundTicketWithID = true
			if pt.LocationSource != "noc_router" {
				t.Errorf("expected ticket location_source=noc_router, got %q", pt.LocationSource)
			}
		}
		if pt.CustomerUser == "akurat1" {
			foundCust2Exact = true
			if pt.Lat < -6.913 || pt.Lat > -6.912 {
				t.Errorf("expected akurat1 exact lat ~ -6.9123, got %v", pt.Lat)
			}
		}
		if pt.CustomerUser == "unpinned1" {
			t.Errorf("unpinned customer should NOT appear at fake Jakarta coords!")
		}
	}
	if !foundODPDown || !foundTicketWithID || !foundCust2Exact {
		t.Fatalf("missing expected points on map: odp=%v ticket=%v cust2=%v", foundODPDown, foundTicketWithID, foundCust2Exact)
	}

	// Test PATCH /devices/:id untuk ubah koordinat device
	newLat, newLng := -6.8900, 107.6200
	wPatch := doReq(r, "PATCH", "/api/v1/devices/ODP-BDG-01", map[string]interface{}{
		"name": "ODP Dago Updated", "lat": newLat, "lng": newLng,
	}, "")
	if wPatch.Code != http.StatusOK {
		t.Fatalf("patch device failed: %d %s", wPatch.Code, wPatch.Body.String())
	}

	// Verify coordinates changed in /devices
	wDevList := doReq(r, "GET", "/api/v1/devices", nil, "")
	if wDevList.Code != http.StatusOK {
		t.Fatalf("get devices failed: %d", wDevList.Code)
	}
	var devListResp struct {
		Data []MonitoredDevice `json:"data"`
	}
	_ = json.Unmarshal(wDevList.Body.Bytes(), &devListResp)
	foundUpdated := false
	for _, d := range devListResp.Data {
		if d.ID == "ODP-BDG-01" {
			foundUpdated = true
			if d.Name != "ODP Dago Updated" || d.Lat == nil || *d.Lat != newLat || d.Lng == nil || *d.Lng != newLng {
				t.Fatalf("device coordinates not updated properly: %+v", d)
			}
		}
	}
	if !foundUpdated {
		t.Fatalf("updated device ODP-BDG-01 not found in /devices list")
	}
}

func TestAutoIsolirPaymentRestoreAndMikrotikSync(t *testing.T) {
	r, mockMT := setupTestEnv(t)

	// Import existing PPPoE user from mock MikroTik (`budi_pppoe`, currently online at 10.10.20.99 with dynamic DB IP "")
	wImp := doReq(r, "POST", "/api/v1/mikrotik/import-customers", nil, "")
	if wImp.Code != http.StatusOK {
		t.Fatalf("import failed: %d %s", wImp.Code, wImp.Body.String())
	}

	// Fetch imported customer ID
	wCusts := doReq(r, "GET", "/api/v1/customers", nil, "")
	var custResp struct {
		Data []Customer `json:"data"`
	}
	_ = json.Unmarshal(wCusts.Body.Bytes(), &custResp)
	if len(custResp.Data) != 1 || !custResp.Data[0].IsOnline || custResp.Data[0].ActiveIP != "10.10.20.99" {
		t.Fatalf("expected 1 imported customer online at 10.10.20.99, got %+v", custResp.Data)
	}
	custID := custResp.Data[0].ID

	// Create overdue invoice (past due_date) -> runAutoIsolir should trigger
	yesterday := time.Now().AddDate(0, 0, -2).Format("2006-01-02")
	wInv := doReq(r, "POST", "/api/v1/invoices", map[string]interface{}{
		"customer_id": custID, "period": "2026-11", "amount": 150000, "due_date": yesterday,
	}, "")
	if wInv.Code != http.StatusCreated {
		t.Fatalf("create invoice failed: %d %s", wInv.Code, wInv.Body.String())
	}
	var invCreated struct {
		Data Invoice `json:"data"`
	}
	_ = json.Unmarshal(wInv.Body.Bytes(), &invCreated)

	// Trigger explicit auto-isolir synchronously to deterministically test state
	wIso := doReq(r, "POST", "/api/v1/invoices/auto-isolir", nil, "")
	if wIso.Code != http.StatusOK {
		t.Fatalf("auto-isolir failed: %d %s", wIso.Code, wIso.Body.String())
	}

	// Verify DB customer is isolated, firewall_logs recorded captured active IP 10.10.20.99,
	// mock MikroTik secret disabled=true, active session kicked, and IP added to ISOLIR address-list!
	var status string
	DB.QueryRow("SELECT status FROM customers WHERE id = ?", custID).Scan(&status)
	if status != "isolated" {
		t.Fatalf("expected DB customer isolated, got %s", status)
	}

	mockMT.mu.Lock()
	secretDisabled := mockMT.secrets[0]["disabled"]
	activeLen := len(mockMT.active)
	isolirLen := len(mockMT.addressList)
	var isolirAddr string
	if isolirLen > 0 {
		isolirAddr = mockMT.addressList[0]["address"]
	}
	mockMT.mu.Unlock()

	if secretDisabled != "true" {
		t.Errorf("expected mock MikroTik secret disabled='true', got %q", secretDisabled)
	}
	if activeLen != 0 {
		t.Errorf("expected active PPPoE session kicked (0 active), got %d", activeLen)
	}
	if isolirLen == 0 || isolirAddr != "10.10.20.99" {
		t.Errorf("expected dynamic IP 10.10.20.99 added to firewall ISOLIR, got len=%d addr=%q", isolirLen, isolirAddr)
	}

	// Verify SimulatePPPoE rejects isolated user accurately
	wSim := doReq(r, "POST", fmt.Sprintf("/api/v1/customers/%d/pppoe-login", custID), nil, "")
	if wSim.Code != http.StatusForbidden {
		t.Errorf("expected SimulatePPPoE 403 for isolated user, got %d", wSim.Code)
	}

	// Pay invoice -> should restore customer, enable secret in MikroTik, remove from ISOLIR, and resolve [AUTO-ISOLIR] ticket!
	wPay := doReq(r, "PATCH", fmt.Sprintf("/api/v1/invoices/%d/pay", invCreated.Data.ID), nil, "")
	if wPay.Code != http.StatusOK {
		t.Fatalf("pay invoice failed: %d %s", wPay.Code, wPay.Body.String())
	}

	DB.QueryRow("SELECT status FROM customers WHERE id = ?", custID).Scan(&status)
	if status != "active" {
		t.Errorf("expected customer restored to active after paying, got %s", status)
	}

	var openAutoIsoTickets int
	DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE device_id='budi_pppoe' AND status='open' AND title LIKE '[AUTO-ISOLIR]%'").Scan(&openAutoIsoTickets)
	if openAutoIsoTickets != 0 {
		t.Errorf("expected [AUTO-ISOLIR] ticket auto-resolved on full payment, found %d open", openAutoIsoTickets)
	}

	mockMT.mu.Lock()
	secretDisabledAfterPay := mockMT.secrets[0]["disabled"]
	isolirLenAfterPay := len(mockMT.addressList)
	mockMT.mu.Unlock()
	if secretDisabledAfterPay != "false" {
		t.Errorf("expected secret re-enabled ('false') after pay, got %q", secretDisabledAfterPay)
	}
	if isolirLenAfterPay != 0 {
		t.Errorf("expected ISOLIR address-list cleared after pay, got %d entries", isolirLenAfterPay)
	}
}

func TestMikrotikSentinelAndQuotedTerminalAndDomainDNS(t *testing.T) {
	r, mockMT := setupTestEnv(t)

	// Simulate WAN link down + CPU overload (94%) + Memory overload (92%)
	mockMT.mu.Lock()
	mockMT.wanRunning = false
	mockMT.cpuLoad = "94"
	mockMT.freeMem = "40000000"
	mockMT.totalMem = "512000000"
	mockMT.mu.Unlock()

	created, resolved, issues := runMikrotikSentinel()
	if created != 3 || resolved != 0 || len(issues) < 3 {
		t.Fatalf("expected 3 created tickets (WAN, CPU, MEM), got created=%d resolved=%d issues=%v", created, resolved, issues)
	}

	// Second run while still down should NOT create duplicate tickets
	created2, _, _ := runMikrotikSentinel()
	if created2 != 0 {
		t.Errorf("expected 0 duplicate tickets on second sentinel cycle, got %d", created2)
	}

	// Recover WAN, CPU, Memory -> should auto-resolve all 3!
	mockMT.mu.Lock()
	mockMT.wanRunning = true
	mockMT.cpuLoad = "22"
	mockMT.freeMem = "350000000"
	mockMT.mu.Unlock()

	_, resolved3, _ := runMikrotikSentinel()
	if resolved3 != 3 {
		t.Errorf("expected 3 tickets auto-resolved on recovery, got %d", resolved3)
	}

	// Test quoted command argument parsing in Terminal
	args := parseCommandArgs(`/ppp/secret/add =name=andi =comment="Pak Andi Blok B2"`)
	if len(args) != 3 || args[2] != "=comment=Pak Andi Blok B2" {
		t.Fatalf("parseCommandArgs failed on quoted string: %#v", args)
	}

	wCmd := doReq(r, "POST", "/api/v1/mikrotik/exec", map[string]string{
		"command": `/ppp/secret/add =name=andi =password=pw123 =comment="Pak Andi Blok B2"`,
	}, "")
	if wCmd.Code != http.StatusOK || !strings.Contains(wCmd.Body.String(), `"success":true`) {
		t.Fatalf("terminal exec failed: %d %s", wCmd.Code, wCmd.Body.String())
	}

	mockMT.mu.Lock()
	foundQuotedComment := false
	for _, s := range mockMT.secrets {
		if s["name"] == "andi" && s["comment"] == "Pak Andi Blok B2" {
			foundQuotedComment = true
		}
	}
	mockMT.mu.Unlock()
	if !foundQuotedComment {
		t.Errorf("expected quoted comment 'Pak Andi Blok B2' preserved in MikroTik")
	}

	// Test SetupMikrotikDomain (guardhub.com DNS static registration)
	wDNS := doReq(r, "POST", "/api/v1/mikrotik/setup-domain", nil, "")
	if wDNS.Code != http.StatusOK || !strings.Contains(wDNS.Body.String(), `"success":true`) {
		t.Fatalf("setup domain DNS failed: %d %s", wDNS.Code, wDNS.Body.String())
	}
	mockMT.mu.Lock()
	dnsCount := len(mockMT.dnsStatic)
	allowRemote := mockMT.dnsAllowRemote
	mockMT.mu.Unlock()
	if dnsCount != 1 || allowRemote != "yes" {
		t.Errorf("expected guardhub.com DNS static entry + allow-remote-requests=yes, got count=%d allow=%q", dnsCount, allowRemote)
	}
}

func TestAuthLoginRateLimiter(t *testing.T) {
	r, _ := setupTestEnv(t)
	testIP := "192.168.100.88:4433"

	// 1. Percobaan salah ke-1
	w1 := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "wrongpassword",
	}, testIP)
	if w1.Code != http.StatusUnauthorized || !strings.Contains(w1.Body.String(), `"attempts_left":2`) {
		t.Fatalf("expected 401 with attempts_left=2, got %d %s", w1.Code, w1.Body.String())
	}

	// 2. Percobaan salah ke-2
	w2 := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "wrongpassword",
	}, testIP)
	if w2.Code != http.StatusUnauthorized || !strings.Contains(w2.Body.String(), `"attempts_left":1`) {
		t.Fatalf("expected 401 with attempts_left=1, got %d %s", w2.Code, w2.Body.String())
	}

	// 3. Percobaan salah ke-3 -> Harus terkunci (HTTP 429 Too Many Requests) selama 60 detik (1 menit)
	w3 := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "wrongpassword",
	}, testIP)
	if w3.Code != http.StatusTooManyRequests || !strings.Contains(w3.Body.String(), `"locked":true`) || !strings.Contains(w3.Body.String(), `"retry_after":60`) {
		t.Fatalf("expected 429 lockout on 3rd failure with 60s, got %d %s", w3.Code, w3.Body.String())
	}

	// Percobaan saat terkunci (meskipun password benar) harus tetap ditolak 429
	w4 := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "rois_admin",
	}, testIP)
	if w4.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 during lockout window, got %d %s", w4.Code, w4.Body.String())
	}

	// Simulasi jeda 1 menit selesai, lalu user salah lagi 3 kali berturut-turut -> Harus terkunci 3 menit (180 detik)
	loginLimiter.mu.Lock()
	for _, att := range loginLimiter.attempts {
		att.lockedUntil = time.Now().Add(-1 * time.Second) // expired
	}
	loginLimiter.mu.Unlock()

	// Salah ke-1 di sesi ke-2
	doReq(r, "POST", "/api/v1/auth/login", map[string]string{"username": "admin", "password": "wrongpassword2"}, testIP)
	// Salah ke-2 di sesi ke-2
	doReq(r, "POST", "/api/v1/auth/login", map[string]string{"username": "admin", "password": "wrongpassword2"}, testIP)
	// Salah ke-3 di sesi ke-2 -> harus terkunci 180 detik (3 menit)
	wLock2 := doReq(r, "POST", "/api/v1/auth/login", map[string]string{"username": "admin", "password": "wrongpassword2"}, testIP)
	if wLock2.Code != http.StatusTooManyRequests || !strings.Contains(wLock2.Body.String(), `"retry_after":180`) {
		t.Fatalf("expected 429 lockout of 180s (3 menit) on repeat 3x failure, got %d %s", wLock2.Code, wLock2.Body.String())
	}

	// IP lain tidak boleh terpengaruh oleh lockout IP pertama
	cleanIP := "192.168.100.99:5522"
	wClean := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "rois_admin",
	}, cleanIP)
	if wClean.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on correct login from clean IP, got %d %s", wClean.Code, wClean.Body.String())
	}

	// Test login dengan password syaiful_admin HARUS DITOLAK (401 Unauthorized) karena sudah dihapus
	cleanIP2 := "192.168.100.98:5522"
	wSyaiful := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "syaiful_admin",
	}, cleanIP2)
	if wSyaiful.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized with removed password syaiful_admin, got %d %s", wSyaiful.Code, wSyaiful.Body.String())
	}

	var loginResp struct {
		Token    string `json:"token"`
		Username string `json:"username"`
	}
	_ = json.Unmarshal(wClean.Body.Bytes(), &loginResp)
	if loginResp.Token == "" {
		t.Fatalf("expected valid token returned, got empty token")
	}

	// Test auth/check with valid token
	reqCheck, _ := http.NewRequest("GET", "/api/v1/auth/check", nil)
	reqCheck.Header.Set("Authorization", "Bearer "+loginResp.Token)
	reqCheck.RemoteAddr = cleanIP
	wCheck := httptest.NewRecorder()
	r.ServeHTTP(wCheck, reqCheck)
	if wCheck.Code != http.StatusOK || !strings.Contains(wCheck.Body.String(), `"authenticated":true`) {
		t.Fatalf("auth check failed with valid token: %d %s", wCheck.Code, wCheck.Body.String())
	}

	// Test auth/logout
	reqLogout, _ := http.NewRequest("POST", "/api/v1/auth/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer "+loginResp.Token)
	reqLogout.RemoteAddr = cleanIP
	wLogout := httptest.NewRecorder()
	r.ServeHTTP(wLogout, reqLogout)
	if wLogout.Code != http.StatusOK {
		t.Fatalf("logout failed: %d %s", wLogout.Code, wLogout.Body.String())
	}

	// After logout, token must be invalid
	wCheck2 := httptest.NewRecorder()
	r.ServeHTTP(wCheck2, reqCheck)
	if wCheck2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d %s", wCheck2.Code, wCheck2.Body.String())
	}
}

func getAuthToken(t *testing.T, r *gin.Engine, ip string) string {
	wLogin := doReq(r, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin", "password": "rois_admin",
	}, ip)
	var loginResp struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(wLogin.Body.Bytes(), &loginResp); err != nil || loginResp.Token == "" {
		t.Fatalf("failed to get auth token: %v %s", err, wLogin.Body.String())
	}
	return loginResp.Token
}

func TestUpdateExistingDBPassword(t *testing.T) {
	InitDBWithDSN("./netguard.db?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	defer DB.Close()
	_, err := DB.Exec("INSERT INTO settings (key, value) VALUES ('admin_pass', 'rois_admin') ON CONFLICT(key) DO UPDATE SET value = 'rois_admin'")
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	_, _ = DB.Exec("INSERT INTO settings (key, value) VALUES ('admin_user', 'admin') ON CONFLICT(key) DO UPDATE SET value = 'admin'")
	var val string
	DB.QueryRow("SELECT value FROM settings WHERE key = 'admin_pass'").Scan(&val)
	if val != "rois_admin" {
		t.Fatalf("expected admin_pass 'rois_admin', got '%s'", val)
	}
	t.Logf("✅ netguard.db admin_pass is confirmed: %s", val)
}

func TestWAFShield_BlocksMaliciousRequests(t *testing.T) {
	r, _ := setupTestEnv(t)

	// 1. Scanner / Attack tool User-Agent (sqlmap) harus diblokir 403 Forbidden
	req1, _ := http.NewRequest("GET", "/api/v1/auth/check", nil)
	req1.Header.Set("User-Agent", "sqlmap/1.5.2#stable")
	req1.RemoteAddr = "192.168.100.201:1234"
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusForbidden || !strings.Contains(w1.Body.String(), "SECURITY ALERT") {
		t.Fatalf("expected 403 Forbidden for sqlmap, got %d %s", w1.Code, w1.Body.String())
	}

	// 2. Scanner nikto
	req2, _ := http.NewRequest("GET", "/api/v1/auth/check", nil)
	req2.Header.Set("User-Agent", "Mozilla/5.00 (Nikto/2.1.6)")
	req2.RemoteAddr = "192.168.100.202:1234"
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for nikto, got %d %s", w2.Code, w2.Body.String())
	}

	// 3. Path Traversal probe (/.env, /etc/passwd) harus diblokir 403 Forbidden
	req3, _ := http.NewRequest("GET", "/.env", nil)
	req3.Header.Set("User-Agent", "Mozilla/5.0")
	req3.RemoteAddr = "192.168.100.203:1234"
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for /.env, got %d %s", w3.Code, w3.Body.String())
	}

	// 4. Header Keamanan OWASP harus terpasang pada request normal
	req4, _ := http.NewRequest("GET", "/api/v1/auth/check", nil)
	req4.Header.Set("User-Agent", "Mozilla/5.0")
	req4.RemoteAddr = "192.168.100.204:1234"
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)
	if w4.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("expected X-Frame-Options: DENY, got %s", w4.Header().Get("X-Frame-Options"))
	}
	if w4.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options: nosniff, got %s", w4.Header().Get("X-Content-Type-Options"))
	}
}

func TestGatewayDetectionAndBackupExportImport(t *testing.T) {
	r, _ := setupTestEnv(t)
	token := getAuthToken(t, r, "192.168.100.99:3333")

	// 1. Test Gateway Detection
	reqGW, _ := http.NewRequest("GET", "/api/v1/mikrotik/detect-gateway", nil)
	reqGW.Header.Set("Authorization", "Bearer "+token)
	reqGW.RemoteAddr = "192.168.100.99:3333"
	wGW := httptest.NewRecorder()
	r.ServeHTTP(wGW, reqGW)
	if wGW.Code != http.StatusOK || !strings.Contains(wGW.Body.String(), "suggested_ips") {
		t.Fatalf("detect gateway failed: %d %s", wGW.Code, wGW.Body.String())
	}

	// 2. Test Backup Export
	reqExport, _ := http.NewRequest("GET", "/api/v1/backup/export", nil)
	reqExport.Header.Set("Authorization", "Bearer "+token)
	reqExport.RemoteAddr = "192.168.100.99:3333"
	wExport := httptest.NewRecorder()
	r.ServeHTTP(wExport, reqExport)
	if wExport.Code != http.StatusOK || !strings.Contains(wExport.Body.String(), `"version":"1.0"`) {
		t.Fatalf("backup export failed: %d %s", wExport.Code, wExport.Body.String())
	}

	// 3. Test Backup Import
	var backupData map[string]interface{}
	if err := json.Unmarshal(wExport.Body.Bytes(), &backupData); err != nil {
		t.Fatalf("failed to parse exported backup: %v", err)
	}

	bodyImport, _ := json.Marshal(backupData)
	reqImport, _ := http.NewRequest("POST", "/api/v1/backup/import", bytes.NewBuffer(bodyImport))
	reqImport.Header.Set("Authorization", "Bearer "+token)
	reqImport.Header.Set("Content-Type", "application/json")
	reqImport.RemoteAddr = "192.168.100.99:3333"
	wImport := httptest.NewRecorder()
	r.ServeHTTP(wImport, reqImport)
	if wImport.Code != http.StatusOK || !strings.Contains(wImport.Body.String(), "berhasil dipulihkan") {
		t.Fatalf("backup import failed: %d %s", wImport.Code, wImport.Body.String())
	}
}
