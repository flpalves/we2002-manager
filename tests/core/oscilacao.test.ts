import { describe, expect, it } from 'vitest'
import { PADROES, mesclarRegras } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { oscilacaoSemanal, quantidadeOscilacao, type JogadorOscilacao } from '@core/jogadores/oscilacao'
import { Disciplinas } from '@core/competicoes/suspensoes'
import { Elencos, type JogadorCarreira } from '@core/partida/sessao'
import { POSICOES_23, atributosAleatorios } from '../helpers/elencos'

function populacao(n: number, semente = 1, media = 12): JogadorOscilacao[] {
  const rng = criarRng(semente)
  return Array.from({ length: n }, (_, i) => ({ id: String(i + 1), posicao: POSICOES_23[i % 23]!, atributos: atributosAleatorios(rng, media) }))
}

describe('oscilação semanal de atributos', () => {
  it('quantidade sempre entre 1% e 3% do total', () => {
    for (let s = 0; s < 300; s++) {
      const q = quantidadeOscilacao(1500, PADROES, criarRng(s))
      expect(q).toBeGreaterThanOrEqual(15)
      expect(q).toBeLessThanOrEqual(45)
    }
  })

  it('metade sobe, metade desce (ímpar: diferença de 1); cada variação é de 1 ou 2', () => {
    for (let s = 0; s < 200; s++) {
      const mudancas = oscilacaoSemanal(populacao(1000, s), PADROES, criarRng(s).derivar('osc'))
      const sobe = mudancas.filter((m) => m.delta > 0).length
      const desce = mudancas.filter((m) => m.delta < 0).length
      expect(Math.abs(sobe - desce)).toBeLessThanOrEqual(1)
      expect(sobe + desce).toBe(mudancas.length)
      for (const m of mudancas) {
        expect([1, 2]).toContain(Math.abs(m.delta))
        expect(m.motivo).toBe('oscilacao')
      }
    }
  })

  it('jogadores distintos, atributos aplicados de verdade e dentro de 1-20', () => {
    const jogadores = populacao(800, 7)
    const antes = new Map(jogadores.map((j) => [j.id, { ...j.atributos }]))
    const mudancas = oscilacaoSemanal(jogadores, PADROES, criarRng(7))
    expect(new Set(mudancas.map((m) => m.jogador)).size).toBe(mudancas.length)
    for (const m of mudancas) {
      const j = jogadores.find((x) => x.id === m.jogador)!
      expect(j.atributos[m.atributo] - antes.get(m.jogador)![m.atributo]).toBe(m.delta)
      expect(j.atributos[m.atributo]).toBeGreaterThanOrEqual(1)
      expect(j.atributos[m.atributo]).toBeLessThanOrEqual(20)
    }
  })

  it('REFLE. só oscila em goleiro', () => {
    const mudancas = Array.from({ length: 100 }, (_, s) => oscilacaoSemanal(populacao(500, s), PADROES, criarRng(s))).flat()
    const pos = new Map(populacao(500).map((j) => [j.id, j.posicao]))
    for (const m of mudancas.filter((x) => x.atributo === 'RES')) expect(pos.get(m.jogador)).toBe('GK')
  })

  it('reproduzível: mesma semente e mesma população, mesmo resultado (a ordem de entrada não importa)', () => {
    const a = oscilacaoSemanal(populacao(600, 3), PADROES, criarRng(99))
    const b = oscilacaoSemanal(populacao(600, 3).reverse(), PADROES, criarRng(99))
    expect(b).toEqual(a)
  })

  it('desligável pelo regras.json', () => {
    const regras = mesclarRegras(PADROES, { oscilacao: { ativa: false } })
    expect(oscilacaoSemanal(populacao(1000), regras, criarRng(1))).toEqual([])
  })

  it('roda no fechamento da semana para todos os clubes e entra no histórico de evolução', () => {
    const rng = criarRng(5)
    const jogadores: JogadorCarreira[] = []
    const times = new Map()
    for (let t = 0; t < 40; t++) {
      const sigla = `T${t}`
      times.set(sigla, { formacao: '4-4-2A', entrosamento: 70, ocupacao: 0.5, foco: 'tatico' })
      POSICOES_23.forEach((posicao, i) =>
        jogadores.push({
          id: String(t * 100 + i), nome: `J${t}-${i}`, posicao, posicaoSecundaria: null, atributos: atributosAleatorios(rng, 12),
          condicao: 100, moral: 60, resistencia: 10, idade: 25, camisa: i + 1, time: sigla, lesaoDias: 0, potencial: 1,
        }),
      )
    }
    const e = new Elencos(jogadores, times, new Disciplinas())
    // Foco tático e potencial 1: o treino não evolui nada e ninguém tem 30+, então só sobra a oscilação.
    e.avancarAte(7, PADROES, (s) => criarRng(5).derivar('semana', s))
    const osc = e.evolucoes.filter((m) => m.motivo === 'oscilacao')
    expect(osc.length).toBeGreaterThanOrEqual(Math.round(920 * 0.01))
    expect(osc.length).toBeLessThanOrEqual(Math.round(920 * 0.03))
    expect(osc.every((m) => m.semana === 1 && e.alterados.has(m.jogador))).toBe(true)
    expect(new Set(osc.map((m) => e.jogadores.get(m.jogador)!.time)).size).toBeGreaterThan(1)
  })
})
