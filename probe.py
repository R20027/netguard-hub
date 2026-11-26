import requests
import time
import subprocess
import platform

# ========== KONFIGURASI ==========
API_BASE = "http://localhost:8080/api/v1"
TICKETS_URL = f"{API_BASE}/tickets"
DEVICES_URL = f"{API_BASE}/devices"
POLLING_INTERVAL = 30  # detik

# Fallback default jika backend belum siap
DEFAULT_DEVICES = [
    {"id": "SW-JKT-01", "ip": "8.8.8.8", "name": "Switch Core JKT"},
    {"id": "RTR-SBY-01", "ip": "1.1.1.1", "name": "Router Surabaya"},
    {"id": "SRV-DC-01", "ip": "192.168.1.100", "name": "Server DC-01"},
]

last_status = {}
# ==================================

def ping_ip(ip):
    """Nge-ping IP, return True kalau hidup, False kalau mati"""
    is_windows = platform.system().lower() == "windows"
    param = "-n" if is_windows else "-c"
    timeout_param = ["-w", "2000"] if is_windows else ["-W", "2"]
    command = ["ping", param, "1"] + timeout_param + [ip]
    try:
        output = subprocess.run(command, capture_output=True, text=True, timeout=5)
        if output.returncode != 0:
            return False
        stdout_lower = output.stdout.lower()
        if "unreachable" in stdout_lower or "timed out" in stdout_lower or "failure" in stdout_lower:
            return False
        if is_windows:
            return "ttl=" in stdout_lower
        return True
    except Exception:
        return False

def fetch_devices():
    """Ambil daftar device dinamis dari backend NetGuard Hub"""
    try:
        resp = requests.get(DEVICES_URL, timeout=5)
        if resp.status_code == 200:
            devs = resp.json().get("data") or []
            if devs:
                return devs
    except Exception:
        pass
    return DEFAULT_DEVICES

def update_device_status(device_id, status):
    """Update kolom status & last_ping pada tabel monitored_devices"""
    try:
        requests.post(f"{DEVICES_URL}/{device_id}/status", json={"status": status}, timeout=5)
    except Exception:
        pass

def has_open_ticket(device_id):
    """Cek apakah sudah ada tiket open untuk device ini agar tidak duplicate"""
    try:
        resp = requests.get(f"{TICKETS_URL}?device_id={device_id}&status=open", timeout=5)
        if resp.status_code == 200:
            tickets = resp.json().get("data", []) or []
            return len(tickets) > 0
    except Exception:
        pass
    return False

def create_ticket(title, priority, device_id, lat=None, lng=None):
    """Buat tiket via API backend jika belum ada tiket open"""
    if has_open_ticket(device_id):
        return False

    data = {
        "title": title,
        "priority": priority,
        "device_id": device_id,
    }
    if lat and lng:
        data["lat"] = lat
        data["lng"] = lng

    try:
        resp = requests.post(TICKETS_URL, json=data, timeout=5)
        return resp.status_code in (200, 201)
    except Exception as e:
        print(f"⚠️ Gagal buat tiket untuk {device_id}: {e}")
        return False

def resolve_ticket(device_id):
    """Tutup semua tiket open otomatis untuk device tertentu"""
    try:
        resp = requests.get(f"{TICKETS_URL}?device_id={device_id}&status=open", timeout=5)
        if resp.status_code != 200:
            return
        tickets = resp.json().get("data", []) or []
        for t in tickets:
            if t.get("device_id") == device_id and t.get("status") == "open":
                ticket_id = t["id"]
                requests.patch(f"{TICKETS_URL}/{ticket_id}/status", json={"status": "resolved"}, timeout=5)
    except Exception as e:
        print(f"⚠️ Gagal resolve tiket untuk {device_id}: {e}")

def monitor():
    print("🛡️ NetGuard Probe Agent Started (Dynamic DB Sync)!")
    print(f"📡 Interval pemantauan: {POLLING_INTERVAL} detik")
    print("=" * 55)

    while True:
        devices = fetch_devices()
        for device in devices:
            device_id = device["id"]
            ip = device["ip"]
            name = device["name"]
            lat = device.get("lat")
            lng = device.get("lng")

            is_up = ping_ip(ip)
            current = "up" if is_up else "down"
            previous = last_status.get(device_id, device.get("status", "up"))

            # Selalu sinkronkan status up/down terkini ke DB agar warna di Peta akurat
            update_device_status(device_id, current)

            if is_up and (previous == "down" or has_open_ticket(device_id)):
                print(f"✅ [{name}] ({ip}) UP - Tiket ditutup otomatis")
                resolve_ticket(device_id)
            elif not is_up and not has_open_ticket(device_id):
                print(f"❌ [{name}] ({ip}) DOWN - Buat tiket P0!")
                title = f"[AUTO] {name} ({ip}) DOWN"
                create_ticket(title, "P0", device_id, lat=lat, lng=lng)

            last_status[device_id] = current

        time.sleep(POLLING_INTERVAL)

if __name__ == "__main__":
    try:
        monitor()
    except KeyboardInterrupt:
        print("\n🛑 Probe Agent dihentikan.")
