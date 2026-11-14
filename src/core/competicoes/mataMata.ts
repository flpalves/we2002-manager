import type { Rng } from '../rng'
import type { Partida, Resultado, Sigla } from './tipos'

/** Regra do mata-mata de uma fase (03-competicoes: agregado → gol fora → prorrogação → pênaltis). */
export interface RegraMataMata {
  jogos: 1 | 2
  gol_fora: boolean
  prorrogacao: boolean
  penaltis: boolean
  mando: 'pior_campanha' | 'melhor_campanha' | 'sorteio'
}

export interface DecisaoConfronto {
  vencedor: Sigla
  perdedor: Sigla
  criterio: 'placar' | 'gol_fora' | 'penaltis'
}

interface Somas {
  a: Sigla
  b: Sigla
  golsA: number
  golsB: number
  foraA: number
  foraB: number
}

/** Soma os gols do confronto (A = mandante do 1º jogo). */
function somar(jogos: readonly Partida[]): Somas {
  const primeiro = jogos[0]!
  const s: Somas = { a: primeiro.casa, b: primeiro.visitante, golsA: 0, golsB: 0, foraA: 0, foraB: 0 }
  for (const j of jogos) {
    const r = j.resultado
    if (!r) continue
    if (j.casa === s.a) {
      s.golsA += r.golsCasa
      s.golsB += r.golsVisitante
      s.foraB += r.golsVisitante
    } else {
      s.golsB += r.golsCasa
      s.golsA += r.golsVisitante
      s.foraA += r.golsVisitante
    }
  }
  return s
}

/**
 * O confronto está empatado depois deste jogo (agregado e, se valer, gol fora)?
 * Usado para saber se o jogo decisivo vai para a prorrogação e para os pênaltis.
 */
export function empatado(jogos: readonly Partida[], regra: RegraMataMata): boolean {
  const s = somar(jogos)
  if (s.golsA !== s.golsB) return false
  if (regra.gol_fora && jogos.length === 2 && s.foraA !== s.foraB) return false
  return true
}

/** O jogo decide o confronto (jogo único ou volta)? */
export function ehDecisivo(jogo: Pick<Partida, 'jogo'>, regra: RegraMataMata): boolean {
  return jogo.jogo === regra.jogos
}

/**
 * Decide o confronto quando todos os jogos têm resultado; `null` se falta jogo.
 * Mata-mata sempre tem vencedor: empate persistente vai aos pênaltis, que são
 * obrigatórios no resultado do jogo decisivo (o WE sempre tem pênaltis).
 */
export function decidirConfronto(jogos: readonly Partida[], regra: RegraMataMata): DecisaoConfronto | null {
  if (jogos.length !== regra.jogos || jogos.some((j) => !j.resultado)) return null
  const ordenados = [...jogos].sort((x, y) => x.jogo - y.jogo)
  const s = somar(ordenados)
  const decide = (aVence: boolean, criterio: DecisaoConfronto['criterio']): DecisaoConfronto =>
    aVence ? { vencedor: s.a, perdedor: s.b, criterio } : { vencedor: s.b, perdedor: s.a, criterio }
  if (s.golsA !== s.golsB) return decide(s.golsA > s.golsB, 'placar')
  if (regra.gol_fora && regra.jogos === 2 && s.foraA !== s.foraB) return decide(s.foraA > s.foraB, 'gol_fora')
  const ultimo = ordenados[ordenados.length - 1]!
  const r = ultimo.resultado as Resultado
  if (r.penaltisCasa === undefined || r.penaltisVisitante === undefined || r.penaltisCasa === r.penaltisVisitante) {
    throw new Error(`Confronto ${ultimo.confronto ?? ultimo.id} empatado sem vencedor nos pênaltis`)
  }
  const casaVence = r.penaltisCasa > r.penaltisVisitante
  return decide((ultimo.casa === s.a) === casaVence, 'penaltis')
}

export interface Chave {
  /** Mandante do 1º jogo (ou do jogo único). */
  casa: Sigla
  visitante: Sigla
}

/**
 * Monta os confrontos da 1ª rodada a partir dos times ordenados por campanha
 * (melhor → pior): 1º x último, 2º x penúltimo... O mando segue a regra.
 */
export function emparelhar(porCampanha: readonly Sigla[], regra: RegraMataMata, rng: Rng): Chave[] {
  if (porCampanha.length % 2 !== 0) throw new Error(`Mata-mata com número ímpar de times (${porCampanha.length})`)
  const n = porCampanha.length
  const chaves: Chave[] = []
  for (let i = 0; i < n / 2; i++) chaves.push(definirMando(porCampanha[i]!, porCampanha[n - 1 - i]!, regra, rng))
  return chaves
}

/** `melhor` tem campanha melhor que `pior`. */
export function definirMando(melhor: Sigla, pior: Sigla, regra: RegraMataMata, rng: Rng): Chave {
  const piorEmCasa = regra.mando === 'pior_campanha' || (regra.mando === 'sorteio' && rng.chance(0.5))
  return piorEmCasa ? { casa: pior, visitante: melhor } : { casa: melhor, visitante: pior }
}
