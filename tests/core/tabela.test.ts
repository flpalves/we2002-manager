import { describe, expect, it } from 'vitest'
import { classificar, DESEMPATE_PADRAO, type CriterioDesempate } from '@core/competicoes/tabela'
import type { Partida, Resultado } from '@core/competicoes/tipos'

const pontos = { vitoria: 3, empate: 1, derrota: 0 }
let n = 0
function jogo(casa: string, visitante: string, gc: number, gv: number, extra: Partial<Resultado> = {}): Partida {
  n++
  return { id: `p${n}`, edicao: 'e', fase: 'f', grupo: null, rodada: 0, confronto: null, jogo: 1, casa, visitante, passo: n, resultado: { golsCasa: gc, golsVisitante: gv, ...extra } }
}
const ordem = (times: string[], partidas: Partida[], criterios: CriterioDesempate[] = DESEMPATE_PADRAO, semente = 1) =>
  classificar(times, partidas, { pontos, criterios, sementeSorteio: semente }).map((l) => l.time)

describe('tabela', () => {
  it('soma jogos, vitórias, gols, pontos e últimos resultados', () => {
    const [a, b] = classificar(['A', 'B'], [jogo('A', 'B', 2, 0), jogo('B', 'A', 1, 1)], { pontos, criterios: DESEMPATE_PADRAO, sementeSorteio: 1 })
    expect(a).toMatchObject({ time: 'A', posicao: 1, jogos: 2, vitorias: 1, empates: 1, derrotas: 0, golsPro: 3, golsContra: 1, saldo: 2, pontos: 4, ultimos: ['V', 'E'] })
    expect(b).toMatchObject({ time: 'B', posicao: 2, pontos: 1, saldo: -2, ultimos: ['D', 'E'] })
  })

  it('ignora partidas sem resultado e times sem jogo ficam zerados', () => {
    const p = jogo('A', 'B', 1, 0)
    const pendente = { ...jogo('A', 'C', 0, 0), resultado: null }
    const t = classificar(['A', 'B', 'C'], [p, pendente], { pontos, criterios: DESEMPATE_PADRAO, sementeSorteio: 1 })
    expect(t.find((l) => l.time === 'C')).toMatchObject({ jogos: 0, pontos: 0 })
  })

  // Um teste por critério: os dois times empatam em tudo que vem antes dele.
  it('critério pontos', () => {
    expect(ordem(['A', 'B'], [jogo('B', 'A', 1, 0)])).toEqual(['B', 'A'])
  })

  it('critério vitórias (mesmos pontos)', () => {
    // A: 1V 0E 1D = 3 pts ; B: 0V 3E 0D = 3 pts
    const ps = [jogo('A', 'X', 1, 0), jogo('A', 'Y', 0, 1), jogo('B', 'X', 0, 0), jogo('B', 'Y', 0, 0), jogo('B', 'Z', 0, 0)]
    expect(ordem(['B', 'A'], ps, ['pontos', 'vitorias'])).toEqual(['A', 'B'])
  })

  it('critério saldo (mesmos pontos e vitórias)', () => {
    const ps = [jogo('A', 'X', 3, 0), jogo('B', 'Y', 1, 0)]
    expect(ordem(['B', 'A'], ps, ['pontos', 'vitorias', 'saldo'])).toEqual(['A', 'B'])
  })

  it('critério gols pró (mesmo saldo)', () => {
    const ps = [jogo('A', 'X', 3, 2), jogo('B', 'Y', 1, 0)]
    expect(ordem(['B', 'A'], ps, ['pontos', 'vitorias', 'saldo', 'gols_pro'])).toEqual(['A', 'B'])
  })

  it('critério confronto direto (só os jogos entre os empatados)', () => {
    // A e B: 3 pts, 1 vitória, saldo 0, 1 gol pró cada; B venceu o confronto.
    const ps = [jogo('B', 'A', 1, 0), jogo('A', 'X', 1, 0)]
    expect(ordem(['A', 'B', 'X'], ps, ['pontos', 'vitorias', 'saldo', 'gols_pro', 'confronto_direto']).slice(0, 2)).toEqual(['B', 'A'])
  })

  it('confronto direto entre três empatados usa o mini-campeonato', () => {
    // A, B e C com 3 pts e mesmo saldo/gols; entre eles: C vence A e B.
    const ps = [jogo('C', 'A', 1, 0), jogo('C', 'B', 1, 0), jogo('A', 'X', 1, 0), jogo('B', 'Y', 1, 0), jogo('X', 'C', 1, 0), jogo('Y', 'C', 0, 0)]
    const t = classificar(['A', 'B', 'C', 'X', 'Y'], ps, { pontos, criterios: ['pontos', 'confronto_direto', 'sorteio'], sementeSorteio: 1 })
    const topo = t.filter((l) => ['A', 'B', 'C'].includes(l.time)).map((l) => l.time)
    expect(topo[0]).toBe('C')
  })

  it('critério menos vermelhos', () => {
    const ps = [jogo('A', 'X', 1, 0, { cartoesCasa: { amarelos: 0, vermelhos: 1 } }), jogo('B', 'Y', 1, 0, { cartoesCasa: { amarelos: 0, vermelhos: 0 } })]
    expect(ordem(['A', 'B'], ps, ['pontos', 'menos_vermelhos'])).toEqual(['B', 'A'])
  })

  it('critério menos amarelos', () => {
    const ps = [jogo('A', 'X', 1, 0, { cartoesCasa: { amarelos: 1, vermelhos: 0 } }), jogo('B', 'Y', 1, 0, { cartoesCasa: { amarelos: 3, vermelhos: 0 } })]
    expect(ordem(['B', 'A'], ps, ['pontos', 'menos_amarelos'])).toEqual(['A', 'B'])
  })

  it('critério sorteio: estável para a mesma semente, varia com a semente', () => {
    const times = ['A', 'B', 'C', 'D', 'E', 'F']
    const a = ordem(times, [], ['pontos', 'sorteio'], 7)
    expect(ordem(times, [], ['pontos', 'sorteio'], 7)).toEqual(a)
    const outras = [1, 2, 3, 4, 5].map((s) => ordem(times, [], ['pontos', 'sorteio'], s).join())
    expect(new Set([a.join(), ...outras]).size).toBeGreaterThan(1)
  })

  it('a ordem dos critérios importa (configurável por fase)', () => {
    // A: 2V 2D = 6 pts, saldo -2 ; B: 1V 3E 2D = 6 pts, saldo +3.
    const ps = [jogo('A', 'X', 1, 0), jogo('A', 'Y', 0, 1), jogo('A', 'Z', 1, 0), jogo('A', 'W', 0, 3)]
    const qs = [jogo('B', 'X', 5, 0), jogo('B', 'Y', 0, 0), jogo('B', 'Z', 0, 0), jogo('B', 'W', 0, 0), jogo('B', 'V', 0, 1), jogo('B', 'U', 0, 1)]
    const todos = [...ps, ...qs]
    expect(ordem(['A', 'B'], todos, ['pontos', 'vitorias', 'saldo'])).toEqual(['A', 'B'])
    expect(ordem(['A', 'B'], todos, ['pontos', 'saldo', 'vitorias'])).toEqual(['B', 'A'])
  })

  it('pontos é sempre o primeiro critério', () => {
    expect(ordem(['A', 'B'], [jogo('B', 'A', 1, 0)], ['sorteio'])).toEqual(['B', 'A'])
  })

  it('pontuação configurável', () => {
    const t = classificar(['A', 'B'], [jogo('A', 'B', 1, 0)], { pontos: { vitoria: 2, empate: 1, derrota: 0 }, criterios: DESEMPATE_PADRAO, sementeSorteio: 1 })
    expect(t[0]!.pontos).toBe(2)
  })
})
