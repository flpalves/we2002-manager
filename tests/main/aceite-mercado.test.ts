import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { calendario } from '../../src/main/carreira/temporada'
import { folhaDe } from '../../src/main/carreira/mercado'
import type { Sql } from '../../src/main/db/sql'
import { avancar } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { atributos, jogador, pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'

/**
 * Aceite da fase 6: temporada simulada com a IA de mercado ativa, sem saldo absurdo
 * (nenhum clube com folha acima de 3× o orçamento).
 */

const SIGLAS = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH']

/** `intensidadeTeste`: multiplicador das chegadas-alvo na intensidade alta (null = o padrão). */
function criar(intensidadeTeste: number | null): Sql {
  const base = mkdtempSync(join(tmpdir(), 'we-aceite6-'))
  // Forças diferentes, um goleiro fraco nos times pares (carência para a IA) e 25 por elenco
  // (com 23, o mínimo, nenhum clube pode vender).
  const times = SIGLAS.map((s, i) =>
    time(s, {
      porte: i < 2 ? 'grande' : i < 5 ? 'medio' : 'pequeno',
      financas: { saldo_inicial: 2_000_000_000 - i * 200_000_000, patrocinio_temporada: 1_000_000_000, orcamento_folha_mensal: 150_000_000 },
      jogadores: Array.from({ length: 25 }, (_, n) => {
        const j = jogador(s, n + 1, { atributos: atributos(9 + (i % 4)), contrato: { salario_mensal: 2_000_000, ate_temporada: 2027, multa: 0 } })
        return i % 2 === 1 && j.posicao === 'GK' ? { ...j, atributos: atributos(5) } : j
      }),
    }),
  )
  escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times }))
  const carreiras = new Carreiras({
    pastaCarreiras: () => join(base, 'carreiras'),
    pastaPacotes: () => join(base, 'pacotes'),
    abrirBanco: abrirNodeSqlite,
    lerResumoArquivo: () => null,
    sementeNova: () => 2026,
    agora: () => '2026-11-13T00:00:00Z',
    sufixoId: () => 'a6',
  })
  carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'Aceite 6', dificuldade: 'normal' })
  const sql = carreiras.sql()
  sql.run("UPDATE carreira SET intensidade_mercado = 'alta'")
  if (intensidadeTeste !== null) {
    const r = JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados)
    r.mercado.intensidade.alta = intensidadeTeste
    sql.run('UPDATE regras SET dados = ? WHERE id = 1', JSON.stringify(r))
  }
  return sql
}

function temporadaInteira(sql: Sql): void {
  for (let i = 0; i < 100 && !calendario(sql).encerrada; i++) avancar(sql)
  expect(calendario(sql).encerrada).toBe(true)
}

function verificarSaude(sql: Sql): void {
  const times = sql.all<{ sigla: string; saldo: number; orcamento_folha_mensal: number }>('SELECT sigla, saldo, orcamento_folha_mensal FROM time')
  for (const t of times) {
    expect(folhaDe(sql, t.sigla), `folha de ${t.sigla}`).toBeLessThanOrEqual(t.orcamento_folha_mensal * 3)
    // Ninguém termina com dívida maior que um ano de folha.
    expect(t.saldo, `saldo de ${t.sigla}`).toBeGreaterThan(-12 * t.orcamento_folha_mensal)
    const n = sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'", t.sigla)!.n
    expect(n, `elenco de ${t.sigla}`).toBeGreaterThanOrEqual(22)
    expect(n).toBeLessThanOrEqual(32)
  }
  // O dinheiro das transferências sai de um e entra no outro.
  const saldoTransf = sql.get<{ s: number | null }>("SELECT SUM(valor) s FROM lancamento_financeiro WHERE categoria IN ('transferencia_entrada', 'transferencia_saida')")!.s ?? 0
  expect(saldoTransf).toBe(0)
  // Camisas únicas em cada time.
  const dup = sql.get<{ n: number }>('SELECT COUNT(*) n FROM (SELECT time_id, camisa FROM jogador WHERE time_id IS NOT NULL GROUP BY time_id, camisa HAVING COUNT(*) > 1)')!.n
  expect(dup).toBe(0)
}

describe('aceite da fase 6 (temporada com IA de mercado)', () => {
  it('intensidade alta: temporada inteira sem saldo absurdo', () => {
    const sql = criar(null)
    temporadaInteira(sql)
    verificarSaude(sql)
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM lancamento_financeiro WHERE categoria = 'salarios'")!.n).toBeGreaterThan(0)
  }, 120_000)

  it('mercado agitado: cada clube segue o plano da janela, sem mexer no time do usuário, e o usuário recebe propostas', () => {
    const sql = criar(2)
    temporadaInteira(sql)
    verificarSaude(sql)
    const feitas = sql.all<{ para: string }>('SELECT para FROM transferencia')
    expect(feitas.length).toBeGreaterThan(0)
    expect(feitas.every((t) => t.para !== 'AAA')).toBe(true) // a CPU nunca mexe no time do usuário sozinha
    // Um plano por clube da CPU em cada janela, com as chegadas contadas.
    const planos = sql.all<{ janela: number; time: string; chegadas_alvo: number; chegadas_feitas: number }>('SELECT janela, time, chegadas_alvo, chegadas_feitas FROM plano_janela')
    // Só abre plano a janela que tem datas no calendário (aqui, a liga acaba antes da janela do meio).
    const comDatas = sql.get<{ n: number }>('SELECT COUNT(*) n FROM passo WHERE semana BETWEEN 27 AND 31')!.n > 0
    expect(new Set(planos.map((p) => p.janela)).size).toBe(comDatas ? 2 : 1)
    expect(planos.filter((p) => p.janela === 1)).toHaveLength(7)
    for (const p of planos) expect(p.chegadas_feitas).toBeLessThanOrEqual(p.chegadas_alvo)
    const porClube = sql.all<{ para: string; n: number }>('SELECT para, COUNT(*) n FROM transferencia WHERE semana <= 16 GROUP BY para')
    for (const x of porClube) expect(x.n).toBe(planos.find((p) => p.janela === 1 && p.time === x.para)!.chegadas_feitas)
    // Propostas pelo usuário em cada janela, todas vencidas ou respondidas ao fim da temporada.
    const propostas = sql.all<{ semana: number; estado: string; prazo_semana: number }>('SELECT semana, estado, prazo_semana FROM proposta_recebida')
    expect(propostas.some((p) => p.semana <= 16)).toBe(true)
    expect(propostas.every((p) => p.estado !== 'aberta')).toBe(true)
    expect(propostas.every((p) => p.prazo_semana >= p.semana)).toBe(true)
  }, 120_000)
})
