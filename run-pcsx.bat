@echo off
setlocal
rem Abre o PCSX-Redux com o WE2002 e carrega a ponte Lua.
rem   run-pcsx.bat         abre o emulador e libera o terminal
rem   run-pcsx.bat debug   roda preso ao terminal e mostra os logs (inclusive print do Lua)
rem
rem Caminhos (o manager passa pelas variaveis de ambiente, vindas das Configuracoes):
rem   WE_EMU  executavel do PCSX-Redux  (padrao: emulador\pcsx-redux\pcsx-redux.exe)
rem   WE_ISO  imagem do jogo (.cue)      (padrao: emulador\we2002.cue)

set "RAIZ=%~dp0"
if defined WE_EMU (set "EMU=%WE_EMU%") else (set "EMU=%RAIZ%emulador\pcsx-redux\pcsx-redux.exe")
if defined WE_ISO (set "ISO=%WE_ISO%") else (set "ISO=%RAIZ%emulador\we2002.cue")
set "SCRIPT=%RAIZ%bridge\we2002.lua"

if not exist "%EMU%" goto :sem_emu
if not exist "%ISO%" goto :notfound
rem Converte as bandeiras/escudos configurados (precisa de "npm install" uma vez)
if not exist "%RAIZ%node_modules\jpeg-js\package.json" goto :sem_npm
node "%RAIZ%tools\converter-bandeira.mjs"
rem Converte os kits dos dois times do partida.json (senao a ponte usa os da partida anterior)
node "%RAIZ%tools\converter-kit-ps1.mjs"
goto :bandeiras_ok
:sem_npm
echo Aviso: rode "npm install" uma vez na pasta do projeto para converter as bandeiras.
:bandeiras_ok
echo Abrindo: "%ISO%"
if /i "%~1"=="debug" goto :debug

start "" "%EMU%" -iso "%ISO%" -dofile "%SCRIPT%" -run -interpreter
exit /b 0

:debug
"%EMU%" -iso "%ISO%" -dofile "%SCRIPT%" -run -interpreter -stdout -lua_stdout
exit /b %errorlevel%

:sem_emu
echo PCSX-Redux nao encontrado: "%EMU%"
pause
exit /b 1

:notfound
echo Jogo nao encontrado: "%ISO%"
pause
exit /b 1
