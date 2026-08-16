@echo off
title UTN Academics Dashboard - Iniciar Sistema
chcp 65001 > nul
cls

echo =====================================================================
echo           UTN Academics Dashboard - Iniciador de Sistema
echo =====================================================================
echo.

REM Buscar Python
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [+] Se detecto Python en el sistema.
    echo [+] Iniciando servidor local en el puerto 8000...
    echo [+] Abriendo navegador en http://localhost:8000 ...
    echo.
    echo Para detener el servidor, cierre esta ventana o presione Ctrl+C.
    echo.
    start "" http://localhost:8000
    python -m http.server 8000
    goto end
)

REM Buscar Node/NPM
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [+] Se detecto Node.js/NPM en el sistema.
    echo [+] Iniciando servidor local con http-server en el puerto 8080...
    echo [+] Abriendo navegador en http://localhost:8080 ...
    echo.
    echo Para detener el servidor, cierre esta ventana o presione Ctrl+C.
    echo.
    start "" http://localhost:8080
    npx http-server -p 8080 --silent
    goto end
)

REM Alternativa: Abrir archivo HTML directamente
echo [!] No se detecto Python ni Node.js en el sistema.
echo [!] Iniciando la aplicacion abriendo el archivo index.html directamente.
echo.
start "" "%~dp0index.html"

:end
echo.
pause
