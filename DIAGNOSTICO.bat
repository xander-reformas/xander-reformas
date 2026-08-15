@echo off
title Diagnostico XANDER
cd /d "%~dp0"
echo Carpeta actual: %CD%
echo.
echo Comprobando node_modules\.bin\vite...
if exist "node_modules\.bin\vite" (
  echo VITE: ENCONTRADO
) else (
  echo VITE: NO ENCONTRADO - hay que instalar
)
echo.
echo Comprobando npm...
where npm
echo.
echo Comprobando node...
where node
echo.
echo Version de node:
node --version
echo.
echo Version de npm:
npm --version
echo.
pause
