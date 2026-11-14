import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import { gerarTemporada, jogarPasso, temporadaEncerrada } from '@core/competicoes/temporada'
import { Disciplinas } from '@core/competicoes/suspensoes'
import { criarSimuladorMotor, Elencos, prioridadeDe, type JogadorCarreira } from '@core/partida/sessao'
import { elencoSintetico } from '../helpers/elencos'

const siglas = Array.from({ length: 16 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`)
const liga: Competicao = {
  id: 'liga',
  nome: 'Liga',
  tipo: 'nacional',
  participantes: { regra: 'lista', times: siglas },
  suspensao: { amarelos: 3, jogos: 1, vermelho_jogos: 1, zera_na_fase: null },
  fases: [{ id: 'l', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
}
const copa: Competicao = {
  id: 'copa',
  nome: 'Copa',
  tipo: 'nacional',
  participantes: { regra: 'lista', times: siglas },
  fases: [{ id: 'mm', nome: 'Mata-mata', formato: 'mata_mata', mata_mata: { jogos: 1, gol_fora: false, prorrogacao: true, penaltis: true, mando: 'sorteio' } }],
}
const competicoes = new Map([
  [liga.id, liga],
  [copa.id, copa],
])

function montar(semente: number) {
  const rng = criarRng(semente)
  const jogadores: JogadorCarreira[] = siglas.flatMap((s, i) => elencoSintetico(`${s}-`, rng.derivar(s), 9 + (i % 5)).map((j) => ({ ...j, time: s, lesaoDias: 0, potencial: 16 })))
  const elencos = new Elencos(jogadores, new Map(siglas.map((s) => [s, { formacao: '4-4-2A', entrosamento: 50, ocupacao: 0.6, foco: null }])), new Disciplinas())
  const estado = gerarTemporada({
    temporada: 2026,
    competicoes: [liga, copa],
    participantes: { liga: siglas, copa: siglas },
    blocos: [
      { competicao: 'liga', datas: 'fds', semana_inicio: 5, semana_fim: 45 },
      { competicao: 'copa', datas: 'meio', semana_inicio: 10, semana_fim: 40 },
    ],
    regras: PADROES,
    rng,
  })
  return { elencos, estado }
}

describe('temporada com o motor e a IA (sessão)', () => {
  const { elencos, estado } = montar(11)
  const simular = criarSimuladorMotor({ elencos, competicoes, regras: PADROES, semente: 11 })
  const ctx = { competicoes, regras: PADROES, rng: criarRng(11) }
  const suspensosQueJogaram: string[] = []
  const lesionadosQueJogaram: string[] = []
  let suspensoes = 0
  let lesoes = 0
  let condicaoMinima = 100
  const t0 = performance.now()

  while (!temporadaEncerrada(estado)) {
    const passo = estado.passos[estado.passoAtual]!
    elencos.avancarAte(passo.dia, PADROES, (sem) => criarRng(11).derivar('treino', sem))
    // Quem está fora antes do passo, por competição
    const fora = new Map<string, Set<string>>()
    for (const p of estado.partidas.filter((x) => x.passo === passo.indice)) {
      const comp = p.edicao.startsWith('liga') ? 'liga' : 'copa'
      const s = new Set<string>()
      for (const j of elencos.jogadores.values()) {
        if (j.time !== p.casa && j.time !== p.visitante) continue
        if (elencos.disciplinas.estaSuspenso(j.id, comp)) {
          s.add(`S:${j.id}`)
          suspensoes++
        }
        if (j.lesaoDias > 0) s.add(`L:${j.id}`)
      }
      fora.set(p.id, s)
    }
    const r = jogarPasso(estado, simular, ctx)
    for (const p of r.jogadas) {
      const s = fora.get(p.id)!
      for (const part of p.resultado!.detalhe!.participacoes) {
        if (s.has(`S:${part.jogador}`)) suspensosQueJogaram.push(part.jogador)
        if (s.has(`L:${part.jogador}`)) lesionadosQueJogaram.push(part.jogador)
        condicaoMinima = Math.min(condicaoMinima, part.condicaoFinal)
      }
      lesoes += p.resultado!.detalhe!.eventos.filter((e) => e.tipo === 'lesao').length
    }
  }
  const duracao = performance.now() - t0

  it('a temporada inteira roda com o motor e tem campeões', () => {
    expect(estado.edicoes.every((e) => e.campeao)).toBe(true)
    expect(estado.partidas.every((p) => p.resultado?.detalhe)).toBe(true)
  })

  it('suspenso não joga na competição em que está suspenso', () => {
    expect(suspensoes).toBeGreaterThan(0)
    expect(suspensosQueJogaram).toEqual([])
  })

  it('lesionado não joga e as lesões acontecem', () => {
    expect(lesoes).toBeGreaterThan(0)
    expect(lesionadosQueJogaram).toEqual([])
  })

  it('a condição cai nos jogos e se recupera entre eles', () => {
    expect(condicaoMinima).toBeLessThan(80)
    const media = [...elencos.jogadores.values()].reduce((a, j) => a + j.condicao, 0) / elencos.jogadores.size
    expect(media).toBeGreaterThan(80)
  })

  it('é rápido o bastante (aceite: temporada de ~2.000 jogos em menos de 30 s)', () => {
    const jogos = estado.partidas.length
    expect((duracao / jogos) * 2000).toBeLessThan(30_000)
  })

  it('mesma semente, mesma temporada', () => {
    const b = montar(11)
    const sim = criarSimuladorMotor({ elencos: b.elencos, competicoes, regras: PADROES, semente: 11 })
    const c = { competicoes, regras: PADROES, rng: criarRng(11) }
    while (!temporadaEncerrada(b.estado)) {
      const passo = b.estado.passos[b.estado.passoAtual]!
      b.elencos.avancarAte(passo.dia, PADROES, (sem) => criarRng(11).derivar('treino', sem))
      jogarPasso(b.estado, sim, c)
    }
    expect(b.estado.partidas.map((p) => [p.resultado!.golsCasa, p.resultado!.golsVisitante])).toEqual(
      estado.partidas.map((p) => [p.resultado!.golsCasa, p.resultado!.golsVisitante]),
    )
  })

  it('prioridade da IA por competição', () => {
    expect(prioridadeDe(liga)).toBe('liga')
    expect(prioridadeDe(copa)).toBe('copa')
    expect(prioridadeDe({ ...liga, tipo: 'estadual' })).toBe('estadual')
    expect(prioridadeDe({ ...liga, tipo: 'continental' })).toBe('continental')
  })
})
