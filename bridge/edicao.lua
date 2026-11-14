-- WE2002 Manager - monitor da edição de jogadores (08/11/2026)
-- Enquanto ligado, compara a base mestre a cada 30 frames e registra, bit a bit,
-- o que mudou em cada jogador (registro de 12 bytes) e nos nomes. Serve para mapear
-- os campos que ainda não conhecemos (posição, habilidades, aparência) mexendo
-- num campo por vez no menu de edição do jogo.
-- Log: tela/terminal + data/edicao.log
return function(ctx)
  local mem, log_tela, PATHS = ctx.mem, ctx.log, ctx.paths
  local BASE, REG, POR_TIME, TIMES = 0x800A5124, 12, 23, 56
  local NOMES, REG_NOME, BLOCO_NOME = 0x80055FF8, 10, 0xE6
  local LEN, LEN_NOMES = TIMES * POR_TIME * REG, TIMES * BLOCO_NOME
  -- Buffer que o menu de edição usa (mesmo formato da base mestre, 2 times x 23).
  -- Achado em 08/11 comparando dumps com 4 cores de pele.
  local BUF, BUF_REGS = 0x8007DF60, 46
  local CAMPOS = { -- já mapeados: (word, bit inicial, bits, nome)
    { 0, 20, 6, "altura" }, { 0, 26, 5, "camisa" }, { 2, 30, 2, "pé" },
    { 1, 29, 3, "OFF" }, { 2, 0, 3, "DEF" }, { 1, 14, 3, "BAL" }, { 1, 17, 3, "STA" }, { 1, 23, 3, "SPD" },
    { 1, 26, 3, "ACC" }, { 1, 10, 3, "RES" }, { 2, 18, 3, "JMP" }, { 2, 15, 3, "HEAD" }, { 2, 12, 3, "TEC" },
    { 2, 9, 3, "PASS" }, { 1, 0, 2, "pele" }, { 0, 4, 5, "cabelo" }, { 0, 9, 3, "cor do cabelo" }, { 0, 13, 3, "barba" }, { 0, 17, 3, "cor da barba" }, { 1, 2, 3, "físico" }, { 1, 5, 5, "idade-15" }, { 2, 27, 3, "chuteira" }, { 0, 0, 3, "posição" }, { 2, 24, 3, "AGREC" }, { 0, 31, 1, "outside" }, { 2, 3, 3, "SHPW" }, { 2, 6, 3, "SHAC" }, { 1, 20, 3, "DRI" }, { 2, 21, 3, "CRV" },
  }
  local function nome_campo(w, b)
    for _, c in ipairs(CAMPOS) do if c[1] == w and b >= c[2] and b < c[2] + c[3] then return c[4], c[2], c[3] end end
    return nil
  end

  local E = WE2002_EDICAO or { ativo = false, n = 0, frame = 0 }
  WE2002_EDICAO = E
  local arq = PATHS and PATHS.resultado and PATHS.resultado:gsub("resultado%.json$", "edicao.log")
  local function log(msg)
    log_tela(msg)
    local f = arq and io.open(arq, "a")
    if f then f:write(os.date("%Y-%m-%d %H:%M:%S "), msg, "\n"); f:close() end
  end

  local function u32(s, i)
    local a, b, c, d = s:byte(i, i + 3)
    return a + b * 256 + c * 65536 + d * 16777216
  end
  local function bit(x, k) return math.floor(x / 2 ^ k) % 2 end
  local function campo(x, ini, n) return math.floor(x / 2 ^ ini) % (2 ^ n) end
  local function nome_jog(t, n)
    local s = mem.read_bytes(NOMES + t * BLOCO_NOME + n * REG_NOME, REG_NOME)
    return (s:gsub("%z.*$", ""))
  end

  function E.ligar(v)
    E.ativo = v
    if v then
      E.reg, E.nomes = mem.read_bytes(BASE, LEN), mem.read_bytes(NOMES, LEN_NOMES)
      E.buf = mem.read_bytes(BUF, BUF_REGS * REG)
      log("monitor de edição LIGADO: mude UM campo por vez no menu de edição")
    else
      log("monitor de edição desligado")
    end
  end

  -- Descreve as mudanças de um word: agrupa bits vizinhos alterados em faixas
  local function descrever(w, old, new)
    local partes, b = {}, 0
    while b < 32 do
      if bit(old, b) ~= bit(new, b) then
        local ini = b
        while b + 1 < 32 and bit(old, b + 1) ~= bit(new, b + 1) do b = b + 1 end
        local fim = b
        -- estende a faixa para dentro de um campo conhecido, se houver
        local nc, cini, cn = nome_campo(w, ini)
        if nc then
          -- campo conhecido: mostra o valor do campo inteiro e pula o resto dele
          partes[#partes + 1] = ("%s (w%d bits %d-%d): %d -> %d"):format(nc, w, cini, cini + cn - 1, campo(old, cini, cn), campo(new, cini, cn))
          b = math.max(b, cini + cn - 1)
        else
          local n = fim - ini + 1
          partes[#partes + 1] = ("w%d bits %d-%d (DESCONHECIDO): %d -> %d"):format(w, ini, fim, campo(old, ini, n), campo(new, ini, n))
        end
      end
      b = b + 1
    end
    return partes
  end

  function E.tick()
    E.frame = E.frame + 1
    if not E.ativo or E.frame % 30 ~= 0 then return end
    local reg, nomes = mem.read_bytes(BASE, LEN), mem.read_bytes(NOMES, LEN_NOMES)
    if reg ~= E.reg then
      for i = 1, LEN, 4 do
        local o, nw = u32(E.reg, i), u32(reg, i)
        if o ~= nw then
          local jog = math.floor((i - 1) / REG)
          local t, n, w = math.floor(jog / POR_TIME), jog % POR_TIME, math.floor(((i - 1) % REG) / 4)
          E.n = E.n + 1
          local cab = ("#%d time %d jogador %d (%s) w%d: %08X -> %08X"):format(E.n, t, n, nome_jog(t, n), w, o, nw)
          log(cab)
          for _, p in ipairs(descrever(w, o, nw)) do log("    " .. p) end
        end
      end
      E.reg = reg
    end
    local buf = mem.read_bytes(BUF, BUF_REGS * REG)
    if buf ~= E.buf then
      for i = 1, BUF_REGS * REG, 4 do
        local o, nw = u32(E.buf, i), u32(buf, i)
        if o ~= nw then
          local r, w = math.floor((i - 1) / REG), math.floor(((i - 1) % REG) / 4)
          E.n = E.n + 1
          log(("#%d EDIÇÃO (buffer) registro %d w%d: %08X -> %08X"):format(E.n, r, w, o, nw))
          for _, p in ipairs(descrever(w, o, nw)) do log("    " .. p) end
        end
      end
      E.buf = buf
    end
    if nomes ~= E.nomes then
      for t = 0, TIMES - 1 do
        for n = 0, POR_TIME - 1 do
          local i = t * BLOCO_NOME + n * REG_NOME + 1
          local a, b = E.nomes:sub(i, i + REG_NOME - 1), nomes:sub(i, i + REG_NOME - 1)
          if a ~= b then
            E.n = E.n + 1
            log(("#%d time %d jogador %d: nome '%s' -> '%s'"):format(E.n, t, n, (a:gsub("%z.*$", "")), (b:gsub("%z.*$", ""))))
          end
        end
      end
      E.nomes = nomes
    end
  end

  -- Marca no log e salva um dump da RAM em dumps/edicao/ (para achar a cópia que o
  -- menu de edição usa: ela não fica na base mestre enquanto se edita).
  function E.marcar()
    E.n = E.n + 1
    E.marcas = (E.marcas or 0) + 1
    local dir = PATHS.dumps .. "/edicao"
    if not E.dir_ok then os.execute('mkdir "' .. dir:gsub("/", "\\") .. '" 2>nul'); E.dir_ok = true end
    local nome = ("%s/%s_%02d.bin"):format(dir, os.date("%Y%m%d_%H%M%S"), E.marcas)
    local ok = mem.dump and mem.dump(nome)
    log(("#%d ---- marca %d ---- dump: %s%s"):format(E.n, E.marcas, nome, ok and "" or " (FALHOU)"))
  end

  function E.draw()
    if not imgui.CollapsingHeader("Monitor de edição de jogadores") then return end
    imgui.TextUnformatted(("Monitor: %s | mudanças registradas: %d | log em data/edicao.log"):format(E.ativo and "LIGADO" or "desligado", E.n))
    if imgui.Button(E.ativo and "Desligar monitor" or "Ligar monitor") then E.ligar(not E.ativo) end
    imgui.SameLine()
    if imgui.Button("Marcar + dump da RAM") then E.marcar() end
  end

  return E
end
