import type { Regras } from '../config/padroes'
import type { Posicao } from '@shared/esquemas/pacote'
import { FORMACAO_PADRAO, FORMACOES, papeisDa, SETOR } from './formacoes'
import { fatorMoral, notaBasePapel, notaPapel } from './efetivo'
import type { Escalacao, JogadorPartida } from './tipos'

/**
 * IA de técnico (04-motor-partida): formação, escalação e convocação dos 23. A mesma IA
 * escala os times da CPU e gera a sugestão automática da tela de escalação do usuário.
 *
 * 1. Formação: escolhida pela qualidade "de ficha" do elenco disponível (sem condição), para
 *    não mudar de jogo para jogo por cansaço.
 * 2. Escalação ideal: os melhores na vaga, com condição e moral (os melhores jogam sempre
 *    que estão inteiros).
 * 3. Rodízio controlado: entre os titulares ideais abaixo do limite de condição, poupa os
 *    mais cansados, até um teto por jogo e só enquanto a força do time não cair demais.
 *    Fora de jogos em sequência e em jogo decisivo, só quem está no limite crítico.
 */

export type PrioridadeCompeticao = 'liga' | 'continental' | 'copa' | 'estadual'

/** Ordem de importância (menor = mais importante). */
export const ORDEM_PRIORIDADE: Readonly<Record<PrioridadeCompeticao, number>> = { liga: 0, continental: 1, copa: 2, estadual: 3 }

/** O que a IA sabe do calendário na hora de escalar. */
export interface ContextoRodizio {
  /** Dias até o jogo seguinte do time; `null` = nenhum marcado. */
  diasAteProximo: number | null
  /** Prioridade da competição do jogo seguinte. */
  prioridadeProximo: PrioridadeCompeticao | null
  /** Final ou jogo que decide o mata-mata: quase não poupa. */
  decisivo: boolean
}

export interface OpcoesEscalacao {
  /** Formação preferida (a do time no pacote). */
  formacao: string
  prioridade: PrioridadeCompeticao
  /** Tamanho da convocação (o WE leva 23 = 11 + 12). */
  convocados?: number
  /** Calendário; ausente = trata como jogos em sequência, sem saber o próximo. */
  rodizio?: ContextoRodizio
}

/** Regras do rodízio que valem para este jogo. */
export interface PlanoRodizio {
  /** Condição abaixo da qual o titular é candidato. */
  limite: number
  /** Máximo de poupados. */
  maximo: number
  /** Perda relativa máxima na força do time. */
  perdaMaxima: number
}

export function planoRodizio(prioridade: PrioridadeCompeticao, ctx: ContextoRodizio | undefined, regras: Regras): PlanoRodizio {
  const r = regras.ia
  const critico: PlanoRodizio = { limite: r.rodizio_critico, maximo: r.rodizio_maximo_decisivo, perdaMaxima: r.rodizio_perda_maxima[prioridade] + r.rodizio_perda_extra_critico }
  if (ctx?.decisivo) return critico
  // Sem jogo logo em seguida, o tempo recupera: só poupa quem está no limite.
  if (ctx && (ctx.diasAteProximo === null || ctx.diasAteProximo > r.rodizio_dias_sequencia)) return { ...critico, maximo: r.rodizio_maximo[prioridade] }
  let limite = r.rodizio_limite[prioridade]
  // Clássico "poupar no estadual para a Libertadores de quarta".
  if (ctx?.prioridadeProximo && ORDEM_PRIORIDADE[ctx.prioridadeProximo] < ORDEM_PRIORIDADE[prioridade]) limite += r.rodizio_bonus_proximo_importante
  return { limite: Math.max(limite, r.rodizio_critico), maximo: r.rodizio_maximo[prioridade], perdaMaxima: r.rodizio_perda_maxima[prioridade] }
}

type Nota = (j: JogadorPartida, p: Posicao) => number

function notaComCache(f: Nota): Nota {
  const cache = new Map<JogadorPartida, Map<Posicao, number>>()
  return (j, p) => {
    let porPapel = cache.get(j)
    if (!porPapel) cache.set(j, (porPapel = new Map()))
    let n = porPapel.get(p)
    if (n === undefined) porPapel.set(p, (n = f(j, p)))
    return n
  }
}

/**
 * Preenche as vagas maximizando a soma das notas: guloso pelas vagas mais difíceis de
 * preencher, depois trocas 2 a 2 enquanto melhorar.
 */
export function preencherVagas(papeis: readonly Posicao[], disponiveis: readonly JogadorPartida[], nota: (j: JogadorPartida, p: Posicao) => number): (JogadorPartida | null)[] {
  const vagas: (JogadorPartida | null)[] = papeis.map(() => null)
  const livres = new Set(disponiveis)
  // Ordem: goleiro primeiro; depois as vagas com menos candidatos naturais.
  const naturais = (p: Posicao) => disponiveis.filter((j) => j.posicao === p || j.posicaoSecundaria === p).length
  const ordem = papeis.map((_, i) => i).sort((a, b) => (papeis[a] === 'GK' ? -1 : papeis[b] === 'GK' ? 1 : naturais(papeis[a]!) - naturais(papeis[b]!)))
  for (const i of ordem) {
    let melhor: JogadorPartida | null = null
    let melhorNota = -Infinity
    for (const j of livres) {
      const n = nota(j, papeis[i]!)
      if (n > melhorNota) {
        melhor = j
        melhorNota = n
      }
    }
    if (melhor) {
      vagas[i] = melhor
      livres.delete(melhor)
    }
  }
  // Melhorias: trocar dois escalados de vaga, ou um escalado por alguém de fora.
  let melhorou = true
  for (let volta = 0; melhorou && volta < 20; volta++) {
    melhorou = false
    for (let a = 0; a < vagas.length; a++) {
      for (let b = a + 1; b < vagas.length; b++) {
        const ja = vagas[a]
        const jb = vagas[b]
        if (!ja || !jb) continue
        const antes = nota(ja, papeis[a]!) + nota(jb, papeis[b]!)
        const depois = nota(jb, papeis[a]!) + nota(ja, papeis[b]!)
        if (depois > antes + 1e-9) {
          vagas[a] = jb
          vagas[b] = ja
          melhorou = true
        }
      }
      const atual = vagas[a]
      for (const fora of livres) {
        if (!atual || nota(fora, papeis[a]!) > nota(atual, papeis[a]!) + 1e-9) {
          if (atual) livres.add(atual)
          livres.delete(fora)
          vagas[a] = fora
          melhorou = true
          break
        }
      }
    }
  }
  return vagas
}

function somaNotas(papeis: readonly Posicao[], vagas: readonly (JogadorPartida | null)[], nota: (j: JogadorPartida, p: Posicao) => number): number {
  return vagas.reduce((acc, j, i) => acc + (j ? nota(j, papeis[i]!) : 0), 0)
}

/**
 * Formação: a do time, trocada por outra do WE só se der um ganho relevante na qualidade
 * de ficha (faltam jogadores de um setor). Não olha condição, para ficar estável.
 */
export function escolherFormacao(disponiveis: readonly JogadorPartida[], preferida: string, regras: Regras): string {
  const ficha = notaComCache((j, p) => notaBasePapel(j, p, regras) * fatorMoral(j.moral, regras))
  const total = (f: string) => somaNotas(papeisDa(f), preencherVagas(papeisDa(f), disponiveis, ficha), ficha)
  const base = FORMACOES[preferida] ? preferida : FORMACAO_PADRAO
  const totalBase = total(base)
  let escolhida = base
  let melhor = totalBase
  for (const f of Object.keys(FORMACOES)) {
    if (f === base) continue
    const t = total(f)
    if (t > melhor && t > totalBase * (1 + regras.ia.ganho_troca_formacao)) {
      escolhida = f
      melhor = t
    }
  }
  return escolhida
}

/**
 * Rodízio: parte do time base (os melhores pela ficha) e tira, do mais cansado para o
 * menos, os candidatos do plano, enquanto couber no teto e a força do time no dia (com
 * condição) não cair além da perda máxima. Só as vagas dos poupados mudam; quem não é
 * candidato joga. Devolve as vagas finais e quem foi poupado.
 */
export function aplicarRodizio(
  papeis: readonly Posicao[],
  disponiveis: readonly JogadorPartida[],
  base: readonly (JogadorPartida | null)[],
  plano: PlanoRodizio,
  notaDoDia: Nota,
): { vagas: (JogadorPartida | null)[]; poupados: JogadorPartida[] } {
  const totalBase = somaNotas(papeis, base, notaDoDia)
  const candidatos = base
    .filter((j): j is JogadorPartida => j !== null && j.condicao < plano.limite)
    .sort((a, b) => a.condicao - b.condicao || (a.id < b.id ? -1 : 1))
  let vagas = [...base]
  const poupados: JogadorPartida[] = []
  for (const c of candidatos) {
    if (poupados.length >= plano.maximo) break
    const fora = new Set([...poupados, c])
    const tentativa = base.map((j) => (j && fora.has(j) ? null : j))
    const abertas = tentativa.map((j, i) => (j ? -1 : i)).filter((i) => i >= 0)
    const banco = disponiveis.filter((j) => !fora.has(j) && !tentativa.includes(j))
    if (banco.length < abertas.length) break
    const entram = preencherVagas(abertas.map((i) => papeis[i]!), banco, notaDoDia)
    abertas.forEach((i, k) => (tentativa[i] = entram[k] ?? null))
    const perda = totalBase > 0 ? 1 - somaNotas(papeis, tentativa, notaDoDia) / totalBase : 0
    if (perda <= plano.perdaMaxima + 1e-9) {
      vagas = tentativa
      poupados.push(c)
    }
  }
  return { vagas, poupados }
}

/**
 * Escala o time: formação estável, time base pela ficha e rodízio controlado; depois
 * convoca os reservas. `disponiveis` já exclui lesionados e suspensos.
 */
export function escalar(disponiveis: readonly JogadorPartida[], op: OpcoesEscalacao, regras: Regras): Escalacao {
  if (disponiveis.length < 11) throw new Error(`Só ${disponiveis.length} jogadores disponíveis (precisa de 11)`)
  const formacao = escolherFormacao(disponiveis, op.formacao, regras)
  const papeis = papeisDa(formacao)
  // Time base: os melhores de ficha (com moral). Cansaço só tira alguém pelo rodízio, com teto.
  const ficha = notaComCache((j, p) => notaBasePapel(j, p, regras) * fatorMoral(j.moral, regras))
  const base = preencherVagas(papeis, disponiveis, ficha)
  // Nota do dia: ficha × condição × moral (cache: o rodízio testa várias trocas).
  const notaDoDia = notaComCache((j, p) => notaPapel(j, p, regras))
  const { vagas, poupados } = aplicarRodizio(papeis, disponiveis, base, planoRodizio(op.prioridade, op.rodizio, regras), notaDoDia)

  const titulares = vagas.filter((j): j is JogadorPartida => j !== null)
  const reservas = convocarReservas(disponiveis.filter((j) => !titulares.includes(j)), (op.convocados ?? 23) - 11, regras)
  return { formacao, titulares, reservas, poupados: poupados.map((j) => j.id) }
}

/**
 * Reservas: um goleiro (se houver), depois um de cada setor, depois os melhores na própria
 * posição (com condição).
 */
export function convocarReservas(restantes: readonly JogadorPartida[], quantidade: number, regras: Regras): JogadorPartida[] {
  const nota = (j: JogadorPartida) => notaPapel(j, j.posicao, regras)
  const ordenados = [...restantes].sort((a, b) => nota(b) - nota(a))
  const escolhidos: JogadorPartida[] = []
  const pegar = (filtro: (j: JogadorPartida) => boolean) => {
    const j = ordenados.find((x) => filtro(x) && !escolhidos.includes(x))
    if (j && escolhidos.length < quantidade) escolhidos.push(j)
  }
  pegar((j) => j.posicao === 'GK')
  for (const setor of ['defesa', 'meio', 'ataque'] as const) pegar((j) => j.posicao !== 'GK' && SETOR[j.posicao] === setor)
  for (const j of ordenados) {
    if (escolhidos.length >= quantidade) break
    // Mais de um goleiro reserva só se não houver mais ninguém.
    if (!escolhidos.includes(j) && j.posicao !== 'GK') escolhidos.push(j)
  }
  for (const j of ordenados) {
    if (escolhidos.length >= quantidade) break
    if (!escolhidos.includes(j)) escolhidos.push(j)
  }
  return escolhidos
}
