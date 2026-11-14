-- WE2002 Manager - resultado da partida (passo 3 do roadmap)
--
-- O jogo guarda tudo o que a tela de RESULT mostra numa área fixa da RAM
-- (mapeado em 07/11/2026 com dumps das telas P.K. MATCH e RESULT):
--
--   Gols da casa       0x800755C4   32 registros de 4 bytes: autor, assistência, minuto, 0
--   Gols do visitante  0x80075644   (vaga 0-22 do time; FF = vazio / sem assistência)
--   Estatísticas       0x800756F2   pares (casa, visitante), 1 byte cada
--   Pênaltis           0x8007570C (casa), 0x8007570D (visitante)
--   Estado do jogo     0x80075560   0x0E nas telas de fim (P.K. MATCH e RESULT)
--
-- A ponte monta o resultado direto dessas tabelas e grava data/resultado.json:
--   * a cada mudança na tabela de gols durante a partida ("final": false);
--   * ao entrar no estado de fim de jogo ("final": true), e de novo se algo
--     mudar enquanto ele durar (ex.: disputa de pênaltis);
--   * pelo botão "Gravar resultado" ou WE.resultado.gravar() no console.
--
-- Uso pela ponte (we2002.lua):
--   local R = require("resultado")({ mem=..., json=..., offsets=..., log=...,
--     paths=PATHS, partida=function() return ui.partida end })
--   R.tick_vsync()  R.tick_ui()  R.draw()  R.nova_partida()

return function(ctx)
  local mem, json, offsets, log = ctx.mem, ctx.json, ctx.offsets, ctx.log
  local PATHS = ctx.paths
  -- Tudo que a ponte loga sobre o resultado também vai para data/ponte.log (diagnóstico)
  local log_tela = log
  log = function(msg)
    log_tela(msg)
    local arq = PATHS and PATHS.resultado and PATHS.resultado:gsub("resultado%.json$", "ponte.log")
    local f = arq and io.open(arq, "a")
    if f then f:write(os.date("%Y-%m-%d %H:%M:%S "), tostring(msg), "\n"); f:close() end
  end

  local R = {}
  local END = {
    gols = { casa = 0x800755C4, visitante = 0x80075644 }, max_gols = 32, reg = 4,
    estatisticas = 0x800756F2,
    penaltis = { casa = 0x8007570C, visitante = 0x8007570D },
    estado = 0x80075560,
    fase = 0x8007570E, -- 0 = 1º tempo?, 1 = 2º tempo, 2 = 1º prorr.?, 3 = 2º prorr., 4 = pênaltis
    -- ⚠️ NÃO CONFIÁVEL (08/11, noite): pareciam marcar o fim de jogo pelos dumps das telas
    -- finais, mas viram "fim" no meio do 1º tempo (eles mudam o tempo todo na partida).
    -- Ficam só como observação; a detecção por eles está desligada (USAR_BYTES_FIM).
    -- Cena da partida (08/11, 62 dumps automáticos de uma partida inteira + RESULT do 2 x 0 de 07/11):
    -- 18 seleção/menu/pausa, 14 no 1º tempo (e intervalo), 12 no 2º tempo, 0 depois do apito final
    -- do 2º tempo, 22 na P.K. MATCH. Fim do jogo = já viu 12 nesta partida e agora vale 0 (fase 1).
    cena = 0x80076AA8,
    -- Valores da cena depois do apito final já vistos (0 numa partida, 13 em outra).
    cena_fim = { [0] = true, [13] = true },
    -- ❌ 0x80076713 = 1 e 0x8007530D = 9 também acontecem durante a partida (alarme falso
    -- em 08/11, 21:54): ficam só no log, não decidem nada.
    pos_jogo = { { 0x80076713, 1 }, { 0x8007530D, 9 } },
    fim = { { 0x8007B8AC, 1 }, { 0x8007B8AD, 0 }, { 0x800649AB, 1 }, { 0x80072A5F, 1 } },
  }
  local ESTADO_FIM_PADRAO = 0x0E
  -- ATENÇÃO (07/11, noite): 0x80075560 vale 0x0E o tempo todo (bandeiras,
  -- partida e telas finais), e a "fase" parece ser o período ATUAL (vale 1
  -- durante todo o 2º tempo). Ou seja, ainda não temos um sinal confiável de
  -- fim de jogo. Enquanto FIM_CONFIAVEL for false, a ponte continua gravando
  -- a cada mudança, mas NÃO trava o resultado e NÃO fecha o emulador.
  local FIM_CONFIAVEL = false -- (sinal antigo: estado 0x0E + fase; não usar)
  -- Fechar o emulador sozinho só depois de confirmar o sinal novo numa partida real.
  local FECHAR_NO_FIM = true -- fecha o emulador fechar_ao_final.espera_segundos depois do resultado final (08/11)
  local USAR_BYTES_FIM = false
  -- Mapeamento do fim de jogo / relógio: salva um dump da RAM a cada DUMP_INTERVALO
  -- frames enquanto a partida estiver armada, em dumps/auto/<partida_id>/.
  local DUMP_INTERVALO = 900 -- 15 s a 60 fps
  -- Pares (casa, visitante) a partir de 0x800756F2, na ordem da memória.
  -- Conferido com duas partidas (RESULT de 07/11). Os dois "desconhecido"
  -- valeram 0 nas duas: um deles deve ser cartões vermelhos (a confirmar).
  local ESTAT = { "chutes", "impedimentos", "faltas", "desconhecido1", "amarelos",
    "escanteios", "laterais", "desconhecido2" }
  local FASES = { [0] = "1T", [1] = "2T", [2] = "1P", [3] = "2P", [4] = "PEN" }
  local NOMES_BUFFER, REG_NOME, POR_TIME = 0x80064570, 16, 23

  local st = WE2002_RESULTADO or {}
  WE2002_RESULTADO = st
  st.frame = st.frame or 0
  st.status = st.status or "aguardando partida"
  if st.auto == nil then st.auto = true end

  -- Modo da partida (partida.json: "modo") ------------------------------------
  --   "pontos_corridos" (round robin): pode empatar. O resultado vale no apito
  --       dos 90 minutos; se o jogo seguir para a prorrogação, ela é ignorada.
  --   "mata_mata": precisa de vencedor. Empate no fim do 2º tempo ou da
  --       prorrogação fica como parcial até a decisão (gols ou pênaltis).
  -- Sem "modo", vale mata-mata (é o que o jogo faz no amistoso).
  local function modo_partida()
    local p = ctx.partida() or {}
    local m = tostring(p.modo or ""):lower():gsub("[%s%-]", "_")
    if m == "pontos_corridos" or m == "round_robin" or m == "liga" then return "pontos_corridos" end
    local c = p.fechar_ao_final
    if type(c) == "table" and c.empate_encerra == true then return "pontos_corridos" end
    return "mata_mata"
  end

  -- Fechar o emulador ao final ------------------------------------------------
  -- partida.json: "fechar_ao_final": { "ativo": true, "espera_segundos": 10 }
  --   ativo           liga/desliga (a caixa na janela vale só para a sessão)
  --   espera_segundos tempo na tela final antes de fechar
  local function cfg_fechar()
    local p = ctx.partida() or {}
    local c = p.fechar_ao_final
    if type(c) == "boolean" then c = { ativo = c } end
    if type(c) ~= "table" then c = {} end
    return {
      ativo = (st.fechar_override ~= nil) and st.fechar_override or (c.ativo == true),
      espera = tonumber(c.espera_segundos) or 10,
    }
  end

  local function fechar_emulador()
    log("fechando o emulador (partida encerrada)")
    if PCSX.quit then PCSX.quit(0) else os.exit(0) end
  end

  local function estado_fim()
    return (offsets.estados and offsets.estados.fim_de_jogo) or ESTADO_FIM_PADRAO
  end

  -- Nome: primeiro o editado no partida.json / data/times, depois o da RAM.
  local function nome_jogador(lado, vaga)
    if type(vaga) ~= "number" or vaga < 0 or vaga >= POR_TIME then return nil end
    local p = ctx.partida()
    for _, e in ipairs((p and p.edicoes) or {}) do
      if (e.lado or "casa") == lado and e.jogador == vaga and type(e.nome) == "string" then
        return e.nome
      end
    end
    local base = NOMES_BUFFER + ((lado == "visitante") and POR_TIME or 0) * REG_NOME
    local s = mem.read_bytes(base + vaga * REG_NOME, REG_NOME)
    s = s:gsub("%z.*$", ""):gsub("[^\32-\126]", "")
    return s
  end

  local function periodo(minuto)
    if minuto <= 45 then return "1T" elseif minuto <= 90 then return "2T"
    elseif minuto <= 105 then return "1P" else return "2P" end
  end

  -- Lê a tabela de gols de um lado
  local function ler_gols(lado)
    local out = {}
    local base = END.gols[lado]
    for i = 0, END.max_gols - 1 do
      local a = base + i * END.reg
      local autor, assist, minuto = mem.read8(a), mem.read8(a + 1), mem.read8(a + 2)
      if autor == 0xFF then break end
      if autor >= POR_TIME or minuto == 0 or minuto > 130 then return nil end -- lixo: tabela ainda não iniciada
      out[#out + 1] = { lado = lado, autor = autor, assist = assist, minuto = minuto }
    end
    return out
  end

  -- Dumps automáticos para mapear o fim de jogo e o relógio ----------------------
  st.auto_dumps = false -- dumps automáticos desligados por padrão (dá para ligar na janela da ponte)
  function R.dump_auto(rotulo)
    if not mem.dump or not PATHS or not PATHS.dumps then return end
    local p = ctx.partida() or {}
    local pid = tostring(p.partida_id or "sem_id"):gsub("[^%w%-_]", "_")
    local dir = PATHS.dumps .. "/auto/" .. pid
    if st.dir_dumps ~= dir then
      os.execute('mkdir "' .. dir:gsub("/", "\\") .. '" 2>nul')
      st.dir_dumps = dir
      st.seq_dump = 0
    end
    st.seq_dump = (st.seq_dump or 0) + 1
    local fase = mem.read8(END.fase)
    local nome = ("%s/%03d_f%d_%s_q%07d.bin"):format(dir, st.seq_dump, fase, rotulo or "auto", st.frame)
    local ok = mem.dump(nome)
    -- índice para a análise: seq, frame, fase, gols, rótulo, hora
    local gc, gv = ler_gols("casa"), ler_gols("visitante")
    local f = io.open(dir .. "/indice.csv", "a")
    if f then
      f:write(("%d,%d,%d,%d,%d,%s,%s\n"):format(st.seq_dump, st.frame, fase, gc and #gc or -1, gv and #gv or -1,
        rotulo or "auto", os.date("%H:%M:%S")))
      f:close()
    end
    if rotulo and rotulo ~= "auto" then
      st.status = ("dump marcado (%s) salvo: %s"):format(rotulo, nome)
      log(st.status)
    end
    return ok
  end

  -- true quando os 4 bytes estão com os valores do fim de jogo
  function R.fim_de_jogo()
    for _, par in ipairs(END.fim) do
      if mem.read8(par[1]) ~= par[2] then return false end
    end
    return true
  end
  function R.fim_bytes()
    local t = {}
    for _, par in ipairs(END.fim) do t[#t + 1] = tostring(mem.read8(par[1])) end
    return table.concat(t, " ")
  end

  function R.pos_jogo()
    for _, par in ipairs(END.pos_jogo) do
      if mem.read8(par[1]) ~= par[2] then return false end
    end
    return true
  end

  local function ler_tudo()
    local gc, gv = ler_gols("casa"), ler_gols("visitante")
    if not gc or not gv then return nil end
    local est = { casa = {}, visitante = {} }
    for i, nome in ipairs(ESTAT) do
      local a = END.estatisticas + (i - 1) * 2
      est.casa[nome] = mem.read8(a)
      est.visitante[nome] = mem.read8(a + 1)
    end
    return {
      gols_casa = gc, gols_visitante = gv, estat = est,
      pk_c = mem.read8(END.penaltis.casa), pk_v = mem.read8(END.penaltis.visitante),
      estado = mem.read8(END.estado),
      fase = mem.read8(END.fase),
      fim = R.fim_de_jogo(),
      cena = mem.read8(END.cena),
      pos_jogo = R.pos_jogo(),
    }
  end

  -- Assinatura para saber se algo mudou
  local function assinatura(d)
    if not d then return "nil" end
    local t = {}
    for _, g in ipairs(d.gols_casa) do t[#t + 1] = ("c%d.%d.%d"):format(g.autor, g.assist, g.minuto) end
    for _, g in ipairs(d.gols_visitante) do t[#t + 1] = ("v%d.%d.%d"):format(g.autor, g.assist, g.minuto) end
    t[#t + 1] = ("pk%d.%d f%d"):format(d.pk_c, d.pk_v, d.fase)
    for _, lado in ipairs({ "casa", "visitante" }) do
      for _, nome in ipairs(ESTAT) do t[#t + 1] = tostring(d.estat[lado][nome]) end
    end
    return table.concat(t, ",")
  end

  local function montar(d, final, motivo)
    local p = ctx.partida() or {}
    local gols = {}
    local todos = {}
    local so90 = modo_partida() == "pontos_corridos"
    if so90 then
      -- pontos corridos: vale o placar dos 90 minutos (prorrogação e pênaltis do jogo são ignorados)
      local function filtrar(l) local o = {} for _, g in ipairs(l) do if g.minuto <= 90 then o[#o + 1] = g end end return o end
      d = { gols_casa = filtrar(d.gols_casa), gols_visitante = filtrar(d.gols_visitante), estat = d.estat,
            pk_c = 0, pk_v = 0, estado = d.estado, fase = math.min(d.fase, 1), fim = d.fim }
    end
    for _, g in ipairs(d.gols_casa) do todos[#todos + 1] = g end
    for _, g in ipairs(d.gols_visitante) do todos[#todos + 1] = g end
    table.sort(todos, function(a, b) return a.minuto < b.minuto end)
    local prorrogacao = false
    for i, g in ipairs(todos) do
      if g.minuto > 90 then prorrogacao = true end
      local tem_assist = g.assist ~= 0xFF and g.assist < POR_TIME
      gols[i] = {
        lado = g.lado, minuto = g.minuto, periodo = periodo(g.minuto),
        vaga = g.autor, nome = nome_jogador(g.lado, g.autor) or json.null,
        assist_vaga = tem_assist and g.assist or json.null,
        assist_nome = tem_assist and nome_jogador(g.lado, g.assist) or json.null,
      }
    end
    local nc, nv = #d.gols_casa, #d.gols_visitante
    local teve_pk = (d.pk_c + d.pk_v) > 0
    if teve_pk then prorrogacao = true end
    local vencedor = (nc > nv and "casa") or (nv > nc and "visitante") or "empate"
    if vencedor == "empate" and teve_pk then
      vencedor = (d.pk_c > d.pk_v and "casa") or (d.pk_v > d.pk_c and "visitante") or "empate"
    end
    local function time(lado, n, pk)
      local t = p[lado] or {}
      return {
        nome = t.nome or json.null, id_we = t.id_we or json.null,
        gols = n, penaltis = teve_pk and pk or json.null,
        estatisticas = d.estat[lado],
      }
    end
    return {
      partida_id = p.partida_id or json.null,
      modo = modo_partida(),
      final = final,
      motivo = motivo or json.null,
      gerado_em = os.date("!%Y-%m-%dT%H:%M:%SZ"),
      casa = time("casa", nc, d.pk_c),
      visitante = time("visitante", nv, d.pk_v),
      fase = FASES[d.fase] or d.fase,
      prorrogacao = prorrogacao or d.fase >= 2,
      penaltis = teve_pk,
      vencedor = vencedor,
      gols = gols,
      nao_mapeado = { "cartoes_por_jogador", "lesoes", "gol_contra" },
    }
  end

  function R.gravar(final, motivo)
    if final == nil then final = true end
    local d = ler_tudo()
    if not d then
      st.status = "tabela de gols ainda não iniciada (fora de partida?)"
      log(st.status)
      return false
    end
    local res = montar(d, final, motivo or "manual")
    local ok, e = json.write_file(PATHS.resultado, res)
    if ok then
      local pk = res.penaltis and (" (pên. %d x %d)"):format(d.pk_c, d.pk_v) or ""
      st.status = ("%s: %s %d x %d %s%s"):format(final and "resultado FINAL gravado" or "parcial gravado",
        tostring(res.casa.nome), res.casa.gols, res.visitante.gols, tostring(res.visitante.nome), pk)
      st.ultima_assinatura = assinatura(d)
      st.ultimo_final = final
    else
      st.status = "erro ao gravar resultado.json: " .. tostring(e)
    end
    log(st.status)
    return ok
  end

  function R.nova_partida()
    st.armado = true
    st.fechar_em = nil
    st.fechando = false
    st.viu_jogo = false
    st.travado = false
    st.base = nil         -- assinatura inicial (descarta restos da partida anterior)
    st.ultima_assinatura = nil
    st.ultimo_final = false
    st.viu_nao_fim = false
    st.fim_conta = 0
    st.viu_2t = false
    st.fim2t_conta = 0
    st.ultimo_pos_jogo = nil
    st.ultima_cena = nil
    st.ultimo_fim_lido = nil
    st.status = "partida armada"
    log(st.status)
  end

  -- Confere a cada 30 frames (a leitura é barata, mas não precisa ser contínua)
  function R.tick_vsync()
    st.frame = st.frame + 1
    if st.fechar_em and st.frame >= st.fechar_em then
      st.fechar_em = nil
      if cfg_fechar().ativo then st.fechando = true; fechar_emulador() end
      return
    end
    if not st.auto or not st.armado or st.frame % 30 ~= 0 then return end
    local d = ler_tudo()
    local sig = assinatura(d)
    if st.base == nil then st.base = sig return end
    if not d then return end
    -- "viu o jogo": a tabela mudou desde que a partida foi armada (o jogo zera
    -- as tabelas no início da partida), então não são restos da anterior.
    if sig ~= st.base then st.viu_jogo = true end
    -- 0x0E também aparece no intervalo (fase 0): aí grava como parcial.
    -- Só vale depois de ver o jogo rolando (estado diferente de 0x0E) desde que
    -- a partida foi armada: evita pegar a tela final da partida anterior.
    if st.auto_dumps and st.frame % DUMP_INTERVALO == 0 then R.dump_auto("auto") end
    -- Fim de jogo pelos bytes de END.fim. Só vale se, depois de armar a partida,
    -- eles já estiveram com o valor de "não acabou" (descarta restos da anterior),
    -- e se o fim aparecer em 2 leituras seguidas (~1 s).
    if d.fim ~= st.ultimo_fim_lido then
      log(("bytes de fim: %s (fase %d) -> %s"):format(R.fim_bytes(), d.fase, d.fim and "FIM DE JOGO" or "jogo em andamento"))
      st.ultimo_fim_lido = d.fim
    end
    -- Fim do 2º tempo pela cena: viu o 2º tempo rolando (12) e agora a cena é 0.
    if d.cena ~= st.ultima_cena then
      log(("cena da partida: %d -> %d (fase %d)"):format(st.ultima_cena or -1, d.cena, d.fase))
      st.ultima_cena = d.cena
    end
    if d.cena == 12 then st.viu_2t = true end
    if d.pos_jogo ~= st.ultimo_pos_jogo then
      log(("pós-jogo (76713=%d, 7530D=%d): %s (cena %d, fase %d)"):format(mem.read8(0x80076713), mem.read8(0x8007530D),
        d.pos_jogo and "SIM" or "não", d.cena, d.fase))
      st.ultimo_pos_jogo = d.pos_jogo
    end
    if st.viu_2t and END.cena_fim[d.cena] and d.fase == 1 then st.fim2t_conta = (st.fim2t_conta or 0) + 1 else st.fim2t_conta = 0 end
    if not d.fim then st.viu_nao_fim = true; st.fim_conta = 0 end
    if d.fim and st.viu_nao_fim and USAR_BYTES_FIM then st.fim_conta = (st.fim_conta or 0) + 1 end
    local modo = modo_partida()
    local motivo_final = nil
    if (st.fim2t_conta or 0) >= 4 then -- ~2 s com a cena de fim
      local empate = #d.gols_casa == #d.gols_visitante
      if modo == "pontos_corridos" or not empate then
        motivo_final = "fim do 2º tempo"
      elseif sig ~= st.ultima_assinatura then
        R.gravar(false, "empate no fim do 2º tempo: prorrogação/pênaltis a seguir")
      end
    end
    if motivo_final then
      -- (fim do 2º tempo detectado acima)
    elseif (st.fim_conta or 0) >= 2 then
      motivo_final = "fim de jogo"
    elseif modo == "pontos_corridos" and d.fase >= 2 and st.viu_nao_fim then
      motivo_final = "fim dos 90 minutos (o jogo seguiu para a prorrogação)"
    end
    if motivo_final then
      if not st.ultimo_final or sig ~= st.ultima_assinatura then R.gravar(true, motivo_final) end
      if FECHAR_NO_FIM then
        local c = cfg_fechar()
        if c.ativo and not st.fechar_em and not st.fechando then
          st.fechar_em = st.frame + math.floor(c.espera * 60)
          log(("partida encerrada: o emulador fecha em %d s"):format(c.espera))
        end
      end
      return
    end
    if sig ~= st.base and sig ~= st.ultima_assinatura then
      R.gravar(false, "andamento")
    end
  end

  function R.tick_ui() end

  function R.marcar_fim()
    local v = mem.read8(END.estado)
    offsets.estados = offsets.estados or {}
    offsets.estados.fim_de_jogo = v
    st.status = ("estado de fim de jogo = 0x%02X (só nesta sessão; para fixar, ponha em offsets.lua)"):format(v)
    log(st.status)
  end

  function R.draw()
    if not imgui.CollapsingHeader("Resultado da partida") then return end
    imgui.TextUnformatted(st.status)
    local d = ler_tudo()
    local e = mem.read8(END.estado)
    local f = mem.read8(END.fase)
    imgui.TextUnformatted(("Modo: %s | estado: 0x%02X %s | fase %d (%s) | detecção %s%s"):format(
      modo_partida() == "pontos_corridos" and "pontos corridos" or "mata-mata", e,
      e == estado_fim() and "(tela de fim)" or "", f, FASES[f] or "?", st.armado and "ARMADA" or "parada",
      st.travado and " | resultado dos 90' fechado" or ""))
    local cena = mem.read8(END.cena)
    local nomes_cena = { [18] = "seleção/menu/pausa", [14] = "1º tempo", [12] = "2º tempo", [0] = "fim do 2º tempo", [22] = "P.K. MATCH" }
    imgui.TextUnformatted(("Cena: %d (%s) | viu 2º tempo: %s"):format(cena, nomes_cena[cena] or "?", st.viu_2t and "sim" or "não"))
    local cha, va = imgui.Checkbox(("Dumps automáticos a cada %d s (mapear fim de jogo/relógio)"):format(math.floor(DUMP_INTERVALO / 60)), st.auto_dumps)
    if cha then st.auto_dumps = va end
    imgui.TextUnformatted("Marcar momento (salva um dump com rótulo):")
    for _, m in ipairs({ { "Intervalo", "intervalo" }, { "Apito final 2T", "apito_2t" }, { "Tela RESULT", "result" },
                         { "Menu pós-jogo", "menu_pos" }, { "Relógio 30:00", "relogio_30" } }) do
      imgui.SameLine()
      if imgui.Button(m[1]) then R.dump_auto(m[2]) end
    end
    if d then
      local pk = (d.pk_c + d.pk_v) > 0 and (" | pênaltis %d x %d"):format(d.pk_c, d.pk_v) or ""
      imgui.TextUnformatted(("Na RAM agora: %d x %d%s"):format(#d.gols_casa, #d.gols_visitante, pk))
      for _, lado in ipairs({ "casa", "visitante" }) do
        for _, g in ipairs(d[lado == "casa" and "gols_casa" or "gols_visitante"]) do
          local a = g.assist ~= 0xFF and nome_jogador(lado, g.assist)
          imgui.TextUnformatted(("  %d' %s - %s%s"):format(g.minuto, lado, nome_jogador(lado, g.autor) or "?",
            a and (" (assist. " .. a .. ")") or ""))
        end
      end
    else
      imgui.TextUnformatted("Tabela de gols ainda não iniciada")
    end
    if imgui.Button("Gravar resultado") then R.gravar(true, "manual") end
    imgui.SameLine()
    if imgui.Button("Armar nova partida") then R.nova_partida() end
    imgui.SameLine()
    local ch, val = imgui.Checkbox("Gravar automaticamente", st.auto)
    if ch then st.auto = val end
    imgui.SameLine()
    if imgui.Button("Valor atual = fim de jogo") then R.marcar_fim() end
    local c = cfg_fechar()
    local chf, vf = imgui.Checkbox("Fechar o emulador ao final", c.ativo)
    if chf then st.fechar_override = vf; if not vf then st.fechar_em = nil end end
    if st.fechar_em then
      imgui.SameLine()
      imgui.TextUnformatted(("fechando em %d s"):format(math.max(0, math.ceil((st.fechar_em - st.frame) / 60))))
      imgui.SameLine()
      if imgui.Button("Cancelar") then st.fechar_em = nil; st.fechar_override = false end
    end
  end

  R.info = function() return st end
  R.ler = ler_tudo
  R.nome_jogador = nome_jogador
  return R
end
