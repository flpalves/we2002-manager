@echo off
rem Abre o app do campeonato. Na primeira vez instala o Electron.
cd /d "%~dp0"
if not exist node_modules\electron goto instalar
goto abrir

:instalar
echo Instalando o Electron (so na primeira vez)...
call npm install
if errorlevel 1 goto erro

:abrir
call npm start
goto fim

:erro
echo.
echo Falhou a instalacao. Confira se o Node.js esta instalado: node -v
pause

:fim
