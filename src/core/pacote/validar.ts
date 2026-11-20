import type { Regras } from '../config/padroes'
import type { Competicao, JogadorSemClube, Pacote, Time } from '@shared/esquemas/pacote'
import { ehAsciiImprimivel } from '../texto'
import { problemasDoDesign } from '../we/estampas'
import { validarDivisoes } from '../competicoes/divisoes'
import { candidatosSegundaDivisao, estadosDaSegundaDivisao, nomeSegundaDivisao } from '../competicoes/virada'
import { validarBlocos } from '../competicoes/blocos'
import { origensDasVagas, saidasDeVaga, tamanhoDaCompeticao } from '../competicoes/vagas'
import { validarJanelas } from '../mercado/janelas'
import { validarCatalogo } from '../noticias/editor'
import { JOGADORES_EM_CAMPO } from '../partida/sessao'
import { ensaiarTemporada } from './ensaio'

/**
 * Regras de consistência do pacote (docs/spec/02-dados.md, "Validação do pacote").
 * Erros bloqueiam criar carreira; avisos só informam (escudo faltando e elenco curto são avisos).
 */

export type NivelProblema = 'erro' | 'aviso'

export interface Problema {
  nivel: NivelProblema
  codigo: string
  mensagem: string
  arquivo?: string
  time?: string
  jogador?: string
  competicao?: string
}

export function temErros(problemas: readonly Problema[]): boolean {
  return problemas.some((p) => p.nivel === 'erro')
}

/** Quantos times a 1ª fase do formato aceita (null = qualquer quantidade a partir de 2). */
export function exigenciaDoFormato(c: Competicao): { exato?: number; potenciaDe2?: boolean } {
  const fase = c.fases[0]
  if (!fase) return {}
  if (fase.formato === 'grupos') return { exato: fase.grupos.quantidade * fase.grupos.tamanho }
  if (fase.formato === 'mata_mata') return { potenciaDe2: true }
  return {}
}

const quantidadeParticipantes = (c: Competicao): number | null => tamanhoDaCompeticao(c)

export function validarPacote(pacote: Pacote, regras: Regras): Problema[] {
  const p: Problema[] = []
  const erro = (codigo: string, mensagem: string, extra: Partial<Problema> = {}) => p.push({ nivel: 'erro', codigo, mensagem, ...extra })
  const aviso = (codigo: string, mensagem: string, extra: Partial<Problema> = {}) => p.push({ nivel: 'aviso', codigo, mensagem, ...extra })

  for (const inv of pacote.invalidos) erro('arquivo_invalido', `${inv.arquivo}: ${inv.mensagem}`, { arquivo: inv.arquivo })
  if (!pacote.manifesto && !pacote.invalidos.some((i) => i.arquivo === 'manifesto.json')) {
    erro('manifesto_ausente', 'Falta o manifesto.json do pacote.', { arquivo: 'manifesto.json' })
  }
  if (pacote.times.length === 0) erro('sem_times', 'O pacote não tem nenhum time.')

  const siglas = new Set<string>()
  const idsJogador = new Map<string, string>()
  const paises = new Set(pacote.paises.map((x) => x.codigo))
  const escudos = new Set(pacote.escudos)
  const kits = new Set(pacote.arquivosKit)

  for (const t of pacote.times) {
    if (siglas.has(t.sigla)) erro('sigla_repetida', `Sigla ${t.sigla} usada por mais de um time.`, { time: t.sigla })
    siglas.add(t.sigla)
    validarTime(t)
  }
  validarSemClube()

  /** `exterior.json` e `livres.json` (06, "Jogadores sem clube"). */
  function validarSemClube(): void {
    const nomesWe = new Map<string, string>()
    const lista: [string, JogadorSemClube, number | null][] = [
      ...(pacote.exterior?.jogadores ?? []).map((j) => ['exterior.json', j, j.taxa] as [string, JogadorSemClube, number | null]),
      ...(pacote.livres?.jogadores ?? []).map((j) => ['livres.json', j, null] as [string, JogadorSemClube, number | null]),
    ]
    for (const [arquivo, j, taxa] of lista) {
      const ref = { arquivo, jogador: j.id }
      const anterior = idsJogador.get(j.id)
      if (anterior) erro('jogador_id_repetido', `Id de jogador ${j.id} repetido (${anterior} e ${arquivo}).`, ref)
      idsJogador.set(j.id, arquivo)
      if (taxa !== null && taxa <= 0) erro('taxa_invalida', `${arquivo}: ${j.nome} com taxa ${taxa}; a taxa do exterior precisa ser maior que zero.`, ref)

      if (!j.nome_we.trim()) erro('nome_we_vazio', `${arquivo}: ${j.nome} sem nome para o WE.`, ref)
      else {
        if (j.nome_we.length > regras.elenco.tamanho_nome_we || !ehAsciiImprimivel(j.nome_we)) {
          aviso('nome_longo', `${arquivo}: nome "${j.nome_we}" passa de ${regras.elenco.tamanho_nome_we} caracteres ASCII (será cortado).`, ref)
        }
        const dono = nomesWe.get(j.nome_we)
        if (dono) aviso('nome_we_repetido', `${arquivo}: nome para o WE "${j.nome_we}" de ${dono} e ${j.nome}.`, ref)
        nomesWe.set(j.nome_we, j.nome)
      }
      if (!j.posicao_secundaria) aviso('sem_posicao_secundaria', `${arquivo}: ${j.nome} sem posição secundária.`, ref)
    }
  }

  function validarTime(t: Time): void {
    const ref = { time: t.sigla, arquivo: `times/${t.sigla}.json` }
    // Sem escudo a interface mostra o provisório (sigla nas cores do clube).
    if (!escudos.has(t.sigla)) aviso('escudo_faltando', `${t.nome}: falta o escudo escudos/${t.sigla}.png (usa o provisório).`, ref)
    if (!paises.has(t.pais)) erro('pais_inexistente', `${t.nome}: país ${t.pais} não está em paises.json.`, ref)
    if (!t.nome_curto.trim()) erro('nome_curto_vazio', `${t.nome}: nome curto (para o WE) vazio.`, ref)
    else if (t.nome_curto.length > regras.elenco.tamanho_nome_we || !ehAsciiImprimivel(t.nome_curto)) {
      aviso('nome_longo', `${t.nome}: nome curto "${t.nome_curto}" passa de ${regras.elenco.tamanho_nome_we} caracteres ASCII (será cortado).`, ref)
    }

    const minimo = regras.elenco.convocaveis_minimo
    const goleiros = t.jogadores.filter((j) => j.posicao === 'GK').length
    // Elenco curto não bloqueia a carreira: quem não tiver 11 perde por W.O. nos jogos simulados
    // (core/partida/sessao.ts), e o time do usuário é conferido ao criar a carreira.
    if (t.jogadores.length < minimo) {
      aviso('elenco_incompleto', `${t.nome}: ${t.jogadores.length} jogadores; o ideal são ${minimo} convocáveis${t.jogadores.length < JOGADORES_EM_CAMPO ? ' (sem 11, perde por W.O.)' : ''}.`, ref)
    }
    if (goleiros < regras.elenco.goleiros_minimo) {
      aviso('goleiros_insuficientes', `${t.nome}: ${goleiros} goleiro(s); precisa de pelo menos ${regras.elenco.goleiros_minimo}.`, ref)
    }

    if (!t.financas) aviso('financas_vazias', `${t.nome}: sem finanças (usa o padrão do porte ${t.porte}).`, ref)
    if (!t.estadio) aviso('estadio_vazio', `${t.nome}: sem estádio (usa o padrão do porte ${t.porte}).`, ref)
    if (!t.kit_goleiro) aviso('kit_goleiro_faltando', `${t.nome}: sem kit de goleiro.`, ref)
    for (const [campo, kit] of [['kit', t.kit], ['kit_reserva', t.kit_reserva], ['kit_goleiro', t.kit_goleiro]] as const) {
      const arte = kit?.['arte']
      if (typeof arte === 'string' && !kits.has(arte)) aviso('kit_arquivo_faltando', `${t.nome}: ${campo} aponta para ${arte}, que não existe no pacote.`, ref)
      for (const prob of problemasDoDesign(kit?.['design'])) aviso('kit_design_invalido', `${t.nome}: ${campo}.design: ${prob}.`, ref)
    }

    const camisas = new Map<number, string>()
    for (const j of t.jogadores) {
      const refJ = { ...ref, jogador: j.id }
      const anterior = idsJogador.get(j.id)
      if (anterior) erro('jogador_id_repetido', `Id de jogador ${j.id} repetido (${anterior} e ${t.sigla}).`, refJ)
      idsJogador.set(j.id, t.sigla)

      const dono = camisas.get(j.camisa)
      if (dono) erro('camisa_repetida', `${t.nome}: camisa ${j.camisa} de ${dono} e ${j.nome}.`, refJ)
      camisas.set(j.camisa, j.nome)

      if (!j.nome_we.trim()) erro('nome_we_vazio', `${t.nome}: ${j.nome} sem nome para o WE.`, refJ)
      else if (j.nome_we.length > regras.elenco.tamanho_nome_we || !ehAsciiImprimivel(j.nome_we)) {
        aviso('nome_longo', `${t.nome}: nome "${j.nome_we}" passa de ${regras.elenco.tamanho_nome_we} caracteres ASCII (será cortado).`, refJ)
      }
      if (!j.posicao_secundaria) aviso('sem_posicao_secundaria', `${t.nome}: ${j.nome} sem posição secundária.`, refJ)
      if (j.contrato.salario_mensal === 0) aviso('contrato_sem_salario', `${t.nome}: ${j.nome} com salário zero.`, refJ)
    }
  }

  const idsCompeticao = new Set(pacote.competicoes.map((c) => c.id))
  const clubes = pacote.times.map((t) => ({ sigla: t.sigla, estado: t.estado ?? null }))
  // Quem joga algum estadual/regional por lista não sobe da segunda divisão de outro.
  const emEstaduais = new Set(
    pacote.competicoes.flatMap((c) => ((c.tipo === 'estadual' || c.tipo === 'regional') && c.participantes.regra === 'lista' ? c.participantes.times : [])),
  )
  const blocos = pacote.temporada?.blocos ?? []
  /** Competição por vagas no ano (03, "Competições por vagas"): quantidade, origens e calendário. */
  function validarPorVagas(c: Competicao, ref: Partial<Problema>): void {
    if (c.participantes.regra !== 'lista') return
    const q = c.participantes.quantidade
    const garantidos = c.participantes.times.length
    if (q === undefined) {
      erro('competicao_tamanho', `${c.nome}: com participantes definidos pelas vagas, diga a quantidade de times.`, ref)
      return
    }
    if (garantidos > q) erro('competicao_tamanho', `${c.nome}: ${garantidos} garantidos na lista, mas a competição tem ${q} times.`, ref)
    const origens = origensDasVagas(c, pacote.competicoes)
    if (!origens.length) {
      aviso('sem_vagas', `${c.nome}: nenhuma competição manda vagas para ela; só é disputada se os garantidos fecharem ${q} times.`, ref)
      return
    }
    // Vagas configuradas (as que dá para contar) e o máximo de times que as origens têm.
    let vagas = 0
    for (const o of origens) {
      for (const s of saidasDeVaga(o, c.id)) {
        if (s.campeao) vagas += 1
        if (s.primeiros) vagas += s.primeiros
        const pos = s.posicoes?.split('-').map(Number)
        if (pos?.[0]) vagas += (pos[1] ?? pos[0]) - pos[0] + 1
      }
    }
    const maximo = garantidos + origens.reduce((t, o) => t + (tamanhoDaCompeticao(o) ?? 0), 0)
    if (maximo < q) {
      aviso('sem_vagas', `${c.nome}: as origens (${origens.map((o) => o.nome).join(', ')}) têm no máximo ${maximo} times para ${q} vagas; enquanto não fechar, a competição não é disputada.`, ref)
    } else if (garantidos + vagas < q) {
      aviso('vagas_completadas', `${c.nome}: ${vagas} vaga(s) configurada(s) nas origens para ${q} times; as que faltam vão para os próximos colocados das origens.`, ref)
    }
    const bloco = blocos.find((b) => b.competicao === c.id)
    if (!bloco) {
      erro('calendario_vagas', `${c.nome}: defina a janela dela no temporada.json, depois do fim das origens (${origens.map((o) => o.nome).join(', ')}).`, ref)
      return
    }
    for (const o of origens) {
      const bo = blocos.find((b) => b.competicao === o.id)
      if (!bo) erro('calendario_vagas', `${c.nome}: ${o.nome} manda vagas mas não tem janela no temporada.json (precisa acabar antes da semana ${bloco.semana_inicio}).`, ref)
      else if (bo.semana_fim >= bloco.semana_inicio) {
        erro('calendario_vagas', `${c.nome} começa na semana ${bloco.semana_inicio}, mas ${o.nome} (origem das vagas) vai até a semana ${bo.semana_fim}.`, ref)
      }
    }
  }
  function validarSegundaDivisao(c: Competicao, ref: Partial<Problema>): void {
    const sd = c.segunda_divisao
    if (!sd) return
    const nome = nomeSegundaDivisao(c)
    if ((c.tipo !== 'estadual' && c.tipo !== 'regional') || c.participantes.regra !== 'lista') {
      erro('segunda_divisao', `${c.nome}: segunda divisão só vale para estadual ou regional com participantes por lista.`, ref)
      return
    }
    const times = c.participantes.times
    if (sd.troca >= times.length) erro('segunda_divisao', `${c.nome}: ${sd.troca} caem para a ${nome}, mas o estadual tem ${times.length} times.`, ref)
    const crit = sd.descem
    if (crit && crit.criterio !== 'posicao') {
      const f = c.fases.find((x) => x.id === crit.fase)
      if (!f) erro('segunda_divisao', `${c.nome}: quem cai para a ${nome} sai da fase "${crit.fase}", que não existe.`, ref)
      else if (crit.criterio === 'grupo') {
        if (f.formato !== 'grupos') erro('segunda_divisao', `${c.nome}: "${f.nome}" não é fase de grupos.`, ref)
        else if (crit.por_grupo * f.grupos.quantidade !== sd.troca) {
          erro('segunda_divisao', `${c.nome}: ${crit.por_grupo} por grupo × ${f.grupos.quantidade} grupos não dá os ${sd.troca} que caem para a ${nome}.`, ref)
        }
      }
    }
    for (const s of sd.times ?? []) {
      if (!siglas.has(s)) erro('time_inexistente', `${c.nome}: a ${nome} marca o time ${s} como apto, mas ele não existe no pacote.`, { ...ref, time: s })
      else if (times.includes(s)) aviso('segunda_divisao', `${c.nome}: ${s} está marcado como apto a subir da ${nome}, mas já joga o estadual.`, { ...ref, time: s })
      else if (emEstaduais.has(s)) aviso('segunda_divisao', `${c.nome}: ${s} está marcado como apto a subir da ${nome}, mas joga outro estadual/regional (não sobe).`, { ...ref, time: s })
    }
    const n = candidatosSegundaDivisao(c, times, clubes, emEstaduais).length
    const origem = sd.times?.length ? 'aptos marcados' : `estados: ${estadosDaSegundaDivisao(c, times, clubes).join(', ') || 'nenhum'}`
    if (n < sd.troca) {
      aviso('segunda_divisao', `${c.nome}: só ${n} clube(s) podem subir da ${nome} (${origem}) para ${sd.troca} vagas; caem só tantos quantos sobem.`, ref)
    }
  }
  for (const c of pacote.competicoes) {
    const ref = { competicao: c.id, arquivo: `competicoes/${c.id}.json` }
    if (c.participantes.regra === 'lista') {
      const vistos = new Set<string>()
      for (const s of c.participantes.times) {
        if (!siglas.has(s)) erro('time_inexistente', `${c.nome}: time ${s} não existe no pacote.`, { ...ref, time: s })
        if (vistos.has(s)) erro('participante_repetido', `${c.nome}: ${s} aparece duas vezes.`, { ...ref, time: s })
        vistos.add(s)
      }
      const q = c.participantes.quantidade
      if (c.participantes.por_vagas) validarPorVagas(c, ref)
      else if (q !== undefined && q !== c.participantes.times.length) {
        erro('competicao_tamanho', `${c.nome}: lista com ${c.participantes.times.length} times, mas a competição pede ${q}.`, ref)
      }
    }

    const n = quantidadeParticipantes(c)
    const exige = exigenciaDoFormato(c)
    const premios = c.premiacao?.por_posicao
    if (premios && n !== null && premios.length > n) {
      aviso('premiacao_sobra', `${c.nome}: premiação para ${premios.length} colocações, mas só ${n} times disputam (as sobras não são pagas).`, ref)
    }
    if (n !== null) {
      if (n < 2) erro('competicao_tamanho', `${c.nome}: precisa de pelo menos 2 times (tem ${n}).`, ref)
      else if (exige.exato !== undefined && n !== exige.exato) {
        erro('competicao_tamanho', `${c.nome}: o formato da 1ª fase pede ${exige.exato} times; tem ${n}.`, ref)
      } else if (exige.potenciaDe2 && (n & (n - 1)) !== 0) {
        erro('competicao_tamanho', `${c.nome}: mata-mata na 1ª fase pede 2, 4, 8, 16... times; tem ${n}.`, ref)
      }
      for (const fase of c.fases) {
        for (const z of fase.zonas ?? []) {
          if (z.de > z.ate || z.ate > n) aviso('zona_invalida', `${c.nome} / ${fase.nome}: zona "${z.nome}" (${z.de}-${z.ate}) fora da tabela de ${n}.`, ref)
        }
      }
    }

    const idsFase = new Set(c.fases.map((f) => f.id))
    for (const f of c.fases) {
      if (f.classificam_para && !idsFase.has(f.classificam_para)) {
        erro('fase_inexistente', `${c.nome}: fase ${f.nome} classifica para "${f.classificam_para}", que não existe.`, ref)
      }
      if (f.formato === 'grupos' && f.grupos.classificam > f.grupos.tamanho) {
        erro('grupos_invalidos', `${c.nome}: classificam ${f.grupos.classificam} de grupos de ${f.grupos.tamanho}.`, ref)
      }
    }
    for (const s of c.saidas ?? []) {
      if (!idsCompeticao.has(s.destino)) aviso('destino_inexistente', `${c.nome}: saída para "${s.destino}", competição que não existe no pacote.`, ref)
      for (const fase of [s.fase, s.por_grupo?.fase]) {
        if (fase && !c.fases.some((f) => f.id === fase)) erro('saida_invalida', `${c.nome}: saída para "${s.destino}" cita a fase "${fase}", que não existe.`, ref)
      }
    }

    if (c.participantes.regra === 'por_divisao') {
      aviso('nao_suportado', `${c.nome}: participantes pela regra "por_divisao" ainda não entram na temporada (use "lista" ou "classificados_de").`, ref)
    }
    if (c.participantes.regra === 'classificados_de') {
      const p = c.participantes
      const recebe = (c2: Competicao) => p.origens.includes(c2.id) && (c2.saidas ?? []).some((s) => s.destino === c.id)
      aviso(
        'primeira_temporada',
        `${c.nome}: participantes por "classificados_de" só existem a partir da 2ª temporada (vêm das vagas da virada); na 1ª a competição não é disputada.`,
        ref,
      )
      if (!pacote.competicoes.some(recebe)) aviso('sem_vagas', `${c.nome}: nenhuma competição de origem (${p.origens.join(', ')}) tem saída para ela.`, ref)
    }
    for (const s of c.saidas ?? []) {
      const destino = pacote.competicoes.find((x) => x.id === s.destino)
      if ((s.tipo === 'acesso' || s.tipo === 'rebaixamento') && destino && (destino.participantes.regra !== 'lista' || c.participantes.regra !== 'lista')) {
        aviso('saida_invalida', `${c.nome}: ${s.tipo} para "${s.destino}" só funciona entre competições com participantes por "lista".`, ref)
      }
    }
    for (const s of c.saidas ?? []) {
      const destino = pacote.competicoes.find((x) => x.id === s.destino)
      const vaga = !s.tipo || !(s.tipo === 'acesso' || s.tipo === 'rebaixamento')
      if (vaga && destino?.participantes.regra === 'lista' && !destino.participantes.por_vagas) {
        aviso('saida_invalida', `${c.nome}: vaga para "${destino.nome}" não tem efeito (marque nela "participantes definidos pelas vagas" ou use "classificados_de").`, ref)
      }
      if (!s.exceto_de?.length) continue
      if (s.ultimos || s.por_grupo) {
        erro('saida_invalida', `${c.nome}: saída para "${s.destino}" pulando outras competições só funciona com campeão, posições ou primeiros.`, ref)
      }
      for (const id of s.exceto_de) {
        if (!idsCompeticao.has(id)) erro('saida_invalida', `${c.nome}: saída para "${s.destino}" pula quem joga "${id}", competição que não existe.`, ref)
      }
    }
    validarSegundaDivisao(c, ref)
    for (const id of c.pula_quem_joga ?? []) {
      if (id === c.id) erro('pula_quem_joga', `${c.nome}: a classificação não pode pular quem joga a própria competição.`, ref)
      else if (!idsCompeticao.has(id)) erro('pula_quem_joga', `${c.nome}: a classificação pula quem joga "${id}", competição que não existe.`, ref)
    }
    if (c.pula_quem_joga?.length && !(c.participantes.regra === 'classificados_de' || (c.participantes.regra === 'lista' && c.participantes.por_vagas))) {
      aviso('pula_quem_joga', `${c.nome}: "pular quem joga" só vale para competições que recebem vagas (por vagas ou classificados_de).`, ref)
    }
    for (const f of c.fases) {
      if (f.entram?.length) aviso('nao_suportado', `${c.nome} / ${f.nome}: "entram" (times que entram em fases seguintes) ainda não é suportado.`, ref)
      if (f.formato === 'pontos_corridos' && f.classificam_para && !f.pontos_corridos.classificam) {
        erro('fase_incompativel', `${c.nome} / ${f.nome}: diga quantos se classificam (pontos_corridos.classificam).`, ref)
      }
    }
    if (n !== null && n >= 2) {
      const problema = problemaDasFases(c, n)
      if (problema) erro('fase_incompativel', `${c.nome}: ${problema}`, ref)
    }
  }

  // regras.json: janelas de transferência
  for (const j of validarJanelas(regras.mercado.janelas, regras.temporada.semanas_por_temporada)) p.push({ ...j, arquivo: 'regras.json' })

  // divisoes.json: escada de acesso e rebaixamento
  if (pacote.divisoes) for (const d of validarDivisoes(pacote.divisoes, pacote.competicoes)) p.push({ ...d, arquivo: 'divisoes.json' })

  // temporada.json: janelas das competições
  for (const b of validarBlocos(pacote.temporada?.blocos ?? [], pacote.competicoes, regras.temporada.semanas_por_temporada)) {
    // A duração da temporada mora no regras.json; o resto, no temporada.json.
    p.push({ ...b, arquivo: b.codigo === 'semanas_invalidas' ? 'regras.json' : 'temporada.json' })
  }

  // noticias.json: catálogo de eventos (o padrão do jogo já é coerente)
  if (pacote.noticias) {
    for (const n of validarCatalogo(pacote.noticias)) {
      p.push({ nivel: n.nivel, codigo: n.codigo, mensagem: n.evento ? `Notícia ${n.evento}: ${n.mensagem}` : n.mensagem, arquivo: 'noticias.json' })
    }
  }

  // Ensaio da 1ª temporada: o que só apareceria ao criar a carreira (calendário que não fecha...).
  // Só com as competições coerentes; com erro nelas, o ensaio repetiria o mesmo problema.
  if (!p.some((x) => x.nivel === 'erro' && (x.competicao || x.arquivo === 'temporada.json' || x.arquivo === 'divisoes.json'))) p.push(...ensaiarTemporada(pacote, regras))

  return p
}

/** As fases encadeadas fecham? (ex.: grupos depois de uma fase precisam receber exatamente quantidade × tamanho). */
export function problemaDasFases(c: Competicao, participantes: number): string | null {
  let n = participantes
  for (let i = 0; i < c.fases.length; i++) {
    const f = c.fases[i]!
    const ultima = i === c.fases.length - 1
    if (f.formato === 'grupos') {
      if (n !== f.grupos.quantidade * f.grupos.tamanho) return `${f.nome} pede ${f.grupos.quantidade * f.grupos.tamanho} times e recebe ${n}.`
      n = f.grupos.quantidade * f.grupos.classificam
    } else if (f.formato === 'pontos_corridos') {
      const c2 = f.pontos_corridos.classificam ?? (ultima ? 1 : n)
      if (c2 > n) return `${f.nome} classifica ${c2} de ${n} times.`
      n = c2
    } else {
      const saem = f.mata_mata.classificam ?? (ultima ? 1 : n / 2)
      let k = n
      while (k > saem && k % 2 === 0) k /= 2
      if (k !== saem) return `${f.nome}: mata-mata de ${n} times não chega a ${saem}.`
      n = saem
    }
  }
  return null
}
