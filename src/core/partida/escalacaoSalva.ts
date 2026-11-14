import type { Regras } from '../config/padroes'
import type { Posicao } from '@shared/esquemas/pacote'
import { FORMACOES, papeisDa } from './formacoes'
import { notaPapel } from './efetivo'
import { convocarReservas, preencherVagas } from './ia'
import type { Escalacao, JogadorPartida } from './tipos'

/**
 * Escalação escolhida pelo usuário na tela de Escalação (08). Vale para o motor e para o WE;
 * quem não puder jogar no dia (lesão, suspensão, saiu do clube) é trocado pela IA na mesma
 * vaga, sem mexer no resto.
 */
export interface EscalacaoSalva {
  formacao: string
  /** 11 ids na ordem das vagas da formação (0 = goleiro); `null` = vaga vazia. */
  titulares: (string | null)[]
  /** Até 12 ids. */
  reservas: string[]
}

export const RESERVAS_WE = 12

export interface EscalacaoAplicada extends Escalacao {
  /** Titulares salvos que ficaram de fora no dia (a IA pôs outro na vaga). */
  substituidos: string[]
}

export function aplicarEscalacaoSalva(salva: EscalacaoSalva, disponiveis: readonly JogadorPartida[], regras: Regras): EscalacaoAplicada {
  if (disponiveis.length < 11) throw new Error(`Só ${disponiveis.length} jogadores disponíveis (precisa de 11)`)
  const formacao = FORMACOES[salva.formacao] ? salva.formacao : Object.keys(FORMACOES)[0]!
  const papeis = papeisDa(formacao)
  const porId = new Map(disponiveis.map((j) => [j.id, j]))
  const usados = new Set<string>()
  const substituidos: string[] = []
  const vagas: (JogadorPartida | null)[] = papeis.map((_, i) => {
    const id = salva.titulares[i] ?? null
    const j = id ? porId.get(id) : undefined
    if (id && !j) substituidos.push(id)
    if (!j || usados.has(j.id)) return null
    usados.add(j.id)
    return j
  })

  // Vagas vazias: a IA preenche com quem sobrou (os reservas escolhidos primeiro).
  const vazias = vagas.map((j, i) => (j ? -1 : i)).filter((i) => i >= 0)
  if (vazias.length) {
    const reservasSalvas = new Set(salva.reservas)
    const restantes = disponiveis.filter((j) => !usados.has(j.id))
    const nota = (j: JogadorPartida, p: Posicao) => notaPapel(j, p, regras) + (reservasSalvas.has(j.id) ? 0.5 : 0)
    const preenchidas = preencherVagas(
      vazias.map((i) => papeis[i]!),
      restantes,
      nota,
    )
    vazias.forEach((i, k) => {
      const j = preenchidas[k] ?? null
      vagas[i] = j
      if (j) usados.add(j.id)
    })
  }
  const titulares = vagas.filter((j): j is JogadorPartida => j !== null)

  const reservas: JogadorPartida[] = []
  for (const id of salva.reservas) {
    const j = porId.get(id)
    if (j && !usados.has(j.id) && reservas.length < RESERVAS_WE) {
      reservas.push(j)
      usados.add(j.id)
    }
  }
  if (reservas.length < RESERVAS_WE) {
    reservas.push(...convocarReservas(disponiveis.filter((j) => !usados.has(j.id)), RESERVAS_WE - reservas.length, regras))
  }
  return { formacao, titulares, reservas, substituidos }
}

/** Escalação válida para salvar: 11 vagas, ids do elenco, sem repetição, até 12 reservas. */
export function validarEscalacaoSalva(salva: EscalacaoSalva, elenco: ReadonlySet<string>): string | null {
  if (!FORMACOES[salva.formacao]) return `Formação desconhecida: ${salva.formacao}`
  if (salva.titulares.length !== 11) return 'A escalação precisa de 11 vagas.'
  if (salva.reservas.length > RESERVAS_WE) return `No máximo ${RESERVAS_WE} reservas.`
  const todos = [...salva.titulares.filter((x): x is string => x !== null), ...salva.reservas]
  if (new Set(todos).size !== todos.length) return 'Jogador repetido na escalação.'
  const estranho = todos.find((id) => !elenco.has(id))
  if (estranho) return 'Jogador que não é do seu elenco.'
  return null
}
