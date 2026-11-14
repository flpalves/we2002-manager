<script setup lang="ts">
import { computed } from 'vue'
import type { JogadorElenco } from '@shared/esquemas/elenco'
import WeSeta from './WeSeta.vue'
import { nomePosicao } from '../formato'

/**
 * Campo da escalação (08): as 11 vagas da formação do WE, do goleiro (embaixo) ao ataque.
 * Cada vaga é um botão (foco do controle); a tela decide o que fazer no clique.
 */
const props = defineProps<{
  papeis: readonly string[]
  titulares: readonly (string | null)[]
  jogadores: ReadonlyMap<string, JogadorElenco>
  selecionada: number | null
  /** Ids que não jogam no dia (lesão/suspensão): a IA troca na hora. */
  desfalques: ReadonlySet<string>
}>()
const emit = defineEmits<{ vaga: [indice: number] }>()

type Linha = 'gol' | 'defesa' | 'volante' | 'meio' | 'ataque'
const LINHA: Record<string, Linha> = { GK: 'gol', CB: 'defesa', SB: 'defesa', DH: 'volante', SH: 'meio', OH: 'meio', CF: 'ataque', WG: 'ataque' }
const ALTURA: Record<Linha, number> = { gol: 89, defesa: 70, volante: 53, meio: 36, ataque: 15 }
const ABERTO = new Set(['SB', 'SH', 'WG'])

/** Posição (%) de cada vaga: abertos (laterais, meias abertos, pontas) nas beiradas. */
const posicoes = computed(() => {
  const saida: { x: number; y: number }[] = props.papeis.map(() => ({ x: 50, y: 50 }))
  const linhas = new Map<Linha, number[]>()
  props.papeis.forEach((p, i) => {
    const l = LINHA[p] ?? 'meio'
    linhas.set(l, [...(linhas.get(l) ?? []), i])
  })
  for (const [l, indices] of linhas) {
    const abertos = indices.filter((i) => ABERTO.has(props.papeis[i]!))
    const centrais = indices.filter((i) => !ABERTO.has(props.papeis[i]!))
    const esquerda = abertos.filter((_, k) => k % 2 === 0)
    const direita = abertos.filter((_, k) => k % 2 === 1)
    const ordem = [...esquerda, ...centrais, ...direita.reverse()]
    // Linha só de centrais (zagueiros, volantes, centroavantes) fica mais fechada no meio.
    const [ini, fim] = abertos.length ? [12, 88] : ordem.length >= 3 ? [24, 76] : [34, 66]
    ordem.forEach((i, k) => {
      const n = ordem.length
      saida[i] = { x: n === 1 ? 50 : ini + ((fim - ini) * k) / (n - 1), y: ALTURA[l] }
    })
  }
  return saida
})

const nomeCurto = (j: JogadorElenco) => j.nomeWe || j.nome
</script>

<template>
  <div class="campo" role="group" aria-label="Campo da escalação">
    <div class="campo__linhas" aria-hidden="true">
      <span class="campo__meio" />
      <span class="campo__circulo" />
      <span class="campo__area campo__area--cima" />
      <span class="campo__area campo__area--baixo" />
    </div>
    <button
      v-for="(papel, i) in papeis"
      :key="i"
      type="button"
      class="vaga"
      :class="{ 'vaga--sel': selecionada === i, 'vaga--vazia': !titulares[i], 'vaga--fora': titulares[i] && desfalques.has(titulares[i]!) }"
      :style="{ left: `${posicoes[i]!.x}%`, top: `${posicoes[i]!.y}%` }"
      :aria-label="`${nomePosicao(papel)}: ${titulares[i] ? (jogadores.get(titulares[i]!)?.nome ?? '') : 'vazia'}`"
      @click="emit('vaga', i)"
    >
      <template v-if="titulares[i] && jogadores.get(titulares[i]!)">
        <span class="vaga__num">{{ jogadores.get(titulares[i]!)!.camisa }}</span>
        <span class="vaga__nome">{{ nomeCurto(jogadores.get(titulares[i]!)!) }}</span>
        <span class="vaga__info">
          <span class="vaga__papel">{{ nomePosicao(papel) }}</span>
          <WeSeta :nivel="jogadores.get(titulares[i]!)!.seta" />
          <span class="vaga__cond" :title="`Condição ${Math.round(jogadores.get(titulares[i]!)!.condicao)}%`">{{ Math.round(jogadores.get(titulares[i]!)!.condicao) }}%</span>
        </span>
      </template>
      <template v-else>
        <span class="vaga__num">?</span>
        <span class="vaga__nome">{{ nomePosicao(papel) }}</span>
        <span class="vaga__info">vaga vazia</span>
      </template>
    </button>
  </div>
</template>

<style scoped>
.campo {
  position: relative;
  aspect-ratio: 68 / 80;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  background: repeating-linear-gradient(180deg, var(--gramado) 0 10%, var(--gramado-escuro) 10% 20%);
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: var(--radius-sm);
  box-shadow: var(--sombra-painel);
}
.campo__linhas > span {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.35);
}
.campo__meio {
  left: 0;
  right: 0;
  top: 50%;
  border-width: 2px 0 0 !important;
}
.campo__circulo {
  left: 50%;
  top: 50%;
  width: 22%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.campo__area {
  left: 25%;
  right: 25%;
  height: 14%;
}
.campo__area--cima {
  top: -2px;
}
.campo__area--baixo {
  bottom: -2px;
}
.vaga {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 4px 3px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.62);
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}
.vaga:hover {
  border-color: rgba(255, 255, 255, 0.6);
}
.vaga:focus-visible {
  outline: 3px solid var(--foco);
  outline-offset: 1px;
}
.vaga--sel {
  border-color: var(--atencao);
  background: rgba(0, 0, 0, 0.82);
}
.vaga--vazia {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.5);
}
.vaga--fora .vaga__nome {
  text-decoration: line-through;
  color: #ff8a80;
}
.vaga__num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--clube);
  color: var(--sobre-clube);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
}
.vaga__nome {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vaga__info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  opacity: 0.9;
}
.vaga__papel {
  font-weight: 700;
}
</style>
