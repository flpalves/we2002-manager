-- Esquema inicial da carreira (fase 0). As demais tabelas de 02-dados.md entram
-- nas migrações das fases que as usam.

CREATE TABLE carreira (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  pacote_id       TEXT NOT NULL,
  pacote_versao   TEXT NOT NULL,
  semente         INTEGER NOT NULL,
  tecnico_nome    TEXT NOT NULL,
  time_usuario    TEXT,
  dificuldade     TEXT NOT NULL DEFAULT 'normal',
  temporada_atual INTEGER NOT NULL,
  semana_atual    INTEGER NOT NULL DEFAULT 1,
  passo_atual     INTEGER NOT NULL DEFAULT 0,
  versao_esquema  INTEGER NOT NULL,
  -- Momento real da criação (metadado da lista de carreiras; nada do jogo usa).
  criada_em       TEXT NOT NULL
);

CREATE TABLE configuracao (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
