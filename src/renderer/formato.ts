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

/** Geral com uma casa decimal ("11,3"). */
export const geralTexto = (g: number) => decimal(g, 1)

/**
 * Ordena uma cópia pela chave; empates mantêm a ordem original (sort estável).
 * `null`/`undefined` vão sempre para o fim, nos dois sentidos.
 */
export function ordenarPor<T>(lista: readonly T[], chave: (x: T) => number | string | null | undefined, crescente: boolean): T[] {
  const sinal = crescente ? 1 : -1
  return [...lista].sort((a, b) => {
    const x = chave(a)
    const y = chave(b)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    return sinal * (typeof x === 'string' ? x.localeCompare(String(y), 'pt-BR') : x - (y as number))
  })
}

export type OrdemElenco = 'camisa' | 'posicao' | 'nome' | 'idade' | 'geral' | 'condicao' | 'seta' | 'moral' | 'contrato' | 'salario' | 'valor'
/** Ordens dos botões (e do Y no controle); as outras vêm do clique no título da coluna. */
export const ORDENS_ELENCO: OrdemElenco[] = ['posicao', 'geral', 'condicao', 'idade']
export const NOME_ORDEM_ELENCO: Record<OrdemElenco, string> = {
  camisa: 'Nº',
  posicao: 'Posição',
  nome: 'Nome',
  idade: 'Idade',
  geral: 'Geral',
  condicao: 'Condição',
  seta: 'Seta',
  moral: 'Moral',
  contrato: 'Contrato',
  salario: 'Salário',
  valor: 'Valor',
}
/** Sentido natural de cada coluna no primeiro clique: melhores primeiro; condição, pior primeiro. */
export const CRESCENTE_ELENCO: Record<OrdemElenco, boolean> = {
  camisa: true,
  posicao: true,
  nome: true,
  idade: true,
  geral: false,
  condicao: true,
  seta: false,
  moral: false,
  contrato: true,
  salario: false,
  valor: false,
}

const NIVEL_SETA: Record<string, number> = { pessima: 0, ruim: 1, normal: 2, boa: 3, otima: 4 }

type Ordenavel = { posicao: string; geral: number; condicao: number; idade: number } & Partial<{
  camisa: number
  nome: string
  seta: string
  moral: number
  contratoAte: number | null
  salario: number
  valor: number
}>

/**
 * Ordena uma cópia do elenco pela coluna (sentido natural se `crescente` não vier).
 * Posição desempata pelo maior geral; as outras, pela posição.
 */
export function ordenarElenco<T extends Ordenavel>(jogadores: readonly T[], ordem: OrdemElenco, crescente = CRESCENTE_ELENCO[ordem]): T[] {
  const pos = (p: string) => ORDEM_POSICAO.indexOf(p)
  const base = [...jogadores].sort((a, b) => pos(a.posicao) - pos(b.posicao) || b.geral - a.geral)
  if (ordem === 'posicao') return crescente ? base : ordenarPor(base, (j) => pos(j.posicao), false)
  const chave: Record<Exclude<OrdemElenco, 'posicao'>, (j: T) => number | string | null | undefined> = {
    camisa: (j) => j.camisa,
    nome: (j) => j.nome,
    idade: (j) => j.idade,
    geral: (j) => j.geral,
    condicao: (j) => j.condicao,
    seta: (j) => (j.seta === undefined ? undefined : NIVEL_SETA[j.seta]),
    moral: (j) => j.moral,
    contrato: (j) => j.contratoAte,
    salario: (j) => j.salario,
    valor: (j) => j.valor,
  }
  return ordenarPor(base, chave[ordem], crescente)
}

const TIPO_TRANSFERENCIA: Record<string, string> = { compra: 'Compra', venda: 'Venda', emprestimo: 'Empréstimo', livre: 'Sem clube', multa: 'Multa rescisória', renovacao: 'Renovação', exterior: 'Do exterior', pre_contrato: 'Pré-contrato' }
export const nomeTipoTransferencia = (t: string) => TIPO_TRANSFERENCIA[t] ?? t
