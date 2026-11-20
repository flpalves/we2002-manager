import { criarRng } from '@core/rng'
import { temporadaEncerrada } from '@core/competicoes/temporada'
import { ehSegundaDivisao, nomeSegundaDivisao, participantesSeguintes, type OpcoesVirada } from '@core/competicoes/virada'
import { fecharMetas, metaAtingida, type Meta } from '@core/diretoria/diretoria'
import { geral, geralExibido } from '@core/jogadores/conversao'
import { viradaExterior } from '@core/mercado/exterior'
import { ajustarPelaDivisao, ligasDosTimes } from '@core/mercado/nivel'
import type { Regras } from '@core/config/padroes'
import * as info from '@core/noticias/informativas'
import type { Atributos, Competicao } from '@shared/esquemas/pacote'
import type { BalancoTemporada, ContratoAcabando, PreviaVirada, RelatorioTemporada } from '@shared/esquemas/temporada'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'
import { camisaLivre, semanaAgora } from './mercado'
import { registrarInfo } from './noticias'
import { abrirSessao, artilharia, chaveClassificados, exigirEmpregado, garantirTemporada } from './temporada'

/**
 * Virada de temporada (03-competicoes, "Virada de temporada"; roadmap fase 9).
 *
 * Fluxo: a temporada acaba → a prévia mostra o balanço e os contratos do usuário que vão
 * acabar (pendência: renovar em Mercado) → `virarTemporada` faz, numa transação:
 *  1. recesso (recuperação, treino e salários das semanas que sobram);
 *  2. balanço (campeões, acesso/rebaixamento, artilheiros, campanha do usuário);
 *  3. metas da diretoria fechadas (confiança; meta crítica perdida = demissão);
 *  4. contratos: os pré-contratos mudam de clube; empréstimos voltam; quem a CPU não renovou
 *     na semana limite sai livre; os do usuário que não renovou ficam livres (o elenco dele
 *     nunca cai abaixo do mínimo: a diretoria renova 1 ano; a CPU completa na semana 1);
 *  5. participantes da próxima temporada, idade +1, cartões zerados;
 *  6. temporada nova: calendário e sorteios, valores de mercado, metas.
 */

type Sessao = ReturnType<typeof abrirSessao>

interface LinhaContrato {
  id: number
  nome: string
  posicao: string
  idade: number
  atributos: string
  sigla: string
  tipo: 'definitivo' | 'emprestimo'
  origem: string | null
  salario_mensal: number
}

function exigirEncerrada(s: Sessao): void {
  if (!temporadaEncerrada(s.estado)) throw new ErroApp('temporada_em_andamento', 'A temporada ainda não acabou: use Continuar.')
}

function contratosAcabando(sql: Sql, temporada: number): LinhaContrato[] {
  return sql.all<LinhaContrato>(
    `SELECT j.id, j.nome, j.posicao, j.idade, j.atributos, t.sigla, c.tipo, o.sigla AS origem, c.salario_mensal
       FROM contrato c JOIN jogador j ON j.id = c.jogador_id JOIN time t ON t.id = c.time_id
       LEFT JOIN time o ON o.id = c.time_origem_id
      WHERE c.ate_temporada <= ? AND j.time_id = c.time_id
      ORDER BY t.sigla, j.id`,
    temporada,
  )
}

const geralDe = (l: { atributos: string; posicao: string }, s: Sessao) => geral(JSON.parse(l.atributos) as Atributos, l.posicao, s.d.regras)

function balanco(sql: Sql, s: Sessao): BalancoTemporada {
  const { d, estado } = s
  const nomeComp = (id: string) => {
    const c = d.competicoes.get(ehSegundaDivisao(id) ? id.slice(0, -2) : id)
    if (!c) return id
    return ehSegundaDivisao(id) ? nomeSegundaDivisao(c) : c.nome
  }
  const atuais = participantesAtuais(s)
  const seguintes = participantesSeguintes([...d.competicoes.values()], atuais, estado.edicoes, opcoesVirada(sql, s))
  const movimentos = [...seguintes.movimentos, ...seguintes.segundaDivisao]
  const campeoes: BalancoTemporada['campeoes'] = []
  const artilheiros: BalancoTemporada['artilheiros'] = []
  const campanhas: BalancoTemporada['campanhas'] = []
  for (const e of estado.edicoes) {
    const nome = nomeComp(e.competicao)
    if (e.campeao) campeoes.push({ competicao: nome, time: e.campeao })
    const [art] = artilharia(sql, e.id, 1)
    if (art) artilheiros.push({ competicao: nome, jogador: art.jogador, time: art.time, gols: art.gols })
    if (e.participantes.includes(d.timeUsuario)) {
      const i = e.classificacaoFinal?.indexOf(d.timeUsuario) ?? -1
      campanhas.push({ competicao: nome, posicao: i >= 0 ? i + 1 : null, campeao: e.campeao === d.timeUsuario })
    }
  }
  return {
    temporada: d.temporada,
    campeoes,
    movimentos: movimentos.map((m) => ({ ...m, de: nomeComp(m.de), para: nomeComp(m.para) })),
    artilheiros,
    campanhas,
  }
}

/**
 * Clubes do pacote e sorteio das segundas divisões fantasmas (o mesmo na prévia e na virada:
 * a prévia mostra quem vai subir).
 */
function opcoesVirada(sql: Sql, s: Sessao): OpcoesVirada {
  const clubes = sql.all<{ sigla: string; estado: string | null }>('SELECT sigla, estado FROM time ORDER BY sigla')
  return { clubes, rng: criarRng(s.d.semente).derivar('virada', s.d.temporada) }
}

/** Participantes desta temporada: as edições geradas (lista e classificados). */
function participantesAtuais(s: Sessao): Record<string, string[]> {
  const r: Record<string, string[]> = {}
  for (const e of s.estado.edicoes) r[e.competicao] = [...e.participantes]
  return r
}

const elencoDe = (sql: Sql, sigla: string) =>
  sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'", sigla)?.n ?? 0

export function previaVirada(sql: Sql): PreviaVirada {
  const s = abrirSessao(sql)
  exigirEncerrada(s)
  const T = s.d.temporada
  const destino = new Map(sql.all<{ id: number; para: string }>('SELECT jogador_id id, para FROM pre_contrato WHERE temporada = ?', T).map((x) => [x.id, x.para]))
  const doUsuario: ContratoAcabando[] = contratosAcabando(sql, T)
    .filter((l) => l.sigla === s.d.timeUsuario)
    .map((l) => {
      const para = destino.get(l.id)
      return { id: String(l.id), nome: l.nome, posicao: l.posicao, idade: l.idade, geral: geralExibido(JSON.parse(l.atributos) as Atributos, l.posicao, s.d.regras), preContrato: para ? nomeTime(sql, para) : null }
    })
  const limite = s.d.regras.mercado.pre_contrato.semana_limite_renovacao
  const chegam = sql
    .all<{ id: number; nome: string; posicao: string; de: string }>(
      'SELECT j.id, j.nome, j.posicao, pc.de FROM pre_contrato pc JOIN jogador j ON j.id = pc.jogador_id WHERE pc.temporada = ? AND pc.para = ? ORDER BY j.nome',
      T, s.d.timeUsuario,
    )
    .map((x) => ({ id: String(x.id), nome: x.nome, posicao: x.posicao, de: nomeTime(sql, x.de) }))
  return {
    ...balanco(sql, s),
    contratosAcabando: doUsuario,
    minimoElenco: s.d.regras.mercado.elenco_minimo,
    elencoAtual: elencoDe(sql, s.d.timeUsuario),
    renovacaoAberta: semanaAgora(sql) <= limite,
    semanaLimiteRenovacao: limite,
    chegam,
  }
}

export function relatorioTemporada(sql: Sql, temporada: number): RelatorioTemporada | null {
  const l = sql.get<{ dados: string }>('SELECT dados FROM relatorio_temporada WHERE temporada = ?', temporada)
  return l ? (JSON.parse(l.dados) as RelatorioTemporada) : null
}

export function virarTemporada(sql: Sql): RelatorioTemporada {
  exigirEmpregado(sql)
  const s = abrirSessao(sql)
  exigirEncerrada(s)
  const { d } = s
  const T = d.temporada
  const semanas = d.regras.temporada.semanas_por_temporada
  // Última semana que já correu (passos e semanas sem jogo avançadas pelo Continuar).
  const ultimaSemana = Math.max(s.semanaProcessada(), s.estado.passos.at(-1)?.semana ?? 0)
  let relatorio!: RelatorioTemporada

  sql.transacao(() => {
    // 1. Recesso: o tempo corre até o fim da semana 52 (condição, treino, salários, avaliações).
    s.elencos.avancarAte(semanas * 7, d.regras, s.rngSemana)
    const eco = s.economia()
    const demitidoAntes = eco.demitido
    eco.semanasPassadas(ultimaSemana, semanas)
    s.gravar()
    if (eco.demitido && !demitidoAntes) registrarInfo(sql, T, semanas, info.demissao(nomeTime(sql, d.timeUsuario)))

    // 2. Balanço (antes de mexer em contratos: a artilharia usa o clube atual do jogador).
    const b = balanco(sql, s)
    for (const m of b.movimentos) registrarInfo(sql, T, semanas, info.acessoOuRebaixamento(nomeTime(sql, m.time), m.para, m.tipo, m.time === d.timeUsuario))
    for (const a of b.artilheiros) registrarInfo(sql, T, semanas, info.artilheiro(a.jogador, nomeTime(sql, a.time), a.gols, a.competicao))

    // 3. Metas da diretoria.
    const metas = fecharAsMetas(sql, s)
    if (metas.total) registrarInfo(sql, T, semanas, info.metasFechadas(metas.atingidas, metas.total, metas.confianca, metas.demitido))
    if (metas.demitido && !eco.demitido) registrarInfo(sql, T, semanas, info.demissao(nomeTime(sql, d.timeUsuario)))

    // 4. Contratos.
    const c = resolverContratos(sql, s)

    // 5. Participantes, idade e cartões.
    const seguintes = participantesSeguintes([...d.competicoes.values()], participantesAtuais(s), s.estado.edicoes, opcoesVirada(sql, s))
    const novas = new Map(d.competicoes)
    for (const comp of d.competicoes.values()) {
      const lista = seguintes.participantes[comp.id]
      if (comp.participantes.regra !== 'lista' || !lista) continue
      const aptos = seguintes.aptos[comp.id]
      const nova: Competicao = {
        ...comp,
        participantes: { ...comp.participantes, times: lista },
        ...(aptos && comp.segunda_divisao && { segunda_divisao: { ...comp.segunda_divisao, times: aptos } }),
      }
      sql.run('UPDATE competicao SET definicao = ? WHERE id = ?', JSON.stringify(nova), comp.id)
      novas.set(comp.id, nova)
    }
    orcamentoPelaDivisao(sql, d.regras, ligasDosTimes(d.competicoes), ligasDosTimes(novas))
    const classificados = Object.fromEntries(
      [...d.competicoes.values()].filter((x) => x.participantes.regra === 'classificados_de').map((x) => [x.id, seguintes.participantes[x.id] ?? []]),
    )
    sql.run('INSERT OR REPLACE INTO configuracao (chave, valor) VALUES (?, ?)', chaveClassificados(T + 1), JSON.stringify(classificados))
    if (d.regras.virada.envelhecer) sql.run('UPDATE jogador SET idade = idade + 1')
    viradaDoExterior(sql, s)
    sql.run('DELETE FROM disciplina WHERE suspenso = 0')
    sql.run('UPDATE disciplina SET amarelos = 0')
    sql.run("UPDATE proposta_recebida SET estado = 'expirada' WHERE estado = 'aberta'")
    sql.run('UPDATE negociacao SET aberta = 0 WHERE aberta = 1')

    const fim = sql.get<{ saldo: number; confianca_diretoria: number }>('SELECT saldo, confianca_diretoria FROM time WHERE sigla = ?', d.timeUsuario)
    relatorio = {
      ...b,
      time: d.timeUsuario,
      metas: metas.lista,
      confianca: fim?.confianca_diretoria ?? 0,
      demitido: metas.demitido || eco.demitido,
      saldo: fim?.saldo ?? 0,
      saidas: c.saidas,
      renovadosPelaDiretoria: c.renovadosPelaDiretoria,
      voltaramDeEmprestimo: c.voltaram,
      chegaramPorPreContrato: c.chegaram,
      proximaTemporada: T + 1,
    }
    sql.run('INSERT OR REPLACE INTO relatorio_temporada (temporada, dados) VALUES (?, ?)', T, JSON.stringify(relatorio))

    // 6. Temporada nova.
    sql.run('UPDATE carreira SET temporada_atual = ?, passo_atual = 0, semana_atual = 1, semana_processada = 0, dia_atual = 0, movimentos = ?', T + 1, d.regras.mercado.movimentos_por_jogo)
    garantirTemporada(sql)
    registrarInfo(sql, T + 1, 1, info.novaTemporada(T + 1))
  })
  return relatorio
}

/**
 * Orçamento pela divisão (06): quem sobe ou desce tem o orçamento da folha ajustado pelo fator da
 * divisão nova (o clube do usuário também). Saldo e patrocínio não mudam (a cota de TV já muda).
 */
function orcamentoPelaDivisao(sql: Sql, regras: Regras, antes: ReadonlyMap<string, string[]>, depois: ReadonlyMap<string, string[]>): void {
  const times = sql.all<{ sigla: string; orcamento_folha_mensal: number }>("SELECT sigla, orcamento_folha_mensal FROM time WHERE pais = 'BRA'")
  for (const t of times) {
    const folha = ajustarPelaDivisao(t.orcamento_folha_mensal, antes.get(t.sigla) ?? [], depois.get(t.sigla) ?? [], regras)
    if (folha !== t.orcamento_folha_mensal) sql.run('UPDATE time SET orcamento_folha_mensal = ? WHERE sigla = ?', folha, t.sigla)
  }
}

/**
 * Disponíveis do exterior que sobraram (06): taxa recalculada pela idade nova e parte do pool
 * sai (`status = 'fora'`, não aparece em busca nenhuma). Roda depois do envelhecimento.
 */
function viradaDoExterior(sql: Sql, s: Sessao): void {
  const { d } = s
  const anos = d.regras.virada.envelhecer ? 1 : 0
  const pool = sql
    .all<{ id: number; idade: number; taxa_fixa: number }>("SELECT id, idade, taxa_fixa FROM jogador WHERE status = 'exterior' AND taxa_fixa IS NOT NULL")
    .map((j) => ({ id: String(j.id), idade: j.idade, idadeAnterior: j.idade - anos, taxa: j.taxa_fixa }))
  for (const r of viradaExterior(pool, d.regras, criarRng(d.semente).derivar('exterior', d.temporada))) {
    if (r.sai) sql.run("UPDATE jogador SET status = 'fora', a_venda = NULL WHERE id = ?", Number(r.id))
    else sql.run('UPDATE jogador SET taxa_fixa = ? WHERE id = ?', r.taxa, Number(r.id))
  }
}

const nomeTime = (sql: Sql, sigla: string) => sql.get<{ n: string }>('SELECT nome_curto n FROM time WHERE sigla = ?', sigla)?.n ?? sigla

function fecharAsMetas(sql: Sql, s: Sessao) {
  const { d } = s
  const linhas = sql.all<{ id: number; tipo: Meta['tipo']; alvo: number | null; competicao: string | null; descricao: string; critica: number }>(
    "SELECT id, tipo, alvo, competicao, descricao, critica FROM meta_diretoria WHERE temporada = ? AND status = 'andamento' ORDER BY id",
    d.temporada,
  )
  const t = sql.get<{ id: number; saldo: number; orcamento_folha_mensal: number; confianca_diretoria: number }>(
    'SELECT id, saldo, orcamento_folha_mensal, confianca_diretoria FROM time WHERE sigla = ?',
    d.timeUsuario,
  )!
  const folha = sql.get<{ f: number }>('SELECT COALESCE(SUM(salario_mensal), 0) f FROM contrato WHERE time_id = ?', t.id)?.f ?? 0
  const posicoes: Record<string, number> = {}
  for (const e of s.estado.edicoes) {
    const i = e.classificacaoFinal?.indexOf(d.timeUsuario) ?? -1
    if (i >= 0) posicoes[e.competicao] = i + 1
  }
  const resultados = linhas.map((l) => {
    const meta: Meta = { tipo: l.tipo, alvo: l.alvo, competicao: l.competicao, descricao: l.descricao, critica: !!l.critica }
    return { id: l.id, meta, atingida: metaAtingida(meta, { posicoes, saldo: t.saldo, folha, orcamentoFolha: t.orcamento_folha_mensal }) }
  })
  for (const r of resultados) sql.run('UPDATE meta_diretoria SET status = ? WHERE id = ?', r.atingida ? 'atingida' : 'perdida', r.id)
  const f = fecharMetas(t.confianca_diretoria, resultados, d.regras)
  sql.run('UPDATE time SET confianca_diretoria = ? WHERE id = ?', Math.round(f.confianca), t.id)
  if (f.demitido) sql.run('UPDATE carreira SET demitido = 1')
  return {
    lista: resultados.map((r) => ({ descricao: r.meta.descricao, atingida: r.atingida, critica: r.meta.critica })),
    atingidas: resultados.filter((r) => r.atingida).length,
    total: resultados.length,
    confianca: Math.round(f.confianca),
    demitido: f.demitido,
  }
}

/** Empréstimos voltam; quem sai fica livre; o elenco não fica abaixo do mínimo nem com menos de 2 goleiros. */
function resolverContratos(sql: Sql, s: Sessao) {
  const { d } = s
  const T = d.temporada
  const semanas = d.regras.temporada.semanas_por_temporada
  const v = d.regras.virada
  const saidas: string[] = []
  const renovadosPelaDiretoria: string[] = []
  const voltaram: string[] = []

  // Fim de contrato: se a temporada acabou antes da semana limite, a CPU decide as renovações
  // agora; a virada é a última data dos pré-contratos (a CPU fecha os que faltam).
  const eco = s.economia()
  const rngFim = criarRng(d.semente).derivar('pre_contrato', T, 'virada')
  eco.renovarCpu(rngFim.derivar('renovacao'))
  eco.preContratos(semanas, rngFim.derivar('rodada'), 1)
  // Só os contratos: saldos e confiança já foram gravados (e as metas mexeram na confiança).
  eco.gravarContratos()
  const { chegaram, sairam } = aplicarPreContratos(sql, s)

  const acabando = contratosAcabando(sql, T)
  // Empréstimos: volta ao clube de origem com contrato novo (mesmo salário).
  for (const l of acabando.filter((x) => x.tipo === 'emprestimo')) {
    if (!l.origem) continue
    const camisa = sql.get<{ camisa: number }>('SELECT camisa FROM jogador WHERE id = ?', l.id)!.camisa
    sql.run("UPDATE jogador SET time_id = (SELECT id FROM time WHERE sigla = ?), status = 'ativo', camisa = ? WHERE id = ?", l.origem, camisaLivre(sql, l.origem, camisa, l.id), l.id)
    sql.run(
      "UPDATE contrato SET time_id = (SELECT id FROM time WHERE sigla = ?), tipo = 'definitivo', time_origem_id = NULL, ate_temporada = ? WHERE jogador_id = ?",
      l.origem, T + v.temporadas_renovacao, l.id,
    )
    if (l.sigla === d.timeUsuario) saidas.push(l.nome)
    if (l.origem === d.timeUsuario) voltaram.push(l.nome)
    registrarInfo(sql, T, semanas, info.voltaDeEmprestimo({ id: String(l.id), nome: l.nome }, nomeTime(sql, l.origem)))
  }

  const porTime = new Map<string, LinhaContrato[]>()
  for (const l of acabando.filter((x) => x.tipo === 'definitivo' || !x.origem)) porTime.set(l.sigla, [...(porTime.get(l.sigla) ?? []), l])
  const saidosDoUsuario: string[] = []
  for (const [sigla, lista] of porTime) {
    const elenco = sql.all<{ posicao: string }>(
      "SELECT j.posicao FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'",
      sigla,
    )
    let tamanho = elenco.length
    let goleiros = elenco.filter((j) => j.posicao === 'GK').length
    const usuario = sigla === d.timeUsuario
    // A CPU já decidiu quem renova na semana limite: quem sobrou sai (a semana 1 completa o
    // elenco com livres). O usuário só fica com quem renovou, e a diretoria garante o mínimo.
    const decisao = lista.map((l) => ({ l, geral: geralDe(l, s), fica: false }))
    // Os piores saem primeiro; os demais só saem se o elenco continuar completo.
    for (const x of decisao.sort((a, b) => a.geral - b.geral || a.l.id - b.l.id)) {
      const gk = x.l.posicao === 'GK'
      const podeSair = !usuario || (tamanho - 1 >= d.regras.mercado.elenco_minimo && (!gk || goleiros - 1 >= 2))
      if (!x.fica && podeSair) {
        sql.run("UPDATE jogador SET time_id = NULL, status = 'livre', a_venda = NULL WHERE id = ?", x.l.id)
        sql.run('DELETE FROM contrato WHERE jogador_id = ?', x.l.id)
        // A IA de mercado repõe na janela principal um número parecido de quem saiu (06).
        sql.run("INSERT INTO saida_elenco (temporada, time, jogador_id, motivo) VALUES (?, ?, ?, 'fim_contrato')", T + 1, sigla, x.l.id)
        tamanho--
        if (gk) goleiros--
        if (usuario) saidosDoUsuario.push(x.l.nome)
      } else {
        const anos = x.fica ? v.temporadas_renovacao : 1
        sql.run('UPDATE contrato SET ate_temporada = ? WHERE jogador_id = ?', T + anos, x.l.id)
        if (usuario) renovadosPelaDiretoria.push(x.l.nome)
      }
    }
  }
  if (saidosDoUsuario.length) registrarInfo(sql, T, semanas, info.contratosEncerrados(saidosDoUsuario))
  saidas.push(...sairam, ...saidosDoUsuario)
  // Escalação salva do usuário: quem saiu é trocado pela IA na mesma vaga (aplicarEscalacaoSalva).
  return { saidas, renovadosPelaDiretoria, voltaram, chegaram }
}

/**
 * Pré-contratos da temporada: o jogador muda para o clube novo com o contrato combinado (sem
 * taxa). Registra a transferência, a saída para a IA de mercado repor e a notícia do usuário.
 */
function aplicarPreContratos(sql: Sql, s: Sessao): { chegaram: string[]; sairam: string[] } {
  const { d } = s
  const T = d.temporada
  const semanas = d.regras.temporada.semanas_por_temporada
  const chegaram: string[] = []
  const sairam: string[] = []
  const linhas = sql.all<{ id: number; nome: string; camisa: number; de: string; para: string; salario_mensal: number; ate_temporada: number; semana: number }>(
    `SELECT j.id, j.nome, j.camisa, pc.de, pc.para, pc.salario_mensal, pc.ate_temporada, pc.semana
       FROM pre_contrato pc JOIN jogador j ON j.id = pc.jogador_id JOIN time t ON t.id = j.time_id
      WHERE pc.temporada = ? AND t.sigla = pc.de AND j.status = 'ativo'
      ORDER BY j.id`,
    T,
  )
  for (const l of linhas) {
    sql.run('UPDATE jogador SET time_id = (SELECT id FROM time WHERE sigla = ?), camisa = ?, a_venda = NULL WHERE id = ?', l.para, camisaLivre(sql, l.para, l.camisa, l.id), l.id)
    sql.run('DELETE FROM contrato WHERE jogador_id = ?', l.id)
    // Multa 0: a temporada nova recalcula pelo valor (recalcularValores).
    sql.run(
      "INSERT INTO contrato (jogador_id, time_id, salario_mensal, ate_temporada, multa, tipo) VALUES (?, (SELECT id FROM time WHERE sigla = ?), ?, ?, 0, 'definitivo')",
      l.id, l.para, l.salario_mensal, l.ate_temporada,
    )
    sql.run("INSERT INTO transferencia (temporada, semana, jogador_id, de, para, tipo, valor, salario) VALUES (?, ?, ?, ?, ?, 'pre_contrato', 0, ?)", T, semanas, l.id, l.de, l.para, l.salario_mensal)
    sql.run("INSERT INTO saida_elenco (temporada, time, jogador_id, motivo) VALUES (?, ?, ?, 'pre_contrato')", T + 1, l.de, l.id)
    if (l.para === d.timeUsuario) {
      chegaram.push(l.nome)
      registrarInfo(sql, T, semanas, info.preContrato({ jogador: l.nome, jogadorId: String(l.id), de: nomeTime(sql, l.de), para: nomeTime(sql, l.para), doUsuario: 'chega' }))
    }
    if (l.de === d.timeUsuario) {
      sairam.push(l.nome)
      // Os assinados antes já viraram notícia na data; os da virada (última rodada), agora.
      if (l.semana >= semanas) registrarInfo(sql, T, semanas, info.preContrato({ jogador: l.nome, jogadorId: String(l.id), de: nomeTime(sql, l.de), para: nomeTime(sql, l.para), doUsuario: 'sai' }))
    }
  }
  return { chegaram, sairam }
}
