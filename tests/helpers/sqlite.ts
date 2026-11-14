import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lerMigracoes, migrar, type BancoMigravel } from '../../src/main/db/migrador'
import { criarTransacaoManual, normalizarParametros, type Sql } from '../../src/main/db/sql'
import type { ConexaoCarreira } from '../../src/main/carreira/servico'

// O better-sqlite3 do projeto é compilado para o Electron; nos testes usamos o node:sqlite.

const pasta = join(__dirname, '../../src/main/db/migracoes')
export const MIGRACOES_REAIS = lerMigracoes(Object.fromEntries(readdirSync(pasta).map((f) => [f, readFileSync(join(pasta, f), 'utf8')])))

export function migravel(db: DatabaseSync): BancoMigravel {
  return {
    exec: (sql) => db.exec(sql),
    versaoEsquema: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    definirVersaoEsquema: (v) => db.exec(`PRAGMA user_version = ${v}`),
  }
}

export function sqlDe(db: DatabaseSync): Sql {
  const transacao = criarTransacaoManual((s) => db.exec(s))
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, ...p) => db.prepare(sql).run(...normalizarParametros(p)),
    get: <T>(sql: string, ...p: Parameters<Sql['run']>[1][]) => db.prepare(sql).get(...normalizarParametros(p)) as T | undefined,
    all: <T>(sql: string, ...p: Parameters<Sql['run']>[1][]) => db.prepare(sql).all(...normalizarParametros(p)) as T[],
    transacao,
  }
}

export function abrirNodeSqlite(arquivo: string): ConexaoCarreira {
  const db = new DatabaseSync(arquivo)
  db.exec('PRAGMA foreign_keys = ON')
  migrar(migravel(db), MIGRACOES_REAIS)
  return { sql: sqlDe(db), versaoEsquema: MIGRACOES_REAIS.length, fechar: () => db.close() }
}
