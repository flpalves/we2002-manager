-- Mercado, finanças, estádio e diretoria (fase 6).

ALTER TABLE carreira ADD COLUMN movimentos INTEGER NOT NULL DEFAULT 5;
ALTER TABLE carreira ADD COLUMN avaliacoes_ruins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE carreira ADD COLUMN demitido INTEGER NOT NULL DEFAULT 0;
ALTER TABLE carreira ADD COLUMN intensidade_mercado TEXT NOT NULL DEFAULT 'media';

-- Valor de mercado (recalculado a cada janela).
ALTER TABLE jogador ADD COLUMN valor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE partida ADD COLUMN publico INTEGER;
ALTER TABLE partida ADD COLUMN renda INTEGER;

CREATE TABLE lancamento_financeiro (
  id        INTEGER PRIMARY KEY,
  temporada INTEGER NOT NULL,
  semana    INTEGER NOT NULL,
  time      TEXT NOT NULL REFERENCES time(sigla),
  categoria TEXT NOT NULL,
  valor     INTEGER NOT NULL,                       -- centavos (+ receita, − despesa)
  descricao TEXT NOT NULL
);
CREATE INDEX lancamento_time ON lancamento_financeiro(time, temporada);

CREATE TABLE transferencia (
  id         INTEGER PRIMARY KEY,
  temporada  INTEGER NOT NULL,
  semana     INTEGER NOT NULL,
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  de         TEXT REFERENCES time(sigla),            -- NULL = livre
  para       TEXT REFERENCES time(sigla),
  tipo       TEXT NOT NULL,
  valor      INTEGER NOT NULL,
  salario    INTEGER NOT NULL
);

-- Negociações do usuário (estado da máquina de negociação em JSON).
CREATE TABLE negociacao (
  id         INTEGER PRIMARY KEY,
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  tipo       TEXT NOT NULL,
  estado     TEXT NOT NULL,
  aberta     INTEGER NOT NULL DEFAULT 1,
  temporada  INTEGER NOT NULL,
  semana     INTEGER NOT NULL
);

-- Propostas da CPU pelos jogadores do usuário (prazo: até o próximo jogo dele).
CREATE TABLE proposta_recebida (
  id         INTEGER PRIMARY KEY,
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  clube      TEXT NOT NULL REFERENCES time(sigla),
  valor      INTEGER NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'aberta' CHECK (estado IN ('aberta', 'aceita', 'recusada', 'expirada')),
  temporada  INTEGER NOT NULL,
  semana     INTEGER NOT NULL
);

CREATE TABLE meta_diretoria (
  id          INTEGER PRIMARY KEY,
  temporada   INTEGER NOT NULL,
  tipo        TEXT NOT NULL,
  alvo        INTEGER,
  competicao  TEXT,
  descricao   TEXT NOT NULL,
  critica     INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'andamento' CHECK (status IN ('andamento', 'atingida', 'perdida'))
);
