-- migrador: sem_chaves_estrangeiras
-- Jogadores sem clube (9.2, spec 06): status 'exterior' (disponível do exterior, só pelo pacote)
-- e 'fora' (saiu do pool na virada); taxa fixa e origem do exterior.
-- O SQLite não altera CHECK: recria a tabela mantendo os dados. As chaves estrangeiras ficam
-- desligadas durante a troca (senão o DROP apagaria os contratos em cascata).

CREATE TABLE jogador_novo (
  id                 INTEGER PRIMARY KEY,
  chave              TEXT NOT NULL UNIQUE,          -- id do jogador no pacote
  time_id            INTEGER REFERENCES time(id),   -- NULL = sem clube (livre, exterior, fora)
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
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'emprestado', 'livre', 'exterior', 'fora')),
  lesao_dias         INTEGER NOT NULL DEFAULT 0,
  valor              INTEGER NOT NULL DEFAULT 0,
  a_venda            TEXT,
  taxa_fixa          INTEGER,                       -- centavos; só no exterior
  origem_clube       TEXT,                          -- só no exterior (informativo)
  origem_pais        TEXT
);
INSERT INTO jogador_novo (id, chave, time_id, nome, nome_we, posicao, posicao_secundaria, camisa, camisa_real, idade,
    nacionalidade, pe, altura, atributos, outside, potencial, resistencia, condicao, moral, aparencia, status,
    lesao_dias, valor, a_venda)
  SELECT id, chave, time_id, nome, nome_we, posicao, posicao_secundaria, camisa, camisa_real, idade,
    nacionalidade, pe, altura, atributos, outside, potencial, resistencia, condicao, moral, aparencia, status,
    lesao_dias, valor, a_venda
  FROM jogador;
DROP TABLE jogador;
ALTER TABLE jogador_novo RENAME TO jogador;
CREATE INDEX jogador_time ON jogador(time_id);
CREATE INDEX jogador_status ON jogador(status);
