import type { Regras } from '../config/padroes'
import { ORDEM_PORTE, type Importancia, type Porte } from './valor'

/**
 * Negociação em duas etapas (06-mercado): primeiro o clube (valor), depois o jogador
 * (salário e duração). Funções puras: recebem a negociação e a proposta, devolvem a nova
 * negociação e a resposta.
 */

export type TipoNegocio = 'compra' | 'emprestimo' | 'livre' | 'renovacao' | 'multa'
export type Etapa = 'clube' | 'jogador' | 'concluida' | 'encerrada'

export interface Movimento {
  quem: 'usuario' | 'clube' | 'jogador'
  etapa: 'clube' | 'jogador'
  tipo: 'proposta' | 'aceita' | 'contraproposta' | 'recusa' | 'encerrada'
  valor: number
}

export interface Negociacao {
  tipo: TipoNegocio
  etapa: Etapa
  /** Clube: quanto pede agora (sobe com a paciência, desce com as contrapropostas). */
  pedida: number
  /** Última contraproposta do clube (a próxima nunca é menor que a oferta que a gerou). */
  ultimaContra: number | null
  recusasSeguidas: number
  valorAcordado: number | null
  /** Jogador: salário mínimo que aceita e a última contraproposta dele. */
  salarioMinimo: number
  ultimaContraSalario: number | null
  salarioAcordado: number | null
  historico: Movimento[]
}

export interface ContextoPedida {
  valor: number
  importancia: Importancia
  porteVendedor: Porte
  porteComprador: Porte
}

/** Pedida inicial do clube vendedor: valor × importância × porte (pequeno vendendo para grande +10%). */
export function pedidaInicial(c: ContextoPedida, regras: Regras): number {
  const m = regras.mercado
  const porte = ORDEM_PORTE[c.porteVendedor] < ORDEM_PORTE[c.porteComprador] ? m.porte_vendedor_menor : 1
  return Math.round(c.valor * m.importancia[c.importancia] * porte)
}

export interface ContextoSalario {
  salarioAtual: number
  /** O jogador muda de clube (compra, empréstimo, livre, multa) ou fica (renovação). */
  mudaDeClube: boolean
  porteAtual: Porte
  porteComprador: Porte
  /** 0-100: moral alta aceita um pouco menos. */
  moral: number
  salarioReferencia: number
}

/** Salário mínimo que o jogador aceita. */
export function salarioMinimoAceito(c: ContextoSalario, regras: Regras): number {
  const m = regras.mercado
  const base = Math.max(c.salarioAtual, c.mudaDeClube ? 0 : c.salarioReferencia * 0.8)
  const mudanca = c.mudaDeClube ? m.jogador_mudanca : 1
  const dif = ORDEM_PORTE[c.porteComprador] - ORDEM_PORTE[c.porteAtual]
  const porte = dif > 0 ? m.jogador_porte_maior : dif < 0 ? m.jogador_porte_menor : 1
  const moral = 1 + 0.1 * ((50 - c.moral) / 50)
  return Math.round(Math.max(base, regras.mercado.salario_minimo) * mudanca * porte * moral)
}

export function iniciarNegociacao(tipo: TipoNegocio, pedida: number, salarioMinimo: number): Negociacao {
  // Livre e renovação começam no jogador; multa: o clube é obrigado a aceitar o valor da multa.
  const semClube = tipo === 'livre' || tipo === 'renovacao'
  return {
    tipo,
    etapa: semClube ? 'jogador' : 'clube',
    pedida,
    ultimaContra: null,
    recusasSeguidas: 0,
    valorAcordado: semClube ? 0 : null,
    salarioMinimo,
    ultimaContraSalario: null,
    salarioAcordado: null,
    historico: [],
  }
}

export type RespostaClube = 'aceita' | 'contraproposta' | 'recusa' | 'encerrada'

/** O clube responde a uma oferta. */
export function proporAoClube(n: Negociacao, oferta: number, regras: Regras): { negociacao: Negociacao; resposta: RespostaClube; valor: number } {
  if (n.etapa !== 'clube') throw new Error('A negociação não está na etapa do clube')
  const m = regras.mercado
  const h = [...n.historico, { quem: 'usuario' as const, etapa: 'clube' as const, tipo: 'proposta' as const, valor: oferta }]
  if (n.tipo === 'multa' || oferta >= n.pedida) {
    const valor = n.tipo === 'multa' ? n.pedida : oferta
    return {
      negociacao: { ...n, etapa: 'jogador', valorAcordado: valor, recusasSeguidas: 0, historico: [...h, { quem: 'clube', etapa: 'clube', tipo: 'aceita', valor }] },
      resposta: 'aceita',
      valor,
    }
  }
  if (oferta >= n.pedida * m.contraproposta_minima) {
    // Meio do caminho entre a oferta e o que pede; a contraproposta desce, mas nunca abaixo da oferta.
    const contra = Math.max(oferta, Math.round((oferta + n.pedida) / 2))
    return {
      negociacao: { ...n, pedida: contra, ultimaContra: contra, recusasSeguidas: 0, historico: [...h, { quem: 'clube', etapa: 'clube', tipo: 'contraproposta', valor: contra }] },
      resposta: 'contraproposta',
      valor: contra,
    }
  }
  const recusas = n.recusasSeguidas + 1
  if (recusas >= m.recusas_maximas) {
    return {
      negociacao: { ...n, etapa: 'encerrada', recusasSeguidas: recusas, historico: [...h, { quem: 'clube', etapa: 'clube', tipo: 'encerrada', valor: n.pedida }] },
      resposta: 'encerrada',
      valor: n.pedida,
    }
  }
  // Paciência: a pedida sobe 5% a cada recusa.
  const pedida = Math.round(n.pedida * m.paciencia)
  return {
    negociacao: { ...n, pedida, recusasSeguidas: recusas, historico: [...h, { quem: 'clube', etapa: 'clube', tipo: 'recusa', valor: pedida }] },
    resposta: 'recusa',
    valor: pedida,
  }
}

/** O jogador responde a uma oferta de salário mensal. */
export function proporAoJogador(n: Negociacao, salario: number, regras: Regras): { negociacao: Negociacao; resposta: RespostaClube; valor: number } {
  if (n.etapa !== 'jogador') throw new Error('A negociação não está na etapa do jogador')
  const m = regras.mercado
  const h = [...n.historico, { quem: 'usuario' as const, etapa: 'jogador' as const, tipo: 'proposta' as const, valor: salario }]
  const pedido = n.ultimaContraSalario ?? n.salarioMinimo
  if (salario >= pedido || salario >= n.salarioMinimo) {
    return {
      negociacao: { ...n, etapa: 'concluida', salarioAcordado: salario, recusasSeguidas: 0, historico: [...h, { quem: 'jogador', etapa: 'jogador', tipo: 'aceita', valor: salario }] },
      resposta: 'aceita',
      valor: salario,
    }
  }
  if (salario >= n.salarioMinimo * m.jogador_contraproposta_minima) {
    const contra = Math.max(salario, Math.round((salario + pedido) / 2))
    return {
      negociacao: { ...n, ultimaContraSalario: contra, salarioMinimo: contra, recusasSeguidas: 0, historico: [...h, { quem: 'jogador', etapa: 'jogador', tipo: 'contraproposta', valor: contra }] },
      resposta: 'contraproposta',
      valor: contra,
    }
  }
  const recusas = n.recusasSeguidas + 1
  if (recusas >= m.recusas_maximas) {
    return {
      negociacao: { ...n, etapa: 'encerrada', recusasSeguidas: recusas, historico: [...h, { quem: 'jogador', etapa: 'jogador', tipo: 'encerrada', valor: pedido }] },
      resposta: 'encerrada',
      valor: pedido,
    }
  }
  return {
    negociacao: { ...n, recusasSeguidas: recusas, historico: [...h, { quem: 'jogador', etapa: 'jogador', tipo: 'recusa', valor: pedido }] },
    resposta: 'recusa',
    valor: pedido,
  }
}

/** Movimentos do usuário entre um jogo e outro (cada proposta gasta 1; propostas recebidas não gastam). */
export class Movimentos {
  constructor(
    public restantes: number,
    private readonly maximo: number,
  ) {}

  gastar(): void {
    if (this.restantes <= 0) throw new Error('Sem movimentos: espere o próximo jogo do seu time.')
    this.restantes--
  }

  /** Depois de cada jogo do usuário. */
  renovar(): void {
    this.restantes = this.maximo
  }
}
