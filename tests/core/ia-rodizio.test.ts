import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { escalar, escolherFormacao, planoRodizio, type ContextoRodizio, type OpcoesEscalacao } from '@core/partida/ia'
import { contextoRodizio, partidaDecisiva } from '@core/partida/sessao'
import type { JogadorPartida } from '@core/partida/tipos'
import type { Partida } from '@core/competicoes/tipos'
import type { Competicao } from '@shared/esquemas/pacote'
import { elencoSintetico } from '../helpers/elencos'

const ia = PADROES.ia
const op: OpcoesEscalacao = { formacao: '4-4-2A', prioridade: 'liga' }
const emSequencia: ContextoRodizio = { diasAteProximo: 3, prioridadeProximo: 'liga', decisivo: false }
const ids = (js: readonly { id: string }[]) => js.map((j) => j.id)

/** Elenco em que todo mundo tem os mesmos atributos: trocar não custa nada. */
const base = elencoSintetico('R', criarRng(7), 12)
const iguais = base.map((j) => ({ ...j, atributos: { ...base[18]!.atributos } }))
const ideal = escalar(iguais, op, PADROES)
const linha = ideal.titulares.filter((j) => j.posicao !== 'GK')

function cansar(elenco: JogadorPartida[], quem: readonly string[], condicao: number): JogadorPartida[] {
  return elenco.map((j) => (quem.includes(j.id) ? { ...j, condicao } : j))
}

describe('plano do rodízio', () => {
  it('em sequência usa o limite da competição e o teto dela', () => {
    expect(planoRodizio('liga', emSequencia, PADROES)).toEqual({ limite: ia.rodizio_limite.liga, maximo: ia.rodizio_maximo.liga, perdaMaxima: ia.rodizio_perda_maxima.liga })
    expect(planoRodizio('estadual', { ...emSequencia, prioridadeProximo: 'estadual' }, PADROES).maximo).toBe(ia.rodizio_maximo.estadual)
  })

  it('próximo jogo mais importante sobe o limite (poupa para a Libertadores)', () => {
    const p = planoRodizio('estadual', { ...emSequencia, prioridadeProximo: 'continental' }, PADROES)
    expect(p.limite).toBe(ia.rodizio_limite.estadual + ia.rodizio_bonus_proximo_importante)
    // Próximo menos importante não muda nada.
    expect(planoRodizio('liga', { ...emSequencia, prioridadeProximo: 'estadual' }, PADROES).limite).toBe(ia.rodizio_limite.liga)
  })

  it('sem jogo logo em seguida, só o crítico', () => {
    expect(planoRodizio('liga', { ...emSequencia, diasAteProximo: 7 }, PADROES).limite).toBe(ia.rodizio_critico)
    expect(planoRodizio('liga', { ...emSequencia, diasAteProximo: null }, PADROES).limite).toBe(ia.rodizio_critico)
  })

  it('jogo decisivo: só o crítico e no máximo um', () => {
    const p = planoRodizio('copa', { ...emSequencia, decisivo: true }, PADROES)
    expect(p.limite).toBe(ia.rodizio_critico)
    expect(p.maximo).toBe(ia.rodizio_maximo_decisivo)
  })
})

describe('escalação com rodízio controlado', () => {
  it('descansados: sai a escalação ideal, ninguém poupado', () => {
    const e = escalar(iguais, { ...op, rodizio: emSequencia }, PADROES)
    expect(ids(e.titulares)).toEqual(ids(ideal.titulares))
    expect(e.poupados).toEqual([])
  })

  it('respeita o teto de poupados mesmo com muitos cansados', () => {
    const cansados = ids(linha.slice(0, 6))
    const liga = escalar(cansar(iguais, cansados, 62), { ...op, rodizio: emSequencia }, PADROES)
    expect(liga.poupados).toHaveLength(ia.rodizio_maximo.liga)
    expect(ids(liga.titulares).filter((id) => cansados.includes(id))).toHaveLength(6 - ia.rodizio_maximo.liga)

    const estadual = escalar(cansar(iguais, cansados, 62), { ...op, prioridade: 'estadual', rodizio: { ...emSequencia, prioridadeProximo: 'estadual' } }, PADROES)
    expect(estadual.poupados).toHaveLength(ia.rodizio_maximo.estadual)
  })

  it('poupa primeiro o mais cansado', () => {
    const [a, b, c] = linha
    const elenco = iguais.map((j) => (j.id === a!.id ? { ...j, condicao: 66 } : j.id === b!.id ? { ...j, condicao: 58 } : j.id === c!.id ? { ...j, condicao: 62 } : j))
    const e = escalar(elenco, { ...op, rodizio: emSequencia }, PADROES)
    expect(e.poupados).toEqual([b!.id, c!.id])
    expect(ids(e.titulares)).toContain(a!.id)
  })

  it('poupado vai para o banco, não some da convocação', () => {
    const alvo = linha[0]!.id
    const e = escalar(cansar(iguais, [alvo], 60), { ...op, rodizio: emSequencia }, PADROES)
    expect(e.poupados).toEqual([alvo])
    expect(ids(e.reservas)).toContain(alvo)
  })

  it('não poupa a estrela se o reserva for muito pior', () => {
    // Um craque no ataque e reservas fracos na mesma função.
    const craqueId = ideal.titulares.find((j) => j.posicao === 'CF')!.id
    const elenco = iguais.map((j) => {
      if (j.id === craqueId) return { ...j, condicao: 64, atributos: Object.fromEntries(Object.keys(j.atributos).map((k) => [k, 19])) as typeof j.atributos }
      if (!ids(ideal.titulares).includes(j.id) && j.posicao !== 'GK') return { ...j, atributos: Object.fromEntries(Object.keys(j.atributos).map((k) => [k, 5])) as typeof j.atributos }
      return j
    })
    const e = escalar(elenco, { ...op, rodizio: emSequencia }, PADROES)
    expect(e.poupados).toEqual([])
    expect(ids(e.titulares)).toContain(craqueId)
  })

  it('sem jogo em sequência, cansado moderado joga e o crítico descansa', () => {
    const [a, b] = linha
    const elenco = cansar(cansar(iguais, [a!.id], 60), [b!.id], 40)
    const e = escalar(elenco, { ...op, rodizio: { ...emSequencia, diasAteProximo: 7 } }, PADROES)
    expect(ids(e.titulares)).toContain(a!.id)
    expect(e.poupados).toEqual([b!.id])
  })

  it('jogo decisivo: no máximo um poupado, mesmo com vários no limite', () => {
    const criticos = ids(linha.slice(0, 3))
    const e = escalar(cansar(iguais, criticos, 40), { ...op, prioridade: 'copa', rodizio: { ...emSequencia, decisivo: true } }, PADROES)
    expect(e.poupados).toHaveLength(1)
  })

  it('a formação não muda por cansaço', () => {
    const elenco = elencoSintetico('F', criarRng(11), 12)
    const atacantes = ids(elenco.filter((j) => j.posicao === 'CF' || j.posicao === 'WG'))
    const fresca = escolherFormacao(elenco, '4-3-3B', PADROES)
    expect(escolherFormacao(cansar(elenco, atacantes, 30), '4-3-3B', PADROES)).toBe(fresca)
  })
})

describe('rodízio ao longo de uma sequência de jogos', () => {
  // Titulares claramente melhores que os reservas; jogo a cada 3 dias.
  const elenco0 = elencoSintetico('S', criarRng(21), 11)
  const xi = new Set(ids(escalar(elenco0, op, PADROES).titulares))
  const elenco = elenco0.map((j) => (xi.has(j.id) ? { ...j, atributos: Object.fromEntries(Object.entries(j.atributos).map(([k, v]) => [k, Math.min(20, v + 2)])) as typeof j.atributos } : j))
  const r = PADROES.condicao

  const jogos = 15
  const jogou = new Map<string, number>()
  const poupadosPorJogo: number[] = []
  let estado = elenco
  for (let k = 0; k < jogos; k++) {
    const e = escalar(estado, { ...op, rodizio: emSequencia }, PADROES)
    poupadosPorJogo.push(e.poupados?.length ?? 0)
    const titulares = new Set(ids(e.titulares))
    for (const id of titulares) jogou.set(id, (jogou.get(id) ?? 0) + 1)
    estado = estado.map((j) => {
      const gasto = titulares.has(j.id) ? r.gasto_por_90 : 0
      return { ...j, condicao: Math.min(100, Math.max(0, j.condicao - gasto) + 3 * r.recuperacao_por_dia) }
    })
  }

  it('os melhores jogam a maior parte dos jogos', () => {
    for (const id of xi) expect(jogou.get(id) ?? 0).toBeGreaterThanOrEqual(Math.ceil(jogos * 0.6))
  })

  it('reservas ganham alguns jogos, mas bem menos que os titulares', () => {
    const reservasQueJogaram = [...jogou.entries()].filter(([id]) => !xi.has(id))
    expect(reservasQueJogaram.length).toBeGreaterThan(0)
    for (const [, n] of reservasQueJogaram) expect(n).toBeLessThan(Math.ceil(jogos * 0.6))
  })

  it('nunca passa do teto de poupados', () => {
    expect(Math.max(...poupadosPorJogo)).toBeLessThanOrEqual(ia.rodizio_maximo.liga)
    expect(poupadosPorJogo.some((n) => n > 0)).toBe(true)
  })
})

describe('contexto do calendário para o rodízio', () => {
  const competicoes = new Map<string, Competicao>([
    ['br', { id: 'br', tipo: 'liga', fases: [{ formato: 'pontos_corridos' }] } as unknown as Competicao],
    ['lib', { id: 'lib', tipo: 'continental', fases: [{ formato: 'grupos' }] } as unknown as Competicao],
  ])
  const partida = (id: string, passo: number, edicao: string, casa: string, visitante: string) =>
    ({ id, edicao, fase: 'f', grupo: null, rodada: 1, confronto: null, jogo: 1, casa, visitante, passo, resultado: null }) as unknown as Partida
  const estado = {
    passos: [
      { indice: 0, dia: 2, semana: 1, tipo: 'meio' as const },
      { indice: 1, dia: 5, semana: 1, tipo: 'fds' as const },
      { indice: 2, dia: 12, semana: 2, tipo: 'fds' as const },
    ],
    edicoes: [{ id: 'br-1', competicao: 'br' }, { id: 'lib-1', competicao: 'lib' }] as never,
    partidas: [partida('a', 0, 'br-1', 'AAA', 'BBB'), partida('b', 1, 'lib-1', 'AAA', 'CCC'), partida('c', 2, 'br-1', 'BBB', 'CCC')],
  }

  it('acha o jogo seguinte do time, a distância em dias e a competição', () => {
    expect(contextoRodizio(estado, estado.partidas[0]!, 'AAA', competicoes, false)).toEqual({ diasAteProximo: 3, prioridadeProximo: 'continental', decisivo: false })
    expect(contextoRodizio(estado, estado.partidas[0]!, 'BBB', competicoes, false)).toEqual({ diasAteProximo: 10, prioridadeProximo: 'liga', decisivo: false })
    expect(contextoRodizio(estado, estado.partidas[1]!, 'AAA', competicoes, true)).toEqual({ diasAteProximo: null, prioridadeProximo: null, decisivo: true })
  })

  it('decisivo: final ou jogo que fecha o mata-mata', () => {
    const mm = { regra: { jogos: 2 }, anteriores: [] } as never
    expect(partidaDecisiva({ jogo: 1 }, { jogoGrande: false, mataMata: null })).toBe(false)
    expect(partidaDecisiva({ jogo: 1 }, { jogoGrande: true, mataMata: null })).toBe(true)
    expect(partidaDecisiva({ jogo: 1 }, { jogoGrande: false, mataMata: mm })).toBe(false)
    expect(partidaDecisiva({ jogo: 2 }, { jogoGrande: false, mataMata: mm })).toBe(true)
  })
})
