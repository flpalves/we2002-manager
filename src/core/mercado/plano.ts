import type { GrupoPosicao, PerfilFinanceiro, Regras } from '../config/padroes'
import type { Rng } from '../rng'
import { importanciaNoTime } from './valor'

/**
 * Plano de janela dos clubes da CPU (06, "IA de mercado"): perfil financeiro, carências por
 * grupo de posição, quem fica sem espaço e quantas chegadas o clube busca na janela.
 */

export interface FinancasClube {
  saldo: number
  /** Folha mensal atual. */
  folha: number
  orcamentoFolha: number
}

/** crise (saldo negativo ou folha muito acima) · apertado · rico · equilibrado. */
export function perfilFinanceiro(f: FinancasClube, regras: Regras): PerfilFinanceiro {
  const p = regras.mercado.ia.perfil
  const orcamento = Math.max(1, f.orcamentoFolha)
  if (f.saldo < 0 || f.folha > orcamento * p.folha_crise) return 'crise'
  const meses = f.saldo / Math.max(1, f.folha)
  if (meses < p.meses_apertado || f.folha > orcamento * p.folha_apertado) return 'apertado'
  if (meses >= p.meses_rico && f.folha <= orcamento) return 'rico'
  return 'equilibrado'
}

export const GRUPOS: readonly GrupoPosicao[] = ['gol', 'zaga', 'lateral', 'volante', 'meia', 'ataque']

/** Grupo da posição do WE (posição fora dos grupos conta como meia). */
export function grupoDe(posicao: string, regras: Regras): GrupoPosicao {
  const g = regras.mercado.ia.grupos
  return GRUPOS.find((x) => g[x].posicoes.includes(posicao)) ?? 'meia'
}

export interface MembroElenco {
  id: string
  posicao: string
  geral: number
  idade: number
  /** Emprestado ao clube: não é vendido nem listado por ele. */
  emprestado?: boolean
}

/** Elenco separado por grupo, do maior geral para o menor (desempate pelo id, para ser estável). */
export function porGrupo<M extends MembroElenco>(elenco: readonly M[], regras: Regras): Map<GrupoPosicao, M[]> {
  const mapa = new Map<GrupoPosicao, M[]>(GRUPOS.map((g) => [g, []]))
  for (const j of elenco) mapa.get(grupoDe(j.posicao, regras))!.push(j)
  for (const lista of mapa.values()) lista.sort((a, b) => b.geral - a.geral || a.id.localeCompare(b.id))
  return mapa
}

export type MotivoCarencia = 'falta' | 'fraco' | 'abaixo_ideal'

export interface Carencia {
  grupo: GrupoPosicao
  motivo: MotivoCarencia
  /** Geral que o reforço precisa superar. */
  referencia: number
}

const PRIORIDADE: Record<MotivoCarencia, number> = { falta: 0, fraco: 1, abaixo_ideal: 2 }

/**
 * Carências em ordem: grupo abaixo do mínimo, titular do grupo bem abaixo da média dos
 * titulares do time, grupo abaixo do ideal. Um grupo aparece uma vez só (o motivo mais grave).
 */
export function carencias(elenco: readonly MembroElenco[], regras: Regras): Carencia[] {
  const g = regras.mercado.ia.grupos
  const grupos = porGrupo(elenco, regras)
  const titulares = [...elenco].sort((a, b) => b.geral - a.geral).slice(0, regras.mercado.titulares)
  const media = titulares.length ? titulares.reduce((a, j) => a + j.geral, 0) / titulares.length : 0
  const lista: (Carencia & { ordem: number })[] = []
  for (const grupo of GRUPOS) {
    const membros = grupos.get(grupo)!
    const melhor = membros[0]?.geral ?? 0
    const pior = membros[membros.length - 1]?.geral ?? 0
    // Para completar o grupo basta um reserva útil: até 3 abaixo da média dos titulares (ou o
    // pior do grupo, se ele for ainda mais fraco).
    const completar = Math.max(0, Math.min(membros.length ? pior : 99, Math.floor(media) - 3) - 1)
    let c: Carencia | null = null
    if (membros.length < g[grupo].minimo) c = { grupo, motivo: 'falta', referencia: completar }
    else if (melhor < media - regras.mercado.carencia_geral) c = { grupo, motivo: 'fraco', referencia: melhor }
    else if (membros.length < g[grupo].ideal) c = { grupo, motivo: 'abaixo_ideal', referencia: completar }
    if (c) lista.push({ ...c, ordem: PRIORIDADE[c.motivo] * 100 + c.referencia })
  }
  return lista.sort((a, b) => a.ordem - b.ordem).map((c) => ({ grupo: c.grupo, motivo: c.motivo, referencia: c.referencia }))
}

/**
 * Quem fica sem espaço: em cada grupo, quem passa do ideal na ordem de geral (pode ser um
 * jogador de geral alto, se o grupo está cheio de gente melhor). Emprestados não contam.
 */
export function semEspaco<M extends MembroElenco>(elenco: readonly M[], regras: Regras, grupo?: GrupoPosicao): M[] {
  const g = regras.mercado.ia.grupos
  const fora: M[] = []
  for (const [nome, membros] of porGrupo(elenco, regras)) {
    if (grupo && nome !== grupo) continue
    fora.push(...membros.slice(g[nome].ideal).filter((j) => !j.emprestado))
  }
  return fora
}

/**
 * Saídas previstas no fim da temporada (janelas depois da principal): quem tem contrato
 * acabando, pesado pela chance de a CPU não renovar, × peso da previsão.
 */
export function saidasPrevistas(elenco: readonly (MembroElenco & { ateTemporada: number })[], temporada: number, regras: Regras): number {
  const gerais = elenco.map((j) => j.geral)
  const r = regras.virada.renovacao_cpu
  const esperado = elenco
    .filter((j) => j.ateTemporada <= temporada && !j.emprestado)
    .reduce((a, j) => a + 1 - r[importanciaNoTime(j.geral, gerais, regras)], 0)
  return esperado * regras.mercado.ia.peso_saida_prevista
}

export interface EntradaChegadas {
  principal: boolean
  carencias: number
  /** Saídas a repor (fim de contrato na virada ou previsão). */
  saidas: number
  perfil: PerfilFinanceiro
  intensidade: 'baixa' | 'media' | 'alta'
  /** Tamanho do elenco hoje (o alvo nunca passa do elenco máximo). */
  tamanho: number
}

/**
 * Chegadas-alvo da janela = (base + peso × carências + peso × saídas) × perfil × intensidade,
 * arredondado com sorteio (a parte fracionária é a chance de +1) e limitado.
 */
export function chegadasAlvo(e: EntradaChegadas, regras: Regras, rng: Rng): number {
  const ia = regras.mercado.ia
  const c = e.principal ? ia.chegadas.principal : ia.chegadas.outras
  const bruto = (c.base + c.por_carencia * e.carencias + c.por_saida * e.saidas) * ia.fator_perfil_chegadas[e.perfil] * regras.mercado.intensidade[e.intensidade]
  const inteiro = Math.floor(bruto) + (rng.chance(bruto - Math.floor(bruto)) ? 1 : 0)
  const espaco = Math.max(0, regras.mercado.elenco_maximo - e.tamanho)
  return Math.min(espaco, Math.max(c.minimo, Math.min(c.maximo, inteiro)))
}
