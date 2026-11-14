import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { criarRng, hash32 } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import { gerarTemporada, jogarPasso, proximoPassoDoTime, temporadaEncerrada, type EstadoTemporada } from '@core/competicoes/temporada'
import { ErroCalendario, type Bloco } from '@core/competicoes/calendario'
import { decidirConfronto } from '@core/competicoes/mataMata'
import { regraMataMata, resolverSaidas } from '@core/competicoes/fases'
import { criarSimuladorProvisorio } from '@core/partida/provisorio'

const nomes = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${String(i + 1).padStart(2, '0')}`)
const serieA = nomes('A', 20)
const outros = nomes('B', 12)
const estrangeiros = nomes('X', 8)

const competicoes: Competicao[] = [
  {
    id: 'estadual',
    nome: 'Estadual',
    tipo: 'estadual',
    participantes: { regra: 'lista', times: [...serieA.slice(0, 4), ...outros.slice(0, 4)] },
    fases: [
      { id: 'grupos', nome: 'Grupos', formato: 'grupos', grupos: { quantidade: 2, tamanho: 4, turnos: 1, sorteio: 'potes', classificam: 2 }, classificam_para: 'final' },
      { id: 'final', nome: 'Mata-mata', formato: 'mata_mata', mata_mata: { jogos: 1, gol_fora: false, prorrogacao: true, penaltis: true, mando: 'melhor_campanha' } },
    ],
  },
  {
    id: 'serie-a',
    nome: 'Série A',
    tipo: 'nacional',
    participantes: { regra: 'lista', times: serieA },
    fases: [{ id: 'liga', nome: 'Liga', formato: 'pontos_corridos', pontos_corridos: { turnos: 2 } }],
    saidas: [
      { campeao: true, destino: 'continental', tipo: 'vaga' },
      { posicoes: '17-20', destino: 'serie-b', tipo: 'rebaixamento' },
    ],
  },
  {
    id: 'copa',
    nome: 'Copa',
    tipo: 'nacional',
    participantes: { regra: 'lista', times: [...serieA, ...outros] },
    fases: [{ id: 'mm', nome: 'Mata-mata', formato: 'mata_mata', mata_mata: { jogos: 2, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'pior_campanha' } }],
  },
  {
    id: 'continental',
    nome: 'Continental',
    tipo: 'continental',
    participantes: { regra: 'lista', times: [...serieA.slice(0, 8), ...estrangeiros] },
    fases: [
      { id: 'grupos', nome: 'Grupos', formato: 'grupos', grupos: { quantidade: 4, tamanho: 4, turnos: 2, sorteio: 'potes', classificam: 2 }, classificam_para: 'mm' },
      { id: 'mm', nome: 'Mata-mata', formato: 'mata_mata', mata_mata: { jogos: 2, gol_fora: true, prorrogacao: false, penaltis: true, mando: 'pior_campanha' } },
    ],
  },
]

const blocos: Bloco[] = [
  { competicao: 'estadual', datas: 'fds', semana_inicio: 1, semana_fim: 10 },
  { competicao: 'serie-a', datas: 'fds', semana_inicio: 11, semana_fim: 50 },
  { competicao: 'copa', datas: 'meio', semana_inicio: 8, semana_fim: 46 },
  { competicao: 'continental', datas: 'meio', semana_inicio: 10, semana_fim: 48 },
]

const forca = (t: string) => 8 + (hash32(t) % 8)
const mapa = new Map(competicoes.map((c) => [c.id, c]))
const pais = (t: string) => (t.startsWith('X') ? 'ARG' : 'BRA')

function gerar(semente: number): EstadoTemporada {
  return gerarTemporada({
    temporada: 2026,
    competicoes,
    participantes: Object.fromEntries(competicoes.map((c) => [c.id, c.participantes.regra === 'lista' ? c.participantes.times : []])),
    blocos,
    regras: PADROES,
    rng: criarRng(semente),
    paisDe: pais,
  })
}

function simularTudo(semente: number): EstadoTemporada {
  const estado = gerar(semente)
  const simular = criarSimuladorProvisorio(forca, semente)
  const ctx = { competicoes: mapa, regras: PADROES, rng: criarRng(semente), paisDe: pais }
  while (!temporadaEncerrada(estado)) jogarPasso(estado, simular, ctx)
  return estado
}

describe('temporada completa (aceite da fase 2)', () => {
  const estado = simularTudo(2026)

  it('gera e simula sem conflito: nenhum time joga duas vezes no mesmo passo', () => {
    const porPasso = new Map<number, string[]>()
    for (const p of estado.partidas) porPasso.set(p.passo, [...(porPasso.get(p.passo) ?? []), p.casa, p.visitante])
    for (const [passo, times] of porPasso) expect(new Set(times).size, `passo ${passo}`).toBe(times.length)
  })

  it('descanso mínimo entre jogos do mesmo time', () => {
    const dias = new Map<string, number[]>()
    for (const p of estado.partidas) {
      const dia = estado.passos[p.passo]!.dia
      for (const t of [p.casa, p.visitante]) dias.set(t, [...(dias.get(t) ?? []), dia])
    }
    for (const [t, ds] of dias) {
      ds.sort((a, b) => a - b)
      for (let i = 1; i < ds.length; i++) expect(ds[i]! - ds[i - 1]!, t).toBeGreaterThan(PADROES.calendario.descanso_minimo_dias)
    }
  })

  it('nenhum jogo pendente no fim e nenhuma rodada reservada sobrando', () => {
    expect(estado.reservadas).toEqual([])
    expect(estado.partidas.filter((p) => !p.resultado)).toEqual([])
  })

  it('cabe nas 52 semanas, com passos em ordem e semanas coerentes', () => {
    expect(estado.passos.at(-1)!.semana).toBeLessThanOrEqual(52)
    for (let i = 1; i < estado.passos.length; i++) {
      const [a, b] = [estado.passos[i - 1]!, estado.passos[i]!]
      expect(b.dia).toBeGreaterThan(a.dia)
      expect(b.semana).toBe(Math.floor(b.dia / 7) + 1)
    }
  })

  it('quantidade de jogos de cada competição', () => {
    const n = (c: string) => estado.partidas.filter((p) => p.edicao === `${c}-2026`).length
    expect(n('serie-a')).toBe(380)
    expect(n('copa')).toBe((16 + 8 + 4 + 2 + 1) * 2)
    expect(n('estadual')).toBe(12 + 2 + 1)
    expect(n('continental')).toBe(48 + (4 + 2 + 1) * 2)
  })

  it('todas as edições têm campeão e o mata-mata sempre tem vencedor', () => {
    for (const e of estado.edicoes) expect(e.campeao, e.id).not.toBeNull()
    for (const c of competicoes) {
      for (const f of c.fases) {
        if (f.formato !== 'mata_mata') continue
        const regra = regraMataMata(f)
        const daFase = estado.partidas.filter((p) => p.edicao === `${c.id}-2026` && p.fase === f.id)
        const confrontos = new Set(daFase.map((p) => p.confronto))
        for (const id of confrontos) {
          const jogos = daFase.filter((p) => p.confronto === id)
          expect(decidirConfronto(jogos, regra), `${c.id} ${id}`).not.toBeNull()
        }
      }
    }
  })

  it('o campeão do mata-mata venceu a final e a classificação final começa por ele', () => {
    const copa = estado.edicoes.find((e) => e.id === 'copa-2026')!
    const final = estado.partidas.filter((p) => p.edicao === 'copa-2026' && p.rodada === 4)
    const decisao = decidirConfronto(final, regraMataMata(competicoes[2]!.fases[0] as never))!
    expect(copa.campeao).toBe(decisao.vencedor)
    expect(copa.classificacaoFinal![0]).toBe(decisao.vencedor)
    expect(copa.classificacaoFinal![1]).toBe(decisao.perdedor)
    expect(copa.classificacaoFinal).toHaveLength(32)
  })

  it('grupos: só os 2 primeiros de cada grupo seguem para o mata-mata', () => {
    const cont = estado.edicoes.find((e) => e.id === 'continental-2026')!
    const grupos = cont.fases[0]!.grupos!
    expect(grupos.map((g) => g.length)).toEqual([4, 4, 4, 4])
    const mm = cont.fases[1]!.participantes!
    expect(mm).toHaveLength(8)
    for (const g of grupos) expect(g.filter((t) => mm.includes(t))).toHaveLength(2)
  })

  it('saídas: campeão da liga ganha vaga e os 4 últimos caem', () => {
    const liga = estado.edicoes.find((e) => e.id === 'serie-a-2026')!
    const saidas = resolverSaidas(liga, competicoes[1]!)
    expect(saidas.filter((s) => s.tipo === 'rebaixamento').map((s) => s.time)).toEqual(liga.classificacaoFinal!.slice(16))
    expect(saidas.find((s) => s.tipo === 'vaga')!.time).toBe(liga.campeao)
  })

  it('mesma semente, mesma temporada; semente diferente, outra temporada', () => {
    const outro = simularTudo(2026)
    expect(outro.edicoes.map((e) => e.campeao)).toEqual(estado.edicoes.map((e) => e.campeao))
    expect(outro.partidas.map((p) => p.resultado)).toEqual(estado.partidas.map((p) => p.resultado))
    const diferente = simularTudo(7)
    expect(diferente.partidas.map((p) => p.resultado)).not.toEqual(estado.partidas.map((p) => p.resultado))
  })

  it('proximoPassoDoTime acha o próximo jogo definido', () => {
    const novo = gerar(1)
    const p = proximoPassoDoTime(novo, 'A01')!
    expect(novo.partidas.some((x) => x.passo === p && (x.casa === 'A01' || x.visitante === 'A01'))).toBe(true)
  })
})

describe('calendário', () => {
  it('janela pequena demais é erro claro', () => {
    expect(() =>
      gerarTemporada({
        temporada: 2026,
        competicoes: [competicoes[1]!],
        participantes: { 'serie-a': serieA },
        blocos: [{ competicao: 'serie-a', datas: 'fds', semana_inicio: 1, semana_fim: 20 }],
        regras: PADROES,
        rng: criarRng(1),
      }),
    ).toThrow(ErroCalendario)
  })

  it('competição sem bloco usa fins de semana da temporada inteira', () => {
    const e = gerarTemporada({ temporada: 2026, competicoes: [competicoes[1]!], participantes: { 'serie-a': serieA }, blocos: [], regras: PADROES, rng: criarRng(1) })
    expect(e.passos.every((p) => p.tipo === 'fds')).toBe(true)
    expect(e.passos).toHaveLength(38)
  })
})
