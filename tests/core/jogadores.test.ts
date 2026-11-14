import { describe, expect, it } from 'vitest'
import { PADROES, type FocoTreino } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { nivelWeNaPartida, pontuacaoSeta, reducaoPorCondicao, seta } from '@core/jogadores/setas'
import { ajustarMoral, moralAposPartida, moralSemanal } from '@core/jogadores/moral'
import { faixaPotencial } from '@core/jogadores/potencial'
import { geral } from '@core/jogadores/conversao'
import {
  atributosDoFoco,
  chanceDeclinio,
  chanceEvolucao,
  entrosamentoAoTrocarFormacao,
  entrosamentoSemanal,
  fatorMinutos,
  focoDaIa,
  semanaDeTreino,
  atributosQueEvoluem,
} from '@core/jogadores/treino'
import { recuperar } from '@core/jogadores/condicao'
import { Disciplinas } from '@core/competicoes/suspensoes'
import { Elencos, type JogadorCarreira } from '@core/partida/sessao'
import { atributosAleatorios } from '../helpers/elencos'

describe('setas do WE', () => {
  it('pontuação = 0,8 × condição + 0,2 × moral', () => {
    expect(pontuacaoSeta(90, 60, PADROES)).toBeCloseTo(84)
  })
  it('faixas: ≥90 ótima · 75-89 boa · 60-74 normal · 45-59 ruim · <45 péssima', () => {
    expect(seta(100, 60, PADROES)).toBe('otima') // 92
    expect(seta(90, 60, PADROES)).toBe('boa') // 84
    expect(seta(70, 60, PADROES)).toBe('normal') // 68
    expect(seta(55, 50, PADROES)).toBe('ruim') // 54
    expect(seta(40, 40, PADROES)).toBe('pessima') // 40
    expect(seta(100, 50, PADROES)).toBe('otima') // 90 (limite)
    expect(seta(87.5, 50, PADROES)).toBe('boa') // 80
  })
  it('redução no WE: <45% → −1 nível, <30% → −2, sem passar de 0', () => {
    expect(reducaoPorCondicao(50, PADROES)).toBe(0)
    expect(reducaoPorCondicao(44, PADROES)).toBe(1)
    expect(reducaoPorCondicao(29, PADROES)).toBe(2)
    expect(nivelWeNaPartida(20, 100, PADROES)).toBe(7)
    expect(nivelWeNaPartida(20, 40, PADROES)).toBe(6)
    expect(nivelWeNaPartida(20, 20, PADROES)).toBe(5)
    expect(nivelWeNaPartida(7, 20, PADROES)).toBe(0)
  })
})

describe('moral', () => {
  const base = { gols: 0, assistencias: 0, jogoGrande: false }
  it('vitória +3, empate 0, derrota −3', () => {
    expect(moralAposPartida(60, { ...base, resultado: 'V' }, PADROES)).toBe(63)
    expect(moralAposPartida(60, { ...base, resultado: 'E' }, PADROES)).toBe(60)
    expect(moralAposPartida(60, { ...base, resultado: 'D' }, PADROES)).toBe(57)
  })
  it('final/clássico em dobro; gol +2 e assistência +1', () => {
    expect(moralAposPartida(60, { ...base, resultado: 'V', jogoGrande: true }, PADROES)).toBe(66)
    expect(moralAposPartida(60, { resultado: 'D', gols: 2, assistencias: 1, jogoGrande: false }, PADROES)).toBe(62)
  })
  it('limitada a 0-100', () => {
    expect(moralAposPartida(99, { ...base, resultado: 'V', jogoGrande: true }, PADROES)).toBe(100)
    expect(ajustarMoral(5, -15)).toBe(0)
  })
  it('volta para 60 devagar (±1 por semana)', () => {
    expect(moralSemanal(70, PADROES)).toBe(69)
    expect(moralSemanal(50, PADROES)).toBe(51)
    expect(moralSemanal(60, PADROES)).toBe(60)
    expect(moralSemanal(60.5, PADROES)).toBe(60)
  })
})

describe('potencial', () => {
  it('faixa estreita com a idade e sempre contém o valor real', () => {
    for (const [idade, largura] of [[18, 6], [21, 4], [25, 2]] as const) {
      for (let k = 0; k < 50; k++) {
        const f = faixaPotencial(14, idade, 7, `j${k}`, PADROES)
        expect(f.max - f.min).toBe(largura)
        expect(f.min).toBeLessThanOrEqual(14)
        expect(f.max).toBeGreaterThanOrEqual(14)
      }
    }
    expect(faixaPotencial(14, 30, 7, 'x', PADROES)).toEqual({ min: 14, max: 14 })
  })
  it('é estável (mesma semente e jogador) e não fica sempre centrada', () => {
    expect(faixaPotencial(12, 18, 3, 'abc', PADROES)).toEqual(faixaPotencial(12, 18, 3, 'abc', PADROES))
    const centros = new Set(Array.from({ length: 30 }, (_, k) => {
      const f = faixaPotencial(12, 18, 3, `j${k}`, PADROES)
      return (f.min + f.max) / 2
    }))
    expect(centros.size).toBeGreaterThan(1)
  })
  it('fica dentro de 1-20 perto das pontas', () => {
    for (let k = 0; k < 30; k++) {
      const a = faixaPotencial(19, 18, 1, `p${k}`, PADROES)
      expect(a.max).toBeLessThanOrEqual(20)
      expect(a.max - a.min).toBe(6)
      const b = faixaPotencial(2, 18, 1, `p${k}`, PADROES)
      expect(b.min).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('treino e evolução', () => {
  it('fórmula da chance: 0,03 × (pot − geral)/5 × idade × minutos', () => {
    expect(chanceEvolucao(15, 10, 20, 90, PADROES)).toBeCloseTo(0.03 * 1 * 1.5 * 1.2)
    expect(chanceEvolucao(15, 10, 24, 30, PADROES)).toBeCloseTo(0.03 * 1 * 1 * 1)
    expect(chanceEvolucao(15, 10, 27, 0, PADROES)).toBeCloseTo(0.03 * 1 * 0.5 * 0.7)
    expect(chanceEvolucao(15, 10, 31, 0, PADROES)).toBeCloseTo(0.03 * 1 * 0.1 * 0.7)
    expect(chanceEvolucao(10, 12, 20, 90, PADROES)).toBe(0)
  })
  it('fator de minutos: ≥60 → 1,2 · entrou → 1,0 · não jogou → 0,7', () => {
    expect(fatorMinutos(60, PADROES)).toBe(1.2)
    expect(fatorMinutos(10, PADROES)).toBe(1)
    expect(fatorMinutos(0, PADROES)).toBe(0.7)
  })
  it('declínio a partir dos 30: 0,008 × (idade − 29)', () => {
    expect(chanceDeclinio(29, PADROES)).toBe(0)
    expect(chanceDeclinio(34, PADROES)).toBeCloseTo(0.04)
  })
  it('cada foco treina os seus atributos; REFLE. só para goleiro', () => {
    expect(atributosDoFoco('fisico', 'CF', PADROES)).toEqual(['SPD', 'ACC', 'STA', 'BAL', 'JMP'])
    expect(atributosDoFoco('tecnico', 'CF', PADROES)).toEqual(['PAS', 'DRI', 'TEC', 'CUR'])
    expect(atributosDoFoco('ataque', 'CF', PADROES)).toEqual(['OFF', 'SHA', 'SHP', 'HEA'])
    expect(atributosDoFoco('defesa', 'CB', PADROES)).not.toContain('RES')
    expect(atributosDoFoco('defesa', 'GK', PADROES)).toContain('RES')
    expect(atributosDoFoco('tatico', 'CF', PADROES)).toEqual([])
    expect(atributosDoFoco('descanso', 'CF', PADROES)).toEqual([])
  })
  it('jovem com potencial evolui nos atributos do foco e o geral para no potencial', () => {
    const rng = criarRng(1)
    const j = { id: 'x', posicao: 'CF' as const, idade: 18, potencial: 10, atributos: atributosAleatorios(rng, 8, 0) }
    const inicio = { ...j.atributos }
    for (let s = 0; s < 400; s++) semanaDeTreino(j, 'ataque', 90, PADROES, rng.derivar(s))
    expect(geral(j.atributos, 'CF', PADROES)).toBe(10)
    expect(j.atributos.OFF + j.atributos.SHA).toBeGreaterThan(inicio.OFF + inicio.SHA)
    expect(j.atributos.SPD).toBe(inicio.SPD)
    expect(j.atributos.PAS).toBe(inicio.PAS)
  })
  it('só evoluem os atributos do foco que pesam no geral da posição', () => {
    // Técnico treina PAS, DRI, TEC e CUR; para o centroavante só DRI e TEC pesam.
    expect(atributosQueEvoluem('tecnico', 'CF', PADROES)).toEqual(['DRI', 'TEC'])
    expect(atributosQueEvoluem('tecnico', 'OH', PADROES)).toEqual(['PAS', 'DRI', 'TEC', 'CUR'])
  })
  it('quem já está no potencial não evolui', () => {
    const rng = criarRng(3)
    const j = { id: 'y', posicao: 'CF' as const, idade: 18, potencial: 8, atributos: atributosAleatorios(rng, 10, 0) }
    const inicio = { ...j.atributos }
    for (let s = 0; s < 100; s++) semanaDeTreino(j, 'ataque', 90, PADROES, rng.derivar(s))
    expect(j.atributos).toEqual(inicio)
  })
  it('veterano perde atributos físicos com o tempo', () => {
    const rng = criarRng(2)
    const j = { id: 'v', posicao: 'CB' as const, idade: 35, potencial: 10, atributos: atributosAleatorios(rng, 14, 0) }
    let quedas = 0
    for (let s = 0; s < 100; s++) quedas += semanaDeTreino(j, 'tatico', 90, PADROES, rng.derivar(s)).filter((m) => m.delta === -1).length
    expect(quedas).toBeGreaterThan(5)
    expect(j.atributos.SPD).toBeLessThan(14)
    expect(j.atributos.PAS).toBe(14)
  })
})

describe('entrosamento (aceite: foco Tático sobe)', () => {
  it('Tático +4/semana até 100', () => {
    expect(entrosamentoSemanal(50, 'tatico', PADROES)).toBe(54)
    expect(entrosamentoSemanal(98, 'tatico', PADROES)).toBe(100)
  })
  it('sem tático −0,5/semana, Descanso −1, sem passar do mínimo 40', () => {
    expect(entrosamentoSemanal(50, 'tecnico', PADROES)).toBe(49.5)
    expect(entrosamentoSemanal(50, 'descanso', PADROES)).toBe(49)
    expect(entrosamentoSemanal(40.3, 'descanso', PADROES)).toBe(40)
    expect(entrosamentoSemanal(35, 'fisico', PADROES)).toBe(35)
  })
  it('trocar de formação cai para 50%', () => {
    expect(entrosamentoAoTrocarFormacao(80, PADROES)).toBe(40)
  })
})

describe('recuperação de condição pelo foco', () => {
  it('Descanso 1,40 · Técnico/Tático 1,00 · Ataque/Defesa 0,90 · Físico 0,75', () => {
    const ganho = (f: FocoTreino) => recuperar(0, 26, 1, PADROES, PADROES.treino.focos[f].recuperacao)
    expect(ganho('descanso')).toBeCloseTo(9.8)
    expect(ganho('tecnico')).toBeCloseTo(7)
    expect(ganho('tatico')).toBeCloseTo(7)
    expect(ganho('ataque')).toBeCloseTo(6.3)
    expect(ganho('defesa')).toBeCloseTo(6.3)
    expect(ganho('fisico')).toBeCloseTo(5.25)
  })
})

describe('semanas na temporada (Elencos)', () => {
  const jogador = (id: string, extra: Partial<JogadorCarreira> = {}): JogadorCarreira => ({
    id,
    time: 'AAA',
    nome: id,
    posicao: 'CF',
    posicaoSecundaria: null,
    atributos: atributosAleatorios(criarRng(id.length), 10, 0),
    condicao: 100,
    moral: 60,
    resistencia: 10,
    idade: 26,
    camisa: 9,
    lesaoDias: 0,
    potencial: 12,
    ...extra,
  })
  const novo = (jogadores: JogadorCarreira[], foco: FocoTreino | null = 'tatico', entrosamento = 50, dia = 0) =>
    new Elencos(jogadores, new Map([['AAA', { formacao: '4-4-2A', entrosamento, ocupacao: 0.6, foco }]]), new Disciplinas(), dia)
  const rng = (s: number) => criarRng(9).derivar('treino', s)

  it('jogador sem jogar recupera nas datas vazias (aceite)', () => {
    const e = novo([jogador('a', { condicao: 50 })], 'tecnico')
    e.avancarAte(3, PADROES, rng)
    expect(e.jogadores.get('a')!.condicao).toBeCloseTo(71)
    e.avancarAte(10, PADROES, rng)
    expect(e.jogadores.get('a')!.condicao).toBe(100)
  })

  it('o foco Tático sobe o entrosamento a cada semana completa (aceite)', () => {
    const e = novo([jogador('a')], 'tatico', 50)
    e.avancarAte(6, PADROES, rng)
    expect(e.times.get('AAA')!.entrosamento).toBe(50)
    e.avancarAte(7, PADROES, rng)
    expect(e.times.get('AAA')!.entrosamento).toBe(54)
    e.avancarAte(28, PADROES, rng)
    expect(e.times.get('AAA')!.entrosamento).toBe(66)
    expect(e.timesAlterados.has('AAA')).toBe(true)
  })

  it('semana completa: moral volta ao padrão e o lesionado volta com 70%', () => {
    const e = novo([jogador('a', { moral: 70 }), jogador('b', { lesaoDias: 5, condicao: 30 })])
    e.avancarAte(7, PADROES, rng)
    expect(e.jogadores.get('a')!.moral).toBe(69)
    expect(e.jogadores.get('b')!.lesaoDias).toBe(0)
    expect(e.jogadores.get('b')!.condicao).toBeGreaterThanOrEqual(70)
  })

  it('a IA escolhe o foco dos times da CPU', () => {
    expect(focoDaIa(70, 80, 3)).toBe('descanso')
    expect(focoDaIa(90, 50, 3)).toBe('tatico')
    expect(['tecnico', 'fisico']).toContain(focoDaIa(90, 80, 3))
    const e = novo([jogador('a', { condicao: 50 })], null, 80)
    e.avancarAte(7, PADROES, rng)
    expect(e.focoDe('AAA')).toBeDefined()
  })

  it('evoluções ficam registradas com a semana', () => {
    const jovem = jogador('j', { idade: 18, potencial: 20, atributos: atributosAleatorios(criarRng(5), 5, 0) })
    const e = novo([jovem], 'tecnico')
    e.registrarMinutos('j', 90)
    e.avancarAte(7 * 30, PADROES, rng)
    expect(e.evolucoes.length).toBeGreaterThan(0)
    expect(e.evolucoes.every((m) => m.semana >= 1 && m.semana <= 30 && m.delta === 1)).toBe(true)
  })
})
