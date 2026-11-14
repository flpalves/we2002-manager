import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import type { EstadoEdicao } from '@core/competicoes/fases'
import { participantesSeguintes } from '@core/competicoes/virada'
import { fecharMetas, metaAtingida, type Meta } from '@core/diretoria/diretoria'
import { cpuRenova } from '@core/mercado/contratos'

const liga = (id: string, times: string[], saidas: Competicao['saidas'] = []): Competicao => ({
  id,
  nome: id.toUpperCase(),
  tipo: 'nacional',
  participantes: { regra: 'lista', times },
  fases: [{ id: 'f', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
  saidas,
})

const encerrada = (competicao: string, final: string[]): EstadoEdicao => ({
  id: `${competicao}-2026`,
  competicao,
  temporada: 2026,
  participantes: [...final],
  fases: [],
  campeao: final[0]!,
  classificacaoFinal: final,
})

describe('virada: participantes da próxima temporada', () => {
  const a = liga('a', ['A1', 'A2', 'A3', 'A4'], [{ posicoes: '3-4', destino: 'b', tipo: 'rebaixamento' }])
  const b = liga('b', ['B1', 'B2', 'B3', 'B4'], [{ posicoes: '1-2', destino: 'a', tipo: 'acesso' }])
  const atuais = { a: a.participantes.regra === 'lista' ? a.participantes.times : [], b: ['B1', 'B2', 'B3', 'B4'] }

  it('acesso e rebaixamento trocam os times de lista, mantendo o tamanho', () => {
    const r = participantesSeguintes([a, b], atuais, [encerrada('a', ['A2', 'A1', 'A4', 'A3']), encerrada('b', ['B3', 'B1', 'B2', 'B4'])])
    expect(r.participantes['a']).toEqual(['A1', 'A2', 'B3', 'B1'])
    expect(r.participantes['b']).toEqual(['B2', 'B4', 'A4', 'A3'])
    expect(r.movimentos.map((m) => `${m.time}:${m.tipo}`).sort()).toEqual(['A3:rebaixamento', 'A4:rebaixamento', 'B1:acesso', 'B3:acesso'])
  })

  it('sem saídas (ou com destino que não existe no pacote) nada muda', () => {
    const so = liga('a', ['A1', 'A2'], [{ posicoes: '1', destino: 'libertadores', tipo: 'vaga' }])
    const r = participantesSeguintes([so], { a: ['A1', 'A2'] }, [encerrada('a', ['A2', 'A1'])])
    expect(r.participantes).toEqual({ a: ['A1', 'A2'] })
    expect(r.movimentos).toEqual([])
    expect(r.vagas).toEqual([])
  })

  it('vagas preenchem a competição por classificados_de, na ordem e até a quantidade', () => {
    const copa: Competicao = {
      id: 'copa',
      nome: 'Copa',
      tipo: 'continental',
      participantes: { regra: 'classificados_de', origens: ['a', 'b'], quantidade: 3 },
      fases: [{ id: 'f', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } }],
    }
    const a2 = liga('a', ['A1', 'A2', 'A3'], [{ posicoes: '1-2', destino: 'copa' }])
    const b2 = liga('b', ['B1', 'B2'], [{ campeao: true, destino: 'copa', tipo: 'vaga' }])
    const r = participantesSeguintes([a2, b2, copa], { a: ['A1', 'A2', 'A3'], b: ['B1', 'B2'] }, [encerrada('a', ['A3', 'A1', 'A2']), encerrada('b', ['B2', 'B1'])])
    expect(r.participantes['copa']).toEqual(['A3', 'A1', 'B2'])
    // A vaga não tira o time da liga de origem.
    expect(r.participantes['a']).toEqual(['A1', 'A2', 'A3'])
  })

  it('um time não é movido duas vezes (campeão que também está na faixa de posições)', () => {
    const b3 = liga('b', ['B1', 'B2', 'B3'], [
      { campeao: true, destino: 'a', tipo: 'acesso' },
      { posicoes: '1-2', destino: 'a', tipo: 'acesso' },
    ])
    const a3 = liga('a', ['A1'])
    const r = participantesSeguintes([a3, b3], { a: ['A1'], b: ['B1', 'B2', 'B3'] }, [encerrada('b', ['B2', 'B1', 'B3'])])
    expect(r.participantes['a']).toEqual(['A1', 'B2', 'B1'])
    expect(r.movimentos).toHaveLength(2)
  })
})

describe('virada: metas da diretoria', () => {
  const pos: Meta = { tipo: 'posicao_liga', alvo: 8, competicao: 'a', descricao: '', critica: true }
  const fim = { posicoes: { a: 8 }, saldo: 0, folha: 100, orcamentoFolha: 100 }

  it('posição até o alvo atinge; abaixo perde; liga não disputada perde', () => {
    expect(metaAtingida(pos, fim)).toBe(true)
    expect(metaAtingida(pos, { ...fim, posicoes: { a: 9 } })).toBe(false)
    expect(metaAtingida(pos, { ...fim, posicoes: {} })).toBe(false)
  })

  it('saldo e folha', () => {
    expect(metaAtingida({ ...pos, tipo: 'saldo_positivo' }, fim)).toBe(true)
    expect(metaAtingida({ ...pos, tipo: 'saldo_positivo' }, { ...fim, saldo: -1 })).toBe(false)
    expect(metaAtingida({ ...pos, tipo: 'folha_no_orcamento' }, { ...fim, folha: 101 })).toBe(false)
  })

  it('meta crítica perdida demite; não crítica só tira confiança', () => {
    const d = PADROES.diretoria
    expect(fecharMetas(50, [{ meta: pos, atingida: false }], PADROES)).toEqual({ confianca: 50 + d.meta_perdida, demitido: true })
    expect(fecharMetas(50, [{ meta: { ...pos, critica: false }, atingida: false }], PADROES).demitido).toBe(false)
    expect(fecharMetas(50, [{ meta: pos, atingida: true }], PADROES)).toEqual({ confianca: 50 + d.meta_atingida, demitido: false })
  })
})

describe('virada: renovação da CPU', () => {
  const gerais = Array.from({ length: 23 }, (_, i) => 20 - i * 0.5)
  const taxa = (j: { idade: number; geral: number }) => {
    const rng = criarRng(7)
    let n = 0
    for (let i = 0; i < 4000; i++) if (cpuRenova({ id: 'x', ...j }, gerais, PADROES, rng)) n++
    return n / 4000
  }

  it('titular renova mais que encostado; veterano renova menos', () => {
    const r = PADROES.virada.renovacao_cpu
    expect(taxa({ idade: 25, geral: 20 })).toBeCloseTo(r.titular, 1)
    expect(taxa({ idade: 25, geral: 9 })).toBeCloseTo(r.encostado, 1)
    expect(taxa({ idade: 35, geral: 20 })).toBeCloseTo(r.titular * PADROES.virada.fator_veterano, 1)
  })

  it('mesma semente, mesma decisão', () => {
    const decide = () => cpuRenova({ id: 'x', idade: 28, geral: 14 }, gerais, PADROES, criarRng(1).derivar('virada', 2026))
    expect(decide()).toBe(decide())
  })
})
