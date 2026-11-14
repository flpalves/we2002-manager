-- Virada de temporada (fase 9): relatório de cada temporada encerrada.

CREATE TABLE relatorio_temporada (
  temporada INTEGER PRIMARY KEY,
  dados     TEXT NOT NULL                           -- JSON: RelatorioTemporada (shared/esquemas/temporada.ts)
);
