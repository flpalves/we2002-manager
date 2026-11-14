import { z } from 'zod'
import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import type { Resultado } from '../competicoes/tipos'
import { gastoPorMinuto } from '../jogadores/condicao'
import type { EventoPartida, Lado, Participacao } from '../partida/tipos'
import type { Posicao } from '@shared/esquemas/pacote'
import { ladoOposto } from './controle'

/**
 * Leitura do data/resultado.json gravado por bridge/resultado.lua. Tolerante: a ponte
 * ainda evolui (campos ausentes não quebram). Lados = vagas do emulador.
 */

const Num = z.number().nullable().optional()

export const ResultadoPonteSchema = z
  .object({
    partida_id: z.string().nullable().optional(),
    modo: z.string().nullable().optional(),
    final: z.boolean().optional(),
    motivo: z.string().nullable().optional(),
    fase: z.union([z.string(), z.number()]).nullable().optional(),
    prorrogacao: z.boolean().optional(),
    penaltis: z.boolean().optional(),
    casa: z.object({ nome: z.string().nullable().optional(), gols: Num, penaltis: Num, estatisticas: z.record(z.string(), z.unknown()).nullable().optional() }).optional(),
    visitante: z.object({ nome: z.string().nullable().optional(), gols: Num, penaltis: Num, estatisticas: z.record(z.string(), z.unknown()).nullable().optional() }).optional(),
    gols: z
      .array(
        z.object({
          lado: z.string(),
          minuto: Num,
          periodo: z.string().nullable().optional(),
          vaga: Num,
          nome: z.string().nullable().optional(),
          assist_vaga: Num,
          assist_nome: z.string().nullable().optional(),
        }),
      )
      .optional(),
  })
  .loose()
export type ResultadoPonte = z.infer<typeof ResultadoPonteSchema>

export interface GolWe {
  lado: Lado
  minuto: number
  vaga: number | null
  nome: string | null
  assistVaga: number | null
  assistNome: string | null
}

export interface ResultadoWe {
  partidaId: string | null
  casaNome: string | null
  visitanteNome: string | null
  golsCasa: number
  golsVisitante: number
  gols: GolWe[]
  penaltis: { casa: number; visitante: number } | null
  prorrogacao: boolean
  final: boolean
  fase: string | null
  amarelos: { casa: number; visitante: number }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function normalizarResultado(bruto: unknown): ResultadoWe | null {
  const r = ResultadoPonteSchema.safeParse(bruto)
  if (!r.success) return null
  const d = r.data
  const gols: GolWe[] = (d.gols ?? []).map((g) => ({
    lado: g.lado === 'visitante' ? 'visitante' : 'casa',
    minuto: num(g.minuto) ?? 0,
    vaga: num(g.vaga),
    nome: g.nome ?? null,
    assistVaga: num(g.assist_vaga),
    assistNome: g.assist_nome ?? null,
  }))
  const pc = num(d.casa?.penaltis)
  const pv = num(d.visitante?.penaltis)
  const amarelos = (lado: 'casa' | 'visitante') => num((d[lado]?.estatisticas ?? {})['amarelos']) ?? 0
  return {
    partidaId: d.partida_id ?? null,
    casaNome: d.casa?.nome ?? null,
    visitanteNome: d.visitante?.nome ?? null,
    golsCasa: num(d.casa?.gols) ?? gols.filter((g) => g.lado === 'casa').length,
    golsVisitante: num(d.visitante?.gols) ?? gols.filter((g) => g.lado === 'visitante').length,
    gols,
    penaltis: d.penaltis || pc !== null || pv !== null ? { casa: pc ?? 0, visitante: pv ?? 0 } : null,
    prorrogacao: !!d.prorrogacao,
    final: d.final === true,
    fase: d.fase === undefined || d.fase === null ? null : String(d.fase),
    amarelos: { casa: amarelos('casa'), visitante: amarelos('visitante') },
  }
}

/** Resultado nas vagas do emulador → mando real. */
export function desinverter(r: ResultadoWe, invertido: boolean): ResultadoWe {
  if (!invertido) return r
  return {
    ...r,
    casaNome: r.visitanteNome,
    visitanteNome: r.casaNome,
    golsCasa: r.golsVisitante,
    golsVisitante: r.golsCasa,
    gols: r.gols.map((g) => ({ ...g, lado: ladoOposto(g.lado) })),
    penaltis: r.penaltis ? { casa: r.penaltis.visitante, visitante: r.penaltis.casa } : null,
    amarelos: { casa: r.amarelos.visitante, visitante: r.amarelos.casa },
  }
}

export interface Esperado {
  partidaId: string
  /** Nomes nas VAGAS do emulador (como foram gravados no partida.json). */
  vagaCasa: string
  vagaVisitante: string
  /** O jogo precisa de vencedor (mata-mata em jogo único ou volta decisiva no WE). */
  precisaVencedor: boolean
}

export type Conferencia = { ok: true } | { ok: false; motivo: string }

/** O resultado.json é desta partida? (validação por partida_id e pelos nomes, como no app antigo.) */
export function conferir(r: ResultadoWe, e: Esperado): Conferencia {
  if (r.partidaId !== e.partidaId) return { ok: false, motivo: `resultado.json é de outra partida (${r.partidaId ?? 'sem id'})` }
  if (r.casaNome && r.visitanteNome && (r.casaNome !== e.vagaCasa || r.visitanteNome !== e.vagaVisitante)) {
    return { ok: false, motivo: `resultado.json é de ${r.casaNome} x ${r.visitanteNome}` }
  }
  if (r.final && e.precisaVencedor && r.golsCasa === r.golsVisitante && (!r.penaltis || r.penaltis.casa === r.penaltis.visitante)) {
    return { ok: false, motivo: 'jogo de mata-mata terminou empatado sem pênaltis' }
  }
  return { ok: true }
}

/**
 * Encerrar com o placar parcial: a saída para quando a ponte não reconhece o apito final
 * (o sinal de fim de jogo na RAM ainda não é confiável). Só vale a partir do 2º tempo, e o
 * mata-mata em jogo único precisa de vencedor (gols ou pênaltis).
 */
export function aceitarParcial(r: ResultadoWe, precisaVencedor: boolean): Conferencia {
  if (r.final) return { ok: true }
  if (r.fase === null || r.fase === '1T') return { ok: false, motivo: 'a partida ainda está no 1º tempo' }
  return conferir({ ...r, final: true }, { partidaId: r.partidaId ?? '', vagaCasa: r.casaNome ?? '', vagaVisitante: r.visitanteNome ?? '', precisaVencedor })
}

/** Jogadores de um lado na ordem das vagas do WE (0-22) e o papel de cada titular. */
export interface LadoEscalado {
  ids: string[]
  posicoes: Posicao[]
  camisas: number[]
  /** Para o gasto de condição dos titulares. */
  perfis: { idade: number; resistencia: number; fole: number; condicao: number }[]
}

/**
 * Converte o resultado do WE (já no mando real) no `Resultado` da carreira. O que a RAM ainda
 * não dá (substituições, cartões por jogador, lesões) fica de fora: os 11 titulares contam
 * os minutos todos; os amarelos entram só como total do time.
 */
export function paraResultado(r: ResultadoWe, lados: Record<Lado, LadoEscalado>, regras: Regras): Resultado {
  const eventos: EventoPartida[] = r.gols
    .slice()
    .sort((a, b) => a.minuto - b.minuto)
    .map((g) => {
      const l = lados[g.lado]
      const autor = g.vaga !== null ? l.ids[g.vaga] : undefined
      const assist = g.assistVaga !== null ? l.ids[g.assistVaga] : undefined
      return { tipo: 'gol' as const, minuto: Math.min(g.minuto, 120), acrescimo: 0, lado: g.lado, jogador: autor ?? '', assistencia: assist ?? null, cabeca: false }
    })
  // Gol sem autor mapeado (gol contra, vaga fora do elenco) fica com jogador '' (decisão 6: gol sem autor).

  const minutos = r.prorrogacao ? 120 : 90
  const participacoes: Participacao[] = (['casa', 'visitante'] as const).flatMap((lado) =>
    lados[lado].ids.slice(0, 11).map((id, vaga) => {
      const perfil = lados[lado].perfis[vaga]!
      return {
        jogador: id,
        lado,
        titular: true,
        posicao: lados[lado].posicoes[vaga]!,
        vaga,
        camisa: lados[lado].camisas[vaga]!,
        minutos,
        entrouAos: null,
        saiuAos: null,
        condicaoFinal: Math.max(0, perfil.condicao - gastoPorMinuto(perfil, regras) * minutos),
      }
    }),
  )
  const naoUtilizados = (['casa', 'visitante'] as const).flatMap((lado) => lados[lado].ids.slice(11).map((jogador) => ({ jogador, lado })))

  return {
    golsCasa: r.golsCasa,
    golsVisitante: r.golsVisitante,
    ...(r.prorrogacao && { prorrogacao: true }),
    ...(r.penaltis && r.penaltis.casa !== r.penaltis.visitante && { penaltisCasa: r.penaltis.casa, penaltisVisitante: r.penaltis.visitante }),
    cartoesCasa: { amarelos: r.amarelos.casa, vermelhos: 0 },
    cartoesVisitante: { amarelos: r.amarelos.visitante, vermelhos: 0 },
    detalhe: { eventos, participacoes, naoUtilizados },
  }
}

/**
 * Pênaltis decididos pelo manager (decisão 5): no jogo de volta jogado no WE em "pontos
 * corridos", se o agregado empatar, o manager cobra os pênaltis com a conversão base do motor.
 */
export function penaltisDoManager(rng: Rng, regras: Regras): { casa: number; visitante: number } {
  const p = regras.motor.penalti_conversao
  let a = 0
  let b = 0
  for (let i = 0; i < 5; i++) {
    if (rng.chance(p)) a++
    if (rng.chance(p)) b++
  }
  while (a === b) {
    const x = rng.chance(p)
    const y = rng.chance(p)
    if (x) a++
    if (y) b++
  }
  return { casa: a, visitante: b }
}
