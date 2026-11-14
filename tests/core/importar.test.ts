import { describe, expect, it } from 'vitest'
import { prepararCarreira } from '@core/pacote/importar'
import { pacote } from '../fixtures/pacote'

const escolha = { id: 'c', nome: 'C', tecnico: 'Felipe', time: 'AAA', semente: 1, criadaEm: 'x' }

describe('importação da carreira', () => {
  it('dificuldade ajusta o orçamento inicial só do time do usuário (±25%)', () => {
    const saldo = (dif: 'facil' | 'normal' | 'dificil', sigla: string) => prepararCarreira(pacote(), { ...escolha, dificuldade: dif }).times.find((t) => t.sigla === sigla)!
    expect(saldo('normal', 'AAA').saldo).toBe(100_000_000)
    expect(saldo('facil', 'AAA').saldo).toBe(125_000_000)
    expect(saldo('dificil', 'AAA')).toMatchObject({ saldo: 75_000_000, orcamento_folha_mensal: 37_500_000 })
    expect(saldo('dificil', 'BBB').saldo).toBe(100_000_000)
  })

  it('moral inicial padrão 60', () => {
    expect(prepararCarreira(pacote(), { ...escolha, dificuldade: 'normal' }).jogadores[0]!.moral).toBe(60)
  })
})
