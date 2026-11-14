/** Formatação para a interface (o banco e o núcleo guardam dinheiro em centavos). */

import { decimal, dinheiro } from '@shared/dinheiro'

export { dinheiro }

/** Reais digitados ("1.500,50" ou "1500.5") → centavos; `null` se inválido. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, '')
  if (!limpo) return 0
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  if (!/^-?\d+(\.\d{1,2})?$/.test(normal)) return null
  return Math.round(Number(normal) * 100)
}

export function centavosParaReais(centavos: number): string {
  return decimal(centavos / 100, 2)
}

const NOMES_DIFICULDADE: Record<string, string> = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' }
export const nomeDificuldade = (d: string) => NOMES_DIFICULDADE[d] ?? d

/** Posições do WE com os nomes da interface (spec 05). */
const POSICAO: Record<string, string> = { GK: 'GOL', CB: 'ZAG', SB: 'LAT', DH: 'VOL', SH: 'MEI-LAT', OH: 'MEI', CF: 'ATA', WG: 'PON' }
export const nomePosicao = (p: string | null | undefined) => (p ? (POSICAO[p] ?? p) : '—')
export const ORDEM_POSICAO = ['GK', 'CB', 'SB', 'DH', 'SH', 'OH', 'CF', 'WG']

const FOCO: Record<string, string> = { fisico: 'Físico', tecnico: 'Técnico', tatico: 'Tático', ataque: 'Ataque', defesa: 'Defesa', descanso: 'Descanso' }
export const nomeFoco = (f: string) => FOCO[f] ?? f

export type OrdemElenco = 'posicao' | 'geral' | 'condicao' | 'idade'
export const ORDENS_ELENCO: OrdemElenco[] = ['posicao', 'geral', 'condicao', 'idade']
export const NOME_ORDEM_ELENCO: Record<OrdemElenco, string> = { posicao: 'Posição', geral: 'Geral', condicao: 'Condição', idade: 'Idade' }

/** Ordena uma cópia do elenco: posição (e geral), geral, condição (pior primeiro) ou idade. */
export function ordenarElenco<T extends { posicao: string; geral: number; condicao: number; idade: number }>(jogadores: readonly T[], ordem: OrdemElenco): T[] {
  const lista = [...jogadores]
  const pos = (p: string) => ORDEM_POSICAO.indexOf(p)
  if (ordem === 'posicao') return lista.sort((a, b) => pos(a.posicao) - pos(b.posicao) || b.geral - a.geral)
  if (ordem === 'geral') return lista.sort((a, b) => b.geral - a.geral)
  if (ordem === 'condicao') return lista.sort((a, b) => a.condicao - b.condicao)
  return lista.sort((a, b) => a.idade - b.idade)
}

const TIPO_TRANSFERENCIA: Record<string, string> = { compra: 'Compra', venda: 'Venda', emprestimo: 'Empréstimo', livre: 'Sem clube', multa: 'Multa rescisória', renovacao: 'Renovação' }
export const nomeTipoTransferencia = (t: string) => TIPO_TRANSFERENCIA[t] ?? t
