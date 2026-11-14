-- Calendário e competições da temporada (fase 2).

CREATE TABLE passo (
  temporada INTEGER NOT NULL,
  indice    INTEGER NOT NULL,
  dia       INTEGER NOT NULL,                       -- dia implícito desde o início da temporada
  semana    INTEGER NOT NULL,
  tipo      TEXT NOT NULL CHECK (tipo IN ('meio', 'fds')),
  PRIMARY KEY (temporada, indice)
);

CREATE TABLE edicao (
  id            TEXT PRIMARY KEY,                   -- <competicao>-<temporada>
  competicao_id TEXT NOT NULL REFERENCES competicao(id),
  temporada     INTEGER NOT NULL,
  campeao       TEXT REFERENCES time(sigla),
  estado        TEXT NOT NULL                       -- JSON: fases, grupos, classificados (core/competicoes/fases.ts)
);
CREATE INDEX edicao_temporada ON edicao(temporada);

CREATE TABLE partida (
  id                  TEXT PRIMARY KEY,             -- <edicao>/<fase>/<rodada>/<jogo>/<n>
  temporada           INTEGER NOT NULL,
  edicao_id           TEXT NOT NULL REFERENCES edicao(id),
  fase                TEXT NOT NULL,
  grupo               TEXT,
  rodada              INTEGER NOT NULL,
  confronto           TEXT,
  jogo                INTEGER NOT NULL,
  passo               INTEGER NOT NULL,
  casa                TEXT NOT NULL REFERENCES time(sigla),
  visitante           TEXT NOT NULL REFERENCES time(sigla),
  gols_casa           INTEGER,
  gols_visitante      INTEGER,
  prorrogacao         INTEGER NOT NULL DEFAULT 0,
  penaltis_casa       INTEGER,
  penaltis_visitante  INTEGER,
  amarelos_casa       INTEGER NOT NULL DEFAULT 0,
  vermelhos_casa      INTEGER NOT NULL DEFAULT 0,
  amarelos_visitante  INTEGER NOT NULL DEFAULT 0,
  vermelhos_visitante INTEGER NOT NULL DEFAULT 0,
  modo                TEXT,                         -- we | cpu_cpu_we | simulada | manual
  origem              TEXT                          -- quem deu o resultado (ex.: provisorio)
);
CREATE INDEX partida_passo ON partida(temporada, passo);
CREATE INDEX partida_edicao ON partida(edicao_id);

-- Rodadas cujos confrontos ainda não se conhecem (fases seguintes, etapas do mata-mata).
CREATE TABLE rodada_reservada (
  edicao_id TEXT NOT NULL REFERENCES edicao(id),
  fase      TEXT NOT NULL,
  rodada    INTEGER NOT NULL,
  jogo      INTEGER NOT NULL,
  passo     INTEGER NOT NULL,
  possiveis TEXT NOT NULL,                          -- JSON: siglas
  PRIMARY KEY (edicao_id, fase, rodada, jogo)
);
