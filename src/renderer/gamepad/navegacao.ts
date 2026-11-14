import { nextTick } from 'vue'
import type { Router } from 'vue-router'
import { LeitorControle, MAPA_TECLAS, type Comando } from './controle'
import { proximoFoco, type Direcao } from './espacial'
import { ordemMenu } from '../router'
import type { useUi } from '../stores/ui'

type Ui = ReturnType<typeof useUi>

const FOCAVEIS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function visivel(el: HTMLElement): boolean {
  if (el.closest('[inert],[aria-hidden="true"]')) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export function focaveis(raiz: ParentNode = document): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(visivel)
}

function retangulo(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, largura: r.width, altura: r.height }
}

function regiaoDe(el: Element): Element | null {
  return el.closest('nav, header, main, footer')
}

function focar(el: HTMLElement): void {
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/** Move o foco na direção pedida; sem foco, vai para o primeiro elemento do conteúdo. */
export function moverFoco(dir: Direcao): void {
  const atual = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
  const todos = focaveis()
  if (!atual || !todos.includes(atual)) {
    const inicial = focaveis(document.querySelector('main') ?? document)[0] ?? todos[0]
    if (inicial) focar(inicial)
    return
  }
  const candidatos = todos.filter((el) => el !== atual).map((item) => ({ item, ret: retangulo(item) }))
  const origem = retangulo(atual)
  // ↑/↓ ficam na região atual (menu, barra superior ou conteúdo) quando há para onde ir;
  // ←/→ atravessam regiões (é assim que se entra e sai do menu).
  let alvo: HTMLElement | null = null
  if (dir === 'cima' || dir === 'baixo') {
    const regiao = regiaoDe(atual)
    alvo = proximoFoco(origem, candidatos.filter((c) => regiaoDe(c.item) === regiao), dir)
  }
  alvo ??= proximoFoco(origem, candidatos, dir)
  if (alvo) focar(alvo)
}

function campoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit'].includes(el.type))
}

/** Comando do controle → tecla enviada a um elemento com `data-controle-proprio`. */
const TECLA_PROPRIA: Partial<Record<Comando, string>> = {
  cima: 'ArrowUp',
  baixo: 'ArrowDown',
  confirmar: 'Enter',
  voltar: 'Escape',
  abaAnterior: 'PageUp',
  abaProxima: 'PageDown',
}

export interface Navegacao {
  executar(c: Comando, origem: 'controle' | 'teclado'): void
  parar(): void
}

export function instalarNavegacao(router: Router, ui: Ui): Navegacao {
  let trocaPorSecao = false
  const irSecao = (passo: 1 | -1) => {
    const atual = router.currentRoute.value.name as string
    const i = ordemMenu.indexOf(atual)
    // Fora do menu da carreira (ex.: editor do pacote) LB/RB não trocam de tela.
    if (i < 0) return
    const proxima = ordemMenu[(i + passo + ordemMenu.length) % ordemMenu.length]
    if (!proxima) return
    trocaPorSecao = true
    void router.push({ name: proxima })
  }

  const executar = (c: Comando, origem: 'controle' | 'teclado') => {
    // Listas com navegação própria (ex.: seletor de time aberto): o controle vira as teclas da lista.
    // No teclado as teclas já chegam nativas ao campo.
    const ativo = document.activeElement
    if (origem === 'controle' && ativo instanceof HTMLElement && ativo.closest('[data-controle-proprio]')) {
      const tecla = TECLA_PROPRIA[c]
      if (tecla) ativo.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }))
      if (tecla || c === 'esquerda' || c === 'direita') return
    }
    // Com um diálogo aberto, só valem direção, A e B (B cancela).
    if (ui.dialogo) {
      if (c === 'voltar') ui.responder(false)
      else if (c === 'confirmar' && origem === 'controle' && document.activeElement instanceof HTMLElement) document.activeElement.click()
      else if (c === 'cima' || c === 'baixo' || c === 'esquerda' || c === 'direita') moverFoco(c)
      return
    }
    switch (c) {
      case 'cima':
      case 'baixo':
      case 'esquerda':
      case 'direita':
        moverFoco(c)
        return
      case 'confirmar':
        // No teclado o Enter já clica nativamente.
        if (origem === 'controle' && document.activeElement instanceof HTMLElement) document.activeElement.click()
        return
      case 'voltar':
        if (ui.acoesTela.voltar) return ui.acoesTela.voltar()
        if (window.history.length > 1 && router.currentRoute.value.name !== 'inicio') router.back()
        else void router.push({ name: 'inicio' })
        return
      case 'secaoAnterior':
        if (router.currentRoute.value.meta.telaCheia) return
        irSecao(-1)
        return
      case 'secaoProxima':
        if (router.currentRoute.value.meta.telaCheia) return
        irSecao(1)
        return
      case 'continuar':
        if (ui.acoesTela.continuar) return ui.acoesTela.continuar()
        // No editor do pacote não há carreira para avançar.
        if (router.currentRoute.value.meta.editor) return
        ui.continuar()
        return
      case 'acaoX':
      case 'acaoY':
      case 'abaAnterior':
      case 'abaProxima':
        ui.acoesTela[c]?.()
        return
    }
  }

  const aoTeclar = (ev: KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return
    const c = MAPA_TECLAS[ev.key] ?? MAPA_TECLAS[ev.key.toLowerCase()]
    if (!c) return
    // Dentro de um campo de texto as teclas são do campo (Esc ainda volta).
    if (campoDeTexto(ev.target) && c !== 'voltar') return
    if (campoDeTexto(ev.target) && ev.key === 'Backspace') return
    ev.preventDefault()
    executar(c, 'teclado')
  }
  window.addEventListener('keydown', aoTeclar)

  // Intervalo fixo em vez de requestAnimationFrame, que para quando a janela fica encoberta.
  const leitor = new LeitorControle()
  const ler = () => {
    const pad = navigator.getGamepads().find((g) => g && g.connected)
    if (pad) {
      const estado = { botoes: pad.buttons.map((b) => b.pressed), eixos: pad.axes }
      for (const c of leitor.atualizar(estado, performance.now())) executar(c, 'controle')
    } else {
      leitor.reiniciar()
    }
  }
  const intervalo = window.setInterval(ler, 16)

  // Ao trocar de tela, o foco vai para o conteúdo novo (o gamepad precisa de um ponto de partida),
  // exceto quando a troca veio de um clique no menu: aí o foco fica no menu.
  // A tela pode marcar a ação mais provável com `data-foco-inicial` (ex.: Simular no pré-jogo,
  // a decisão em Notícias). Como os dados chegam depois da troca de rota, espera até ~1,5 s por ela,
  // sem tirar o foco se o usuário já tiver se mexido.
  let esperaFoco = 0
  const focarConteudo = () =>
    void nextTick(() => {
      window.clearInterval(esperaFoco)
      const main = document.querySelector('main') ?? document
      const marcado = () => focaveis(main).find((el) => el.hasAttribute('data-foco-inicial'))
      const primeiro = marcado() ?? focaveis(main)[0]
      if (primeiro) focar(primeiro)
      if (marcado()) return
      const automatico = primeiro ?? null
      let tentativas = 0
      esperaFoco = window.setInterval(() => {
        // Marcado tem preferência; sem nada focado ainda, serve o primeiro que aparecer.
        const alvo = marcado() ?? (automatico === null ? focaveis(main)[0] : undefined)
        const mexeu = document.activeElement !== automatico && document.activeElement !== document.body
        if (alvo && !mexeu) focar(alvo)
        if (alvo || mexeu || ++tentativas > 15) window.clearInterval(esperaFoco)
      }, 100)
    })
  const pararRota = router.afterEach(() => {
    if (trocaPorSecao) {
      trocaPorSecao = false
      focarConteudo()
      return
    }
    const ativo = document.activeElement
    if (ativo && ativo !== document.body && ativo.closest('nav')) return
    focarConteudo()
  })
  focarConteudo()

  return {
    executar,
    parar: () => {
      window.removeEventListener('keydown', aoTeclar)
      window.clearInterval(intervalo)
      pararRota()
    },
  }
}
