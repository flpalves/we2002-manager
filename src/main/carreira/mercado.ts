import type { Regras } from '@core/config/padroes'
import { geral } from '@core/jogadores/conversao'
import { dentroDaJanela, responderContraproposta } from '@core/mercado/ia'
import {
  iniciarNegociacao,
  pedidaInicial,
  proporAoClube,
  proporAoJogador,
  salarioMinimoAceito,
  type Negociacao,
  type TipoNegocio,
} from '@core/mercado/negociacao'
import { fatorSerieSalarioDoTime, importanciaNoTime, multaPadrao, salarioReferencia, type Porte } from '@core/mercado/valor'
import { paraAscii } from '@core/texto'
import type { Atributos, Competicao } from '@shared/esquemas/pacote'
import type { JogadorMercadoDto, NegociacaoDto, PropostaRecebida, ResultadoContraproposta, SituacaoMercado } from '@shared/esquemas/mercado'
import type { z } from 'zod'
import type { FiltrosMercadoSchema, PropostaSchema } from '@shared/esquemas/mercado'
import { ErroApp } from '../ipc/registrar'
import { registrarInfo } from './noticias'
import { preContrato as noticiaPreContrato, transferencia as noticiaTransferencia } from '@core/noticias/informativas'
import { ligasDosTimes } from './economia'
import { nivelClube } from '@core/mercado/nivel'
import { dinheiro } from '@shared/dinheiro'
import type { Sql } from '../db/sql'

/**
 * Mercado do usuário (06): busca, negociação em duas etapas com o limite de movimentos,
 * propostas recebidas da CPU. As contas vêm do núcleo; aqui só banco e regras de acesso.
 */

export type Filtros = z.infer<typeof FiltrosMercadoSchema>
export type Proposta = z.infer<typeof PropostaSchema>

interface Carreira {
  time_usuario: string
  temporada_atual: number
  passo_atual: number
  movimentos: number
  demitido: number
}

export function regrasDe(sql: Sql): Regras {
  return JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados) as Regras
}

export function carreiraDe(sql: Sql): Carreira {
  return sql.get<Carreira>('SELECT time_usuario, temporada_atual, passo_atual, movimentos, demitido FROM carreira')!
}

/** Semana em que o tempo está (o Continuar anda uma por vez; 1 antes da primeira). */
export function semanaAgora(sql: Sql): number {
  return Math.max(1, sql.get<{ semana_processada: number }>('SELECT semana_processada FROM carreira')?.semana_processada ?? 0)
}

export function folhaDe(sql: Sql, sigla: string): number {
  return (
    sql.get<{ f: number | null }>('SELECT SUM(c.salario_mensal) f FROM contrato c JOIN time t ON t.id = c.time_id WHERE t.sigla = ?', sigla)?.f ?? 0
  )
}

function tamanhoElenco(sql: Sql, sigla: string): number {
  return sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'", sigla)?.n ?? 0
}

/** Elenco do clube na temporada seguinte: contrato depois desta (sem pré-contrato com outro) + os pré-contratos assinados. */
function elencoSeguinte(sql: Sql, sigla: string, temporada: number): number {
  const ficam =
    sql.get<{ n: number }>(
      `SELECT COUNT(*) n FROM jogador j JOIN time t ON t.id = j.time_id JOIN contrato c ON c.jogador_id = j.id
        WHERE t.sigla = ? AND j.status = 'ativo' AND c.ate_temporada > ? AND c.tipo = 'definitivo'
          AND NOT EXISTS (SELECT 1 FROM pre_contrato pc WHERE pc.jogador_id = j.id AND pc.temporada = ?)`,
      sigla, temporada, temporada,
    )?.n ?? 0
  const chegam = sql.get<{ n: number }>('SELECT COUNT(*) n FROM pre_contrato WHERE para = ? AND temporada = ?', sigla, temporada)?.n ?? 0
  return ficam + chegam
}

export type Intensidade = 'baixa' | 'media' | 'alta'

/** Intensidade da IA de mercado (Configurações, por carreira). */
export function intensidade(sql: Sql): Intensidade {
  return sql.get<{ intensidade_mercado: Intensidade }>('SELECT intensidade_mercado FROM carreira')!.intensidade_mercado
}

export function definirIntensidade(sql: Sql, v: Intensidade): Intensidade {
  sql.run('UPDATE carreira SET intensidade_mercado = ?', v)
  return intensidade(sql)
}

export function situacao(sql: Sql): SituacaoMercado {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const semana = semanaAgora(sql)
  const t = sql.get<{ saldo: number; orcamento_folha_mensal: number }>('SELECT saldo, orcamento_folha_mensal FROM time WHERE sigla = ?', c.time_usuario)!
  return {
    movimentos: c.movimentos,
    movimentosMaximo: r.mercado.movimentos_por_jogo,
    janelaAberta: dentroDaJanela(semana, r),
    janelas: r.mercado.janelas,
    semana,
    saldo: t.saldo,
    folha: folhaDe(sql, c.time_usuario),
    orcamentoFolha: t.orcamento_folha_mensal,
    elenco: tamanhoElenco(sql, c.time_usuario),
    elencoMinimo: r.mercado.elenco_minimo,
    elencoMaximo: r.mercado.elenco_maximo,
    demitido: !!c.demitido,
    semanaLimiteRenovacao: r.mercado.pre_contrato.semana_limite_renovacao,
  }
}

// ------------------------------------------------------------------ jogadores

interface LinhaMercado {
  id: number
  nome: string
  sigla: string | null
  porte: Porte | null
  posicao: string
  idade: number
  potencial: number
  atributos: string
  moral: number
  valor: number
  status: string
  salario_mensal: number | null
  ate_temporada: number | null
  multa: number | null
  contrato_tipo: string | null
  a_venda: string | null
  saldo_time: number | null
  /** Disponível do exterior (06): taxa fixa e origem; nulos para os outros. */
  taxa_fixa: number | null
  origem_clube: string | null
  origem_pais: string | null
  /** Pré-contrato assinado nesta temporada: clube de destino. */
  pre_contrato: string | null
}

const SELECT_MERCADO = `
  SELECT j.id, j.nome, t.sigla, t.porte, j.posicao, j.idade, j.potencial, j.atributos, j.moral, j.valor, j.status, j.a_venda, t.saldo AS saldo_time,
         j.taxa_fixa, j.origem_clube, j.origem_pais, c.salario_mensal, c.ate_temporada, c.multa, c.tipo AS contrato_tipo, pc.para AS pre_contrato
    FROM jogador j LEFT JOIN time t ON t.id = j.time_id LEFT JOIN contrato c ON c.jogador_id = j.id
    LEFT JOIN pre_contrato pc ON pc.jogador_id = j.id AND pc.temporada = (SELECT temporada_atual FROM carreira)`

function paraDto(l: LinhaMercado, regras: Regras, usuario: string): JogadorMercadoDto {
  return {
    id: String(l.id),
    nome: l.nome,
    time: l.sigla,
    posicao: l.posicao,
    idade: l.idade,
    geral: geral(JSON.parse(l.atributos) as Atributos, l.posicao, regras),
    valor: l.valor,
    salario: l.salario_mensal ?? 0,
    contratoAte: l.ate_temporada,
    multa: l.multa ?? multaPadrao(l.valor, regras),
    doUsuario: l.sigla === usuario,
    aVenda: l.sigla ? (l.a_venda as JogadorMercadoDto['aVenda']) : null,
    origem: l.status === 'exterior' && l.origem_clube ? { clube: l.origem_clube, pais: l.origem_pais ?? '' } : null,
    taxa: l.status === 'exterior' ? l.taxa_fixa : null,
    preContrato: l.pre_contrato,
  }
}

/** Fator de série do salário do clube que vai pagar: as ligas em que ele joga na temporada atual. */
function fatorSalarialDoTime(sql: Sql, sigla: string, regras: Regras): number {
  const t = sql.get<{ pais: string; fator_valor: number | null }>('SELECT t.pais, p.fator_valor FROM time t LEFT JOIN pais p ON p.codigo = t.pais WHERE t.sigla = ?', sigla)
  const ligas = sql
    .all<{ c: string }>(
      `SELECT DISTINCT e.competicao_id c FROM partida p JOIN edicao e ON e.id = p.edicao_id
        WHERE p.temporada = (SELECT temporada_atual FROM carreira) AND (p.casa = ? OR p.visitante = ?)`,
      sigla,
      sigla,
    )
    .map((l) => l.c)
  return fatorSerieSalarioDoTime(ligas, t?.pais ?? 'BRA', t?.fator_valor ?? 1, regras)
}

/** Nível do clube na temporada (06, "Nível do clube"): pelas ligas nacionais da competição; null = livre/sem clube. */
function nivelDoTime(sql: Sql, sigla: string | null, regras: Regras): number | undefined {
  if (!sigla) return undefined
  const t = sql.get<{ pais: string }>('SELECT pais FROM time WHERE sigla = ?', sigla)
  if (!t) return undefined
  const competicoes = sql.all<{ definicao: string }>('SELECT definicao FROM competicao').map((x) => JSON.parse(x.definicao) as Competicao)
  return nivelClube(ligasDosTimes(competicoes).get(sigla) ?? [], t.pais, regras)
}

/** Salário de referência do jogador se for jogar no clube `pagador` (06). */
function salarioReferenciaPara(sql: Sql, l: LinhaMercado, pagador: string, regras: Regras): number {
  const g = geral(JSON.parse(l.atributos) as Atributos, l.posicao, regras)
  return salarioReferencia({ geral: g, idade: l.idade, potencial: l.potencial, fatorSerieSalario: fatorSalarialDoTime(sql, pagador, regras) }, regras)
}

function linha(sql: Sql, id: string): LinhaMercado {
  const l = sql.get<LinhaMercado>(`${SELECT_MERCADO} WHERE j.id = ?`, Number(id))
  if (!l) throw new ErroApp('jogador_inexistente', 'Jogador não encontrado.')
  return l
}

/** Busca no mercado (todos os clubes, os livres e os do exterior), do maior geral para o menor; até 200. */
export function buscar(sql: Sql, f: Filtros): JogadorMercadoDto[] {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const nome = f.nome ? paraAscii(f.nome).toLowerCase() : null
  return sql
    // 'fora' (saiu do pool do exterior) não aparece em busca nenhuma.
    .all<LinhaMercado>(`${SELECT_MERCADO} WHERE j.status IN ('ativo', 'livre', 'exterior')`)
    .map((l) => paraDto(l, r, c.time_usuario))
    .filter(
      (j) =>
        (!nome || paraAscii(j.nome).toLowerCase().includes(nome)) &&
        (!f.posicao || j.posicao === f.posicao) &&
        (f.geralMin === undefined || j.geral >= f.geralMin) &&
        (f.idadeMax === undefined || j.idade <= f.idadeMax) &&
        (f.valorMax === undefined || j.valor <= f.valorMax) &&
        (!f.somenteLivres || j.time === null) &&
        (!f.somenteExterior || j.taxa != null) &&
        (!f.somenteAVenda || j.aVenda !== null) &&
        (!f.somenteMeus || j.doUsuario) &&
        (!f.somenteFimDeContrato || (j.time !== null && !j.preContrato && j.contratoAte !== null && j.contratoAte <= c.temporada_atual)),
    )
    .sort((a, b) => b.geral - a.geral || a.valor - b.valor || a.nome.localeCompare(b.nome))
    .slice(0, 200)
}

/** O momento do mercado para o usuário: janela, prazo de renovação e se o clube pode assinar pré-contrato. */
interface Momento {
  usuario: string
  temporada: number
  janela: boolean
  /** Passou da semana limite de renovação. */
  prazoEncerrado: boolean
  /** O clube do usuário joga uma liga nacional (A, B, C): pode assinar pré-contrato. */
  ligaNacional: boolean
}

function momento(sql: Sql): Momento {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const semana = semanaAgora(sql)
  const competicoes = new Map(
    sql.all<{ id: string; definicao: string }>('SELECT id, definicao FROM competicao').map((x) => [x.id, JSON.parse(x.definicao) as Competicao]),
  )
  return {
    usuario: c.time_usuario,
    temporada: c.temporada_atual,
    janela: dentroDaJanela(semana, r),
    prazoEncerrado: semana > r.mercado.pre_contrato.semana_limite_renovacao,
    ligaNacional: (ligasDosTimes(competicoes).get(c.time_usuario)?.length ?? 0) > 0,
  }
}

/** O contrato termina nesta temporada (definitivo). */
const acabaAgora = (l: LinhaMercado, temporada: number) => l.contrato_tipo !== 'emprestimo' && l.ate_temporada !== null && l.ate_temporada <= temporada

/**
 * Tipos de negócio possíveis agora: fora da janela, só livres e renovações (o exterior, só na
 * janela). Contrato acabando: renova só até a semana limite; depois dela, outros clubes da liga
 * nacional assinam pré-contrato (o do usuário inclusive).
 */
function tiposPossiveis(l: LinhaMercado, m: Momento): TipoNegocio[] {
  if (l.status === 'fora') return []
  if (l.status === 'exterior') return m.janela ? ['exterior'] : []
  if (l.pre_contrato) return []
  if (l.sigla === m.usuario) {
    if (l.contrato_tipo === 'emprestimo') return []
    return m.prazoEncerrado && acabaAgora(l, m.temporada) ? [] : ['renovacao']
  }
  if (!l.sigla) return ['livre']
  const tipos: TipoNegocio[] = m.janela ? ['compra', 'emprestimo', 'multa'] : []
  if (m.prazoEncerrado && m.ligaNacional && acabaAgora(l, m.temporada)) tipos.push('pre_contrato')
  return tipos
}

/** Por que não dá para negociar o jogador agora. */
function motivoIndisponivel(sql: Sql, l: LinhaMercado, possiveis: TipoNegocio[], m: Momento): string {
  if (l.status === 'exterior') return 'Do exterior: só na janela de transferências.'
  if (l.status === 'fora') return 'Jogador fora do mercado.'
  if (l.pre_contrato) {
    const destino = sql.get<{ n: string }>('SELECT nome_curto n FROM time WHERE sigla = ?', l.pre_contrato)?.n ?? l.pre_contrato
    return l.pre_contrato === m.usuario ? 'Pré-contrato assinado: ele chega na próxima temporada.' : `Assinou pré-contrato com o ${destino}: sai no fim da temporada.`
  }
  if (l.sigla === m.usuario && m.prazoEncerrado && acabaAgora(l, m.temporada)) return 'O prazo de renovação acabou: ele sai no fim da temporada.'
  if (l.sigla && acabaAgora(l, m.temporada) && m.prazoEncerrado && !m.ligaNacional) return 'Pré-contrato só para clubes das ligas nacionais.'
  return possiveis.length ? 'Tipo de negócio indisponível para este jogador.' : 'Fora da janela: só jogadores livres e renovações.'
}

/** O saldo do usuário cobre a taxa do exterior? (06: saldo negativo bloqueia.) */
function cobreTaxa(sql: Sql, l: LinhaMercado, usuario: string): boolean {
  const saldo = sql.get<{ saldo: number }>('SELECT saldo FROM time WHERE sigla = ?', usuario)!.saldo
  return saldo >= 0 && saldo >= (l.taxa_fixa ?? 0)
}

// ------------------------------------------------------------------ negociação

interface LinhaNegociacao {
  id: number
  jogador_id: number
  tipo: TipoNegocio
  estado: string
}

function negociacaoAberta(sql: Sql, jogador: string): LinhaNegociacao | null {
  return sql.get<LinhaNegociacao>('SELECT id, jogador_id, tipo, estado FROM negociacao WHERE jogador_id = ? AND aberta = 1 ORDER BY id DESC', Number(jogador)) ?? null
}

/** Pedida do clube e salário mínimo do jogador para o tipo de negócio. */
function iniciar(sql: Sql, l: LinhaMercado, tipo: TipoNegocio, regras: Regras, usuario: string): Negociacao {
  const comprador = sql.get<{ porte: Porte }>('SELECT porte FROM time WHERE sigla = ?', usuario)!.porte
  const porteAtual = l.porte ?? comprador
  const nivelUsuario = nivelDoTime(sql, usuario, regras)
  const nivelAtual = nivelDoTime(sql, l.sigla, regras) ?? nivelUsuario
  const ref = salarioReferenciaPara(sql, l, usuario, regras)
  const salarioAtual = l.salario_mensal ?? 0
  let pedida = 0
  if (tipo === 'compra' || tipo === 'emprestimo') {
    const gerais = sql
      .all<{ atributos: string; posicao: string }>("SELECT j.atributos, j.posicao FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'", l.sigla)
      .map((x) => geral(JSON.parse(x.atributos) as Atributos, x.posicao, regras))
    const g = geral(JSON.parse(l.atributos) as Atributos, l.posicao, regras)
    pedida = pedidaInicial(
      { valor: l.valor, importancia: importanciaNoTime(g, gerais, regras), porteVendedor: porteAtual, porteComprador: comprador, nivelVendedor: nivelAtual, nivelComprador: nivelUsuario },
      regras,
    )
    // À venda: desconto na pedida (maior se o vendedor está no vermelho).
    if (l.a_venda) pedida = Math.round(pedida * ((l.saldo_time ?? 0) < 0 ? regras.mercado.ia.desconto_crise : regras.mercado.ia.desconto_a_venda))
    if (tipo === 'emprestimo') pedida = Math.round(pedida * regras.mercado.taxa_emprestimo)
  } else if (tipo === 'multa') {
    pedida = l.multa ?? multaPadrao(l.valor, regras)
  } else if (tipo === 'exterior') {
    pedida = l.taxa_fixa ?? 0
  }
  const semClube = tipo === 'livre' || tipo === 'exterior'
  const salarioMinimo = salarioMinimoAceito(
    {
      salarioAtual: semClube ? 0 : salarioAtual,
      mudaDeClube: tipo !== 'renovacao',
      porteAtual,
      porteComprador: comprador,
      moral: l.moral,
      salarioReferencia: ref,
      nivelAtual,
      nivelComprador: nivelUsuario,
    },
    regras,
  )
  // Livre não tem salário atual: pede pelo menos o de referência do valor dele. Quem vem do
  // exterior quer ganhar mais para vir (× exterior.premio_salarial).
  const piso = tipo === 'livre' ? ref : tipo === 'exterior' ? Math.round(ref * regras.exterior.premio_salarial) : 0
  return iniciarNegociacao(tipo, pedida, Math.max(salarioMinimo, piso))
}

function paraNegociacaoDto(sql: Sql, id: number | null, l: LinhaMercado, n: Negociacao, mensagem: string | null): NegociacaoDto {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  return {
    id,
    jogador: paraDto(l, r, c.time_usuario),
    tipo: n.tipo,
    etapa: n.etapa,
    pedida: n.pedida,
    valorAcordado: n.valorAcordado,
    contraSalario: n.ultimaContraSalario,
    historico: n.historico,
    tiposPossiveis: tiposPossiveis(l, momento(sql)),
    mensagem,
  }
}

/** Abre (ou retoma) a negociação de um jogador. Abrir não gasta movimento. */
export function negociacao(sql: Sql, jogador: string, tipo?: TipoNegocio): NegociacaoDto {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const l = linha(sql, jogador)
  const mo = momento(sql)
  const possiveis = tiposPossiveis(l, mo)
  const aberta = negociacaoAberta(sql, jogador)
  if (aberta && (!tipo || tipo === aberta.tipo)) return paraNegociacaoDto(sql, aberta.id, l, JSON.parse(aberta.estado) as Negociacao, null)
  const escolhido = tipo ?? possiveis[0]
  if (!escolhido || !possiveis.includes(escolhido)) {
    const n = iniciarNegociacao(escolhido ?? 'compra', 0, 0)
    return paraNegociacaoDto(sql, null, l, { ...n, etapa: 'encerrada' }, motivoIndisponivel(sql, l, possiveis, mo))
  }
  const n = iniciar(sql, l, escolhido, r, c.time_usuario)
  // Exterior: sem caixa para a taxa, não dá para começar a negociação.
  if (escolhido === 'exterior' && !cobreTaxa(sql, l, c.time_usuario)) return paraNegociacaoDto(sql, null, l, { ...n, etapa: 'encerrada' }, 'Sem caixa para a taxa.')
  // Trocar de tipo encerra a negociação anterior (a nova começa do zero).
  if (aberta) sql.run('UPDATE negociacao SET aberta = 0 WHERE id = ?', aberta.id)
  return paraNegociacaoDto(sql, null, l, n, null)
}

/**
 * Proposta do usuário (ao clube ou ao jogador, conforme a etapa). Gasta 1 movimento.
 * Concluída a etapa do jogador, o negócio é executado.
 */
export function propor(sql: Sql, p: Proposta): NegociacaoDto {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  if (c.demitido) throw new ErroApp('demitido', 'Você foi demitido: escolha um novo clube antes de negociar.')
  const l = linha(sql, p.jogadorId)
  const mo = momento(sql)
  const possiveis = tiposPossiveis(l, mo)
  if (!possiveis.includes(p.tipo)) throw new ErroApp('negocio_indisponivel', motivoIndisponivel(sql, l, possiveis, mo))
  // A taxa só sai do caixa no fechamento, mas sem caixa para ela a negociação nem começa (nem segue).
  if (p.tipo === 'exterior' && !cobreTaxa(sql, l, c.time_usuario)) throw new ErroApp('sem_caixa', 'Sem caixa para a taxa.')
  if (c.movimentos <= 0) throw new ErroApp('sem_movimentos', 'Sem movimentos: espere o próximo jogo do seu time.')

  const aberta = negociacaoAberta(sql, p.jogadorId)
  let n = aberta && aberta.tipo === p.tipo ? (JSON.parse(aberta.estado) as Negociacao) : iniciar(sql, l, p.tipo, r, c.time_usuario)
  if (n.etapa === 'encerrada' || n.etapa === 'concluida') n = iniciar(sql, l, p.tipo, r, c.time_usuario)

  const saldo = sql.get<{ saldo: number; orcamento_folha_mensal: number }>('SELECT saldo, orcamento_folha_mensal FROM time WHERE sigla = ?', c.time_usuario)!
  const chegando = p.tipo !== 'renovacao'
  // Pré-contrato conta no elenco da temporada seguinte (quem fica + quem já assinou).
  const tamanho = p.tipo === 'pre_contrato' ? elencoSeguinte(sql, c.time_usuario, c.temporada_atual) : tamanhoElenco(sql, c.time_usuario)
  if (chegando && tamanho >= r.mercado.elenco_maximo) {
    throw new ErroApp('elenco_cheio', `Elenco cheio (${r.mercado.elenco_maximo} jogadores${p.tipo === 'pre_contrato' ? ' na próxima temporada' : ''}).`)
  }

  let mensagem: string
  if (n.etapa === 'clube') {
    const valor = p.valor ?? 0
    if (saldo.saldo < 0) throw new ErroApp('saldo_negativo', 'Saldo negativo: só dá para contratar livres.')
    if (valor > saldo.saldo || (p.tipo === 'multa' && n.pedida > saldo.saldo)) throw new ErroApp('sem_saldo', 'A proposta passa do saldo do clube.')
    const res = proporAoClube(n, valor, r)
    n = res.negociacao
    mensagem =
      res.resposta === 'aceita'
        ? 'O clube aceitou. Agora negocie com o jogador.'
        : res.resposta === 'contraproposta'
          ? 'O clube fez uma contraproposta.'
          : res.resposta === 'recusa'
            ? 'O clube recusou e agora pede mais.'
            : 'O clube encerrou a negociação.'
  } else if (n.etapa === 'jogador') {
    const salario = p.salario ?? 0
    // Saldo negativo: livre só com salário dentro do orçamento da folha.
    const semTaxa = p.tipo === 'livre' || p.tipo === 'pre_contrato'
    if (saldo.saldo < 0 && (!semTaxa || folhaDe(sql, c.time_usuario) + salario > saldo.orcamento_folha_mensal)) {
      throw new ErroApp('saldo_negativo', 'Saldo negativo: só livres com salário dentro do orçamento da folha.')
    }
    const res = proporAoJogador(n, salario, r)
    n = res.negociacao
    mensagem =
      res.resposta === 'aceita'
        ? 'Negócio fechado!'
        : res.resposta === 'contraproposta'
          ? 'O jogador fez uma contraproposta de salário.'
          : res.resposta === 'recusa'
            ? 'O jogador recusou.'
            : 'O jogador encerrou a negociação.'
  } else {
    throw new ErroApp('negociacao_encerrada', 'Esta negociação já terminou.')
  }

  let id: number | null = aberta && aberta.tipo === p.tipo ? aberta.id : null
  sql.transacao(() => {
    sql.run('UPDATE carreira SET movimentos = movimentos - 1')
    if (aberta && aberta.tipo !== p.tipo) sql.run('UPDATE negociacao SET aberta = 0 WHERE id = ?', aberta.id)
    const fim = n.etapa === 'concluida' || n.etapa === 'encerrada'
    if (id === null) {
      sql.run('INSERT INTO negociacao (jogador_id, tipo, estado, aberta, temporada, semana) VALUES (?, ?, ?, ?, ?, ?)', Number(p.jogadorId), p.tipo, JSON.stringify(n), fim ? 0 : 1, c.temporada_atual, semanaAgora(sql))
      id = sql.get<{ id: number }>('SELECT MAX(id) id FROM negociacao')!.id
    } else {
      sql.run('UPDATE negociacao SET estado = ?, aberta = ? WHERE id = ?', JSON.stringify(n), fim ? 0 : 1, id)
    }
    if (n.etapa === 'concluida') executar(sql, l, n, p.temporadas ?? 2, r)
  })
  return paraNegociacaoDto(sql, id, linha(sql, p.jogadorId), n, mensagem)
}

/** Primeira camisa livre (1-32) no time, mantendo a atual se estiver livre. */
export function camisaLivre(sql: Sql, sigla: string, atual: number, jogadorId: number): number {
  const usadas = new Set(sql.all<{ camisa: number }>('SELECT j.camisa FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.id <> ?', sigla, jogadorId).map((x) => x.camisa))
  if (atual >= 1 && atual <= 32 && !usadas.has(atual)) return atual
  for (let n = 1; n <= 32; n++) if (!usadas.has(n)) return n
  return atual
}

/** Muda o jogador de clube com contrato novo, registra a transferência e o dinheiro. */
export function transferir(
  sql: Sql,
  t: { jogador: number; de: string | null; para: string; tipo: TipoNegocio | 'venda'; valor: number; salario: number; ateTemporada: number; multa: number; emprestimo: boolean },
): void {
  const c = carreiraDe(sql)
  const semana = semanaAgora(sql)
  const { camisa, origem_clube: origem } = sql.get<{ camisa: number; origem_clube: string | null }>('SELECT camisa, origem_clube FROM jogador WHERE id = ?', t.jogador)!
  // Quem chega do exterior perde a taxa e a origem: se sair do clube depois, vira livre (06).
  sql.run(
    "UPDATE jogador SET time_id = (SELECT id FROM time WHERE sigla = ?), status = 'ativo', camisa = ?, a_venda = NULL, taxa_fixa = NULL, origem_clube = NULL, origem_pais = NULL WHERE id = ?",
    t.para, camisaLivre(sql, t.para, camisa, t.jogador), t.jogador,
  )
  sql.run('DELETE FROM contrato WHERE jogador_id = ?', t.jogador)
  sql.run(
    'INSERT INTO contrato (jogador_id, time_id, salario_mensal, ate_temporada, multa, tipo, time_origem_id) VALUES (?, (SELECT id FROM time WHERE sigla = ?), ?, ?, ?, ?, (SELECT id FROM time WHERE sigla = ?))',
    t.jogador, t.para, t.salario, t.ateTemporada, t.multa, t.emprestimo ? 'emprestimo' : 'definitivo', t.emprestimo ? t.de : null,
  )
  sql.run('INSERT INTO transferencia (temporada, semana, jogador_id, de, para, tipo, valor, salario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', c.temporada_atual, semana, t.jogador, t.de, t.para, t.tipo, t.valor, t.salario)
  const nomeTime = (x: string) => sql.get<{ n: string }>('SELECT nome_curto n FROM time WHERE sigla = ?', x)?.n ?? x
  const nomeJ = sql.get<{ nome: string }>('SELECT nome FROM jogador WHERE id = ?', t.jogador)!.nome
  registrarInfo(sql, c.temporada_atual, semana, noticiaTransferencia({ jogador: nomeJ, jogadorId: String(t.jogador), de: t.de && nomeTime(t.de), para: nomeTime(t.para), valor: t.valor, emprestimo: t.emprestimo, ...(t.tipo === 'exterior' && origem && { exterior: origem }) }, dinheiro))
  if (t.valor > 0) {
    const nome = sql.get<{ nome: string }>('SELECT nome FROM jogador WHERE id = ?', t.jogador)!.nome
    const cat = t.emprestimo ? 'emprestimo' : null
    const rotulo = t.emprestimo ? 'Empréstimo' : t.tipo === 'exterior' ? `Do exterior${origem ? ` (${origem})` : ''}` : 'Compra'
    lancar(sql, t.para, cat ?? 'transferencia_saida', -t.valor, `${rotulo}: ${nome}`, semana, c.temporada_atual)
    if (t.de) lancar(sql, t.de, cat ?? 'transferencia_entrada', t.valor, `${t.emprestimo ? 'Empréstimo' : 'Venda'}: ${nome}`, semana, c.temporada_atual)
  }
}

function lancar(sql: Sql, time: string, categoria: string, valor: number, descricao: string, semana: number, temporada: number): void {
  sql.run('INSERT INTO lancamento_financeiro (temporada, semana, time, categoria, valor, descricao) VALUES (?, ?, ?, ?, ?, ?)', temporada, semana, time, categoria, valor, descricao)
  sql.run('UPDATE time SET saldo = saldo + ? WHERE sigla = ?', valor, time)
}

/** Executa o negócio fechado pelo usuário. */
function executar(sql: Sql, l: LinhaMercado, n: Negociacao, temporadas: number, r: Regras): void {
  const c = carreiraDe(sql)
  const salario = n.salarioAcordado ?? 0
  if (n.tipo === 'renovacao') {
    sql.run('UPDATE contrato SET salario_mensal = ?, ate_temporada = ? WHERE jogador_id = ?', salario, c.temporada_atual + temporadas, l.id)
    return
  }
  if (n.tipo === 'pre_contrato') {
    // Sem taxa e sem mudar agora: a virada leva o jogador com este contrato (começa na temporada seguinte).
    const semana = semanaAgora(sql)
    sql.run(
      'INSERT OR REPLACE INTO pre_contrato (jogador_id, de, para, salario_mensal, ate_temporada, temporada, semana) VALUES (?, ?, ?, ?, ?, ?, ?)',
      l.id, l.sigla, c.time_usuario, salario, c.temporada_atual + temporadas, c.temporada_atual, semana,
    )
    const nomeTime = (x: string) => sql.get<{ n: string }>('SELECT nome_curto n FROM time WHERE sigla = ?', x)?.n ?? x
    registrarInfo(sql, c.temporada_atual, semana, noticiaPreContrato({ jogador: l.nome, jogadorId: String(l.id), de: nomeTime(l.sigla!), para: nomeTime(c.time_usuario), doUsuario: 'chega' }))
    return
  }
  const emprestimo = n.tipo === 'emprestimo'
  transferir(sql, {
    jogador: l.id,
    de: l.sigla,
    para: c.time_usuario,
    tipo: n.tipo,
    valor: n.valorAcordado ?? 0,
    salario,
    // Empréstimo vai até o fim da temporada; o resto pela duração combinada.
    ateTemporada: emprestimo ? c.temporada_atual : c.temporada_atual + temporadas,
    multa: multaPadrao(l.valor, r),
    emprestimo,
  })
}

// ------------------------------------------------------------------ lista de venda

/** Põe (ou tira) um jogador do usuário na lista de venda: ele atrai mais propostas da CPU. */
export function definirAVenda(sql: Sql, jogadorId: string, aVenda: boolean): JogadorMercadoDto {
  const c = carreiraDe(sql)
  const l = linha(sql, jogadorId)
  if (l.sigla !== c.time_usuario) throw new ErroApp('jogador_de_outro_time', 'Só dá para pôr à venda jogadores do seu elenco.')
  if (l.contrato_tipo === 'emprestimo') throw new ErroApp('jogador_emprestado', 'Jogador emprestado não pode ser posto à venda.')
  sql.run('UPDATE jogador SET a_venda = ? WHERE id = ?', aVenda ? 'usuario' : null, l.id)
  return paraDto(linha(sql, jogadorId), regrasDe(sql), c.time_usuario)
}

// ------------------------------------------------------------------ propostas recebidas

export function propostas(sql: Sql): PropostaRecebida[] {
  return sql
    .all<{
      id: number
      jogador_id: number
      jogador: string
      clube: string
      valor: number
      valor_mercado: number
      semana: number
      prazo_semana: number
      contraproposta: number | null
      a_venda: string | null
    }>(
      `SELECT p.id, p.jogador_id, j.nome AS jogador, p.clube, p.valor, j.valor AS valor_mercado, p.semana, p.prazo_semana, p.contraproposta, j.a_venda
         FROM proposta_recebida p JOIN jogador j ON j.id = p.jogador_id
        WHERE p.estado = 'aberta' ORDER BY p.id DESC`,
    )
    .map((p) => ({
      id: p.id,
      jogadorId: String(p.jogador_id),
      jogador: p.jogador,
      clube: p.clube,
      valor: p.valor,
      valorMercado: p.valor_mercado,
      semana: p.semana,
      prazo: p.prazo_semana,
      contraproposta: p.contraproposta,
      aVenda: p.a_venda !== null,
    }))
}

interface LinhaProposta {
  jogador_id: number
  clube: string
  valor: number
  teto: number
  estado: string
  temporada: number
  contraproposta: number | null
}

function propostaAberta(sql: Sql, id: number): LinhaProposta {
  const p = sql.get<LinhaProposta>('SELECT jogador_id, clube, valor, teto, estado, temporada, contraproposta FROM proposta_recebida WHERE id = ?', id)
  if (!p || p.estado !== 'aberta') throw new ErroApp('proposta_inexistente', 'Proposta não está mais aberta.')
  return p
}

/** Confere se o jogador ainda pode ser vendido (está no elenco, que não fica abaixo do mínimo). */
function conferirVenda(sql: Sql, id: number, p: LinhaProposta, r: Regras, c: Carreira): LinhaMercado {
  const l = linha(sql, String(p.jogador_id))
  if (l.sigla !== c.time_usuario) {
    sql.run("UPDATE proposta_recebida SET estado = 'expirada' WHERE id = ?", id)
    throw new ErroApp('proposta_invalida', 'O jogador não está mais no seu elenco.')
  }
  if (tamanhoElenco(sql, c.time_usuario) <= r.mercado.elenco_minimo) {
    throw new ErroApp('elenco_minimo', `O elenco não pode ficar com menos de ${r.mercado.elenco_minimo} jogadores.`)
  }
  return l
}

/** Vende o jogador do usuário para o clube da CPU pelo valor e conta a chegada no plano do comprador. */
function venderPelaProposta(sql: Sql, id: number, p: LinhaProposta, valor: number, l: LinhaMercado, r: Regras, c: Carreira): void {
  const comprador = sql.get<{ porte: Porte }>('SELECT porte FROM time WHERE sigla = ?', p.clube)!.porte
  const salario = salarioMinimoAceito(
    {
      salarioAtual: l.salario_mensal ?? 0,
      mudaDeClube: true,
      porteAtual: l.porte ?? comprador,
      porteComprador: comprador,
      moral: l.moral,
      salarioReferencia: salarioReferenciaPara(sql, l, p.clube, r),
      nivelAtual: nivelDoTime(sql, c.time_usuario, r),
      nivelComprador: nivelDoTime(sql, p.clube, r),
    },
    r,
  )
  sql.transacao(() => {
    sql.run("UPDATE proposta_recebida SET estado = 'aceita', valor = ? WHERE id = ?", valor, id)
    // As outras propostas pelo mesmo jogador caem.
    sql.run("UPDATE proposta_recebida SET estado = 'expirada' WHERE jogador_id = ? AND estado = 'aberta'", p.jogador_id)
    sql.run('UPDATE negociacao SET aberta = 0 WHERE jogador_id = ?', p.jogador_id)
    transferir(sql, { jogador: p.jogador_id, de: c.time_usuario, para: p.clube, tipo: 'venda', valor, salario, ateTemporada: c.temporada_atual + 3, multa: multaPadrao(l.valor, r), emprestimo: false })
    sql.run(
      `UPDATE plano_janela SET chegadas_feitas = chegadas_feitas + 1, verba = MAX(0, verba - ?)
        WHERE temporada = ? AND time = ? AND janela = (SELECT MAX(janela) FROM plano_janela WHERE temporada = ? AND time = ?)`,
      valor, p.temporada, p.clube, p.temporada, p.clube,
    )
  })
}

/** Aceitar ou recusar uma proposta da CPU (não gasta movimento). */
export function responderProposta(sql: Sql, id: number, aceitar: boolean): PropostaRecebida[] {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const p = propostaAberta(sql, id)
  if (!aceitar) {
    sql.run("UPDATE proposta_recebida SET estado = 'recusada' WHERE id = ?", id)
    return propostas(sql)
  }
  const l = conferirVenda(sql, id, p, r, c)
  venderPelaProposta(sql, id, p, p.valor, l, r, c)
  return propostas(sql)
}

/**
 * Contraproposta do usuário (1 rodada, não gasta movimento): até o teto oculto o clube aceita e
 * o negócio fecha; um pouco acima ele cobre parte (oferece o teto, sem nova contraproposta);
 * acima disso, desiste.
 */
export function contrapropor(sql: Sql, id: number, pedido: number): ResultadoContraproposta {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const p = propostaAberta(sql, id)
  if (p.contraproposta !== null) throw new ErroApp('contraproposta_feita', 'Você já fez a contraproposta: agora é aceitar ou recusar.')
  const l = conferirVenda(sql, id, p, r, c)
  const res = responderContraproposta(p, pedido, r)
  const clube = sql.get<{ n: string }>('SELECT nome_curto n FROM time WHERE sigla = ?', p.clube)?.n ?? p.clube
  if (res.resposta === 'aceita') {
    venderPelaProposta(sql, id, p, res.valor, l, r, c)
    return { resposta: 'aceita', valor: res.valor, mensagem: `${clube} aceitou: ${l.nome} vendido por ${dinheiro(res.valor)}.`, propostas: propostas(sql) }
  }
  if (res.resposta === 'cobre') {
    sql.run('UPDATE proposta_recebida SET valor = ?, contraproposta = ? WHERE id = ?', res.valor, pedido, id)
    return { resposta: 'cobre', valor: res.valor, mensagem: `${clube} não chega a ${dinheiro(pedido)}, mas sobe a oferta para ${dinheiro(res.valor)}.`, propostas: propostas(sql) }
  }
  sql.run("UPDATE proposta_recebida SET estado = 'desistiu', contraproposta = ? WHERE id = ?", pedido, id)
  return { resposta: 'desiste', valor: null, mensagem: `${clube} achou ${dinheiro(pedido)} demais e desistiu de ${l.nome}.`, propostas: propostas(sql) }
}
