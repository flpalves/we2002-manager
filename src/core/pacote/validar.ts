import type { Regras } from '../config/padroes'
import type { Competicao, Pacote, Time } from '@shared/esquemas/pacote'
import { ehAsciiImprimivel } from '../texto'
import { problemasDoDesign } from '../we/estampas'
import { validarDivisoes } from '../competicoes/divisoes'
import { validarBlocos } from '../competicoes/blocos'
import { validarJanelas } from '../mercado/janelas'
import { validarCatalogo } from '../noticias/editor'

/**
 * Regras de consistência do pacote (docs/spec/02-dados.md, "Validação do pacote").
 * Erros bloqueiam criar carreira; avisos só informam.
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

function quantidadeParticipantes(c: Competicao): number | null {
  if (c.participantes.regra === 'lista') return c.participantes.times.length
  return c.participantes.quantidade ?? null
}

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

  function validarTime(t: Time): void {
    const ref = { time: t.sigla, arquivo: `times/${t.sigla}.json` }
    if (!escudos.has(t.sigla)) erro('escudo_faltando', `${t.nome}: falta o escudo escudos/${t.sigla}.png.`, ref)
    if (!paises.has(t.pais)) erro('pais_inexistente', `${t.nome}: país ${t.pais} não está em paises.json.`, ref)
    if (!t.nome_curto.trim()) erro('nome_curto_vazio', `${t.nome}: nome curto (para o WE) vazio.`, ref)
    else if (t.nome_curto.length > regras.elenco.tamanho_nome_we || !ehAsciiImprimivel(t.nome_curto)) {
      aviso('nome_longo', `${t.nome}: nome curto "${t.nome_curto}" passa de ${regras.elenco.tamanho_nome_we} caracteres ASCII (será cortado).`, ref)
    }

    const minimo = regras.elenco.convocaveis_minimo
    const goleiros = t.jogadores.filter((j) => j.posicao === 'GK').length
    if (t.jogadores.length < minimo) {
      erro('elenco_incompleto', `${t.nome}: ${t.jogadores.length} jogadores; precisa de pelo menos ${minimo} convocáveis.`, ref)
    }
    if (goleiros < regras.elenco.goleiros_minimo) {
      erro('goleiros_insuficientes', `${t.nome}: ${goleiros} goleiro(s); precisa de pelo menos ${regras.elenco.goleiros_minimo}.`, ref)
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
      if (q !== undefined && q !== c.participantes.times.length) {
        erro('competicao_tamanho', `${c.nome}: lista com ${c.participantes.times.length} times, mas a competição pede ${q}.`, ref)
      }
    }

    const n = quantidadeParticipantes(c)
    const exige = exigenciaDoFormato(c)
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
