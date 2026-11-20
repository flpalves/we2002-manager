import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ResumoCarreira } from '@shared/esquemas/carreira'
import type { Entrada } from '@shared/esquemas/ipc'
import type { ResultadoContinuar } from '@shared/esquemas/temporada'
import type { SituacaoMercado } from '@shared/esquemas/mercado'
import { chamar, ErroApi } from '../api'
import { COR_CLUBE_PADRAO, useUi } from './ui'
import { useTemporada } from './temporada'
import { router } from '../router'

/** Escudo de um time do pacote ou da carreira aberta, pelo protocolo we-arquivo://. */
export function urlEscudoPacote(pacote: string, sigla: string, versao: number): string {
  return `we-arquivo://pacote/${pacote}/escudos/${encodeURIComponent(sigla)}.png?v=${versao}`
}

export function urlArquivoCarreira(caminho: string | null): string | undefined {
  return caminho ? `we-arquivo://carreira/${caminho.split('/').map(encodeURIComponent).join('/')}` : undefined
}

function textoPlacar(r: ResultadoContinuar, nome: (s: string) => string, proximo: { semana: number } | null = null): string {
  const j = r.jogoDoUsuario
  let texto = ''
  if (j?.placar) {
    const p = j.placar
    const pen = p.penaltisCasa !== null ? ` (pên. ${p.penaltisCasa} x ${p.penaltisVisitante})` : ''
    texto = `${j.competicaoNome}: ${nome(j.casa)} ${p.golsCasa} x ${p.golsVisitante} ${nome(j.visitante)}${pen}.`
  } else if (r.preJogo) {
    texto = `Semana ${r.semana}: ${r.passosJogados ? `${r.passosJogados} data(s) simulada(s). ` : ''}Seu jogo é nesta semana.`
  } else {
    texto = `Semana ${r.semana}: ${r.passosJogados ? `${r.passosJogados} data(s) simulada(s).` : 'sem jogos.'}`
    if (proximo && !r.encerrada) texto += ` Seu próximo jogo: semana ${proximo.semana}.`
  }
  for (const c of r.campeoes) texto += ` ${nome(c.time)} é campeão: ${c.competicao}!`
  if (r.encerrada) texto += ' Fim da temporada!'
  return texto
}

export const useCarreira = defineStore('carreira', () => {
  const atual = ref<ResumoCarreira | null>(null)
  /** Notícias não lidas e eventos esperando decisão (menu e Continuar). */
  const noticias = ref<{ naoLidas: number; pendentes: number } | null>(null)
  /** Movimentos, janela e saldo (barra superior e Mercado). */
  const mercado = ref<SituacaoMercado | null>(null)
  const ui = useUi()
  const temporada = useTemporada()

  const corClube = computed(() => atual.value?.time.cores[0] ?? COR_CLUBE_PADRAO)

  async function definir(r: ResumoCarreira | null): Promise<void> {
    atual.value = r
    ui.definirCorClube(corClube.value)
    if (r) await Promise.all([temporada.carregar(), carregarMercado()])
    else {
      temporada.limpar()
      mercado.value = null
    }
  }

  async function carregarMercado(): Promise<void> {
    try {
      mercado.value = atual.value ? await chamar('mercado:situacao', undefined) : null
    } catch {
      mercado.value = null
    }
    await carregarNoticias()
  }

  async function carregarNoticias(): Promise<void> {
    try {
      if (!atual.value) {
        noticias.value = null
        return
      }
      const c = await chamar('noticias:caixa', {})
      noticias.value = { naoLidas: c.naoLidas, pendentes: c.pendentes }
    } catch {
      noticias.value = null
    }
  }

  /** Depois de negociar, vender, mudar o ingresso ou trocar de clube: resumo, cor e movimentos. */
  async function atualizar(): Promise<void> {
    atual.value = await chamar('carreira:atual', undefined)
    ui.definirCorClube(corClube.value)
    await carregarMercado()
  }

  async function carregar(): Promise<void> {
    try {
      await definir(await chamar('carreira:atual', undefined))
    } catch {
      await definir(null)
    }
  }

  async function abrir(id: string): Promise<void> {
    await definir(await chamar('carreira:abrir', { id }))
  }

  /** Volta a carreira para um autosave e a deixa aberta. */
  async function restaurar(id: string, numero: number): Promise<void> {
    await definir(await chamar('carreira:restaurar', { id, numero }))
  }

  async function criar(entrada: Entrada<'carreira:criar'>): Promise<void> {
    await definir(await chamar('carreira:criar', entrada))
  }

  async function fechar(): Promise<void> {
    await chamar('carreira:fechar', undefined)
    await definir(null)
  }

  async function apagar(id: string): Promise<void> {
    await chamar('carreira:apagar', { id })
    if (atual.value?.id === id) await definir(null)
  }

  /**
   * START / CONTINUAR: o tempo anda uma semana (com ou sem jogo). Se o jogo do usuário cai
   * nela, abre o pré-jogo; se ele já é a data atual, vai direto para o pré-jogo.
   */
  async function continuar(): Promise<void> {
    if (!atual.value) return ui.avisar('Nenhuma carreira aberta. Crie ou carregue uma em Salvar / Carreiras.')
    if (temporada.avancando) return
    if (temporada.calendario?.encerrada) {
      void router.push({ name: 'fimTemporada' })
      return
    }
    if (noticias.value?.pendentes) {
      ui.avisar('Há uma notícia esperando a sua decisão.', 5000)
      void router.push({ name: 'noticias' })
      return
    }
    if (temporada.jogoNaDataAtual) {
      void router.push({ name: 'prejogo' })
      return
    }
    try {
      const r = await temporada.continuar()
      await atualizar()
      if (r.eventoPendente) {
        ui.avisar(`${textoPlacar(r, temporada.nome)} Uma notícia espera a sua decisão.`, 7000)
        void router.push({ name: 'noticias' })
        return
      }
      ui.avisar(textoPlacar(r, temporada.nome, temporada.proximoJogo), 7000)
      if (r.preJogo) void router.push({ name: 'prejogo' })
      else if (r.encerrada) void router.push({ name: 'fimTemporada' })
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'evento_pendente') {
        ui.avisar(e.message, 6000)
        void router.push({ name: 'noticias' })
        return
      }
      ui.avisar(`Não foi possível continuar: ${(e as Error).message}`, 8000)
    }
  }

  /** Depois do jogo do usuário (WE, simulado ou digitado): atualiza tudo e abre a súmula com os destaques. */
  async function concluirJogo(r: ResultadoContinuar): Promise<void> {
    await temporada.recarregar()
    await atualizar()
    ui.avisar(`${textoPlacar(r, temporada.nome)}${r.eventoPendente ? ' Uma notícia espera a sua decisão.' : ''}`, 7000)
    const j = r.jogoDoUsuario
    void router.push(j ? { name: 'partida', params: { id: j.id }, query: { destaques: '1' } } : { name: 'inicio' })
  }

  ui.registrarContinuar(continuar)

  return { atual, mercado, noticias, carregarNoticias, corClube, atualizar, carregar, abrir, restaurar, criar, fechar, apagar, continuar, concluirJogo }
})
