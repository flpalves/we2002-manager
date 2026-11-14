import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Tema } from '@shared/esquemas/config'
import { chamar } from '../api'
import { corSobreClube } from '../cores'
import type { Comando } from '../gamepad/controle'

/** Cor padrão enquanto não há carreira aberta (token `clube` do design system). */
export const COR_CLUBE_PADRAO = '#C8102E'

export interface Atalho {
  comando: Comando
  rotulo: string
  /** Texto da tecla, quando diferente do padrão (ex.: "LT/RT"). */
  tecla?: string
}

/**
 * Ações que a tela atual oferece ao controle (X, Y, LT/RT). `voltar` e `continuar`,
 * quando a tela os define, substituem o comportamento geral de B e START.
 */
export type AcoesTela = Partial<Record<'acaoX' | 'acaoY' | 'abaAnterior' | 'abaProxima' | 'voltar' | 'continuar', () => void>>

export const ATALHOS_GERAIS: readonly Atalho[] = [
  { comando: 'confirmar', rotulo: 'Selecionar' },
  { comando: 'voltar', rotulo: 'Voltar' },
  { comando: 'secaoAnterior', rotulo: 'Seção' },
  { comando: 'continuar', rotulo: 'Continuar' },
]

export const useUi = defineStore('ui', () => {
  const tema = ref<Tema>('escuro')
  const corClube = ref(COR_CLUBE_PADRAO)
  const atalhosTela = ref<Atalho[]>([])
  const acoesTela = shallowRef<AcoesTela>({})
  const aviso = ref<string | null>(null)
  let temporizadorAviso: ReturnType<typeof setTimeout> | undefined

  function aplicarTema(): void {
    const raiz = document.documentElement
    raiz.dataset['tema'] = tema.value
    raiz.style.setProperty('--clube', corClube.value)
    raiz.style.setProperty('--sobre-clube', corSobreClube(corClube.value))
  }

  async function carregar(): Promise<void> {
    try {
      const config = await chamar('config:obter', undefined)
      tema.value = config.tema
    } catch (e) {
      avisar(`Não foi possível ler as configurações: ${(e as Error).message}`)
    }
    aplicarTema()
  }

  async function definirTema(novo: Tema): Promise<void> {
    tema.value = novo
    aplicarTema()
    try {
      await chamar('config:salvar', { tema: novo })
    } catch (e) {
      avisar(`Tema não foi salvo: ${(e as Error).message}`)
    }
  }

  function alternarTema(): Promise<void> {
    return definirTema(tema.value === 'escuro' ? 'claro' : 'escuro')
  }

  function definirCorClube(cor: string): void {
    corClube.value = cor
    aplicarTema()
  }

  function definirTela(atalhos: Atalho[], acoes: AcoesTela): void {
    atalhosTela.value = atalhos
    acoesTela.value = acoes
  }

  function limparTela(): void {
    atalhosTela.value = []
    acoesTela.value = {}
  }

  function avisar(texto: string, ms = 4000): void {
    aviso.value = texto
    clearTimeout(temporizadorAviso)
    temporizadorAviso = setTimeout(() => (aviso.value = null), ms)
  }

  /** Diálogo de confirmação (modal, navegável pelo controle; B cancela). */
  const dialogo = ref<{ titulo: string; texto: string; botao: string; perigo: boolean } | null>(null)
  let responderDialogo: ((sim: boolean) => void) | null = null

  function confirmar(titulo: string, texto: string, botao = 'Confirmar', perigo = false): Promise<boolean> {
    responderDialogo?.(false)
    dialogo.value = { titulo, texto, botao, perigo }
    return new Promise((resolver) => {
      responderDialogo = resolver
    })
  }

  function responder(sim: boolean): void {
    const r = responderDialogo
    responderDialogo = null
    dialogo.value = null
    r?.(sim)
  }

  /** Ação do CONTINUAR / START, registrada pela store da carreira. */
  let acaoContinuar: (() => Promise<void>) | null = null
  function registrarContinuar(fn: () => Promise<void>): void {
    acaoContinuar = fn
  }

  function continuar(): void {
    if (acaoContinuar) void acaoContinuar()
    else avisar('Nenhuma carreira aberta. Crie ou carregue uma em Salvar / Carreiras.')
  }

  return {
    tema,
    corClube,
    atalhosTela,
    acoesTela,
    aviso,
    carregar,
    definirTema,
    alternarTema,
    definirCorClube,
    definirTela,
    limparTela,
    avisar,
    continuar,
    registrarContinuar,
    dialogo,
    confirmar,
    responder,
  }
})
