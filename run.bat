@echo off
setlocal enabledelayedexpansion
title UTN Academics Dashboard
chcp 65001 >nul
cls

echo =====================================================================
echo         UTN Academics Dashboard - Iniciador de Sistema
echo =====================================================================
echo.

REM --- Verificar Python ---
python --version >nul 2>nul
if !ERRORLEVEL! equ 0 goto :usePython

REM --- Verificar Node/NPM ---
npm --version >nul 2>nul
if !ERRORLEVEL! equ 0 goto :useNode

REM --- Sin servidor: abrir HTML directo ---
echo [!] No se encontro Python ni Node.js.
echo [!] Abriendo index.html directamente en el navegador.
echo.
start "" "%~dp0index.html"
goto :fin

:usePython
echo [+] Python detectado.
echo [+] Servidor en: http://localhost:5016
echo [+] Cerrá esta ventana para detener el servidor.
echo.
start /b cmd /c "timeout /t 2 >nul && start http://localhost:5016"
python -m http.server 5016 --bind 127.0.0.1

goto :fin

:useNode
echo [+] Node.js detectado.
echo [+] Servidor en: http://localhost:5016
echo [+] Cerra esta ventana para detener el servidor.
echo.
start /b cmd /c "timeout /t 3 >nul && start http://localhost:5016"
npx http-server . -p 5016 -s --cors
goto :fin



:fin
echo.
pause
endlocal
