-- Treino, evolução e moral (fase 4).

-- Foco do treino do time; NULL = a IA escolhe toda semana (times da CPU).
ALTER TABLE time ADD COLUMN treino_foco TEXT;

-- Histórico de mudanças de atributo (tela de treino: "evolução recente"; ficha do jogador).
CREATE TABLE evolucao (
  id         INTEGER PRIMARY KEY,
  temporada  INTEGER NOT NULL,
  semana     INTEGER NOT NULL,
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  atributo   TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  motivo     TEXT NOT NULL CHECK (motivo IN ('evolucao', 'declinio', 'noticia'))
);
CREATE INDEX evolucao_jogador ON evolucao(jogador_id);
CREATE INDEX evolucao_semana ON evolucao(temporada, semana);
