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

describe('migração 013 (exterior)', () => {
  it('carreira antiga migra sem perder jogador, contrato nem dados das colunas antigas', () => {
    const { banco, db } = bancoEmMemoria()
    const reais = lerMigracoes(arquivosReais)
    migrar(banco, reais.filter((m) => m.versao <= 12))
    db.exec("INSERT INTO pais (codigo, nome, fator_valor) VALUES ('BRA', 'Brasil', 1)")
    db.exec(`INSERT INTO time (id, sigla, nome, nome_curto, pais, cores, porte, formacao, estadio_nome, estadio_capacidade,
               ingresso, custo_por_jogo, saldo, patrocinio_temporada, orcamento_folha_mensal)
             VALUES (1, 'AAA', 'Time A', 'AAA', 'BRA', '[]', 'medio', '4-4-2A', 'E', 1000, 0, 0, 0, 0, 0)`)
    db.exec(`INSERT INTO jogador (id, chave, time_id, nome, nome_we, posicao, camisa, idade, nacionalidade, pe, altura, atributos, outside,
               potencial, resistencia, lesao_dias, valor, a_venda, status)
             VALUES (7, 'aaa-j1', 1, 'Jogador', 'JOG', 'CF', 9, 25, 'BRA', 'destro', 180, '{}', 1, 12, 10, 3, 4500, 'usuario', 'ativo'),
                    (8, 'liv-j1', NULL, 'Livre', 'LIV', 'CB', 0, 30, 'BRA', 'destro', 180, '{}', 1, 12, 10, 0, 100, NULL, 'livre')`)
    db.exec("INSERT INTO contrato (jogador_id, time_id, salario_mensal, ate_temporada, multa) VALUES (7, 1, 1000, 2027, 0)")
    db.exec("INSERT INTO evolucao (temporada, semana, jogador_id, atributo, delta, motivo) VALUES (2026, 1, 7, 'OFF', 1, 'evolucao')")

    migrar(banco, reais)
    expect(db.prepare('SELECT id, chave, time_id, lesao_dias, valor, a_venda, status, taxa_fixa, origem_clube FROM jogador ORDER BY id').all()).toEqual([
      { id: 7, chave: 'aaa-j1', time_id: 1, lesao_dias: 3, valor: 4500, a_venda: 'usuario', status: 'ativo', taxa_fixa: null, origem_clube: null },
      { id: 8, chave: 'liv-j1', time_id: null, lesao_dias: 0, valor: 100, a_venda: null, status: 'livre', taxa_fixa: null, origem_clube: null },
    ])
    // O DROP da tabela antiga não pode apagar os contratos (ON DELETE CASCADE).
    expect(db.prepare('SELECT jogador_id FROM contrato').all()).toEqual([{ jogador_id: 7 }])
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })

    db.exec(`INSERT INTO jogador (chave, nome, nome_we, posicao, camisa, idade, nacionalidade, pe, altura, atributos, outside, potencial, resistencia, status, taxa_fixa, origem_clube, origem_pais)
             VALUES ('ext-j1', 'Ext', 'EXT', 'CF', 0, 27, 'BRA', 'destro', 180, '{}', 1, 14, 10, 'exterior', 5000000, 'Zenit', 'RUS')`)
    expect(() => db.exec("UPDATE jogador SET status = 'fora' WHERE chave = 'ext-j1'")).not.toThrow()
    expect(() => db.exec("UPDATE jogador SET status = 'sumiu' WHERE chave = 'ext-j1'")).toThrow()
  })
})
