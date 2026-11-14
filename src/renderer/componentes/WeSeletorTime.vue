<script setup lang="ts">
/**
 * Seletor de time com busca (no espírito do select2): mostra o time escolhido com escudo;
 * ao abrir, um campo de busca filtra a lista enquanto se digita.
 * Teclado: ↑/↓ percorrem, Enter escolhe, Esc fecha. No controle, o mesmo com o direcional, A e B
 * (a lista fica marcada com `data-controle-proprio`; ver gamepad/navegacao.ts).
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import WeEscudo from './WeEscudo.vue'
import WeIcone from './WeIcone.vue'
import { filtrarTimes, type TimeBuscavel } from '../busca'

export interface OpcaoTime extends TimeBuscavel {
  cores: string[]
}

const props = withDefaults(
  defineProps<{
    times: readonly OpcaoTime[]
    /** Nome acessível do campo (ex.: "Clube"). */
    rotulo: string
    /** URL do escudo de cada time (PNG do pacote). */
    escudo?: (sigla: string) => string | undefined
    desabilitado?: boolean
    placeholder?: string
  }>(),
  { escudo: undefined, desabilitado: false, placeholder: 'Escolha um time' },
)
defineOptions({ inheritAttrs: false })
const modelo = defineModel<string>({ required: true })

const id = useId()
const aberto = ref(false)
const termo = ref('')
const destaque = ref(0)
const gatilho = ref<HTMLButtonElement | null>(null)
const caixa = ref<HTMLElement | null>(null)
const busca = ref<HTMLInputElement | null>(null)
const lista = ref<HTMLElement | null>(null)
const posicao = ref({ top: 0, bottom: 0, left: 0, width: 0, maxHeight: 320, acima: false })

const escolhido = computed(() => props.times.find((t) => t.sigla === modelo.value) ?? null)
const filtrados = computed(() => filtrarTimes(props.times, termo.value))

watch(termo, () => (destaque.value = 0))

function posicionar(): void {
  const r = gatilho.value?.getBoundingClientRect()
  if (!r) return
  const abaixo = window.innerHeight - r.bottom - 12
  const acima = r.top - 12
  const emCima = abaixo < 240 && acima > abaixo
  posicao.value = {
    top: r.bottom + 4,
    bottom: window.innerHeight - r.top + 4,
    left: r.left,
    width: Math.max(r.width, 280),
    maxHeight: Math.min(380, emCima ? acima : abaixo),
    acima: emCima,
  }
}

async function abrir(): Promise<void> {
  if (props.desabilitado || aberto.value) return
  termo.value = ''
  posicionar()
  aberto.value = true
  const i = filtrados.value.findIndex((t) => t.sigla === modelo.value)
  destaque.value = Math.max(0, i)
  await nextTick()
  busca.value?.focus()
  rolarParaDestaque()
  document.addEventListener('mousedown', aoClicarFora, true)
  window.addEventListener('resize', aoRedimensionar)
}

const aoRedimensionar = () => fechar(false)

function fechar(devolverFoco = true): void {
  if (!aberto.value) return
  aberto.value = false
  document.removeEventListener('mousedown', aoClicarFora, true)
  window.removeEventListener('resize', aoRedimensionar)
  if (devolverFoco) void nextTick(() => gatilho.value?.focus())
}

function escolher(sigla: string): void {
  modelo.value = sigla
  fechar()
}

function aoClicarFora(ev: MouseEvent): void {
  const alvo = ev.target as Node
  if (caixa.value?.contains(alvo) || gatilho.value?.contains(alvo)) return
  fechar(false)
}

function rolarParaDestaque(): void {
  void nextTick(() => lista.value?.querySelector<HTMLElement>(`[data-indice="${destaque.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}

function mover(passo: number): void {
  const n = filtrados.value.length
  if (!n) return
  destaque.value = (destaque.value + passo + n) % n
  rolarParaDestaque()
}

function aoTeclar(ev: KeyboardEvent): void {
  const tratar = () => {
    ev.preventDefault()
    ev.stopPropagation()
  }
  switch (ev.key) {
    case 'ArrowDown':
      tratar()
      mover(1)
      break
    case 'ArrowUp':
      tratar()
      mover(-1)
      break
    case 'PageDown':
      tratar()
      mover(8)
      break
    case 'PageUp':
      tratar()
      mover(-8)
      break
    case 'Enter': {
      tratar()
      const t = filtrados.value[destaque.value]
      if (t) escolher(t.sigla)
      break
    }
    case 'Escape':
      tratar()
      fechar()
      break
    case 'Tab':
      fechar(false)
      break
  }
}

/** No gatilho fechado, ↓ e Enter também abrem (como num select). */
function aoTeclarGatilho(ev: KeyboardEvent): void {
  if (ev.key === 'ArrowDown' && ev.altKey) {
    ev.preventDefault()
    void abrir()
  }
}

onBeforeUnmount(() => fechar(false))
</script>

<template>
  <button
    ref="gatilho"
    v-bind="$attrs"
    type="button"
    class="seletor"
    :class="{ 'seletor--aberto': aberto }"
    role="combobox"
    :aria-label="rotulo"
    :aria-expanded="aberto"
    :aria-controls="`${id}-lista`"
    aria-haspopup="listbox"
    :disabled="desabilitado"
    @click="aberto ? fechar() : abrir()"
    @keydown="aoTeclarGatilho"
  >
    <template v-if="escolhido">
      <WeEscudo :sigla="escolhido.sigla" :cor="escolhido.cores[0]" :src="escudo?.(escolhido.sigla)" tamanho="p" />
      <span class="seletor__nome">{{ escolhido.nome }}</span>
      <span class="seletor__extra">{{ escolhido.estado ?? escolhido.pais ?? '' }}</span>
    </template>
    <span v-else class="seletor__nome seletor__vazio">{{ placeholder }}</span>
    <WeIcone nome="seta" :tamanho="12" class="seletor__seta" />
  </button>

  <Teleport to="body">
    <div
      v-if="aberto"
      ref="caixa"
      class="seletor-caixa"
      :class="{ 'seletor-caixa--acima': posicao.acima }"
      data-controle-proprio
      :style="{
        left: `${posicao.left}px`,
        width: `${posicao.width}px`,
        maxHeight: `${posicao.maxHeight}px`,
        ...(posicao.acima ? { bottom: `${posicao.bottom}px` } : { top: `${posicao.top}px` }),
      }"
    >
      <div class="seletor-caixa__busca">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M10 3A7 7 0 1 0 10 17A7 7 0 1 0 10 3Z" /><path d="M15 15L21 21" stroke-linecap="square" />
        </svg>
        <input
          ref="busca"
          v-model="termo"
          type="text"
          role="searchbox"
          :aria-label="`Buscar ${rotulo.toLowerCase()}`"
          :aria-controls="`${id}-lista`"
          :aria-activedescendant="filtrados.length ? `${id}-op-${destaque}` : undefined"
          placeholder="Buscar por nome, sigla ou estado"
          autocomplete="off"
          spellcheck="false"
          @keydown="aoTeclar"
        />
        <span class="we-lb">{{ filtrados.length }}</span>
      </div>
      <ul :id="`${id}-lista`" ref="lista" class="seletor-caixa__lista" role="listbox" :aria-label="rotulo" @mousedown.prevent>
        <li
          v-for="(t, i) in filtrados"
          :id="`${id}-op-${i}`"
          :key="t.sigla"
          role="option"
          :data-indice="i"
          :aria-selected="t.sigla === modelo"
          class="opcao"
          :class="{ 'opcao--destaque': i === destaque, 'opcao--escolhida': t.sigla === modelo }"
          @mousemove="destaque = i"
          @click="escolher(t.sigla)"
        >
          <WeEscudo :sigla="t.sigla" :cor="t.cores[0]" :src="escudo?.(t.sigla)" tamanho="p" />
          <span class="opcao__nome">{{ t.nome }}</span>
          <span class="opcao__sigla">{{ t.sigla }}</span>
          <span class="opcao__extra">{{ t.estado ?? t.pais ?? '' }}</span>
        </li>
        <li v-if="!filtrados.length" class="opcao opcao--nada">Nenhum time encontrado.</li>
      </ul>
    </div>
  </Teleport>
</template>

<style scoped>
.seletor {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  font: inherit;
  font-size: 14px;
  text-align: left;
  color: var(--texto);
  background: var(--painel-fundo);
  border: 1px solid var(--linha-forte);
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-sizing: border-box;
}
.seletor:hover:not(:disabled) {
  border-color: var(--texto-suave);
}
.seletor--aberto {
  border-color: var(--clube);
}
.seletor:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.seletor__nome {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.seletor__vazio {
  color: var(--texto-suave);
}
.seletor__extra {
  font-size: 11px;
  color: var(--texto-suave);
}
.seletor__seta {
  transform: rotate(90deg);
  opacity: 0.7;
}
.seletor--aberto .seletor__seta {
  transform: rotate(-90deg);
}

.seletor-caixa {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: var(--painel);
  border: 1px solid var(--linha-forte);
  border-top: 3px solid var(--clube);
  border-radius: var(--radius-sm);
  box-shadow: 4px 4px 0 var(--sombra-dura);
  box-sizing: border-box;
}
.seletor-caixa--acima {
  flex-direction: column-reverse;
  border-top: 1px solid var(--linha-forte);
  border-bottom: 3px solid var(--clube);
}
.seletor-caixa__busca {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  color: var(--texto-suave);
  border-bottom: 1px solid var(--linha);
}
.seletor-caixa--acima .seletor-caixa__busca {
  border-bottom: 0;
  border-top: 1px solid var(--linha);
}
.seletor-caixa__busca input {
  flex: 1;
  min-width: 0;
  padding: 5px 6px;
  font: inherit;
  font-size: 14px;
  color: var(--texto-forte);
  background: var(--painel-fundo);
  border: 1px solid var(--linha-forte);
  border-radius: var(--radius-sm);
}
.seletor-caixa__busca input:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: -1px;
}
.seletor-caixa__lista {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  min-height: 0;
}
.opcao {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-left: 3px solid transparent;
  cursor: pointer;
}
.opcao--escolhida {
  font-weight: 700;
  color: var(--texto-forte);
}
.opcao--destaque {
  background: var(--botao-hover);
  border-left-color: var(--clube);
  outline: 1px solid var(--foco);
  outline-offset: -1px;
}
.opcao__nome {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opcao__sigla {
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--texto-suave);
}
.opcao__extra {
  width: 26px;
  font-size: 11px;
  text-align: right;
  color: var(--texto-suave);
}
.opcao--nada {
  cursor: default;
  color: var(--texto-suave);
}
</style>
