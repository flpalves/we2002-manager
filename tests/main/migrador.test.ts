import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { lerMigracoes, migrar, type BancoMigravel } from '../../src/main/db/migrador'

// O better-sqlite3 do projeto é compilado para o Electron; nos testes usamos o SQLite do Node.
function bancoEmMemoria(): { banco: BancoMigravel; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  const banco: BancoMigravel = {
    exec: (sql) => db.exec(sql),
    versaoEsquema: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    definirVersaoEsquema: (v) => db.exec(`PRAGMA user_version = ${v}`),
  }
  return { banco, db }
}

const pasta = join(__dirname, '../../src/main/db/migracoes')
const arquivosReais = Object.fromEntries(readdirSync(pasta).map((f) => [f, readFileSync(join(pasta, f), 'utf8')]))

describe('lerMigracoes', () => {
  it('ordena pelo número e lê o nome', () => {
    const m = lerMigracoes({ 'x/002_b.sql': 'B', 'x/001_a.sql': 'A' })
    expect(m.map((x) => [x.versao, x.nome, x.sql])).toEqual([
      [1, 'a', 'A'],
      [2, 'b', 'B'],
    ])
  })

  it('rejeita nome fora do padrão NNN_nome.sql', () => {
    expect(() => lerMigracoes({ '1_a.sql': '' })).toThrow(/inválido/)
    expect(() => lerMigracoes({ '001-A.sql': '' })).toThrow(/inválido/)
  })

  it('rejeita buraco ou repetição na sequência', () => {
    expect(() => lerMigracoes({ '001_a.sql': '', '003_c.sql': '' })).toThrow(/sequência/)
    expect(() => lerMigracoes({ '001_a.sql': '', '001_b.sql': '' })).toThrow(/sequência/)
  })

  it('as migrações do projeto estão em sequência', () => {
    expect(lerMigracoes(arquivosReais).length).toBeGreaterThan(0)
  })
})

describe('migrar', () => {
  const migs = lerMigracoes({
    '001_a.sql': 'CREATE TABLE a (x INTEGER);',
    '002_b.sql': 'CREATE TABLE b (y INTEGER);',
  })

  it('aplica tudo num banco novo e grava a versão', () => {
    const { banco, db } = bancoEmMemoria()
    expect(migrar(banco, migs)).toEqual({ de: 0, para: 2, aplicadas: ['a', 'b'] })
    expect(banco.versaoEsquema()).toBe(2)
    db.prepare('INSERT INTO b VALUES (1)').run()
  })

  it('é idempotente e aplica só as novas', () => {
    const { banco } = bancoEmMemoria()
    migrar(banco, migs.slice(0, 1))
    expect(migrar(banco, migs)).toEqual({ de: 1, para: 2, aplicadas: ['b'] })
    expect(migrar(banco, migs).aplicadas).toEqual([])
  })

  it('desfaz a migração que falha e mantém a versão anterior', () => {
    const { banco, db } = bancoEmMemoria()
    const ruins = lerMigracoes({
      '001_a.sql': 'CREATE TABLE a (x INTEGER);',
      '002_b.sql': 'CREATE TABLE b (y INTEGER); INSERT INTO nao_existe VALUES (1);',
    })
    expect(() => migrar(banco, ruins)).toThrow(/002_b/)
    expect(banco.versaoEsquema()).toBe(1)
    const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    expect(tabelas.map((t) => t.name)).toEqual(['a'])
  })

  it('recusa carreira de esquema mais novo que o app', () => {
    const { banco } = bancoEmMemoria()
    banco.definirVersaoEsquema(9)
    expect(() => migrar(banco, migs)).toThrow(/mais nova/)
  })

  it('as migrações reais rodam num banco vazio', () => {
    const { banco, db } = bancoEmMemoria()
    const reais = lerMigracoes(arquivosReais)
    migrar(banco, reais)
    db.prepare(
      `INSERT INTO carreira (id, nome, pacote_id, pacote_versao, semente, tecnico_nome, temporada_atual, versao_esquema, criada_em)
       VALUES ('c1', 'Teste', 'brasil-2026', '1', 123, 'Felipe', 2026, ?, '2026-01-01')`,
    ).run(reais.length)
    expect(db.prepare('SELECT semana_atual FROM carreira').get()).toEqual({ semana_atual: 1 })
  })
})
