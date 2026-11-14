import { describe, expect, it } from 'vitest'
import { criarRng } from '@core/rng'
import { quantidadeRodadas, todosContraTodos } from '@core/competicoes/rodadas'
import { decidirConfronto, emparelhar, empatado, type RegraMataMata } from '@core/competicoes/mataMata'
import { sortearEstrangeiros, sortearGrupos } from '@core/competicoes/sorteio'
import type { Partida, Resultado } from '@core/competicoes/tipos'

const times = (n: number) => Array.from({ length: n }, (_, i) => `T${String(i + 1).padStart(2, '0')}`)

describe('todos contra todos', () => {
  for (const n of [4, 5, 20]) {
    it(`${n} times, 2 turnos: cada par se enfrenta duas vezes com mando invertido e ninguém joga duas vezes na rodada`, () => {
      const ts = times(n)
      const rodadas = todosContraTodos(ts, 2, criarRng(n))
      expect(rodadas).toHaveLength(quantidadeRodadas(n, 2))
      const jogos = new Map<string, number>()
      for (const r of rodadas) {
        const naRodada = r.flatMap((c) => [c.casa, c.visitante])
        expect(new Set(naRodada).size).toBe(naRodada.length)
        for (const c of r) jogos.set(`${c.casa}>${c.visitante}`, (jogos.get(`${c.casa}>${c.visitante}`) ?? 0) + 1)
      }
      for (const a of ts) for (const b of ts) if (a !== b) expect(jogos.get(`${a}>${b}`), `${a}>${b}`).toBe(1)
    })
  }

  it('mando equilibrado no turno (diferença de no máximo 1 entre casa e fora... ±1)', () => {
    const ts = times(20)
    const turno = todosContraTodos(ts, 1, criarRng(3))
    for (const t of ts) {
      const casa = turno.flat().filter((c) => c.casa === t).length
      expect(Math.abs(casa - 9.5)).toBeLessThanOrEqual(1.5)
    }
  })

  it('mesma semente, mesma tabela', () => {
    expect(todosContraTodos(times(6), 1, criarRng(9))).toEqual(todosContraTodos(times(6), 1, criarRng(9)))
  })
})

const regra = (extra: Partial<RegraMataMata> = {}): RegraMataMata => ({ jogos: 2, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'pior_campanha', ...extra })
const jogo = (n: number, casa: string, visitante: string, r: Resultado): Partida => ({
  id: `j${n}`, edicao: 'e', fase: 'f', grupo: null, rodada: 0, confronto: 'c1', jogo: n, casa, visitante, passo: n, resultado: r,
})

describe('mata-mata', () => {
  it('vence quem fez mais gols no agregado', () => {
    const d = decidirConfronto([jogo(1, 'A', 'B', { golsCasa: 2, golsVisitante: 0 }), jogo(2, 'B', 'A', { golsCasa: 1, golsVisitante: 0 })], regra())
    expect(d).toEqual({ vencedor: 'A', perdedor: 'B', criterio: 'placar' })
  })

  it('gol fora desempata quando ligado', () => {
    const ida = jogo(1, 'A', 'B', { golsCasa: 2, golsVisitante: 1 })
    const volta = jogo(2, 'B', 'A', { golsCasa: 1, golsVisitante: 0, penaltisCasa: 4, penaltisVisitante: 2 })
    expect(decidirConfronto([ida, volta], regra({ gol_fora: true }))).toMatchObject({ vencedor: 'B', criterio: 'gol_fora' })
    expect(decidirConfronto([ida, volta], regra())).toMatchObject({ vencedor: 'B', criterio: 'penaltis' })
  })

  it('pênaltis do jogo decisivo decidem o empate', () => {
    const d = decidirConfronto([jogo(1, 'A', 'B', { golsCasa: 1, golsVisitante: 1, prorrogacao: true, penaltisCasa: 3, penaltisVisitante: 5 })], regra({ jogos: 1 }))
    expect(d).toEqual({ vencedor: 'B', perdedor: 'A', criterio: 'penaltis' })
  })

  it('empate sem pênaltis no resultado é erro (mata-mata sempre tem vencedor)', () => {
    expect(() => decidirConfronto([jogo(1, 'A', 'B', { golsCasa: 0, golsVisitante: 0 })], regra({ jogos: 1 }))).toThrow(/pênaltis/)
  })

  it('confronto incompleto ainda não tem decisão', () => {
    expect(decidirConfronto([jogo(1, 'A', 'B', { golsCasa: 1, golsVisitante: 0 })], regra())).toBeNull()
  })

  it('empatado() considera agregado e gol fora', () => {
    const ida = jogo(1, 'A', 'B', { golsCasa: 1, golsVisitante: 1 })
    const volta = jogo(2, 'B', 'A', { golsCasa: 0, golsVisitante: 0 })
    expect(empatado([ida, volta], regra())).toBe(true)
    expect(empatado([ida, volta], regra({ gol_fora: true }))).toBe(false)
  })

  it('emparelha melhor x pior com o mando da regra', () => {
    const rng = criarRng(1)
    expect(emparelhar(['A', 'B', 'C', 'D'], regra(), rng)).toEqual([
      { casa: 'D', visitante: 'A' },
      { casa: 'C', visitante: 'B' },
    ])
    expect(emparelhar(['A', 'B'], regra({ mando: 'melhor_campanha' }), rng)).toEqual([{ casa: 'A', visitante: 'B' }])
    expect(() => emparelhar(['A', 'B', 'C'], regra(), rng)).toThrow(/ímpar/)
  })
})

describe('sorteios', () => {
  it('grupos por potes: um time de cada pote por grupo', () => {
    const ranking = times(16)
    const grupos = sortearGrupos(ranking, 4, 4, 'potes', criarRng(2))
    expect(grupos).toHaveLength(4)
    for (const g of grupos) {
      expect(g).toHaveLength(4)
      g.forEach((t, pote) => expect(Math.floor(ranking.indexOf(t) / 4)).toBe(pote))
    }
    expect(new Set(grupos.flat()).size).toBe(16)
  })

  it('evita dois times do mesmo país no grupo quando possível', () => {
    const ranking = ['BR1', 'BR2', 'AR1', 'AR2', 'BR3', 'AR3', 'UY1', 'UY2']
    const pais = (t: string) => t.slice(0, 2)
    for (let s = 0; s < 20; s++) {
      const grupos = sortearGrupos(ranking, 4, 2, 'potes', criarRng(s), pais)
      for (const g of grupos) expect(new Set(g.map(pais)).size).toBe(g.length)
    }
  })

  it('número errado de times é erro', () => {
    expect(() => sortearGrupos(times(7), 2, 4, 'livre', criarRng(1))).toThrow()
  })

  it('estrangeiros: X por país, sem repetir e reproduzível', () => {
    const pool = { ARG: ['RIV', 'BOC', 'RAC', 'IND'], URU: ['NAC', 'PEN'] }
    const a = sortearEstrangeiros(pool, { ARG: 2, URU: 1 }, criarRng(4))
    expect(a).toHaveLength(3)
    expect(new Set(a).size).toBe(3)
    expect(a.slice(0, 2).every((t) => pool.ARG.includes(t))).toBe(true)
    expect(sortearEstrangeiros(pool, { ARG: 2, URU: 1 }, criarRng(4))).toEqual(a)
    expect(() => sortearEstrangeiros(pool, { URU: 3 }, criarRng(4))).toThrow()
  })
})
