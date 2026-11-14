import type { Regras } from '../config/padroes'
import type { Porte } from '../mercado/valor'

/** Diretoria (06): metas por temporada, confiança e demissão. */

export type Dificuldade = 'facil' | 'normal' | 'dificil'

export interface Meta {
  tipo: 'posicao_liga' | 'saldo_positivo' | 'folha_no_orcamento'
  /** Posição máxima na liga (posicao_liga). */
  alvo: number | null
  competicao: string | null
  descricao: string
  critica: boolean
}

/** Metas da temporada pelo porte, pelo tamanho da liga e pela dificuldade. */
export function gerarMetas(porte: Porte, liga: { id: string; nome: string; times: number } | null, dificuldade: Dificuldade, regras: Regras): Meta[] {
  const d = regras.diretoria
  const metas: Meta[] = []
  if (liga) {
    const alvo = Math.max(1, Math.min(liga.times, Math.round(liga.times * d.meta_posicao[porte]) + d.meta_dificuldade[dificuldade]))
    metas.push({ tipo: 'posicao_liga', alvo, competicao: liga.id, descricao: `Terminar a ${liga.nome} até o ${alvo}º lugar`, critica: true })
  }
  metas.push({ tipo: 'saldo_positivo', alvo: null, competicao: null, descricao: 'Fechar a temporada com saldo positivo', critica: false })
  metas.push({ tipo: 'folha_no_orcamento', alvo: null, competicao: null, descricao: 'Manter a folha dentro do orçamento', critica: false })
  return metas
}

/** Probabilidade de vitória pela força relativa (logística), para a expectativa de pontos. */
export function pontosEsperados(forcaTime: number, forcaAdversario: number, emCasa: boolean): number {
  const dif = forcaTime - forcaAdversario + (emCasa ? 0.6 : -0.6)
  const pV = 1 / (1 + Math.exp(-dif / 1.5))
  const pE = 0.27 * Math.exp(-(dif * dif) / 18)
  const v = Math.max(0, pV - pE / 2)
  return 3 * v + pE
}

const limitar = (v: number) => Math.max(0, Math.min(100, v))

/** Confiança depois de um jogo: k × (pontos obtidos − pontos esperados). */
export function confiancaAposJogo(confianca: number, pontos: number, esperados: number, regras: Regras): number {
  return limitar(confianca + regras.diretoria.peso_jogo * (pontos - esperados))
}

export interface Avaliacao {
  confianca: number
  avaliacoesRuins: number
  demitido: boolean
}

/** Avaliação de cada ciclo: saldo negativo e folha acima do orçamento pesam; abaixo do limite 2× seguidas = demissão. */
export function avaliar(confianca: number, avaliacoesRuins: number, situacao: { saldo: number; folha: number; orcamentoFolha: number }, dificuldade: Dificuldade, regras: Regras): Avaliacao {
  const d = regras.diretoria
  let c = confianca
  if (situacao.saldo < 0) c += d.saldo_negativo
  if (situacao.folha > situacao.orcamentoFolha) c += d.folha_acima
  c = limitar(c)
  const ruins = c < d.limite_demissao[dificuldade] ? avaliacoesRuins + 1 : 0
  return { confianca: c, avaliacoesRuins: ruins, demitido: ruins >= d.avaliacoes_para_demissao }
}

/** Situação do clube no fim da temporada, para conferir as metas. */
export interface FimDeTemporada {
  /** Competição → posição final do time (1 = campeão); ausente = não disputou. */
  posicoes: Readonly<Record<string, number>>
  saldo: number
  folha: number
  orcamentoFolha: number
}

/** A meta foi cumprida? Liga não disputada (ex.: o técnico trocou de clube) conta como perdida. */
export function metaAtingida(m: Meta, f: FimDeTemporada): boolean {
  switch (m.tipo) {
    case 'posicao_liga': {
      const pos = m.competicao ? f.posicoes[m.competicao] : undefined
      return pos !== undefined && pos <= (m.alvo ?? Infinity)
    }
    case 'saldo_positivo':
      return f.saldo >= 0
    case 'folha_no_orcamento':
      return f.folha <= f.orcamentoFolha
  }
}

/** Resultado das metas na virada: confiança sobe/desce; meta crítica perdida = demissão. */
export function fecharMetas(confianca: number, resultados: { meta: Meta; atingida: boolean }[], regras: Regras): { confianca: number; demitido: boolean } {
  let c = confianca
  let demitido = false
  for (const r of resultados) {
    c += r.atingida ? regras.diretoria.meta_atingida : regras.diretoria.meta_perdida
    if (!r.atingida && r.meta.critica) demitido = true
  }
  return { confianca: limitar(c), demitido }
}

/** Clubes que aceitariam o técnico demitido: porte menor ou igual, ordenados do maior porte ao menor. */
export function clubesInteressados<T extends { sigla: string; porte: Porte; pais: string }>(clubes: readonly T[], atual: string, porteAtual: Porte): T[] {
  const ordem: Record<Porte, number> = { pequeno: 0, medio: 1, grande: 2 }
  return clubes
    .filter((c) => c.sigla !== atual && c.pais === 'BRA' && ordem[c.porte] <= ordem[porteAtual])
    .sort((a, b) => ordem[b.porte] - ordem[a.porte] || a.sigla.localeCompare(b.sigla))
}
