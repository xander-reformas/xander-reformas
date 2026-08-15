@echo off
title XANDER - Desplegar en Vercel

pushd "%~dp0"

:: Añadir Git al PATH por si acaso
if exist "C:\Program Files\Git\bin\git.exe" (
    set "PATH=%PATH%;C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
)

echo.
echo === XANDER Reformas - Desplegar en Vercel ===
echo.
echo PASO 1: Login en Vercel
echo Se abrira el navegador. Entra con Google o crea cuenta.
echo Cuando el navegador diga "Authenticated" vuelve aqui.
echo.
call vercel login
if %errorlevel% neq 0 (
    echo ERROR en login. Intenta de nuevo.
    pause
    exit /b 1
)
echo Login OK.
echo.

echo PASO 2: Desplegando la app...
echo.
echo Vercel hara unas preguntas, responde:
echo   Set up and deploy?   Y + Enter
echo   Which scope?         tu usuario + Enter
echo   Link to existing?    N + Enter
echo   Project name?        xander-reformas + Enter
echo   Directory?           solo Enter
echo   Override settings?   N + Enter
echo.
call vercel --prod

echo.
echo ============================================
echo  LISTO - Copia la URL de arriba (*.vercel.app)
echo  y dasela a Claude para configurar las
echo  variables de entorno.
echo ============================================
echo.
pause
