-- Dados importados do pacote (fase 1). Daqui em diante o SQLite é a fonte da verdade
-- da carreira; mudar o pacote não afeta carreiras existentes.

CREATE TABLE pais (
  codigo      TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  fator_valor REAL NOT NULL
);

CREATE TABLE time (
  id                     INTEGER PRIMARY KEY,
  sigla                  TEXT NOT NULL UNIQUE,
  nome                   TEXT NOT NULL,
  nome_curto             TEXT NOT NULL,
  pais                   TEXT NOT NULL REFERENCES pais(codigo),
  estado                 TEXT,
  cores                  TEXT NOT NULL,             -- JSON: ["#RRGGBB", ...]
  porte                  TEXT NOT NULL CHECK (porte IN ('grande', 'medio', 'pequeno')),
  formacao               TEXT NOT NULL,
  estadio_nome           TEXT NOT NULL,
  estadio_capacidade     INTEGER NOT NULL,
  ingresso               INTEGER NOT NULL,          -- centavos
  custo_por_jogo         INTEGER NOT NULL,          -- centavos
  saldo                  INTEGER NOT NULL,          -- centavos
  patrocinio_temporada   INTEGER NOT NULL,          -- centavos
  orcamento_folha_mensal INTEGER NOT NULL,          -- centavos
  confianca_diretoria    INTEGER NOT NULL DEFAULT 50,
  entrosamento           INTEGER NOT NULL DEFAULT 50,
  kit                    TEXT,                      -- JSON (formato das ferramentas de kit)
  kit_reserva            TEXT,
  kit_goleiro            TEXT,
  bandeira               TEXT,
  escudo                 TEXT                       -- caminho relativo à pasta da carreira
);

CREATE TABLE jogador (
  id                 INTEGER PRIMARY KEY,
  chave              TEXT NOT NULL UNIQUE,          -- id do jogador no pacote
  time_id            INTEGER REFERENCES time(id),
  nome               TEXT NOT NULL,
  nome_we            TEXT NOT NULL,
  posicao            TEXT NOT NULL,
  posicao_secundaria TEXT,
  camisa             INTEGER NOT NULL,
  camisa_real        INTEGER,
  idade              INTEGER NOT NULL,
  nacionalidade      TEXT NOT NULL,
  pe                 TEXT NOT NULL,
  altura             INTEGER NOT NULL,
  atributos          TEXT NOT NULL,                 -- JSON: 16 atributos 1-20
  outside            INTEGER NOT NULL,
  potencial          INTEGER NOT NULL,
  resistencia        INTEGER NOT NULL,
  condicao           INTEGER NOT NULL DEFAULT 100,
  moral              INTEGER NOT NULL DEFAULT 50,
  aparencia          TEXT,                          -- JSON
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'emprestado', 'livre'))
);
CREATE INDEX jogador_time ON jogador(time_id);

CREATE TABLE contrato (
  id              INTEGER PRIMARY KEY,
  jogador_id      INTEGER NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  time_id         INTEGER NOT NULL REFERENCES time(id),
  salario_mensal  INTEGER NOT NULL,
  ate_temporada   INTEGER NOT NULL,
  multa           INTEGER NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'definitivo' CHECK (tipo IN ('definitivo', 'emprestimo')),
  time_origem_id  INTEGER REFERENCES time(id)
);
CREATE INDEX contrato_jogador ON contrato(jogador_id);

CREATE TABLE competicao (
  id        TEXT PRIMARY KEY,
  nome      TEXT NOT NULL,
  tipo      TEXT NOT NULL,
  definicao TEXT NOT NULL                           -- JSON completo de competicoes/<id>.json
);

-- regras.json do pacote já mesclado com os padrões, congelado na criação da carreira.
CREATE TABLE regras (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  dados TEXT NOT NULL
);
