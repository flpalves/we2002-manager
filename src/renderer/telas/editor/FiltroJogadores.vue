<script setup lang="ts">
import { POSICOES, type Posicao } from '@shared/esquemas/pacote'
import WeBotao from '../../componentes/WeBotao.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'

/**
 * Topo da lista da aba Jogadores: de onde vêm os jogadores (times, exterior, livres),
 * filtro por posição principal e busca por nome. A origem e a posição ficam no store;
 * a busca é de quem usa (v-model). O slot fica entre a origem e o filtro (o seletor de time).
 */
const props = defineProps<{
  contagens: { exterior: number; livres: number }
  /** Alterações não salvas na lista atual: trocar de origem pede confirmação. */
  alterado: boolean
}>()
const busca = defineModel<string>('busca', { required: true })

const editor = useEditor()
const ui = useUi()

const ORIGENS = [
  { id: 'times', nome: 'Times' },
  { id: 'exterior', nome: 'Exterior' },
  { id: 'livres', nome: 'Livres' },
] as const

async function escolherOrigem(o: (typeof ORIGENS)[number]['id']): Promise<void> {
  if (o === editor.origemJogadores) return
  // Exterior e livres são um rascunho só (salvos juntos): trocar entre eles não perde nada.
  const mesmoRascunho = o !== 'times' && editor.origemJogadores !== 'times'
  if (props.alterado && !mesmoRascunho && !(await ui.confirmar('Descartar alterações', 'Há alterações não salvas nesta lista. Descartar?', 'Descartar'))) return
  busca.value = ''
  editor.origemJogadores = o
}

const alternarPosicao = (p: Posicao | null) => (editor.filtroPosicao = editor.filtroPosicao === p ? null : p)
</script>

<template>
  <div class="acoes origens" role="group" aria-label="Origem dos jogadores">
    <WeBotao v-for="o in ORIGENS" :key="o.id" :ativo="editor.origemJogadores === o.id" @click="escolherOrigem(o.id)">
      {{ o.nome }}<template v-if="o.id !== 'times'"> ({{ contagens[o.id] }})</template>
    </WeBotao>
  </div>
  <slot />
  <div class="posicoes" role="group" aria-label="Filtrar por posição">
    <WeBotao :ativo="editor.filtroPosicao === null" @click="alternarPosicao(null)">Todas</WeBotao>
    <WeBotao v-for="p in POSICOES" :key="p" :ativo="editor.filtroPosicao === p" @click="alternarPosicao(p)">{{ p }}</WeBotao>
  </div>
  <label class="campo busca"><span class="we-lb">Buscar</span><input v-model="busca" type="text" maxlength="40" placeholder="Nome ou nome no WE" /></label>
</template>

<style scoped>
.origens .we-btn {
  flex: 1;
  padding: 4px 6px;
}
.posicoes {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-top: var(--space-3);
}
.posicoes .we-btn {
  padding: 2px 4px;
  font-size: 11px;
  justify-content: center;
}
.busca {
  margin-top: var(--space-3);
}
.busca input {
  width: 100%;
  box-sizing: border-box;
}
</style>
