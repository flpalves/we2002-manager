import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { escalacao, escalacaoAutomatica, salvarEscalacao, sugerirEscalacao } from '../../src/main/carreira/escalacao'
import type { Sql } from '../../src/main/db/sql'
import { continuarAtePreJogo, jogarUsuario } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'
import { ErroApp } from '../../src/main/ipc/registrar'

describe('escalação do usuário (serviço + motor)', () => {
  let sql: Sql

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-escalacao-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    const c = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 3,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 'e1',
    })
    c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'E', dificuldade: 'normal' })
    sql = c.sql()
  })

  const doElenco = () => sql.all<{ id: number }>("SELECT j.id FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = 'AAA' ORDER BY j.id").map((j) => String(j.id))

  it('começa automática, mostrando a escalação da IA para o próximo jogo', () => {
    const e = escalacao(sql)
    expect(e.automatica).toBe(true)
    expect(e.titulares.filter(Boolean)).toHaveLength(11)
    expect(e.reservas).toHaveLength(12)
    expect(e.proximoJogo).not.toBeNull()
    expect(e.formacoes.map((f) => f.id)).toContain('4-4-2A')
  })

  it('a escalação salva é a que entra em campo', () => {
    const e = escalacao(sql)
    const titulares = [...e.titulares]
    const reserva = e.reservas[5]!
    const saiu = titulares[9]!
    titulares[9] = reserva // troca um titular por um reserva
    const salva = salvarEscalacao(sql, { formacao: e.formacao, titulares, reservas: [saiu] })
    expect(salva).toMatchObject({ automatica: false, titulares, reservas: [saiu] })
    expect(salva.noProximoJogo?.titulares).toEqual(titulares)

    continuarAtePreJogo(sql)
    const r = jogarUsuario(sql)
    const jogaram = sql
      .all<{ jogador_id: number }>("SELECT jogador_id FROM escalacao_partida WHERE partida_id = ? AND time = 'AAA' AND titular = 1 ORDER BY vaga", r.jogoDoUsuario!.id)
      .map((x) => String(x.jogador_id))
    expect(jogaram).toEqual(titulares)
  })

  it('trocar a formação derruba o entrosamento; sugestão da IA na formação pedida; volta para automática', () => {
    const antes = escalacao(sql)
    const outra = antes.formacoes.find((f) => f.id !== antes.formacao)!.id
    const s = sugerirEscalacao(sql, outra)
    expect(s).toMatchObject({ automatica: false, formacao: outra })
    expect(s.entrosamento).toBe(Math.round(antes.entrosamento * 0.5))
    expect(new Set([...s.titulares, ...s.reservas]).size).toBe(23)
    expect(escalacaoAutomatica(sql).automatica).toBe(true)
  })

  it('recusa escalação inválida', () => {
    const ids = doElenco()
    const tentar = (t: (string | null)[], r: string[] = []) => {
      try {
        salvarEscalacao(sql, { formacao: '4-4-2A', titulares: t, reservas: r })
        return null
      } catch (e) {
        return e instanceof ErroApp ? e.codigo : 'outro'
      }
    }
    expect(tentar([ids[0]!, ids[0]!, ...ids.slice(2, 11)])).toBe('escalacao_invalida')
    expect(tentar([...ids.slice(0, 10), '999999'])).toBe('escalacao_invalida')
    expect(tentar(ids.slice(0, 11), [ids[0]!])).toBe('escalacao_invalida')
    expect(tentar(ids.slice(0, 11), ids.slice(11, 23))).toBeNull()
  })
})
