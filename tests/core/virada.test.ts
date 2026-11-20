import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import type { EstadoEdicao } from '@core/competicoes/fases'
import { candidatosSegundaDivisao, idSegundaDivisao, participantesSeguintes } from '@core/competicoes/virada'
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

describe('virada: segunda divisão fantasma dos estaduais', () => {
  const estadual = (extra: Partial<Competicao> = {}): Competicao => ({
    id: 'est',
    nome: 'Estadual',
    tipo: 'estadual',
    participantes: { regra: 'lista', times: ['E1', 'E2', 'E3', 'E4'] },
    fases: [{ id: 'f', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } }],
    segunda_divisao: { troca: 2 },
    ...extra,
  })
  const clubes = [
    ...['E1', 'E2', 'E3', 'E4', 'R1', 'R2', 'R3', 'R4'].map((sigla) => ({ sigla, estado: 'RJ' })),
    { sigla: 'S1', estado: 'SP' },
    { sigla: 'X1', estado: null },
  ]
  const fim = [encerrada('est', ['E3', 'E1', 'E4', 'E2'])]
  const atuais = { est: ['E1', 'E2', 'E3', 'E4'] }

  it('os 2 últimos caem e sobem 2 clubes sorteados do mesmo estado', () => {
    const r = participantesSeguintes([estadual()], atuais, fim, { clubes, rng: criarRng(7) })
    const lista = r.participantes['est']!
    expect(lista).toHaveLength(4)
    expect(lista.slice(0, 2)).toEqual(['E1', 'E3'])
    for (const t of lista.slice(2)) expect(['R1', 'R2', 'R3', 'R4']).toContain(t)
    const caem = r.segundaDivisao.filter((m) => m.tipo === 'rebaixamento')
    expect(caem.map((m) => m.time).sort()).toEqual(['E2', 'E4'])
    expect(caem.every((m) => m.para === idSegundaDivisao('est'))).toBe(true)
    expect(r.segundaDivisao.filter((m) => m.tipo === 'acesso').map((m) => m.time)).toEqual(lista.slice(2))
  })

  it('o sorteio é reproduzível pela semente e varia com ela', () => {
    const sorteio = (semente: number) => participantesSeguintes([estadual()], atuais, fim, { clubes, rng: criarRng(semente) }).participantes['est']!.slice(2)
    expect(sorteio(7)).toEqual(sorteio(7))
    const vistos = new Set(Array.from({ length: 30 }, (_, i) => sorteio(i).join(',')))
    expect(vistos.size).toBeGreaterThan(1)
  })

  it('aptos marcados valem sozinhos; sem marcação, os estados; quem está em outro estadual não sobe', () => {
    const outro: Competicao = { ...estadual({ id: 'out', segunda_divisao: undefined }), participantes: { regra: 'lista', times: ['R1', 'R2'] } }
    const marcados = estadual({ segunda_divisao: { troca: 2, estados: ['RJ'], times: ['X1', 'S1', 'R1'] } })
    expect(candidatosSegundaDivisao(marcados, atuais.est, clubes, new Set(['R1', 'R2']))).toEqual(['S1', 'X1'])
    const c = estadual({ segunda_divisao: { troca: 2, estados: ['RJ'] } })
    expect(candidatosSegundaDivisao(c, atuais.est, clubes, new Set(['R1', 'R2']))).toEqual(['R3', 'R4'])
    const sp = estadual({ segunda_divisao: { troca: 1, estados: ['SP'] } })
    const r = participantesSeguintes([sp, outro], { ...atuais, out: ['R1', 'R2'] }, fim, { clubes, rng: criarRng(1) })
    expect(r.participantes['est']).toEqual(['E1', 'E3', 'E4', 'S1'])
    expect(r.participantes['out']).toEqual(['R1', 'R2'])
  })

  it('a lista de aptos roda: quem sobe sai dela, quem cai entra', () => {
    const c = estadual({ segunda_divisao: { troca: 2, times: ['R1', 'R2', 'R3'] } })
    const r = participantesSeguintes([c], atuais, fim, { clubes, rng: criarRng(5) })
    const subiram = r.participantes['est']!.slice(2)
    expect(r.aptos['est']!.sort()).toEqual([...['R1', 'R2', 'R3'].filter((t) => !subiram.includes(t)), 'E2', 'E4'].sort())
    // Sem marcação não há lista para rodar.
    expect(participantesSeguintes([estadual()], atuais, fim, { clubes, rng: criarRng(5) }).aptos).toEqual({})
  })

  it('com menos candidatos que a troca, cai só quem tem substituto; sem clubes/rng nada muda', () => {
    const poucos = clubes.filter((t) => !['R2', 'R3', 'R4'].includes(t.sigla))
    const r = participantesSeguintes([estadual()], atuais, fim, { clubes: poucos, rng: criarRng(1) })
    expect(r.participantes['est']).toEqual(['E1', 'E3', 'E4', 'R1'])
    expect(participantesSeguintes([estadual()], atuais, fim).participantes['est']).toEqual(atuais.est)
  })

  it('critério de quem cai: o último de cada grupo', () => {
    const c = estadual({
      fases: [{ id: 'g', nome: 'Grupos', formato: 'grupos', grupos: { quantidade: 2, tamanho: 2, turnos: 1, sorteio: 'livre', classificam: 1 } }],
      segunda_divisao: { troca: 2, descem: { criterio: 'grupo', fase: 'g', por_grupo: 1 } },
    })
    const e: EstadoEdicao = {
      ...encerrada('est', ['E3', 'E1', 'E4', 'E2']),
      fases: [
        {
          id: 'g',
          participantes: ['E1', 'E2', 'E3', 'E4'],
          grupos: [['E1', 'E3'], ['E2', 'E4']],
          classificados: null,
          eliminados: [],
          encerrada: true,
          ordemGrupos: [['E1', 'E3'], ['E4', 'E2']],
        },
      ],
    }
    const r = participantesSeguintes([c], atuais, [e], { clubes, rng: criarRng(3) })
    expect(r.segundaDivisao.filter((m) => m.tipo === 'rebaixamento').map((m) => m.time)).toEqual(['E3', 'E2'])
  })
})

describe('virada: Série D por vagas (só os garantidos passam de uma temporada para a outra)', () => {
  const pc = (id: string, times: string[], extra: Partial<Competicao> = {}): Competicao => ({ ...liga(id, times), ...extra })
  const c = pc('c', ['C1', 'C2', 'C3'], { saidas: [{ ultimos: 1, destino: 'd', tipo: 'rebaixamento' }] })
  const d = pc('d', [], {
    participantes: { regra: 'lista', times: [], quantidade: 4, por_vagas: true },
    saidas: [{ primeiros: 1, destino: 'c', tipo: 'acesso' }],
  })
  const est = pc('est', ['C1', 'D2', 'E1', 'E2', 'E3'], {
    tipo: 'estadual',
    saidas: [{ primeiros: 2, destino: 'd', exceto_de: ['c'] }],
  })
  const atuais = { c: ['C1', 'C2', 'C3'], d: ['D1', 'D2', 'D3', 'D4'], est: ['C1', 'D2', 'E1', 'E2', 'E3'] }
  const edicoes = [encerrada('c', ['C1', 'C2', 'C3']), encerrada('d', ['D4', 'D2', 'D1', 'D3']), encerrada('est', ['C1', 'D4', 'C3', 'E2', 'E1'])]

  it('a D da próxima temporada fica só com o rebaixado da C; as vagas do estadual valem no mesmo ano', () => {
    const r = participantesSeguintes([c, d, est], atuais, edicoes)
    expect(r.participantes['c']).toEqual(['C1', 'C2', 'D4'])
    expect(r.participantes['d']).toEqual(['C3'])
    expect(r.vagas.filter((v) => v.para === 'd')).toEqual([])
  })

  it('sem por_vagas, a vaga para uma lista não tem efeito', () => {
    const fixa: Competicao = { ...d, participantes: { regra: 'lista', times: ['D1', 'D2', 'D3', 'D4'] } }
    const r = participantesSeguintes([c, fixa, est], atuais, edicoes)
    expect(r.participantes['d']).toEqual(['D1', 'D2', 'D3', 'C3'])
  })

  it('Sul-Americana: pula quem vai à Libertadores na próxima temporada e a vaga desce', () => {
    const liberta: Competicao = { ...pc('liberta', []), participantes: { regra: 'classificados_de', origens: ['a', 'copa'] } }
    const sula: Competicao = { ...pc('sula', []), participantes: { regra: 'classificados_de', origens: ['a'] }, pula_quem_joga: ['liberta'] }
    const a = pc('a', ['A1', 'A2', 'A3', 'A4', 'A5'], { saidas: [{ posicoes: '1-2', destino: 'liberta' }, { posicoes: '3-4', destino: 'sula' }] })
    const copa = pc('copa', ['A1', 'A2', 'A3', 'A4', 'A5'], { saidas: [{ campeao: true, destino: 'liberta' }] })
    const r = participantesSeguintes([a, copa, liberta, sula], { a: a.participantes.regra === 'lista' ? a.participantes.times : [] }, [
      encerrada('a', ['A1', 'A2', 'A3', 'A4', 'A5']),
      encerrada('copa', ['A3', 'A5']),
    ])
    // A3 ganhou a Copa (Libertadores): as vagas 3-4 da Sul-Americana descem para A4 e A5.
    expect(r.participantes['liberta']).toEqual(['A1', 'A2', 'A3'])
    expect(r.participantes['sula']).toEqual(['A4', 'A5'])
  })

  it('vaga pulando para classificados_de respeita a quantidade (próxima temporada)', () => {
    const copa: Competicao = { ...pc('copa', []), participantes: { regra: 'classificados_de', origens: ['est'], quantidade: 2 } }
    const e2: Competicao = { ...est, saidas: [{ primeiros: 3, destino: 'copa', exceto_de: ['c', 'd'] }] }
    const r = participantesSeguintes([c, d, e2, copa], atuais, edicoes)
    // Pulados: C1 e D4 (na C) e C3 (na D). Sobram E2 e E1, e só 2 cabem.
    expect(r.participantes['copa']).toEqual(['E2', 'E1'])
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
