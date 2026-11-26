@echo off
title NetGuard Hub - Setup Domain guardhub.com
echo ========================================================
echo        SETUP DOMAIN LOKAL: guardhub.com               
echo ========================================================
echo Script ini mendaftarkan 'guardhub.com' ke file hosts Windows.
echo (Jalankan Klik Kanan - Run as Administrator jika diminta)
echo.

findstr /i "guardhub.com" "%windir%\system32\drivers\etc\hosts" >nul
if %errorlevel% equ 0 (
    echo [OK] Domain guardhub.com SUDAH TERDAFTAR di file hosts Windows!
) else (
    echo 127.0.0.1 guardhub.com >> "%windir%\system32\drivers\etc\hosts"
    if %errorlevel% equ 0 (
        echo [OK] Berhasil menambahkan '127.0.0.1 guardhub.com' ke hosts!
    ) else (
        echo [!] Gagal menulis ke hosts. Pastikan klik kanan 'Run as administrator'.
    )
)

echo.
echo ========================================================
echo Sekarang Anda bisa membuka di browser:
echo http://guardhub.com:5173
echo ========================================================
pause
