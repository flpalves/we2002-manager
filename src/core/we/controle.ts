/**
 * Escolha do estado base (quem controla cada lado no WE) e desinversão do mando.
 * Port de `escolherControle` / `vagasDoJogo` / `desinverter` do app antigo (campeonato/).
 *
 * O estado base é sempre Brasil (vaga casa) x Holanda (vaga visitante); o controle diz quem
 * joga com o pad 1. Sem o estado CPU x P1, o time do usuário vai para a vaga da casa e o
 * mando fica invertido (desinverter ao gravar o resultado).
 */

export type Controle = 'p1_cpu' | 'cpu_p1' | 'p1_p2' | 'cpu_cpu'
export type ModoWe = 'jogar' | 'assistir'

export interface EscolhaControle {
  controle: Controle
  /** O time do usuário (visitante real) foi para a vaga da casa. */
  invertido: boolean
}

/** Arquivo de cada estado base em `states/` (mesma lista de ESTADOS_BASE em bridge/we2002.lua). */
export const ARQUIVO_ESTADO: Readonly<Record<Controle, string>> = {
  p1_cpu: 'amistoso.sstate',
  cpu_p1: 'base_cpu_p1.sstate',
  p1_p2: 'base_p1_p2.sstate',
  cpu_cpu: 'base_cpu_cpu.sstate',
}

export function escolherControle(usuarioVisitante: boolean, disponiveis: ReadonlySet<Controle>, modo: ModoWe): EscolhaControle {
  if (modo === 'assistir' && disponiveis.has('cpu_cpu')) return { controle: 'cpu_cpu', invertido: false }
  if (usuarioVisitante) {
    if (disponiveis.has('cpu_p1')) return { controle: 'cpu_p1', invertido: false }
    return { controle: 'p1_cpu', invertido: true }
  }
  return { controle: 'p1_cpu', invertido: false }
}

/** Times nas vagas do emulador a partir do mando real. */
export function vagasDoJogo<T>(casa: T, visitante: T, invertido: boolean): { vagaCasa: T; vagaVisitante: T } {
  return invertido ? { vagaCasa: visitante, vagaVisitante: casa } : { vagaCasa: casa, vagaVisitante: visitante }
}

export const ladoOposto = (l: 'casa' | 'visitante'): 'casa' | 'visitante' => (l === 'casa' ? 'visitante' : 'casa')
