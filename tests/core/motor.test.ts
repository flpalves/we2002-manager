import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { escalar, convocarReservas } from '@core/partida/ia'
import { simularPartida, type EntradaMotor } from '@core/partida/motor'
import { fatorCondicao, fatorPosicao, notaPapel } from '@core/partida/efetivo'
import { gastoPorMinuto, recuperar } from '@core/jogadores/condicao'
import { papeisDa } from '@core/partida/formacoes'
import { elencoSintetico } from '../helpers/elencos'

const op = { formacao: '4-4-2A', prioridade: 'liga' as const }

function entrada(semente: number, extra: Partial<EntradaMotor> = {}): EntradaMotor {
  const rng = criarRng(semente)
  const a = elencoSintetico('A', rng, 11)
  const b = elencoSintetico('B', rng, 11)
  return {
    casa: { sigla: 'A', escalacao: escalar(a, op, PADROES), entrosamento: 50 },
    visitante: { sigla: 'B', escalacao: escalar(b, op, PADROES), entrosamento: 50 },
    ocupacao: 0.5,
    substituicoes: 3,
    regras: PADROES,
    rng: rng.derivar('motor'),
    ...extra,
  }
}

describe('motor de partida', () => {
  it('mesma semente, mesmo jogo', () => {
    expect(simularPartida(entrada(5))).toEqual(simularPartida(entrada(5)))
  })

  it('eventos batem com o placar e com os cartões', () => {
    for (let s = 0; s < 200; s++) {
      const r = simularPartida(entrada(s))
      const gols = r.detalhe.eventos.filter((e) => e.tipo === 'gol')
      expect(gols.filter((g) => g.lado === 'casa')).toHaveLength(r.golsCasa)
      expect(gols.filter((g) => g.lado === 'visitante')).toHaveLength(r.golsVisitante)
      expect(r.detalhe.eventos.filter((e) => e.tipo === 'amarelo').length).toBe(r.amarelos.casa + r.amarelos.visitante)
      for (const g of gols) if (g.tipo === 'gol') expect(g.assistencia).not.toBe(g.jogador)
    }
  })

  it('autor e assistente são do próprio time', () => {
    for (let s = 0; s < 200; s++) {
      const r = simularPartida(entrada(s))
      const lado = new Map(r.detalhe.participacoes.map((p) => [p.jogador, p.lado]))
      for (const e of r.detalhe.eventos) {
        if (e.tipo !== 'gol') continue
        expect(lado.get(e.jogador)).toBe(e.lado)
        if (e.assistencia) expect(lado.get(e.assistencia)).toBe(e.lado)
      }
    }
  })

  it('respeita o limite de substituições e registra minutos jogados', () => {
    for (let s = 0; s < 200; s++) {
      const r = simularPartida(entrada(s))
      for (const lado of ['casa', 'visitante'] as const) {
        const subs = r.detalhe.eventos.filter((e) => e.tipo === 'substituicao' && e.lado === lado)
        expect(subs.length).toBeLessThanOrEqual(3)
        const ps = r.detalhe.participacoes.filter((p) => p.lado === lado)
        expect(ps.filter((p) => p.titular)).toHaveLength(11)
        expect(ps).toHaveLength(11 + subs.length)
        for (const p of ps) {
          expect(p.minutos).toBeGreaterThanOrEqual(0)
          expect(p.minutos).toBeLessThanOrEqual(90)
        }
        // Minutos por vaga: nunca passam de 90; sem expulsão nem lesão, somam 90.
        const limpo = !r.detalhe.eventos.some((e) => e.lado === lado && (e.tipo === 'vermelho' || e.tipo === 'lesao'))
        for (let v = 0; v < 11; v++) {
          const total = ps.filter((p) => p.vaga === v).reduce((a, p) => a + p.minutos, 0)
          expect(total).toBeLessThanOrEqual(92)
          if (limpo) expect(total).toBeGreaterThanOrEqual(88)
        }
      }
    }
  })

  it('expulso não aparece mais em lances depois do vermelho', () => {
    let achou = 0
    for (let s = 0; s < 2000 && achou < 10; s++) {
      const r = simularPartida(entrada(s))
      const verm = r.detalhe.eventos.find((e) => e.tipo === 'vermelho')
      if (!verm || verm.tipo !== 'vermelho') continue
      achou++
      const depois = r.detalhe.eventos.slice(r.detalhe.eventos.indexOf(verm) + 1)
      for (const e of depois) {
        if (e.tipo === 'gol') expect([e.jogador, e.assistencia]).not.toContain(verm.jogador)
        if (e.tipo === 'amarelo' || e.tipo === 'lesao') expect(e.jogador).not.toBe(verm.jogador)
      }
    }
    expect(achou).toBeGreaterThan(0)
  })

  it('prorrogação e pênaltis quando o desempate pede; pênaltis sempre decidem', () => {
    let comPenaltis = 0
    for (let s = 0; s < 300; s++) {
      const r = simularPartida(entrada(s, { desempate: (c, v, apos) => (c !== v ? null : apos ? 'penaltis' : 'prorrogacao') }))
      if (r.golsCasa !== r.golsVisitante) continue
      expect(r.prorrogacao).toBe(true)
      expect(r.penaltisCasa).not.toBeNull()
      expect(r.penaltisCasa).not.toBe(r.penaltisVisitante)
      comPenaltis++
      for (const p of r.detalhe.participacoes) expect(p.minutos).toBeLessThanOrEqual(120)
    }
    expect(comPenaltis).toBeGreaterThan(10)
  })

  it('sem desempate, o empate fica em 90 minutos', () => {
    const r = simularPartida(entrada(3))
    expect(r.prorrogacao).toBe(false)
    expect(r.penaltisCasa).toBeNull()
  })

  it('lesões têm gravidade e semanas dentro das faixas', () => {
    let n = 0
    for (let s = 0; s < 400; s++) {
      for (const e of simularPartida(entrada(s)).detalhe.eventos) {
        if (e.tipo !== 'lesao') continue
        n++
        const faixa = PADROES.lesoes.faixas.find((f) => f.nome === e.gravidade)!
        expect(e.semanas).toBeGreaterThanOrEqual(faixa.semanas[0])
        expect(e.semanas).toBeLessThanOrEqual(faixa.semanas[1])
      }
    }
    expect(n).toBeGreaterThan(0)
  })

  it('a condição cai durante o jogo', () => {
    const r = simularPartida(entrada(8))
    const titulares = r.detalhe.participacoes.filter((p) => p.titular && p.minutos === 90)
    expect(titulares.length).toBeGreaterThan(0)
    expect(titulares.every((p) => p.condicaoFinal < 100)).toBe(true)
  })
})

describe('atributo efetivo', () => {
  const j = elencoSintetico('X', criarRng(1), 11)[3]! // CB, secundária SB
  it('fatores de posição da spec', () => {
    expect(fatorPosicao(j, 'CB', PADROES)).toBe(1)
    expect(fatorPosicao(j, 'SB', PADROES)).toBe(0.92)
    expect(fatorPosicao({ posicao: 'CB', posicaoSecundaria: null }, 'SB', PADROES)).toBe(0.85)
    expect(fatorPosicao({ posicao: 'CB', posicaoSecundaria: null }, 'CF', PADROES)).toBe(0.7)
    expect(fatorPosicao({ posicao: 'CB', posicaoSecundaria: null }, 'GK', PADROES)).toBe(0.4)
  })
  it('condição abaixo de 60% reduz até −15%', () => {
    expect(fatorCondicao(80, PADROES)).toBe(1)
    expect(fatorCondicao(60, PADROES)).toBe(1)
    expect(fatorCondicao(30, PADROES)).toBeCloseTo(0.925)
    expect(fatorCondicao(0, PADROES)).toBeCloseTo(0.85)
  })
  it('moral muda ±5%', () => {
    expect(notaPapel({ ...j, moral: 100 }, 'CB', PADROES) / notaPapel({ ...j, moral: 50 }, 'CB', PADROES)).toBeCloseTo(1.05)
  })
})

describe('condição (spec 05)', () => {
  it('gasto em 90 minutos ≈ 28 × resistência × idade (FOLE 10 é neutro)', () => {
    const base = { idade: 26, resistencia: 10, fole: 10 }
    expect(gastoPorMinuto(base, PADROES) * 90).toBeCloseTo(28)
    expect(gastoPorMinuto({ ...base, resistencia: 20 }, PADROES) * 90).toBeCloseTo((28 * 0.7) / 1)
    expect(gastoPorMinuto({ ...base, idade: 34 }, PADROES) * 90).toBeCloseTo(28 * 1.2)
  })
  it('recupera 7 por dia ajustado pela idade, até 100', () => {
    expect(recuperar(60, 26, 3, PADROES)).toBe(81)
    expect(recuperar(60, 21, 3, PADROES)).toBeCloseTo(84.15)
    expect(recuperar(95, 26, 4, PADROES)).toBe(100)
    expect(recuperar(50, 26, 0, PADROES)).toBe(50)
  })
})

describe('IA de técnico', () => {
  const elenco = elencoSintetico('T', criarRng(4), 11)

  it('escala 11 na formação e convoca 12 reservas com goleiro', () => {
    const e = escalar(elenco, op, PADROES)
    expect(e.titulares).toHaveLength(11)
    expect(e.reservas).toHaveLength(12)
    expect(e.titulares[0]!.posicao).toBe('GK')
    expect(e.reservas.some((r) => r.posicao === 'GK')).toBe(true)
    expect(new Set([...e.titulares, ...e.reservas]).size).toBe(23)
  })

  it('os titulares jogam na posição natural ou secundária quando há gente para isso', () => {
    const e = escalar(elenco, op, PADROES)
    const papeis = papeisDa(e.formacao)
    const encaixados = e.titulares.filter((j, i) => j.posicao === papeis[i] || j.posicaoSecundaria === papeis[i]).length
    expect(encaixados).toBeGreaterThanOrEqual(10)
  })

  const iguais = elenco.map((j) => ({ ...j, atributos: { ...elenco[18]!.atributos } }))

  it('rodízio: titular cansado dá lugar a um reserva igual e descansado', () => {
    const cansado = escalar(iguais, op, PADROES).titulares.find((j) => j.posicao === 'CF')!
    const e2 = escalar(iguais.map((j) => (j.id === cansado.id ? { ...j, condicao: 60 } : j)), op, PADROES)
    expect(e2.titulares.map((j) => j.id)).not.toContain(cansado.id)
  })

  it('o estadual poupa mais que a liga', () => {
    const alvo = escalar(iguais, op, PADROES).titulares.find((j) => j.posicao === 'CF')!
    const comCond = iguais.map((j) => (j.id === alvo.id ? { ...j, condicao: 75 } : j))
    expect(escalar(comCond, op, PADROES).titulares.map((j) => j.id)).toContain(alvo.id)
    expect(escalar(comCond, { ...op, prioridade: 'estadual' }, PADROES).titulares.map((j) => j.id)).not.toContain(alvo.id)
  })

  it('troca de formação quando falta um setor', () => {
    // 4-3-3B com um centroavante só e nenhum ponta: uma formação com um atacante encaixa melhor.
    let atacantes = 0
    const semPontas = elenco.map((j) => {
      if (j.posicao === 'WG' || (j.posicao === 'CF' && atacantes++ > 0)) return { ...j, posicao: 'DH' as const, posicaoSecundaria: null }
      return { ...j, posicaoSecundaria: null }
    })
    const e = escalar(semPontas, { ...op, formacao: '4-3-3B' }, PADROES)
    expect(e.formacao).not.toBe('4-3-3B')
    expect(papeisDa(e.formacao).filter((p) => p === 'CF' || p === 'WG')).toHaveLength(1)
  })

  it('com menos de 11 disponíveis é erro', () => {
    expect(() => escalar(elenco.slice(0, 10), op, PADROES)).toThrow()
  })

  it('reservas: goleiro e um de cada setor antes de repetir', () => {
    const r = convocarReservas(elenco.slice(2), 5, PADROES)
    expect(r).toHaveLength(5)
    expect(r.map((j) => j.posicao)).toContain('GK')
  })
})
