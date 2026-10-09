@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js o'rnatilmagan. https://nodejs.org saytidan LTS versiyasini o'rnating. & pause & exit /b 1)
if not exist node_modules (echo Kutubxonalar o'rnatilmoqda, 1-3 daqiqa... & call npm install --no-audit --no-fund || (pause & exit /b 1))
call npm start
pause
