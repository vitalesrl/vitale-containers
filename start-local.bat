@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installazione dipendenze...
  call npm install
  if errorlevel 1 exit /b 1
)

for /f %%A in ('node -p "process.arch"') do set "NODE_ARCH=%%A"

echo.
echo Vitale Containers
echo Frontend: http://localhost:4000
echo Backend : http://localhost:4001
echo Admin   : http://localhost:4000/admin
echo Node    : %NODE_ARCH%
echo.

if /I "%NODE_ARCH%"=="ia32" (
  echo PC 32-bit rilevato: avvio modalita LOW MEMORY.
  call npm run dev:32
) else (
  call npm run dev
)
