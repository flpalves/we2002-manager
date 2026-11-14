-- Oscilação semanal aleatória de atributos (09): novo motivo 'oscilacao' no histórico de evolução.
-- O SQLite não altera CHECK: recria a tabela mantendo os dados.

CREATE TABLE evolucao_nova (
  id         INTEGER PRIMARY KEY,
  temporada  INTEGER NOT NULL,
  semana     INTEGER NOT NULL,
  jogador_id INTEGER NOT NULL REFERENCES jogador(id),
  atributo   TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  motivo     TEXT NOT NULL CHECK (motivo IN ('evolucao', 'declinio', 'noticia', 'oscilacao'))
);
INSERT INTO evolucao_nova (id, temporada, semana, jogador_id, atributo, delta, motivo)
  SELECT id, temporada, semana, jogador_id, atributo, delta, motivo FROM evolucao;
DROP TABLE evolucao;
ALTER TABLE evolucao_nova RENAME TO evolucao;
CREATE INDEX evolucao_jogador ON evolucao(jogador_id);
CREATE INDEX evolucao_semana ON evolucao(temporada, semana);
