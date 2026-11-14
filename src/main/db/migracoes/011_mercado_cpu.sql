-- Mercado da CPU com intenção (06, "IA de mercado"; roadmap 9.1): lista de venda, plano de
-- janela por clube, saídas por fim de contrato e propostas com teto e contraproposta.

-- À venda: NULL ou o motivo ('excedente', 'financeiro', 'emprestimo', 'usuario').
ALTER TABLE jogador ADD COLUMN a_venda TEXT;

-- Plano de cada clube da CPU na janela (criado na primeira data dela).
CREATE TABLE plano_janela (
  temporada       INTEGER NOT NULL,
  janela          INTEGER NOT NULL,                  -- semana_inicio da janela
  time            TEXT NOT NULL REFERENCES time(sigla),
  perfil          TEXT NOT NULL,
  chegadas_alvo   INTEGER NOT NULL,
  chegadas_feitas INTEGER NOT NULL DEFAULT 0,
  verba           INTEGER NOT NULL,
  teto_folha      INTEGER NOT NULL,
  PRIMARY KEY (temporada, janela, time)
);

-- Quantas propostas o usuário recebe na janela.
CREATE TABLE plano_propostas (
  temporada INTEGER NOT NULL,
  janela    INTEGER NOT NULL,
  alvo      INTEGER NOT NULL,
  feitas    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (temporada, janela)
);

-- Quem saiu de cada clube por fim de contrato na virada (temporada = a que começa).
CREATE TABLE saida_elenco (
  id         INTEGER PRIMARY KEY,
  temporada  INTEGER NOT NULL,
  time       TEXT NOT NULL REFERENCES time(sigla),
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  motivo     TEXT NOT NULL
);
CREATE INDEX saida_elenco_time ON saida_elenco(temporada, time);

-- Propostas recebidas: teto oculto, prazo em semanas, contraproposta (1 rodada) e o estado
-- 'desistiu' (a CPU desistiu depois da contraproposta). Recria a tabela por causa do CHECK.
CREATE TABLE proposta_recebida_nova (
  id             INTEGER PRIMARY KEY,
  jogador_id     INTEGER NOT NULL REFERENCES jogador(id),
  clube          TEXT NOT NULL REFERENCES time(sigla),
  valor          INTEGER NOT NULL,
  teto           INTEGER NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'aberta' CHECK (estado IN ('aberta', 'aceita', 'recusada', 'expirada', 'desistiu')),
  temporada      INTEGER NOT NULL,
  semana         INTEGER NOT NULL,
  prazo_semana   INTEGER NOT NULL,
  contraproposta INTEGER                              -- valor pedido pelo usuário (NULL = não pediu)
);
INSERT INTO proposta_recebida_nova (id, jogador_id, clube, valor, teto, estado, temporada, semana, prazo_semana)
  SELECT id, jogador_id, clube, valor, valor, estado, temporada, semana, semana FROM proposta_recebida;
DROP TABLE proposta_recebida;
ALTER TABLE proposta_recebida_nova RENAME TO proposta_recebida;
CREATE INDEX proposta_recebida_estado ON proposta_recebida(estado, temporada);

-- Regras congeladas na carreira: a intensidade vira multiplicador das chegadas-alvo, entram os
-- números da IA (json_insert não sobrescreve) e saem as chances por data, que não são mais usadas.
UPDATE regras SET dados = json_remove(
  json_insert(
    json_set(dados, '$.mercado.intensidade', json('{"baixa":0.6,"media":1,"alta":1.4}')),
    '$.mercado.ia', json('{
      "grupos": {
        "gol": {"posicoes": ["GK"], "minimo": 2, "ideal": 3},
        "zaga": {"posicoes": ["CB"], "minimo": 3, "ideal": 4},
        "lateral": {"posicoes": ["SB"], "minimo": 2, "ideal": 4},
        "volante": {"posicoes": ["DH"], "minimo": 2, "ideal": 4},
        "meia": {"posicoes": ["OH", "SH"], "minimo": 2, "ideal": 4},
        "ataque": {"posicoes": ["CF", "WG"], "minimo": 4, "ideal": 7}
      },
      "perfil": {"meses_rico": 6, "meses_apertado": 2, "folha_apertado": 1.05, "folha_crise": 1.25},
      "chegadas": {
        "principal": {"base": 1.5, "por_carencia": 0.5, "por_saida": 0.8, "minimo": 1, "maximo": 7},
        "outras": {"base": 0, "por_carencia": 0.4, "por_saida": 0.5, "minimo": 0, "maximo": 3}
      },
      "fator_perfil_chegadas": {"rico": 1.2, "equilibrado": 1, "apertado": 0.85, "crise": 0.5},
      "fracao_verba": {"rico": 0.6, "equilibrado": 0.45, "apertado": 0.25, "crise": 0},
      "reinveste_venda": {"rico": 0.7, "equilibrado": 0.5, "apertado": 0.3, "crise": 0},
      "teto_folha": {"rico": 1.15, "equilibrado": 1.05, "apertado": 1, "crise": 1},
      "meses_custo_salario": 12,
      "desconto_a_venda": 0.85,
      "desconto_crise": 0.75,
      "idade_emprestimo": 21,
      "peso_saida_prevista": 0.5,
      "propostas": {
        "minimo": [1, 2],
        "maximo": 10,
        "por_interessante": 0.3,
        "clubes_para_interesse_cheio": 4,
        "fator_outras_janelas": 0.6,
        "peso_a_venda": 3,
        "peso_contrato_acabando": 1.5,
        "peso_jovem": 1.3,
        "idade_jovem": 23,
        "oferta": {"rico": [0.95, 1.25], "equilibrado": [0.85, 1.1], "apertado": [0.75, 0.95]},
        "oferta_a_venda": [0.8, 1],
        "teto": {"rico": 1.4, "equilibrado": 1.2, "apertado": 1.05},
        "cobre_ate": 1.15,
        "prazo_semanas": 2
      }
    }'),
    '$.noticias.transferencias_por_data', 3
  ),
  '$.mercado.chance_proposta_usuario',
  '$.mercado.fracao_saldo_compra'
);
