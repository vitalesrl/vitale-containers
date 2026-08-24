@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installazione dipendenze...
  call npm install
  if errorlevel 1 exit /b 1
)

echo.
echo Vitale Containers - modalita 32-bit LOW MEMORY
echo Frontend: http://localhost:4000
echo Backend : http://localhost:4001
echo Admin   : http://localhost:4000/admin
echo.
call npm run dev:32
