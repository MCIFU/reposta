@echo off
chcp 65001 >nul
REM Abre Reposta en este PC, sin Vercel: se actualiza desde GitHub, compila solo si hay cambios y abre el navegador.
cd /d "%~dp0"
title Reposta
set PORT=3002
REM Clave opcional de openrouteservice.org para las rutas de la pestana Viaje: set ORS_API_KEY=tu_clave
echo.
echo   Arrancando Reposta en http://localhost:%PORT%
echo   Deja esta ventana abierta mientras lo uses.
echo.
where node >nul 2>nul || (echo   Falta Node.js: instalalo desde https://nodejs.org y vuelve a abrir este archivo. & pause & exit /b 1)
where git >nul 2>nul && if exist ".git" (
  echo   Buscando actualizaciones...
  REM npm reescribe package-lock.json al instalar: se descarta para que la actualizacion no se bloquee
  git checkout -- package-lock.json >nul 2>nul
  git pull --ff-only -q origin main || echo   No pude actualizar: se abre la version que tienes.
)
set COMMIT=
set HECHO=
for /f %%c in ('git rev-parse HEAD 2^>nul') do set COMMIT=%%c
if exist "apps\web\.next\COMMIT_LOCAL" set /p HECHO=<"apps\web\.next\COMMIT_LOCAL"
if not exist node_modules goto compilar
if not "%COMMIT%"=="%HECHO%" goto compilar
goto arrancar
:compilar
echo   Hay cambios: instalando y compilando (la primera vez tarda unos minutos)...
call npm install --no-audit --no-fund
if errorlevel 1 goto error
call npm run build
if errorlevel 1 goto error
if not "%COMMIT%"=="" >"apps\web\.next\COMMIT_LOCAL" echo %COMMIT%
:arrancar
REM si ya habia una copia abierta en este puerto, se cierra
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>&1
start "" cmd /c "timeout /t 4 >nul & start http://localhost:%PORT%"
call npm start
goto fin
:error
echo.
echo   Algo ha fallado al instalar o compilar. Copia lo de arriba y pasaselo a Claude.
pause
:fin
