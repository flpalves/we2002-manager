import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PacoteAberto } from '@shared/esquemas/ipc'
import type { Competicao, Divisoes, Exterior, JanelaTransferencia, Livres, Posicao, Temporada, Time } from '@shared/esquemas/pacote'
import type { EventoCatalogo } from '@shared/esquemas/noticias'
import type { BaseKit } from '@core/we/desenharKit'
import type { DesignKit } from '@core/we/estampas'
import { chamar } from '../api'
import { useUi } from './ui'
import { urlEscudoPacote } from './carreira'

export type ResumoPacote = { id: string; nome: string; versao: string; temporada: number | null }

/** Pacote aberto no editor (e na tela de nova carreira). */
export const useEditor = defineStore('editor', () => {
  const ui = useUi()
  const pacotes = ref<ResumoPacote[]>([])
  const aberto = ref<PacoteAberto | null>(null)
  const ocupado = ref(false)

  /** Seleção do editor (a validação usa para pular até o problema). */
  type Aba = 'times' | 'uniformes' | 'jogadores' | 'competicoes' | 'divisoes' | 'temporada' | 'janelas' | 'noticias' | 'validacao'
  const aba = ref<Aba>('times')
  const timeSelecionado = ref<string | null>(null)
  const jogadorSelecionado = ref<string | null>(null)
  const competicaoSelecionada = ref<string | null>(null)
  const noticiaSelecionada = ref<string | null>(null)
  /** Aba Jogadores: de onde vêm os jogadores listados (elenco de um time, exterior ou livres). */
  const origemJogadores = ref<'times' | 'exterior' | 'livres'>('times')
  /** Aba Jogadores: filtro por posição principal (null = todas). */
  const filtroPosicao = ref<Posicao | null>(null)
  /** Jogador sem clube selecionado (id do pacote), separado do jogador do elenco. */
  const semClubeSelecionado = ref<string | null>(null)

  function irPara(alvo: { time?: string | undefined; jogador?: string | undefined; competicao?: string | undefined; arquivo?: string | undefined; codigo?: string | undefined }): void {
    // A duração da temporada mora no regras.json, mas é editada na aba Temporada.
    if (alvo.arquivo === 'temporada.json' || alvo.codigo === 'semanas_invalidas') {
      aba.value = 'temporada'
      return
    }
    if (alvo.arquivo === 'exterior.json' || alvo.arquivo === 'livres.json') {
      origemJogadores.value = alvo.arquivo === 'exterior.json' ? 'exterior' : 'livres'
      if (alvo.jogador) semClubeSelecionado.value = alvo.jogador
      filtroPosicao.value = null
      aba.value = 'jogadores'
      return
    }
    if (alvo.arquivo === 'noticias.json') {
      aba.value = 'noticias'
      return
    }
    if (alvo.arquivo === 'divisoes.json' || alvo.arquivo === 'regras.json') {
      aba.value = alvo.arquivo === 'divisoes.json' ? 'divisoes' : 'janelas'
      return
    }
    if (alvo.competicao) {
      competicaoSelecionada.value = alvo.competicao
      aba.value = 'competicoes'
      return
    }
    if (alvo.time) timeSelecionado.value = alvo.time
    if (alvo.jogador) {
      jogadorSelecionado.value = alvo.jogador
      origemJogadores.value = 'times'
      filtroPosicao.value = null
      aba.value = 'jogadores'
    } else if (alvo.time) aba.value = 'times'
  }

  const erros = computed(() => aberto.value?.problemas.filter((p) => p.nivel === 'erro') ?? [])
  const avisos = computed(() => aberto.value?.problemas.filter((p) => p.nivel === 'aviso') ?? [])

  async function listar(): Promise<void> {
    pacotes.value = await chamar('pacote:listar', undefined)
  }

  async function abrir(id: string): Promise<void> {
    aberto.value = await chamar('pacote:abrir', { pacote: id })
  }

  /** Executa uma operação que devolve o pacote atualizado; erros viram aviso na tela. */
  async function operar(fn: (id: string) => Promise<PacoteAberto | null>, sucesso?: string): Promise<boolean> {
    if (!aberto.value) return false
    ocupado.value = true
    try {
      const r = await fn(aberto.value.id)
      if (r) {
        aberto.value = r
        if (sucesso) ui.avisar(sucesso)
      }
      return r !== null
    } catch (e) {
      ui.avisar((e as Error).message, 6000)
      return false
    } finally {
      ocupado.value = false
    }
  }

  const salvarTime = (time: Time, siglaAnterior?: string) =>
    operar((pacote) => chamar('pacote:salvarTime', { pacote, time, ...(siglaAnterior && { siglaAnterior }) }), `${time.nome} salvo.`)
  const removerTime = (sigla: string) => operar((pacote) => chamar('pacote:removerTime', { pacote, sigla }), `${sigla} removido.`)
  const salvarCompeticao = (competicao: Competicao, idAnterior?: string) =>
    operar(
      (pacote) => chamar('pacote:salvarCompeticao', { pacote, competicao, ...(idAnterior && { idAnterior }) }),
      `${competicao.nome} salva.`,
    )
  const salvarJanelas = (janelas: JanelaTransferencia[] | null) =>
    operar((pacote) => chamar('pacote:salvarJanelas', { pacote, janelas }), janelas ? 'Janelas salvas.' : 'Janelas de volta ao padrão.')
  const salvarTemporada = (temporada: Temporada, semanas: number | null) =>
    operar((pacote) => chamar('pacote:salvarTemporada', { pacote, temporada, semanas }), 'Temporada salva.')
  const salvarDivisoes = (divisoes: Divisoes) => operar((pacote) => chamar('pacote:salvarDivisoes', { pacote, divisoes }), 'Divisões salvas.')
  const salvarNoticias = (catalogo: EventoCatalogo[] | null, regras: { fator_chance: number | null; maximo_por_avaliacao: number | null }) =>
    operar((pacote) => chamar('pacote:salvarNoticias', { pacote, catalogo, regras }), catalogo ? 'Notícias salvas.' : 'Notícias de volta ao catálogo padrão.')
  const salvarSemClube = (exterior: Exterior | null, livres: Livres | null) =>
    operar((pacote) => chamar('pacote:salvarSemClube', { pacote, exterior, livres }), 'Jogadores sem clube salvos.')
  const removerCompeticao = (id: string) => operar((pacote) => chamar('pacote:removerCompeticao', { pacote, id }), 'Competição removida.')
  const importarEscudo = (sigla: string) => operar((pacote) => chamar('pacote:importarEscudo', { pacote, sigla }), `Escudo de ${sigla} importado.`)

  /** Kit original do WE para a prévia dos uniformes (carregado uma vez). */
  const baseKit = ref<BaseKit | null>(null)
  async function carregarBaseKit(): Promise<BaseKit | null> {
    if (baseKit.value) return baseKit.value
    const r = await chamar('kit:base', undefined)
    if (!r) return null
    const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    baseKit.value = { rgba: bytes(r.rgba), pagina: bytes(r.pagina) }
    return baseKit.value
  }

  type CampoKit = 'kit' | 'kit_reserva' | 'kit_goleiro'
  const gerarKit = (sigla: string, campo: CampoKit, design: DesignKit, corNumero: string) =>
    operar(
      (pacote) => chamar('pacote:gerarKit', { pacote, sigla, campo, design: design as unknown as Record<string, unknown>, cor_numero: corNumero }),
      'Uniforme gerado. Vale para as carreiras novas deste pacote.',
    )

  function escudo(sigla: string): string | undefined {
    const p = aberto.value
    return p && p.escudos.includes(sigla) ? urlEscudoPacote(p.id, sigla, p.versao) : undefined
  }

  return { pacotes, aberto, ocupado, erros, avisos, aba, timeSelecionado, jogadorSelecionado, competicaoSelecionada, noticiaSelecionada, origemJogadores, filtroPosicao, semClubeSelecionado, irPara, salvarSemClube, listar, abrir, baseKit, carregarBaseKit, gerarKit, salvarTime, removerTime, salvarCompeticao, salvarDivisoes, salvarJanelas, salvarTemporada, salvarNoticias, removerCompeticao, importarEscudo, escudo }
})
