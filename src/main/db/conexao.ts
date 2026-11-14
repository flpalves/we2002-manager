import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { lerMigracoes, migrar, type BancoMigravel, type ResultadoMigracao } from './migrador'
import { normalizarParametros, type ParametroSql, type Sql } from './sql'

const arquivos = import.meta.glob('./migracoes/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const MIGRACOES = lerMigracoes(arquivos)
export const VERSAO_ESQUEMA = MIGRACOES.at(-1)?.versao ?? 0

export type Banco = Database.Database

export function adaptarMigravel(db: Banco): BancoMigravel {
  return {
    exec: (sql) => void db.exec(sql),
    versaoEsquema: () => db.pragma('user_version', { simple: true }) as number,
    definirVersaoEsquema: (v) => void db.pragma(`user_version = ${Math.trunc(v)}`),
  }
}

export function adaptarSql(db: Banco): Sql {
  return {
    exec: (sql) => void db.exec(sql),
    run: (sql, ...p) => db.prepare(sql).run(...normalizarParametros(p)),
    get: <T>(sql: string, ...p: ParametroSql[]) => db.prepare(sql).get(...normalizarParametros(p)) as T | undefined,
    all: <T>(sql: string, ...p: ParametroSql[]) => db.prepare(sql).all(...normalizarParametros(p)) as T[],
    transacao: (fn) => db.transaction(fn)(),
  }
}

/** Abre (ou cria) o `carreira.sqlite`, liga WAL e chaves estrangeiras e aplica as migrações. */
export function abrirBanco(arquivo: string): { db: Banco; migracao: ResultadoMigracao } {
  mkdirSync(dirname(arquivo), { recursive: true })
  const db = new Database(arquivo)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 3000')
  try {
    const migracao = migrar(adaptarMigravel(db), MIGRACOES)
    return { db, migracao }
  } catch (e) {
    db.close()
    throw e
  }
}

/** Abre só para leitura, sem migrar (lista de carreiras). */
export function abrirLeitura(arquivo: string): Banco {
  return new Database(arquivo, { readonly: true, fileMustExist: true })
}
