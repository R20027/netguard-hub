@echo off
title NetGuard Hub - Android APK Builder
echo ========================================================
echo          NETGUARD HUB - ANDROID APK BUILDER             
echo ========================================================

:: 1. Deteksi JAVA_HOME jika belum ada di environment
if "%JAVA_HOME%"=="" (
    for /d %%D in ("%ProgramFiles%\Microsoft\jdk-17*" "%ProgramFiles%\Java\jdk-17*" "%ProgramFiles%\Eclipse Adoptium\jdk-17*" "%ProgramFiles%\Java\jdk*") do (
        if exist "%%~D\bin\javac.exe" (
            set "JAVA_HOME=%%~D"
            goto found_java
        )
    )
    for /d %%D in ("%ProgramFiles(x86)%\Microsoft\jdk-17*" "%ProgramFiles(x86)%\Java\jdk-17*" "%LocalAppData%\Programs\Eclipse Adoptium\jdk-17*") do (
        if exist "%%~D\bin\javac.exe" (
            set "JAVA_HOME=%%~D"
            goto found_java
        )
    )
)

:found_java
if not "%JAVA_HOME%"=="" (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
    echo [✓] Java JDK terdeteksi di: %JAVA_HOME%
) else (
    echo [!] PERINGATAN: Java JDK 17 tidak ditemukan secara otomatis.
    echo Pastikan JDK 17 telah terinstal di komputer.
)

:: 2. Build Frontend React
echo.
echo [1/4] Membangun bundle produksi Frontend (Vite)...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [X] Gagal melakukan build frontend.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Sinkronkan ke Android Project (Capacitor)
echo.
echo [2/4] Menyinkronkan aset web ke platform Android...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [X] Gagal sinkronisasi Capacitor.
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Kompilasi APK dengan Gradle Wrapper
echo.
echo [3/4] Mengompilasi Android APK dengan Gradle...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Kompilasi Gradle memerlukan Android SDK / JDK yang valid.
    echo Anda juga dapat membuka folder 'frontend\android' langsung di Android Studio.
    pause
    exit /b %ERRORLEVEL%
)

:: 5. Salin APK ke folder utama
echo.
echo [4/4] Menyalin APK ke folder utama...
cd ..\..
if exist "frontend\android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "frontend\android\app\build\outputs\apk\debug\app-debug.apk" "NetGuard-Hub.apk"
    echo.
    echo ========================================================
    echo  BERHASIL! Android APK telah dibuat:
    echo  File: %CD%\NetGuard-Hub.apk
    echo ========================================================
) else (
    echo [!] File APK tidak ditemukan di path output standar.
)

pause
