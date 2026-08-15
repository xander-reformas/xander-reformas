@echo off
title XANDER Gestion SaaS
echo.
echo  ============================================
echo   XANDER Gestion SaaS
echo  ============================================
echo.
cd /d "%~dp0"

if not exist "node_modules\.bin\vite" (
  echo  Instalando dependencias por primera vez...
  echo  Esto tarda 1-2 minutos, espera...
  echo.
  npm install
  if errorlevel 1 (
    echo.
    echo  ERROR: Fallo la instalacion. Comprueba tu conexion a internet.
    pause
    exit /b 1
  )
  echo.
  echo  Instalacion completada!
  echo.
)

echo  Iniciando servidor en http://localhost:3000
echo  Presiona Ctrl+C para detener la app.
echo.
npm run dev
pause
