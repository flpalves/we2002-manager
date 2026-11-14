-- WE2002 Manager - bandeiras/escudos (PCSX-Redux)
--
-- Mapeado em 07/11/2026 com o save state bra_hol_22. Cada lado tem DUAS
-- imagens que usam a MESMA paleta de 16 cores:
--
--   casa (Brasil)       64x28 em x=560 y=0    22x8 em x=632 y=80, x=640 y=98, x=822 y=320    paleta x=144 y=507
--   visitante (Holanda) 64x28 em x=560 y=28   22x8 em x=620 y=64, x=646 y=98, x=810 y=312    paleta x=144 y=505
--
-- A 64x28 aparece na tela de substituição e na seleção de times; a 22x8 é a
-- bandeirinha do placar (fica num atlas com as dos outros países; gravamos um
-- bloco de 24x8 com 1 pixel transparente de cada lado).
-- As imagens vêm compactadas do CD direto para a VRAM (não passam pela RAM),
-- então a troca é feita na VRAM: a cada poucos frames a ponte confere se a
-- original está lá e grava a convertida (tools/converter-bandeira.mjs) por cima.
-- Mesma rotina de upload do kit PS1 (PCSX.callGuest, exige CPU em Interpreter).
--
-- Arquivos:
--   kits/bandeiras/ref_<lado>{,_pequena,_paleta}.bin       originais (referência)
--   kits/convertidos/bandeira_<lado>{,_pequena,_paleta}.bin convertidas
--
-- A bandeira grande que tremula (RESULT) é outra textura e ainda não é trocada.

return function(ctx)
  local log, ROOT = ctx.log, ctx.root
  local B = { ativo = true, lados = {}, status = "inativo", uploads = 0, frames = 0, intervalo = 10, erro = nil }
  -- alvos: x e w em halfwords (4 pixels de 4 bits cada)
  local SLOTS = {
    -- a bandeirinha 22x8 existe em 3 cópias: atlas da partida, cópia do placar
    -- (y=98, casa e visitante lado a lado) e atlas com todos os países
    casa = { px = 144, py = 507, alvos = {
      { sufixo = "", x = 560, y = 0, w = 16, h = 28 },
      { sufixo = "_pequena", x = 632, y = 80, w = 6, h = 8 },
      { sufixo = "_pequena", x = 640, y = 98, w = 6, h = 8 },
      { sufixo = "_pequena", x = 822, y = 320, w = 6, h = 8 } } },
    visitante = { px = 144, py = 505, alvos = {
      { sufixo = "", x = 560, y = 28, w = 16, h = 28 },
      { sufixo = "_pequena", x = 620, y = 64, w = 6, h = 8 },
      { sufixo = "_pequena", x = 646, y = 98, w = 6, h = 8 },
      { sufixo = "_pequena", x = 810, y = 312, w = 6, h = 8 } } },
  }

  local function ler(p)
    local f = io.open(p, "rb"); if not f then return nil end
    local d = f:read("*a"); f:close(); return d
  end

  function B.carregar()
    B.lados, B.erro = {}, nil
    local n = 0
    for lado, s in pairs(SLOTS) do
      local conv = ROOT .. "/kits/convertidos/bandeira_" .. lado
      local ref = ROOT .. "/kits/bandeiras/ref_" .. lado
      local d = { pal = ler(conv .. "_paleta.bin"), refpal = ler(ref .. "_paleta.bin"), imgs = {} }
      local ok = d.pal and d.refpal and #d.pal == 32
      for i, a in ipairs(s.alvos) do
        local img, r = ler(conv .. a.sufixo .. ".bin"), ler(ref .. a.sufixo .. ".bin")
        if img and r and #img == a.w * 2 * a.h and #r == #img then d.imgs[i] = { img = img, ref = r } else ok = false end
      end
      if ok then B.lados[lado] = d; n = n + 1 end
    end
    B.status = n > 0 and ("%d bandeira(s) carregada(s)"):format(n) or "nenhuma bandeira convertida"
    log("bandeiras: " .. B.status)
    return n
  end

  local function bloco(vram, x, y, w, h)
    local t = {}
    for r = 0, h - 1 do
      local o = (y + r) * 2048 + x * 2
      t[#t + 1] = vram:sub(o + 1, o + w * 2)
    end
    return table.concat(t)
  end

  local function parecido(a, b)
    if #a ~= #b then return false end
    local iguais = 0
    for i = 1, #a do if a:byte(i) == b:byte(i) then iguais = iguais + 1 end end
    return iguais >= #a * 0.9
  end

  local function verificar()
    local ok, vram = pcall(function() return tostring(PCSX.GPU.getVRAM()) end)
    if not ok or #vram < 1024 * 512 * 2 then B.status = "não consegui ler a VRAM" return end
    local partes = {}
    for lado, d in pairs(B.lados) do
      local s = SLOTS[lado]
      local presentes, aplicadas = 0, 0
      for i, a in ipairs(s.alvos) do
        local e = d.imgs[i]
        local atual = bloco(vram, a.x, a.y, a.w, a.h)
        if atual == e.img then
          presentes, aplicadas = presentes + 1, aplicadas + 1
        elseif parecido(atual, e.ref) then
          ctx.upload(a.x, a.y, a.w, a.h, e.img); B.uploads = B.uploads + 1
          presentes = presentes + 1
        end
      end
      -- a paleta só é trocada quando alguma das imagens está na VRAM, para não
      -- recolorir a bandeira original em outras telas
      local pal = bloco(vram, s.px, s.py, 16, 1)
      if pal ~= d.pal and pal == d.refpal and presentes > 0 then
        ctx.upload(s.px, s.py, 16, 1, d.pal); B.uploads = B.uploads + 1
      end
      local estado = presentes == 0 and "aguardando" or
        ((aplicadas == #s.alvos and pal == d.pal) and "aplicada" or ("aplicando %d/%d"):format(aplicadas, #s.alvos))
      partes[#partes + 1] = lado .. ": " .. estado
    end
    B.status = #partes > 0 and table.concat(partes, " | ") or "nenhuma bandeira convertida"
  end

  function B.tick()
    if not B.ativo or B.erro or not next(B.lados) then return end
    B.frames = B.frames + 1
    if B.frames % B.intervalo ~= 0 then return end
    local ok, e = pcall(verificar)
    if not ok then
      B.erro = tostring(e)
      B.status = "erro: " .. B.erro
      log("bandeiras desativadas: " .. B.erro)
    end
  end

  function B.ligar(on)
    B.ativo = on ~= false
    B.erro = nil
    if B.ativo then B.carregar() end
  end

  B.carregar()
  return B
end
