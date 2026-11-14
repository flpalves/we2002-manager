-- Mapa de endereços do Winning Eleven 2002 (BR).
-- Tudo começa vazio (nil). Conforme você descobrir cada endereço com a
-- busca por diferença, preencha aqui E documente em docs/offsets.md.
--
-- IMPORTANTE: estes endereços valem só para ESTA versão da ISO.
-- Se trocar de imagem/região, o mapa inteiro precisa ser revalidado.

return {
  versao_iso = "WE2002 (BR) - preencher serial/hash",

  -- Estado do jogo -------------------------------------------------------
  -- Byte que muda conforme a tela (menu, seleção de times, loading, partida).
  -- Candidato visto no código (lbu, comparado com 0x0D e 0x10). A confirmar.
  estado = { addr = 0x80075560, width = 1 },
  -- Valores observados para cada tela (preencher depois de mapear).
  estados = {
    -- menu_principal = 0x??,
    -- selecao_times  = 0x??,
    -- loading        = 0x??,
    -- em_partida     = 0x??,
    -- fim_de_jogo    = 0x??,
  },

  -- Times da partida -----------------------------------------------------
  time_casa      = { addr = 0x80075564, width = 1 }, -- confirmado 2026-11-03 (persiste no pré-jogo)
  time_visitante = { addr = 0x80075565, width = 1 }, -- confirmado 2026-11-03

  -- Placar (fase 3 do roadmap) -------------------------------------------
  gols_casa      = { addr = nil, width = 1 },
  gols_visitante = { addr = nil, width = 1 },
  -- Autor do último gol. indice = "lado" (vaga 0-22 do time que marcou) ou
  -- "global" (0-22 casa, 23-45 visitante). atraso = frames após o placar mudar.
  autor_gol      = { addr = nil, width = 1, indice = "lado", atraso = 30 },
  -- Relógio da partida. unidade = "minutos" ou "segundos".
  relogio        = { addr = nil, width = 1, unidade = "minutos" },
  -- Obs.: endereços confirmados pelo assistente da janela ficam em
  -- bridge/mapeados.json e têm prioridade sobre os valores daqui.

  -- Struct de jogador (fase 2) -------------------------------------------
  jogadores = {
    base   = nil, -- endereço do 1º jogador na base mestre
    stride = nil, -- tamanho de cada registro em bytes
    campos = {
      -- nome    = { off = 0x00, len = ?? },
      -- numero  = { off = 0x??, width = 1 },
      -- posicao = { off = 0x??, width = 1 },
    },
  },
}
