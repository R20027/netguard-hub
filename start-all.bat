@echo off
title NetGuard Hub - Web Server Launcher (LAN Only)
echo ===================================================
echo        STARTING NETGUARD HUB WEB SERVER            
echo          [TANPA APK - AKSES VIA BROWSER]           
echo ===================================================

:: Deteksi IP Lokal (Wi-Fi / Ethernet)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "169.254"') do (
    set "LOCAL_IP=%%a"
    goto found_ip
)
:found_ip
set "LOCAL_IP=%LOCAL_IP: =%"

echo [1/2] Menjalankan NetGuard Hub Server (Web UI + Backend API :8080)...
start "NetGuard Hub Server" cmd /k "go run ."

echo [2/2] Menjalankan Probe Monitoring Agent...
start "NetGuard Probe" cmd /k "python -u probe.py"

echo ===================================================
echo Server NetGuard Hub berhasil diluncurkan!
echo.
echo [!] Akses dari Komputer Server ini:
echo     http://localhost:8080  atau  http://guardhub.com:8080
echo.
if not "%LOCAL_IP%"=="" (
    echo [!] Akses dari HP / Laptop lain (1 Jaringan Wi-Fi/LAN yang sama):
    echo     http://%LOCAL_IP%:8080
    echo     http://guardhub.com:8080  (jika DNS MikroTik sudah disetup)
    echo.
)
echo [V] Proteksi Keamanan:
echo     Hanya perangkat dalam 1 LAN yang dapat mengakses.
echo     Akses dari internet publik otomatis ditolak (403 Forbidden).
echo ===================================================
pause
