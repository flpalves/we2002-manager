import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { detalheTime, transferencias } from '../../src/main/carreira/times'
import { transferir } from '../../src/main/carreira/mercado'
import { ErroApp } from '../../src/main/ipc/registrar'
import type { Sql } from '../../src/main/db/sql'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { escreverPacote } from '../helpers/pacote'
import { pacote as fixture, time } from '../fixtures/pacote'

const codigo = (f: () => unknown): string | null => {
  try {
    f()
    return null
  } catch (e) {
    return e instanceof ErroApp ? e.codigo : (e as Error).message
  }
}

describe('página de clube e transferências (serviço + SQLite)', () => {
  let sql: Sql
  const idDe = (sigla: string, camisa: number) =>
    sql.get<{ id: number }>('SELECT j.id FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.camisa = ?', sigla, camisa)!.id

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-times-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    const carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 7,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 't1',
    })
    carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'T', dificuldade: 'normal' })
    sql = carreiras.sql()
  })

  it('mostra elenco e escalação provável de um clube da IA', () => {
    const d = detalheTime(sql, 'BBB')
    expect(d).toMatchObject({ sigla: 'BBB', usuario: false })
    expect(d.elenco.time).toBe('BBB')
    expect(d.elenco.jogadores).toHaveLength(23)
    expect(d.escalacao?.titulares).toHaveLength(11)
    expect(d.escalacao?.papeis).toHaveLength(11)
    const ids = new Set(d.elenco.jogadores.map((j) => j.id))
    expect([...d.escalacao!.titulares, ...d.escalacao!.reservas].every((id) => ids.has(id))).toBe(true)
    expect(d.proximoJogo).not.toBeNull()
    expect(detalheTime(sql, 'AAA').usuario).toBe(true)
    expect(codigo(() => detalheTime(sql, 'ZZZ'))).toBe('time_inexistente')
  })

  it('lista as transferências de todos os clubes e filtra por clube com o saldo', () => {
    const base = { salario: 1_000_000, ateTemporada: 2028, multa: 0, emprestimo: false }
    transferir(sql, { ...base, jogador: idDe('BBB', 10), de: 'BBB', para: 'AAA', tipo: 'compra', valor: 5_000_000 })
    transferir(sql, { ...base, jogador: idDe('CCC', 9), de: 'CCC', para: 'DDD', tipo: 'compra', valor: 3_000_000 })
    transferir(sql, { ...base, jogador: idDe('AAA', 7), de: 'AAA', para: 'CCC', tipo: 'venda', valor: 2_000_000 })

    const todas = transferencias(sql)
    expect(todas.lista).toHaveLength(3)
    expect(todas.saldo).toBeNull()
    expect(todas.temporadas).toEqual([todas.temporada])
    expect(todas.lista[0]).toMatchObject({ de: 'AAA', para: 'CCC', tipo: 'venda', valor: 2_000_000 })

    const aaa = transferencias(sql, { sigla: 'AAA' })
    expect(aaa.lista.map((t) => t.tipo)).toEqual(['venda', 'compra'])
    expect(aaa.saldo).toEqual({ gasto: 5_000_000, arrecadado: 2_000_000, chegadas: 1, saidas: 1 })
    expect(transferencias(sql, { sigla: 'DDD' }).lista[0]).toMatchObject({ de: 'CCC', para: 'DDD' })
    expect(transferencias(sql, { temporada: 1990 }).lista).toHaveLength(0)
    expect(codigo(() => transferencias(sql, { sigla: 'ZZZ' }))).toBe('time_inexistente')
  })
})
