-- WE2002 Manager - ponte com o PCSX-Redux (fase 1)
--
-- Como carregar:
--   * pelo run-pcsx.bat (usa -dofile), ou
--   * no console Lua do PCSX-Redux:  dofile 'D:/we2002-manager/bridge/we2002.lua'
--
-- Abre a janela "WE2002 Bridge" com:
--   1. Busca por diferença na RAM (para achar estado do jogo, IDs dos times...)
--   2. Watches: endereços vigiados ao vivo, com escrita e congelamento
--   3. partida.json: leitura do arquivo e injeção dos IDs (quando mapeados)

-- Caminhos ---------------------------------------------------------------
local src = debug.getinfo(1, "S").source:gsub("^@", ""):gsub("\\", "/")
local BRIDGE = src:match("^(.*)/[^/]+$") or "."
local ROOT = BRIDGE:match("^(.*)/[^/]+$") or ".."

package.path = BRIDGE .. "/?.lua;" .. BRIDGE .. "/lib/?.lua;" .. package.path
for _, m in ipairs({ "mem", "json", "search", "offsets", "resultado", "bandeiras", "edicao" }) do package.loaded[m] = nil end

local mem = require("mem")
local json = require("json")
local search = require("search")
local offsets = require("offsets")

local PATHS = {
  partida = ROOT .. "/data/partida.json",
  resultado = ROOT .. "/data/resultado.json",
  watches = BRIDGE .. "/watches.json",
  dumps = ROOT .. "/dumps",
  states = ROOT .. "/states",
  bridge = BRIDGE,
}
PATHS.estado_amistoso = PATHS.states .. "/amistoso.sstate"
-- Estados base por modo de controle (todos parados na tela das bandeiras, Brasil x Holanda,
-- antes de confirmar o visitante). O partida.json escolhe com "controle".
local ESTADOS_BASE = {
  { id = "p1_cpu",  nome = "P1 (casa) x CPU",       arquivo = "amistoso.sstate" },
  { id = "cpu_p1",  nome = "CPU x P1 (visitante)",  arquivo = "base_cpu_p1.sstate" },
  { id = "p1_p2",   nome = "P1 x P2",               arquivo = "base_p1_p2.sstate" },
  { id = "cpu_cpu", nome = "CPU x CPU",             arquivo = "base_cpu_cpu.sstate" },
}
local function estado_base_path(id)
  for _, e in ipairs(ESTADOS_BASE) do
    if e.id == id then return PATHS.states .. "/" .. e.arquivo, e end
  end
  return nil
end

local function log(...)
  local parts = {}
  for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
  print("[we2002] " .. table.concat(parts, " "))
end

-- Estado da UI -----------------------------------------------------------
local ui = {
  search_width = 1,
  search_value = "0",
  new_watch_addr = "",
  new_watch_label = "",
  status = "Pronto.",
  partida = nil,
  partida_erro = nil,
}

-- Watches ----------------------------------------------------------------
-- { addr = <físico>, width = 1|2|4, label = "...", frozen = false, freeze_value = n, edit = "" }
local watches = json.read_file(PATHS.watches) or {}
for _, w in ipairs(watches) do w.edit = w.edit or ""; w.frozen = false end

local function save_watches()
  local out = {}
  for i, w in ipairs(watches) do
    out[i] = { addr = w.addr, width = w.width, label = w.label }
  end
  local ok, e = json.write_file(PATHS.watches, out)
  ui.status = ok and ("Watches salvos em " .. PATHS.watches) or ("Erro ao salvar: " .. tostring(e))
end

local function add_watch(addr, width, label)
  watches[#watches + 1] = {
    addr = mem.phys(addr), width = width or 1,
    label = label ~= "" and label or mem.fmt(addr), frozen = false, edit = "",
  }
end

local function parse_num(s)
  s = (s or ""):gsub("%s", "")
  if s:match("^0[xX]") then return tonumber(s:sub(3), 16) end
  if s:match("^%$") then return tonumber(s:sub(2), 16) end
  return tonumber(s)
end

-- Congelamento: reescreve o valor a cada VSync -----------------------------
-- Patches contínuos (estilo GameShark): blocos de bytes reescritos a cada VSync.
-- Necessário porque o jogo recarrega os dados do CD ao apertar INICIAR e
-- sobrescreve qualquer escrita feita antes.
local patches = {} -- [chave] = { addr = <físico>, bytes = { ... } }
WE2002_PATCHES = WE2002_PATCHES or patches
patches = WE2002_PATCHES -- sobrevive a "Recarregar script"

-- Agenda por frame (VSync): usada para apertar botões em sequência.
WE2002_FRAME = WE2002_FRAME or 0
WE2002_AGENDA = WE2002_AGENDA or {}

local function rodar_agenda()
  WE2002_FRAME = WE2002_FRAME + 1
  local resto = {}
  for _, item in ipairs(WE2002_AGENDA) do
    if WE2002_FRAME >= item.frame then
      local ok, e = pcall(item.fn)
      if not ok then print("[we2002] erro na agenda: " .. tostring(e)) end
    else
      resto[#resto + 1] = item
    end
  end
  WE2002_AGENDA = resto
end

local function agendar(daqui_a_frames, fn)
  WE2002_AGENDA[#WE2002_AGENDA + 1] = { frame = WE2002_FRAME + daqui_a_frames, fn = fn }
end

local R -- módulo de resultado (bridge/resultado.lua), criado mais abaixo
local ED -- monitor de edição de jogadores (bridge/edicao.lua), criado mais abaixo

local aplicar_condicoes -- definida mais abaixo (condição física)

local function apply_freezes()
  rodar_agenda()
  if WE2002_FRAME % 30 == 0 then
    local ok, e = pcall(function() if aplicar_condicoes then aplicar_condicoes() end end)
    if not ok and not WE2002_ERRO_COND then WE2002_ERRO_COND = true; print("[we2002] erro na condição: " .. tostring(e)) end
  end
  if ED then
    local ok, e = pcall(ED.tick)
    if not ok and not WE2002_ERRO_EDICAO then WE2002_ERRO_EDICAO = true; print("[we2002] erro no monitor de edição: " .. tostring(e)) end
  end
  if R then
    local ok, e = pcall(R.tick_vsync)
    if not ok and not WE2002_ERRO_RESULTADO then
      WE2002_ERRO_RESULTADO = true
      print("[we2002] erro no resultado: " .. tostring(e))
    end
  end
  for _, w in ipairs(watches) do
    if w.frozen and w.freeze_value then mem.write(w.addr, w.freeze_value, w.width) end
  end
  for _, p in pairs(patches) do
    -- Guarda: só escreve se a área ainda tiver os dados originais ou os nossos.
    -- Na partida o jogo reaproveita a base mestre para carregar código (ex.: tela
    -- de substituição); escrever por cima disso trava o jogo.
    local escrever_ok = true
    if p.orig then
      local igual_orig, igual_nosso = true, true
      for i = 1, #p.bytes do
        local v = mem.read8(p.addr + i - 1)
        if v ~= p.orig[i] then igual_orig = false end
        if v ~= p.bytes[i] then igual_nosso = false end
      end
      escrever_ok = igual_orig and not igual_nosso
    end
    if escrever_ok then
      for i = 1, #p.bytes do mem.write8(p.addr + i - 1, p.bytes[i]) end
    end
  end
end

local function ler_orig(addr, len)
  local t = {}
  for i = 1, len do t[i] = mem.read8(addr + i - 1) end
  return t
end

local function patch_string(key, addr, texto, len)
  local bytes = {}
  for i = 1, len do bytes[i] = i <= #texto and texto:byte(i) or 0 end
  local anterior = patches[key]
  patches[key] = { addr = mem.phys(addr), bytes = bytes, orig = anterior and anterior.orig or ler_orig(addr, len) }
end

local NOMES = {
  mestre_base = 0x80055FF8, mestre_time = 0xE6, mestre_reg = 10,
  buffer_base = 0x80064570, buffer_reg = 16, por_time = 23,
}

-- Troca o nome do jogador n (0-22) do lado "casa" ou "visitante".
-- Escreve na base mestre e no buffer da partida, a cada VSync.
local function trocar_nome(lado, n, texto)
  local visitante = (lado == "visitante" or lado == "v" or lado == 2)
  local id = mem.read8(visitante and 0x80075565 or 0x80075564)
  texto = texto:sub(1, 10)
  patch_string(("m%d_%d"):format(id, n),
    NOMES.mestre_base + id * NOMES.mestre_time + n * NOMES.mestre_reg, texto, NOMES.mestre_reg)
  -- Só a base mestre: o jogo copia para o buffer da partida ao confirmar a seleção.
  -- Forçar o buffer a cada frame trava o jogo nas substituições.
  log(("nome: %s #%d (time %d) -> %s"):format(visitante and "visitante" or "casa", n, id, texto))
end

-- Nome do time na tela ---------------------------------------------------------
-- O jogo tem duas tabelas de ponteiros para os nomes dos times (indexadas pelo
-- ID): 0x800BF0E8 e 0x8014D964. Os textos são colados uns nos outros, então
-- reaproveitamos os textos de times que não usamos ("WORLD ALLSTARS" e
-- "EURO ALLSTARS", 16 bytes = até 15 letras) e apontamos o time para eles.
-- As duas áreas mudam durante a partida: os patches têm guarda (só escrevem
-- enquanto a área tiver os dados originais).
local NOME_TIME = {
  tabelas = {
    { ptrs = 0x800BF0E8, slots = { casa = 0x8007FD48, visitante = 0x8007FD58 } },
    { ptrs = 0x8014D964, slots = { casa = 0x80149B00, visitante = 0x80149B10 } },
  },
  max = 15,
}

local ACENTOS = { ["á"]="A",["à"]="A",["â"]="A",["ã"]="A",["ä"]="A",["é"]="E",["ê"]="E",["è"]="E",
  ["í"]="I",["ì"]="I",["ó"]="O",["ô"]="O",["õ"]="O",["ò"]="O",["ö"]="O",["ú"]="U",["ü"]="U",["ù"]="U",
  ["ç"]="C",["ñ"]="N",["Á"]="A",["À"]="A",["Â"]="A",["Ã"]="A",["É"]="E",["Ê"]="E",["Í"]="I",["Ó"]="O",
  ["Ô"]="O",["Õ"]="O",["Ú"]="U",["Ü"]="U",["Ç"]="C",["Ñ"]="N" }

local function texto_tela(t)
  t = tostring(t or ""):gsub("[\xC3][\x80-\xBF]", function(c) return ACENTOS[c] or "" end)
  t = t:upper():gsub("[^ -~]", "")
  return t:sub(1, NOME_TIME.max)
end

local function trocar_nome_time(lado, nome)
  local visitante = (lado == "visitante")
  local id = mem.read8(visitante and 0x80075565 or 0x80075564)
  local texto = texto_tela(nome)
  if texto == "" then return end
  local chave_lado = visitante and "visitante" or "casa"
  for i, t in ipairs(NOME_TIME.tabelas) do
    local slot = t.slots[chave_lado]
    patch_string(("time%d_txt_%s"):format(i, chave_lado), slot, texto, 16)
    local pa = t.ptrs + id * 4
    local b = {}
    for k = 0, 3 do b[k + 1] = bit.band(bit.rshift(slot, 8 * k), 0xFF) end
    local key = ("time%d_ptr_%s"):format(i, chave_lado)
    local anterior = patches[key]
    patches[key] = { addr = mem.phys(pa), bytes = b, orig = anterior and anterior.orig or ler_orig(pa, 4) }
  end
  log(("nome do time na tela: %s (time %d) -> %s"):format(chave_lado, id, texto))
end

-- Formação padrão do time ----------------------------------------------------------
-- Tabela permanente de formações: 0x80053111 + entrada*11, 11 bytes = "casas" do
-- campo ocupadas (inclui o goleiro), em ordem crescente. Os jogadores das vagas
-- 0-10 ocupam as casas nessa ordem. A partida usa a entrada 41 para a casa e a
-- 42 para o visitante (confirmado em 07/11/2026: a Holanda jogava com a 42, e
-- gravar na 41 mudou a formação da casa). Nomes das prontas ainda a confirmar.
local FORMACAO = { base = 0x80053111, tam = 11, entrada = { casa = 41, visitante = 42 } }
local FORMACOES = {
  ["5-3-2"]  = { 0x01, 0x02, 0x03, 0x06, 0x09, 0x0b, 0x0c, 0x0d, 0x0f, 0x11, 0x13 }, -- padrão do Brasil
  ["4-5-1A"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x0a, 0x0c, 0x0d, 0x0e, 0x10, 0x12 },
  ["4-5-1B"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x09, 0x0b, 0x0c, 0x0d, 0x0f, 0x12 },
  ["4-4-2A"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x0a, 0x0c, 0x0d, 0x0f, 0x11, 0x13 }, -- padrão da maioria dos times
  ["4-4-2B"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x09, 0x0b, 0x0e, 0x10, 0x11, 0x13 },
  ["4-3-3A"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x0a, 0x0e, 0x10, 0x12, 0x14, 0x15 },
  ["4-3-3B"] = { 0x01, 0x02, 0x06, 0x07, 0x08, 0x09, 0x0b, 0x0f, 0x12, 0x14, 0x15 },
  ["holanda"] = { 0x01, 0x02, 0x03, 0x06, 0x07, 0x08, 0x09, 0x0b, 0x0f, 0x11, 0x13 }, -- padrão da Holanda
}

-- formacao: nome (ver FORMACOES) ou lista de 11 números
local function trocar_formacao(lado, formacao)
  local visitante = (lado == "visitante")
  local id = mem.read8(visitante and 0x80075565 or 0x80075564)
  local codigos = type(formacao) == "table" and formacao or FORMACOES[tostring(formacao)]
  if type(codigos) ~= "table" or #codigos ~= FORMACAO.tam then
    log(("formação inválida para %s: %s"):format(lado, tostring(formacao))); return
  end
  local addr = FORMACAO.base + FORMACAO.entrada[visitante and "visitante" or "casa"] * FORMACAO.tam
  local key = "formacao_" .. (visitante and "visitante" or "casa")
  local anterior = patches[key]
  patches[key] = { addr = mem.phys(addr), bytes = codigos, orig = anterior and anterior.orig or ler_orig(addr, FORMACAO.tam) }
  log(("formação: %s (entrada %d) -> %s"):format(visitante and "visitante" or "casa", FORMACAO.entrada[visitante and "visitante" or "casa"],
    type(formacao) == "table" and table.concat(formacao, ",") or tostring(formacao)))
end

-- Condição física (seta) ----------------------------------------------------------
-- 46 registros de 20 bytes em 0x80063200 (23 da casa, depois 23 do visitante):
--   +0  ponteiro para o registro do jogador no buffer (0x80065A58 + 12*n, n = 0..45)
--   +16 condição: 0 = seta vermelha (melhor), 1 laranja, 2 verde, 3 azul, 4 branca (pior)
-- No JSON: "condicao": 1 (pior, seta branca) a 5 (melhor, seta vermelha).
-- O jogo sorteia a condição ao montar a partida; a ponte confere a cada 30 frames e
-- reescreve. Cada registro é identificado pelo ponteiro (+0), não pela posição,
-- para continuar certo depois de substituições.
local COND = { base = 0x80063200, reg = 20, total = 46, off = 16, buffer = 0x80065A58, regjog = 12 }
WE2002_CONDICAO = WE2002_CONDICAO or { casa = {}, visitante = {} }
local condicoes = WE2002_CONDICAO

local function definir_condicao(lado, vaga, nivel)
  nivel = math.floor(tonumber(nivel) or 0)
  if nivel < 1 or nivel > 5 then return end
  condicoes[lado == "visitante" and "visitante" or "casa"][vaga] = 5 - nivel
end

aplicar_condicoes = function()
  if not next(condicoes.casa) and not next(condicoes.visitante) then return 0 end
  local escritos = 0
  for i = 0, COND.total - 1 do
    local r = COND.base + i * COND.reg
    local ptr = mem.read32(r)
    local d = ptr - COND.buffer
    if d >= 0 and d < 46 * COND.regjog and d % COND.regjog == 0 then
      local n = d / COND.regjog
      local lado = n < 23 and "casa" or "visitante"
      local alvo = condicoes[lado][n % 23]
      local atual = mem.read8(r + COND.off)
      if alvo and atual <= 4 and atual ~= alvo then
        mem.write8(r + COND.off, alvo); escritos = escritos + 1
      end
    end
  end
  return escritos
end

local function contar_patches()
  local c = 0
  for _ in pairs(patches) do c = c + 1 end
  return c
end

local ok_ev, listener = pcall(PCSX.Events.createEventListener, "GPU::Vsync", apply_freezes)
if not ok_ev then log("aviso: não consegui registrar VSync, congelamento roda só no frame da UI") end
WE2002_VSYNC_LISTENER = listener -- referência global evita coleta pelo GC

-- partida.json -----------------------------------------------------------
-- Expande os arquivos de time (data/times/*.json): cada jogador vira uma edição
-- na vaga correspondente; edições do partida.json vêm depois e sobrescrevem.
local function expandir_times(p)
  local eds, idx = {}, {}
  local function add(e)
    local lado = e.lado == "visitante" and "visitante" or "casa"
    local k = lado .. ":" .. tostring(e.jogador)
    local cur = idx[k]
    if not cur then cur = { lado = lado }; idx[k] = cur; eds[#eds + 1] = cur end
    for kk, vv in pairs(e) do if vv ~= json.null then cur[kk] = vv end end
  end
  for _, lado in ipairs({ "casa", "visitante" }) do
    local ref = p[lado] and p[lado].time
    if type(ref) == "string" then
      local t, err = json.read_file(ROOT .. "/" .. ref)
      if t then
        p[lado].nome = t.nome or p[lado].nome
        for _, k in ipairs({ "formacao", "nome_tela" }) do
          if t[k] ~= nil and p[lado][k] == nil then p[lado][k] = t[k] end
        end
        for _, j in ipairs(t.jogadores or {}) do
          add({ lado = lado, jogador = j.vaga, nome = j.nome, camisa = j.camisa, altura = j.altura, atributos = j.atributos, condicao = j.condicao,
            posicao = j.posicao, pe = j.pe, idade = j.idade, outside = j.outside, aparencia = j.aparencia })
        end
      else
        print("[we2002] time não carregado (" .. ref .. "): " .. tostring(err))
      end
    end
  end
  for _, e in ipairs(p.edicoes or {}) do add(e) end
  p.edicoes = eds
end

local function load_partida()
  local data, e = json.read_file(PATHS.partida)
  if data then expandir_times(data) end
  ui.partida, ui.partida_erro = data, e
  if data then
    ui.status = string.format("partida.json carregado: %s x %s",
      tostring(data.casa and data.casa.nome), tostring(data.visitante and data.visitante.nome))
  else
    ui.status = "Erro no partida.json: " .. tostring(e)
  end
end

local function aplicar_partida()
  local p = ui.partida
  if not p then return load_partida() end
  local faltando = {}
  for _, k in ipairs({ "time_casa", "time_visitante" }) do
    if not offsets[k].addr then faltando[#faltando + 1] = k end
  end
  if #faltando > 0 then
    ui.status = "Endereços ainda não mapeados em offsets.lua: " .. table.concat(faltando, ", ")
    return
  end
  mem.write(offsets.time_casa.addr, p.casa.id_we, offsets.time_casa.width)
  mem.write(offsets.time_visitante.addr, p.visitante.id_we, offsets.time_visitante.width)
  -- cópias da tela de seleção (só fazem efeito enquanto ela está aberta)
  local copias = 0
  for _, c in ipairs(offsets.copias_selecao or {}) do
    mem.write(c.casa, p.casa.id_we, c.width)
    mem.write(c.visitante, p.visitante.id_we, c.width)
    copias = copias + 1
  end
  ui.status = string.format("IDs escritos: casa=%d visitante=%d (+%d cópias da seleção)",
    p.casa.id_we, p.visitante.id_we, copias)
  log(ui.status)
end

local function gravar_resultado()
  if R then R.gravar(true, "manual") end
end

local function dump_vram()
  os.execute('mkdir "' .. PATHS.dumps:gsub("/", "\\") .. '" 2>nul')
  local name = string.format("%s/vram_%s.bin", PATHS.dumps, os.date("%Y%m%d_%H%M%S"))
  local ok, e = pcall(function()
    local v = tostring(PCSX.GPU.getVRAM())
    local f = assert(io.open(name, "wb"))
    f:write(v); f:close()
  end)
  ui.status = ok and ("Dump da VRAM salvo: " .. name) or ("Erro no dump da VRAM: " .. tostring(e))
  log(ui.status)
end

local function dump_ram()
  os.execute('mkdir "' .. PATHS.dumps:gsub("/", "\\") .. '" 2>nul')
  local name = string.format("%s/ram_%s.bin", PATHS.dumps, os.date("%Y%m%d_%H%M%S"))
  local ok, e = mem.dump(name)
  ui.status = ok and ("Dump salvo: " .. name) or ("Erro no dump: " .. tostring(e))
end

-- Save states ----------------------------------------------------------
-- Atalho até mapearmos a RAM: você chega ao amistoso pelos menus uma vez,
-- salva o estado, e a ponte carrega esse estado sempre que o emulador abrir.
local function file_exists(path)
  local f = io.open(path, "rb")
  if f then f:close() return true end
  return false
end

local function salvar_estado(path)
  os.execute('mkdir "' .. PATHS.states:gsub("/", "\\") .. '" 2>nul')
  local ok, e = pcall(function()
    local slice = PCSX.createSaveState()
    local f = Support.File.open(path, "TRUNCATE")
    f:writeMoveSlice(slice)
    f:close()
  end)
  ui.status = ok and ("Estado salvo: " .. path) or ("Erro ao salvar estado: " .. tostring(e))
  log(ui.status)
end

local function carregar_estado(path)
  if not file_exists(path) then
    ui.status = "Nenhum estado salvo em " .. path
    return false
  end
  local ok, e = pcall(function()
    local f = Support.File.open(path, "READ")
    PCSX.loadSaveState(f)
    f:close()
  end)
  ui.status = ok and ("Estado carregado: " .. path) or ("Erro ao carregar estado: " .. tostring(e))
  log(ui.status)
  return ok
end

-- Resultado da partida (placar, gols, autores) -> data/resultado.json
-- Monitor de edição de jogadores (bridge/edicao.lua)
ED = require("edicao")({ mem = mem, log = log, paths = PATHS })

R = require("resultado")({
  mem = mem, json = json, offsets = offsets, log = log, paths = PATHS,
  partida = function() return ui.partida end,
  salvar_estado = salvar_estado,
})

-- Carregamento automático: espera alguns frames de UI para o emulador terminar
-- de iniciar. A flag global evita recarregar quando o script é recarregado.
local AUTOLOAD_DELAY = 60
local ui_frames = 0
local function talvez_autoload()
  if WE2002_AUTOLOAD_FEITO then return end
  ui_frames = ui_frames + 1
  if ui_frames < AUTOLOAD_DELAY then return end
  WE2002_AUTOLOAD_FEITO = true
  -- Estado base conforme o "controle" do partida.json (padrão: P1 em casa x CPU)
  if not ui.partida then load_partida() end
  local controle = (ui.partida and ui.partida.controle) or "p1_cpu"
  local caminho, info = estado_base_path(controle)
  if not caminho or not file_exists(caminho) then
    log(("estado base '%s' não encontrado; usando states/amistoso.sstate (P1 x CPU)"):format(controle))
    caminho = PATHS.estado_amistoso
  else
    log(("estado base: %s (%s)"):format(info.nome, caminho))
  end
  if file_exists(caminho) then
    -- O PCSX-Redux só efetiva o load no fim do frame: espera alguns frames
    -- antes de ler a RAM (IDs dos times, registros) para montar os patches.
    if carregar_estado(caminho) and WE and WE.pos_carga then
      agendar(10, function() WE.pos_carga() end)
    end
  else
    log("sem states/amistoso.sstate: iniciando normalmente pelos menus")
  end
end

-- Janela -----------------------------------------------------------------
local function draw_search()
  if not imgui.CollapsingHeader("Busca por diferença na RAM") then return end

  imgui.TextUnformatted("Largura:")
  imgui.SameLine()
  if imgui.RadioButton("1 byte", ui.search_width == 1) then ui.search_width = 1 end
  imgui.SameLine()
  if imgui.RadioButton("2 bytes", ui.search_width == 2) then ui.search_width = 2 end

  if imgui.Button("Nova busca (snapshot)") then
    search.reset(ui.search_width)
    ui.status = string.format("Busca iniciada: %d candidatos", search.count)
  end

  if search.candidates then
    imgui.SameLine()
    imgui.TextUnformatted(string.format("Candidatos: %d", search.count))

    if imgui.Button("Mudou") then search.filter("changed") end
    imgui.SameLine()
    if imgui.Button("Não mudou") then search.filter("unchanged") end
    imgui.SameLine()
    if imgui.Button("Aumentou") then search.filter("inc") end
    imgui.SameLine()
    if imgui.Button("Diminuiu") then search.filter("dec") end

    local _, v = imgui.extra.InputText("Valor", ui.search_value)
    ui.search_value = v
    imgui.SameLine()
    if imgui.Button("Igual a") then
      local n = parse_num(ui.search_value)
      if n then search.filter("eq", n) else ui.status = "Valor inválido" end
    end

    imgui.TextUnformatted("Filtros: " .. table.concat(search.history, "  |  "))

    if search.count <= 200 then
      imgui.Separator()
      for i, c in ipairs(search.list(200)) do
        imgui.TextUnformatted(string.format("%s  ant=%d  atual=%d", mem.fmt(c.addr), c.prev, c.cur))
        imgui.SameLine()
        if imgui.Button("+ watch##s" .. i) then add_watch(c.addr, search.width, "") end
      end
    else
      imgui.TextUnformatted("(a lista aparece quando houver 200 candidatos ou menos)")
    end
  end
end

local function draw_watches()
  if not imgui.CollapsingHeader("Watches") then return end

  local _, a = imgui.extra.InputText("Endereço (0x80...)", ui.new_watch_addr)
  ui.new_watch_addr = a
  local _, l = imgui.extra.InputText("Rótulo", ui.new_watch_label)
  ui.new_watch_label = l
  for _, wd in ipairs({ 1, 2, 4 }) do
    if wd > 1 then imgui.SameLine() end
    if imgui.Button(string.format("Adicionar (%d)", wd)) then
      local n = parse_num(ui.new_watch_addr)
      if n then add_watch(n, wd, ui.new_watch_label); ui.new_watch_label = "" else ui.status = "Endereço inválido" end
    end
  end
  imgui.SameLine()
  if imgui.Button("Salvar watches") then save_watches() end

  imgui.Separator()
  local remove
  for i, w in ipairs(watches) do
    local v = mem.read(w.addr, w.width)
    imgui.TextUnformatted(string.format("%-22s %s = %d (0x%X)", w.label, mem.fmt(w.addr), v, v))
    imgui.SameLine()
    local changed, fz = imgui.Checkbox("Congelar##w" .. i, w.frozen)
    if changed then w.frozen = fz; w.freeze_value = v end
    imgui.SameLine()
    if imgui.Button("Ir##w" .. i) then pcall(PCSX.GUI.jumpToMemory, 0x80000000 + w.addr, w.width) end
    imgui.SameLine()
    if imgui.Button("x##w" .. i) then remove = i end

    local _, e = imgui.extra.InputText("##edit" .. i, w.edit)
    w.edit = e
    imgui.SameLine()
    if imgui.Button("Escrever##w" .. i) then
      local n = parse_num(w.edit)
      if n then
        mem.write(w.addr, n, w.width)
        if w.frozen then w.freeze_value = n end
      end
    end
  end
  if remove then table.remove(watches, remove) end
end

local function draw_estados()
  if not imgui.CollapsingHeader("Início rápido (save state)") then return end
  imgui.TextUnformatted("Pare o jogo no ponto do amistoso que quer usar como início e salve.")
  if imgui.Button("Salvar estado do amistoso") then salvar_estado(PATHS.estado_amistoso) end
  imgui.SameLine()
  if imgui.Button("Carregar estado do amistoso") then carregar_estado(PATHS.estado_amistoso) end
  imgui.TextUnformatted(file_exists(PATHS.estado_amistoso)
    and "Carregamento automático: ATIVO (states/amistoso.sstate existe)"
    or "Carregamento automático: inativo (nenhum estado salvo)")
  imgui.Separator()
  imgui.TextUnformatted("Estados base por controle (pare na tela das bandeiras, Brasil x Holanda, antes de confirmar o visitante):")
  for _, e in ipairs(ESTADOS_BASE) do
    local caminho = PATHS.states .. "/" .. e.arquivo
    if imgui.Button("Salvar##" .. e.id) then salvar_estado(caminho) end
    imgui.SameLine()
    if imgui.Button("Carregar##" .. e.id) then
      if carregar_estado(caminho) and WE and WE.pos_carga then agendar(10, function() WE.pos_carga() end) end
    end
    imgui.SameLine()
    imgui.TextUnformatted(("%s  [%s] %s"):format(e.nome, e.arquivo, file_exists(caminho) and "OK" or "falta"))
  end
  imgui.Separator()
  imgui.TextUnformatted("Estados extras (para comparar fora do emulador):")
  local _, n = imgui.extra.InputText("Nome##extra", ui.extra_state or "")
  ui.extra_state = n
  imgui.SameLine()
  if imgui.Button("Salvar como") then
    local nome = (ui.extra_state or ""):gsub("[^%w_%-]", "")
    if nome ~= "" then salvar_estado(PATHS.states .. "/" .. nome .. ".sstate") end
  end
  imgui.SameLine()
  if imgui.Button("Carregar##extra") then
    local nome = (ui.extra_state or ""):gsub("[^%w_%-]", "")
    if nome ~= "" then carregar_estado(PATHS.states .. "/" .. nome .. ".sstate") end
  end
end

local function draw_nomes()
  if not imgui.CollapsingHeader("Trocar nome de jogador (teste)") then return end
  if imgui.RadioButton("Casa", ui.nome_lado == "casa") then ui.nome_lado = "casa" end
  imgui.SameLine()
  if imgui.RadioButton("Visitante", ui.nome_lado == "visitante") then ui.nome_lado = "visitante" end
  local _, n = imgui.extra.InputText("Nº do jogador (0-22)", ui.nome_n)
  ui.nome_n = n
  local _, t = imgui.extra.InputText("Novo nome (máx. 10)", ui.nome_texto)
  ui.nome_texto = t
  if imgui.Button("Aplicar nome") then
    local num = tonumber(ui.nome_n)
    if num and num >= 0 and num <= 22 then
      trocar_nome(ui.nome_lado, num, ui.nome_texto)
      ui.status = ("Nome aplicado: %s #%d -> %s"):format(ui.nome_lado, num, ui.nome_texto:sub(1, 10))
    else
      ui.status = "Número do jogador inválido (use 0 a 22)"
    end
  end
  imgui.SameLine()
  if imgui.Button("Atributos no máximo") then
    local num = tonumber(ui.nome_n)
    if num and num >= 0 and num <= 22 then
      WE.max(ui.nome_lado, num)
      ui.status = ("Atributos no máximo: %s #%d"):format(ui.nome_lado, num)
    end
  end
  imgui.SameLine()
  if imgui.Button("Remover todos os patches") then WE.limpar() end
end

local function draw_partida()
  if not imgui.CollapsingHeader("partida.json") then return end
  if imgui.Button("Recarregar partida.json") then load_partida() end
  imgui.SameLine()
  if imgui.Button("Aplicar IDs dos times") then aplicar_partida() end
  imgui.SameLine()
  if imgui.Button("Gravar resultado.json") then gravar_resultado() end

  local p = ui.partida
  if p then
    imgui.TextUnformatted(string.format("Casa:      %s (id_we=%s)", tostring(p.casa.nome), tostring(p.casa.id_we)))
    imgui.TextUnformatted(string.format("Visitante: %s (id_we=%s)", tostring(p.visitante.nome), tostring(p.visitante.id_we)))
  elseif ui.partida_erro then
    imgui.TextUnformatted("Erro: " .. tostring(ui.partida_erro))
  end

  if offsets.estado.addr then
    local v = mem.read(offsets.estado.addr, offsets.estado.width)
    local nome = "?"
    for k, val in pairs(offsets.estados) do if val == v then nome = k end end
    imgui.TextUnformatted(string.format("Estado do jogo: %d (%s)", v, nome))
  else
    imgui.TextUnformatted("Estado do jogo: endereço ainda não mapeado")
  end
end

function DrawImguiFrame()
  if not ok_ev then apply_freezes() end
  talvez_autoload()
  R.tick_ui()
  if WE and WE.tick_kits then WE.tick_kits() end
  if WE and WE.bandeiras then WE.bandeiras.tick() end
  if imgui.Begin("WE2002 Bridge") then
    if imgui.Button("Dump da RAM") then dump_ram() end
    imgui.SameLine()
    if imgui.Button("Dump da VRAM") then dump_vram() end
    imgui.SameLine()
    if imgui.Button("Recarregar script") then
      local ok, e = pcall(dofile, BRIDGE .. "/we2002.lua")
      if not ok then ui.status = "Erro ao recarregar: " .. tostring(e) end
    end
    imgui.TextUnformatted(ui.status)
    imgui.TextUnformatted(("Patches contínuos ativos: %d"):format(contar_patches()))
    if WE and WE.kit_info then
      local K = WE.kit_info()
      imgui.TextUnformatted(("Kit PS1: %s | %s | uploads: %d"):format(K.ativo and "ligado" or "desligado", K.status, K.uploads))
      imgui.SameLine()
      if imgui.Button(K.ativo and "Desligar kit PS1" or "Ligar kit PS1") then WE.kitps1(not K.ativo) end
    end
    if WE and WE.bandeiras then
      local Bd = WE.bandeiras
      imgui.TextUnformatted(("Bandeiras: %s | %s | uploads: %d"):format(Bd.ativo and "ligado" or "desligado", Bd.status, Bd.uploads))
      imgui.SameLine()
      if imgui.Button(Bd.ativo and "Desligar bandeiras" or "Ligar bandeiras") then Bd.ligar(not Bd.ativo) end
      imgui.SameLine()
      if imgui.Button("Recarregar bandeiras") then Bd.carregar() end
    end
    imgui.Separator()
    draw_estados()
    draw_nomes()
    draw_partida()
    R.draw()
    if ED then ED.draw() end
    draw_search()
    draw_watches()
  end
  imgui.End()
end


-- Rastreador: registra quem escreve num endereço (pc, ra e registradores),
-- num arquivo, para eu analisar o código do jogo fora do emulador.
WE2002_BPS = WE2002_BPS or {}
local function rastrear(addr, len, tipo, max_hits)
  max_hits = max_hits or 40
  tipo = tipo or "Write"
  local path = ROOT .. "/dumps/trace.txt"
  local f = io.open(path, "a")
  if f then f:write(("\n== %s %s len=%d %s\n"):format(tipo, mem.fmt(addr), len, os.date())) f:close() end
  local hits = 0
  local base = bit.band(addr, 0x1FFFFF)
  for _, seg in ipairs({ 0x80000000, 0x00000000, 0xA0000000 }) do
  local bp
  bp = PCSX.addBreakpoint(seg + base, tipo, len, "we2002 trace", function(address, width)
    local ok, e = pcall(function()
      hits = hits + 1
      local r = PCSX.getRegisters()
      local g = r.GPR.n
      local line = ("hit=%d addr=%08X w=%d pc=%08X ra=%08X v0=%08X v1=%08X a0=%08X a1=%08X a2=%08X a3=%08X " ..
        "t0=%08X t1=%08X t2=%08X t3=%08X s0=%08X s1=%08X s2=%08X s3=%08X s4=%08X s5=%08X s6=%08X s7=%08X sp=%08X")
        :format(hits, address, width, r.pc, g.ra, g.v0, g.v1, g.a0, g.a1, g.a2, g.a3,
          g.t0, g.t1, g.t2, g.t3, g.s0, g.s1, g.s2, g.s3, g.s4, g.s5, g.s6, g.s7, g.sp)
      local fh = io.open(path, "a")
      if fh then fh:write(line, "\n") fh:close() end
    end)
    if not ok then print("[we2002] erro no rastreador: " .. tostring(e)) end
    if hits >= max_hits then
      log(("rastreador %s: %d registros gravados em dumps/trace.txt (removido)"):format(mem.fmt(addr), hits))
      return false
    end
  end)
  WE2002_BPS[#WE2002_BPS + 1] = bp
  end
  log(("rastreador ativo em %s e espelhos 0x00/0xA0 (%s, %d bytes), até %d registros"):format(mem.fmt(addr), tipo, len, max_hits))
end


-- Atributos ------------------------------------------------------------------
-- Registro de 12 bytes (3 words) por jogador. Mapeado pela função do painel
-- de atributos (0x80153D28). Cada atributo tem 3 bits: exibido = bruto + 12 (12..19).
local ATR = {
  mestre_base = 0x800A5124, buffer_base = 0x80065A58, reg = 12, por_time = 23,
  campos = {
    OFF = { 1, 29 }, DEF = { 2, 0 }, BAL = { 1, 14 }, STA = { 1, 17 }, SPD = { 1, 23 },
    ACC = { 1, 26 }, RES = { 1, 10 }, JMP = { 2, 18 }, HEAD = { 2, 15 }, TEC = { 2, 12 },
    PASS = { 2, 9 }, SHPW = { 2, 3 }, SHAC = { 2, 6 }, DRI = { 1, 20 }, CRV = { 2, 21 },
    AGR = { 2, 24 }, -- agressividade (AGREC. no menu de edição; não aparece no painel da partida)
  },
}

-- Demais campos do registro (mapa completo em 11/11/2026; mesma tabela de tools/lib/registro.mjs).
-- No time/partida.json, por jogador (todos opcionais; ausente = mantém o original):
--   posicao "GK"/"CB"/"LB"/"RB"/"DH"/"LH"/"RH"/"OH"/"CF"/"LW"/"RW" · pe "destro"/"canhoto"/"ambidestro"
--   idade 15-46 · outside true/false · aparencia { pele 1-4, fisico "A"-"H", cabelo "a1"-"p1",
--   cor_cabelo "A"-"H", barba "A"-"G", cor_barba "A"-"G", chuteira "A"-"H" }
local REG_POS = { GK = 0, CB = 1, SW = 1, SB = 2, LB = 2, RB = 2, WB = 2, DH = 3, DM = 3, CH = 3,
  SH = 4, LH = 4, RH = 4, OH = 5, AM = 5, CF = 6, SS = 6, WG = 7, LW = 7, RW = 7, WF = 7 }
local REG_PE = { destro = 0, canhoto = 1, ambidestro = 2 }
local REG_CABELOS = { "a1", "a2", "a3", "b1", "b2", "b3", "b4", "b5", "b6", "c1", "c2", "d1", "d2", "e1", "e2", "f1",
  "f2", "f3", "g1", "h1", "i1", "i2", "i3", "j1", "k1", "l1", "l2", "l3", "m1", "n1", "o1", "p1" }

local function reg_letra(v, max)
  if type(v) ~= "string" or #v ~= 1 then return nil end
  local n = v:upper():byte() - 65
  if n >= 0 and n <= max then return n end
  return nil
end
local function reg_faixa(v, a, b) return math.max(a, math.min(b, math.floor(v))) end

-- Lista de { word (1-3), bit inicial, bits, valor }
local function campos_registro(e)
  local c = {}
  local function put(i, sh, nb, v) if v ~= nil then c[#c + 1] = { i, sh, nb, v } end end
  if type(e.posicao) == "string" then put(1, 0, 3, REG_POS[e.posicao:upper()]) end
  if type(e.pe) == "string" then put(3, 30, 2, REG_PE[e.pe:lower()]) end
  if type(e.idade) == "number" then put(2, 5, 5, reg_faixa(e.idade - 15, 0, 31)) end
  if type(e.outside) == "boolean" then put(1, 31, 1, e.outside and 1 or 0) end
  local a = type(e.aparencia) == "table" and e.aparencia or {}
  if type(a.pele) == "number" then put(2, 0, 2, reg_faixa(a.pele - 1, 0, 3)) end
  put(2, 2, 3, reg_letra(a.fisico, 7))
  if type(a.cabelo) == "string" then
    for i, nome in ipairs(REG_CABELOS) do if nome == a.cabelo:lower() then put(1, 4, 5, i - 1) end end
  elseif type(a.cabelo) == "number" then put(1, 4, 5, reg_faixa(a.cabelo, 0, 31)) end
  put(1, 9, 3, reg_letra(a.cor_cabelo, 7))
  put(1, 13, 3, reg_letra(a.barba, 6))
  put(1, 17, 3, reg_letra(a.cor_barba, 6))
  put(3, 27, 3, reg_letra(a.chuteira, 7))
  return c
end

local function ler_words(addr)
  return { mem.read32(addr), mem.read32(addr + 4), mem.read32(addr + 8) }
end

local function aplicar_valores(w, valores)
  for nome, v in pairs(valores) do
    local c = ATR.campos[nome]
    if c then
      local bruto = math.max(0, math.min(7, v - 12))
      local i, sh = c[1] + 1, c[2]
      local mask = bit.lshift(7, sh)
      w[i] = bit.bor(bit.band(w[i], bit.bnot(mask)), bit.lshift(bruto, sh))
    end
  end
  return w
end

local function words_para_bytes(w)
  local b = {}
  for i = 1, 3 do
    for k = 0, 3 do b[#b + 1] = bit.band(bit.rshift(w[i], 8 * k), 0xFF) end
  end
  return b
end

-- valores: tabela { OFF = 19, SPD = 19, ... } com números de 12 a 19 (como na tela)
-- camisa (opcional): 1 a 32, gravada em w0 bits 26-30 (valor = número - 1)
-- extras (opcional): lista de campos_registro()
local function trocar_atributos(lado, n, valores, camisa, altura, extras)
  local visitante = (lado == "visitante" or lado == "v" or lado == 2)
  local id = mem.read8(visitante and 0x80075565 or 0x80075564)
  local alvos = {
    { ("am%d_%d"):format(id, n), ATR.mestre_base + (id * ATR.por_time + n) * ATR.reg },
  }
  -- Monta o registro a partir da base mestre (sempre válida) e grava o mesmo
  -- registro nas duas cópias. O buffer da partida pode estar vazio antes da
  -- confirmação da seleção.
  local key = alvos[1][1]
  local w = patches[key] and {  -- reaproveita um patch anterior (nome/camisa/atributos juntos)
    patches[key].bytes[1] + patches[key].bytes[2] * 256 + patches[key].bytes[3] * 65536 + patches[key].bytes[4] * 16777216,
    patches[key].bytes[5] + patches[key].bytes[6] * 256 + patches[key].bytes[7] * 65536 + patches[key].bytes[8] * 16777216,
    patches[key].bytes[9] + patches[key].bytes[10] * 256 + patches[key].bytes[11] * 65536 + patches[key].bytes[12] * 16777216,
  } or ler_words(alvos[1][2])
  w = aplicar_valores(w, valores or {})
  if camisa then
    w[1] = bit.bor(bit.band(w[1], bit.bnot(bit.lshift(0x1F, 26))), bit.lshift(bit.band(camisa - 1, 0x1F), 26))
  end
  if altura then -- w0 bits 20-25, cm = valor + 148
    local v = math.max(0, math.min(63, altura - 148))
    w[1] = bit.bor(bit.band(w[1], bit.bnot(bit.lshift(0x3F, 20))), bit.lshift(v, 20))
  end
  for _, c in ipairs(extras or {}) do
    local i, sh, nb, v = c[1], c[2], c[3], c[4]
    local mask = bit.lshift(bit.lshift(1, nb) - 1, sh)
    w[i] = bit.bor(bit.band(w[i], bit.bnot(mask)), bit.band(bit.lshift(v, sh), mask))
  end
  local bytes = words_para_bytes(w)
  for _, a in ipairs(alvos) do
    local anterior = patches[a[1]]
    patches[a[1]] = { addr = mem.phys(a[2]), bytes = bytes, orig = anterior and anterior.orig or ler_orig(a[2], #bytes) }
  end
  log(("atributos: %s #%d (time %d) alterados"):format(visitante and "visitante" or "casa", n, id))
end

local function atributos_max(lado, n)
  local v = {}
  for nome in pairs(ATR.campos) do v[nome] = 19 end
  trocar_atributos(lado, n, v)
end

local function ler_atributos(lado, n)
  local visitante = (lado == "visitante" or lado == "v" or lado == 2)
  local a = ATR.buffer_base + ((visitante and ATR.por_time or 0) + n) * ATR.reg
  local w = ler_words(a)
  local out = {}
  for nome, c in pairs(ATR.campos) do
    out[#out + 1] = ("%s=%d"):format(nome, bit.band(bit.rshift(w[c[1] + 1], c[2]), 7) + 12)
  end
  table.sort(out)
  local altura = bit.band(bit.rshift(w[1], 20), 0x3F) + 148
  print(("[we2002] %s #%d: altura=%d %s"):format(visitante and "visitante" or "casa", n, altura, table.concat(out, " ")))
end


-- Início automático -----------------------------------------------------------
-- Depois de carregar o estado (tela das bandeiras), aplica as edições do
-- partida.json e aperta os botões de confirmação até o pré-jogo.
local function apertar(botao, segurar)
  local pad = PCSX.SIO0.slots[1].pads[1]
  local b = PCSX.CONSTS.PAD.BUTTON[botao]
  if not b then log("botão desconhecido: " .. tostring(botao)) return end
  pad.setOverride(b)
  agendar(segurar or 6, function() pad.clearOverride(b) end)
end

local CAMISA = { base = 0x80064970, por_time = 23 }

local function aplicar_edicoes(p)
  local lista = p and p.edicoes or {}
  condicoes.casa, condicoes.visitante = {}, {}
  local ncond = 0
  for _, e in ipairs(lista) do
    if type(e.jogador) == "number" and type(e.condicao) == "number" then
      definir_condicao(e.lado or "casa", e.jogador, e.condicao); ncond = ncond + 1
    end
  end
  if ncond > 0 then log(("condição física definida para %d jogador(es)"):format(ncond)) end
  -- nome do time na tela: "nome_tela" (se houver) ou "nome"
  for _, lado in ipairs({ "casa", "visitante" }) do
    local t = p and p[lado]
    local nome = t and (t.nome_tela or t.nome)
    if type(nome) == "string" then trocar_nome_time(lado, nome) end
    if t and t.formacao and t.formacao ~= json.null then trocar_formacao(lado, t.formacao) end
  end
  for _, e in ipairs(lista) do
    local lado, n = e.lado or "casa", e.jogador
    if type(n) == "number" then
      if type(e.nome) == "string" then trocar_nome(lado, n, e.nome) end
      local valores = {}
      if e.atributos == "max" then
        for nome in pairs(ATR.campos) do valores[nome] = 19 end
      elseif type(e.atributos) == "table" then
        valores = e.atributos
      end
      local camisa = type(e.camisa) == "number" and e.camisa or nil
      if camisa and not (camisa >= 1 and camisa <= 32) then
        log(("camisa %d ignorada: a base do jogo aceita 1 a 32"):format(camisa)); camisa = nil
      end
      local altura = type(e.altura) == "number" and e.altura or nil
      local extras = campos_registro(e)
      -- tudo num registro só: atributos, camisa, altura, posição, pé, idade, aparência
      if next(valores) or camisa or altura or #extras > 0 then
        trocar_atributos(lado, n, valores, camisa, altura, extras)
      end
    end
  end
  log(("%d edição(ões) aplicada(s) do partida.json"):format(#lista))
end

local function pos_carga()
  load_partida()
  local p = ui.partida
  if not p then return end
  aplicar_edicoes(p)
  R.nova_partida()
  if WE and WE.kitps1 then WE.kitps1(true) end
  if WE and WE.bandeiras then WE.bandeiras.carregar() end
  local ini = p.inicio_automatico
  if not ini or ini.ativo == false then return end
  local intervalo = ini.intervalo_frames or 45
  local espera = ini.espera_inicial_frames or 30
  for i, botao in ipairs(ini.botoes or { "CIRCLE" }) do
    agendar(espera + (i - 1) * intervalo, function()
      log("apertando " .. botao)
      apertar(botao)
    end)
  end
end


-- Kits PS1 (PCSX-Redux) ---------------------------------------------------------
-- Grava na VRAM o kit convertido por tools/converter-kit-ps1.mjs (página de 8 bits
-- + paleta). O upload usa uma rotina mínima em MIPS chamada com PCSX.callGuest
-- (exige CPU em modo Interpreter). A RAM é restaurada depois da chamada.
-- A cada poucos frames a ponte compara a VRAM com o kit esperado e regrava se o
-- jogo tiver reenviado a textura (ex.: substituição), preservando os algarismos
-- (índices F0-F3) que o jogo desenhou nas costas.
local ffi = require("ffi")
local KIT = { ativo = false, lados = {}, intervalo = 10, frames = 0, uploads = 0, erro = nil, status = "inativo" }
local CODE_ADDR, DATA_ADDR = 0x801F0000, 0x80180000
local GUEST = { 0x3C081F80, 0x3C09A000, 0xAD091810, 0xAD061810, 0xAD071810, 0x8C8A0000,
  0x24A5FFFF, 0xAD0A1810, 0x14A0FFFC, 0x24840004, 0x03E00008, 0x00000000 }
local function words_str(ws)
  local t = {}
  for i, w in ipairs(ws) do
    t[i] = string.char(bit.band(w, 255), bit.band(bit.rshift(w, 8), 255), bit.band(bit.rshift(w, 16), 255), bit.band(bit.rshift(w, 24), 255))
  end
  return table.concat(t)
end
local GUEST_CODE = words_str(GUEST)

local function ler_arquivo(p)
  local f = io.open(p, "rb"); if not f then return nil end
  local d = f:read("*a"); f:close(); return d
end

-- x, w em halfwords; dados = w*h*2 bytes
local function upload_vram(x, y, w, h, dados)
  local r = PCSX.callGuest {
    pc = CODE_ADDR,
    args = { DATA_ADDR, #dados / 4, bit.bor(bit.lshift(y, 16), x), bit.bor(bit.lshift(h, 16), w) },
    stage = { { addr = CODE_ADDR, data = GUEST_CODE }, { addr = DATA_ADDR, data = dados } },
    isolate = "ram",
  }
  if r.status ~= "returned" then error("upload falhou: " .. tostring(r.status)) end
  KIT.uploads = KIT.uploads + 1
end

local function carregar_kits()
  KIT.lados = {}
  local p = ui.partida
  if not (p and p.kits) then return end
  for _, lado in ipairs({ "casa", "visitante" }) do
    local k = p.kits[lado]
    if k and k.ps1 and k.ps1.ativo ~= false then
      local base = ROOT .. "/kits/convertidos/" .. lado
      local d = {
        pagina = ler_arquivo(base .. "_pagina.bin"), mascara = ler_arquivo(base .. "_mascara.bin"),
        paleta = ler_arquivo(base .. "_paleta.bin"), palmask = ler_arquivo(base .. "_paleta_mascara.bin"),
        refpal = ler_arquivo(ROOT .. "/" .. k.ps1.paleta_vram), refpag = ler_arquivo(ROOT .. "/" .. k.pagina),
        px = k.ps1.pagina_vram[1], py = k.ps1.pagina_vram[2], linhas = k.ps1.linhas_paleta,
      }
      if d.pagina and d.mascara and d.paleta and d.palmask and d.refpal and d.refpag then
        KIT.lados[lado] = d
      else
        log("kit PS1 " .. lado .. ": arquivos convertidos não encontrados (rode tools/converter-kit-ps1.mjs)")
      end
    end
  end
end

local function verificar_kits()
  local ok_v, vram = pcall(function() return tostring(PCSX.GPU.getVRAM()) end)
  if not ok_v or #vram < 1024 * 512 * 2 then KIT.status = "não consegui ler a VRAM" return end
  local estados = {}
  for lado, d in pairs(KIT.lados) do
    -- 1. A paleta do kit está carregada? (entradas reservadas iguais à referência)
    local linha0 = d.linhas[1]
    local off0 = linha0 * 2048
    local carregado = true
    for i = 0, 255 do
      if d.palmask:byte(i + 1) == 0 and vram:sub(off0 + i * 2 + 1, off0 + i * 2 + 2) ~= d.refpal:sub(i * 2 + 1, i * 2 + 2) then
        carregado = false; break
      end
    end
    -- 2. A página do kit está na VRAM? (amostra de pixels que o kit convertido não muda)
    if carregado then
      if not d.amostra then
        d.amostra = {}
        for i = 0, 32767, 37 do if d.mascara:byte(i + 1) == 0 then d.amostra[#d.amostra + 1] = i end end
      end
      local iguais = 0
      for _, i in ipairs(d.amostra) do
        local y, x = math.floor(i / 128), i % 128
        if vram:byte((d.py + y) * 2048 + d.px * 2 + x + 1) == d.refpag:byte(i + 1) then iguais = iguais + 1 end
      end
      if iguais < #d.amostra * 0.95 then carregado = false end
    end
    if not carregado then
      estados[#estados + 1] = lado .. ": aguardando partida"
    else
      -- página esperada = kit convertido + algarismos que o jogo desenhou nas costas
      local alvo = ffi.new("uint8_t[32768]")
      local mudou = false
      for y = 0, 255 do
        local o = (d.py + y) * 2048 + d.px * 2
        for x = 0, 127 do
          local i = y * 128 + x
          local atual = vram:byte(o + x + 1)
          local v
          if d.mascara:byte(i + 1) == 0 then v = atual
          elseif y >= 80 and y < 128 and x < 100 and atual >= 0xF0 and atual <= 0xF3 then v = atual
          else v = d.pagina:byte(i + 1) end
          alvo[i] = v
          if v ~= atual then mudou = true end
        end
      end
      if mudou then upload_vram(d.px, d.py, 64, 256, ffi.string(alvo, 32768)) end
      -- paleta: entradas nossas por cima da atual, em cada linha usada pelo kit
      for _, linha in ipairs(d.linhas) do
        local off = linha * 2048
        local atual = vram:sub(off + 1, off + 512)
        local t = {}
        for i = 0, 255 do
          t[i + 1] = d.palmask:byte(i + 1) == 1 and d.paleta:sub(i * 2 + 1, i * 2 + 2) or atual:sub(i * 2 + 1, i * 2 + 2)
        end
        local novo = table.concat(t)
        if novo ~= atual then upload_vram(0, linha, 256, 1, novo) end
      end
      estados[#estados + 1] = lado .. ": aplicado"
    end
  end
  KIT.status = table.concat(estados, " | ")
end

local function tick_kits()
  if not KIT.ativo or KIT.erro then return end
  KIT.frames = KIT.frames + 1
  if KIT.frames % KIT.intervalo ~= 0 then return end
  local ok, e = pcall(verificar_kits)
  if not ok then
    KIT.erro = tostring(e)
    KIT.status = "erro: " .. KIT.erro
    log("kit PS1 desativado: " .. KIT.erro)
    if KIT.erro:find("nterpreter") or KIT.erro:find("dynarec") then
      log("troque a CPU para Interpreter (Configuration > Emulation) ou rode o run-pcsx.bat (já usa -interpreter)")
    end
  end
end

local function ligar_kits(on)
  KIT.ativo = on ~= false
  KIT.erro = nil
  if KIT.ativo then load_partida(); carregar_kits() end
  local n = 0
  for _ in pairs(KIT.lados) do n = n + 1 end
  log(("kit PS1 %s (%d lado(s) configurado(s))"):format(KIT.ativo and "ligado" or "desligado", n))
end

-- Bandeiras/escudos no placar (bridge/bandeiras.lua) -----------------------
local BAND = require("bandeiras")({ log = log, root = ROOT, upload = upload_vram })

-- Atalhos para o console Lua --------------------------------------------
WE = {
  mem = mem, search = search, offsets = offsets, json = json,
  hex = function(addr, len) print(mem.hexdump(addr, len or 64)) end,
  nome = trocar_nome,
  nome_time = trocar_nome_time,
  formacao = trocar_formacao,
  condicao = definir_condicao,
  condicoes = condicoes,
  formacoes = FORMACOES,
  kitps1 = ligar_kits,
  tick_kits = tick_kits,
  kit_info = function() return KIT end,
  kitps1_status = function() print("[we2002] kit PS1: " .. KIT.status .. " | uploads: " .. KIT.uploads) end,
  salvar_como = function(nome) salvar_estado(PATHS.states .. "/" .. nome .. ".sstate") end,
  carregar_de = function(nome) carregar_estado(PATHS.states .. "/" .. nome .. ".sstate") end,
  pos_carga = pos_carga,
  resultado = R,
  bandeiras = BAND,
  apertar = apertar,
  edicoes = function() load_partida(); aplicar_edicoes(ui.partida) end,
  atributos = trocar_atributos,
  max = atributos_max,
  ver = ler_atributos,
  rastrear = rastrear,
  -- patch contínuo genérico: WE.poke(0x80064971, 22) ou WE.poke(addr, {1,2,3})
  poke = function(addr, v)
    local bytes = type(v) == "table" and v or { v }
    patches[("p%08X"):format(addr)] = { addr = mem.phys(addr), bytes = bytes }
    log(("poke %s <- %d byte(s)"):format(mem.fmt(addr), #bytes))
  end,
  limpar = function() for k in pairs(patches) do patches[k] = nil end; log("patches removidos") end,
  patches = function() print(contar_patches() .. " patches ativos") end,
  watch = add_watch,
  dump = dump_ram,
  dump_vram = dump_vram,
  salvar = function() salvar_estado(PATHS.estado_amistoso) end,
  carregar = function() carregar_estado(PATHS.estado_amistoso) end,
}

load_partida()
log("ponte carregada de " .. BRIDGE .. " | watches: " .. #watches)
log("console: WE.hex(0x80010000, 128), WE.watch(0x800xxxxx, 1, 'rótulo')")
