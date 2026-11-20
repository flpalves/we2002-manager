<script setup lang="ts">
import { computed, ref } from 'vue'
import WePainel from '../../componentes/WePainel.vue'
import WeSeletorTime from '../../componentes/WeSeletorTime.vue'
import PainelUniformes from './PainelUniformes.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'

/** Aba Uniformes: escolhe o time pelo seletor com busca e edita os três uniformes dele. */
const editor = useEditor()
const ui = useUi()

const times = computed(() => [...(editor.aberto?.times ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)))
if (!editor.timeSelecionado && times.value[0]) editor.timeSelecionado = times.value[0].sigla
const time = computed(() => editor.aberto?.times.find((t) => t.sigla === editor.timeSelecionado) ?? null)
const painel = ref<InstanceType<typeof PainelUniformes> | null>(null)

const timeEscolhido = computed({
  get: () => editor.timeSelecionado ?? '',
  set: async (sigla: string) => {
    if (sigla === editor.timeSelecionado) return
    if (painel.value?.algumAlterado && !(await ui.confirmar('Descartar alterações', 'Há uniformes alterados e não gerados neste time. Descartar?', 'Descartar'))) return
    editor.timeSelecionado = sigla
  },
})
</script>

<template>
  <div class="barra-time">
    <span class="we-lb">Time</span>
    <div class="seletor"><WeSeletorTime v-model="timeEscolhido" :times="times" rotulo="Time" :escudo="editor.escudo" /></div>
  </div>
  <PainelUniformes v-if="time" ref="painel" :time="time" />
  <WePainel v-else titulo="Uniformes"><p>Escolha um time.</p></WePainel>
</template>

<style scoped>
.barra-time {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.seletor {
  width: min(360px, 100%);
}
</style>
