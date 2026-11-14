import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { definirFoco, elenco, ficha, salvarAparencia, treino } from '../../src/main/carreira/elenco'
import { avancar } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { escreverPacote } from '../helpers/pacote'
import { pacote as fixture, time } from '../fixtures/pacote'

describe('elenco, ficha e treino (serviço + SQLite)', () => {
  let carreiras: Carreiras
  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-elenco-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 77,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 'e1',
    })
    carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'E', dificuldade: 'normal' })
  })

  it('lista o elenco do usuário com geral, seta e contrato; moral inicial 60', () => {
    const e = elenco(carreiras.sql())
    expect(e.time).toBe('AAA')
    expect(e.jogadores).toHaveLength(23)
    const j = e.jogadores[0]!
    expect(j).toMatchObject({ geral: 10, condicao: 100, moral: 60, seta: 'otima', lesaoSemanas: 0, suspenso: [], contratoAte: 2027 })
  })

  it('a ficha traz atributos no WE, faixa de potencial e histórico depois dos jogos', () => {
    avancar(carreiras.sql())
    const e = elenco(carreiras.sql())
    const titular = e.jogadores.find((j) => j.posicao === 'CF')!
    const f = ficha(carreiras.sql(), titular.id)
    expect(Object.keys(f.atributos)).toHaveLength(16)
    expect(f.atributosWe.OFF).toBeGreaterThanOrEqual(12)
    expect(f.potencial.min).toBeLessThanOrEqual(12)
    expect(f.potencial.max).toBeGreaterThanOrEqual(12)
    expect(ficha(carreiras.sql(), titular.id).potencial).toEqual(f.potencial)
    const jogaram = e.jogadores.map((j) => ficha(carreiras.sql(), j.id)).filter((x) => x.historico.length > 0)
    expect(jogaram.length).toBeGreaterThanOrEqual(11)
  })

  it('salva e limpa a aparência', () => {
    const id = elenco(carreiras.sql()).jogadores[0]!.id
    const a = { pele: 3, fisico: 'G', cabelo: 'k1', cor_cabelo: 'A', barba: 'C', cor_barba: 'B', chuteira: 'H' } as const
    expect(salvarAparencia(carreiras.sql(), id, a).aparencia).toEqual(a)
    expect(salvarAparencia(carreiras.sql(), id, null).aparencia).toBeNull()
    expect(() => salvarAparencia(carreiras.sql(), '999999', a)).toThrow()
  })

  it('o time do usuário começa no Técnico; trocar para Tático sobe o entrosamento com as semanas (aceite)', () => {
    expect(treino(carreiras.sql()).foco).toBe('tecnico')
    expect(definirFoco(carreiras.sql(), 'tatico').foco).toBe('tatico')
    const antes = treino(carreiras.sql()).entrosamento
    for (let i = 0; i < 3; i++) avancar(carreiras.sql())
    expect(treino(carreiras.sql()).entrosamento).toBeGreaterThan(antes)
  })
})
