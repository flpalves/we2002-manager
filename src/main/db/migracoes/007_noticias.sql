-- Notícias e eventos aleatórios (fase 7).

CREATE TABLE noticia (
  id                INTEGER PRIMARY KEY,
  temporada         INTEGER NOT NULL,
  semana            INTEGER NOT NULL,
  tipo              TEXT NOT NULL,
  origem            TEXT NOT NULL CHECK (origem IN ('info', 'evento')),
  evento            TEXT,                                  -- id do evento do catálogo
  texto             TEXT NOT NULL,
  jogador_id        INTEGER REFERENCES jogador(id),
  time              TEXT,
  efeitos_aplicados TEXT,                                  -- JSON: [{efeito, antes, depois}] (auditável)
  escolhas          TEXT,                                  -- JSON: opções com os efeitos já sorteados
  escolha_feita     TEXT,
  pendente          INTEGER NOT NULL DEFAULT 0,            -- escolha esperando resposta (bloqueia o Continuar)
  lida              INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX noticia_tempo ON noticia(temporada, semana);
CREATE INDEX noticia_evento ON noticia(evento);
