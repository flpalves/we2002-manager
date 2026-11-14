-- Motor de partida (fase 3): eventos, escalações, disciplina e lesões.

ALTER TABLE jogador ADD COLUMN lesao_dias INTEGER NOT NULL DEFAULT 0;

CREATE TABLE evento_partida (
  id          INTEGER PRIMARY KEY,
  partida_id  TEXT NOT NULL REFERENCES partida(id),
  ordem       INTEGER NOT NULL,
  minuto      INTEGER NOT NULL,
  acrescimo   INTEGER NOT NULL DEFAULT 0,
  tipo        TEXT NOT NULL CHECK (tipo IN ('gol', 'amarelo', 'vermelho', 'lesao', 'substituicao')),
  time        TEXT NOT NULL REFERENCES time(sigla),
  jogador_id  INTEGER REFERENCES jogador(id),          -- autor / cartão / lesão / quem sai
  outro_id    INTEGER REFERENCES jogador(id),          -- assistência / quem entra
  detalhe     TEXT                                     -- cabeça, 2º amarelo, gravidade+semanas, motivo da troca
);
CREATE INDEX evento_partida_partida ON evento_partida(partida_id);
CREATE INDEX evento_partida_jogador ON evento_partida(tipo, jogador_id);

CREATE TABLE escalacao_partida (
  partida_id  TEXT NOT NULL REFERENCES partida(id),
  jogador_id  INTEGER NOT NULL REFERENCES jogador(id),
  time        TEXT NOT NULL REFERENCES time(sigla),
  titular     INTEGER NOT NULL,
  posicao     TEXT NOT NULL,
  vaga        INTEGER NOT NULL,
  camisa      INTEGER NOT NULL,
  minutos     INTEGER NOT NULL,
  entrou_aos  INTEGER,
  saiu_aos    INTEGER,
  PRIMARY KEY (partida_id, jogador_id)
);
CREATE INDEX escalacao_partida_jogador ON escalacao_partida(jogador_id);

-- Cartões acumulados e jogos de suspensão a cumprir, por competição.
CREATE TABLE disciplina (
  jogador_id    INTEGER NOT NULL REFERENCES jogador(id),
  competicao_id TEXT NOT NULL REFERENCES competicao(id),
  amarelos      INTEGER NOT NULL,
  suspenso      INTEGER NOT NULL,
  PRIMARY KEY (jogador_id, competicao_id)
);
