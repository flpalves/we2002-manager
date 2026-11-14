<script setup lang="ts">
/** Critério de um lado da troca entre divisões: posição, fase ou grupo (spec 03, divisoes.json). */
import { computed } from 'vue'
import type { Competicao, CriterioDivisao } from '@shared/esquemas/pacote'
import WeBotao from '../../componentes/WeBotao.vue'

const props = defineProps<{
  competicao: Competicao | undefined
  /** primeiros = quem sobe desta divisão; ultimos = quem desce dela. */
  lado: 'primeiros' | 'ultimos'
  troca: number
  rotulo: string
}>()
const modelo = defineModel<CriterioDivisao | undefined>({ required: true })

const atual = computed<CriterioDivisao>(() => modelo.value ?? { criterio: 'posicao' })
const fases = computed(() => props.competicao?.fases ?? [])
const fasesGrupo = computed(() => fases.value.filter((f) => f.formato === 'grupos'))

function escolher(tipo: CriterioDivisao['criterio']): void {
  if (tipo === 'posicao') modelo.value = undefined
  else if (tipo === 'fase') modelo.value = { criterio: 'fase', fase: fases.value[fases.value.length - 1]?.id ?? '' }
  else {
    const f = fasesGrupo.value[0]
    const q = f?.formato === 'grupos' ? f.grupos.quantidade : 1
    modelo.value = { criterio: 'grupo', fase: f?.id ?? '', por_grupo: Math.max(1, Math.round(props.troca / q)) }
  }
}

const verbo = computed(() => (props.lado === 'primeiros' ? 'sobem' : 'descem'))
const resumo = computed(() => {
  const c = atual.value
  const n = props.troca
  const fase = (id: string) => fases.value.find((f) => f.id === id)?.nome ?? id
  if (c.criterio === 'posicao') return `Os ${n} ${props.lado === 'primeiros' ? 'primeiros' : 'últimos'} da classificação final ${verbo.value}.`
  if (c.criterio === 'fase') return `Entre quem jogou "${fase(c.fase)}", os ${n} ${props.lado === 'primeiros' ? 'melhores' : 'piores'} ${verbo.value}.`
  const f = fasesGrupo.value.find((x) => x.id === c.fase)
  const q = f?.formato === 'grupos' ? f.grupos.quantidade : 0
  return `Os ${c.por_grupo} ${props.lado === 'primeiros' ? 'primeiros' : 'últimos'} de cada grupo de "${fase(c.fase)}" ${verbo.value} (${c.por_grupo} × ${q} = ${c.por_grupo * q}).`
})
</script>

<template>
  <div class="criterio">
    <span class="we-lb">{{ rotulo }}</span>
    <div class="acoes" role="group" :aria-label="`Critério: ${rotulo}`">
      <WeBotao :ativo="atual.criterio === 'posicao'" @click="escolher('posicao')">Posição</WeBotao>
      <WeBotao :ativo="atual.criterio === 'fase'" :desabilitado="!fases.length" @click="escolher('fase')">Fase</WeBotao>
      <WeBotao :ativo="atual.criterio === 'grupo'" :desabilitado="!fasesGrupo.length" @click="escolher('grupo')">Grupo</WeBotao>
    </div>
    <div v-if="modelo && modelo.criterio !== 'posicao'" class="criterio__campos">
      <label class="campo">
        <span class="we-lb">Fase</span>
        <select v-model="modelo.fase">
          <option v-for="f in modelo.criterio === 'grupo' ? fasesGrupo : fases" :key="f.id" :value="f.id">{{ f.nome }}</option>
        </select>
      </label>
      <label v-if="modelo.criterio === 'grupo'" class="campo">
        <span class="we-lb">Por grupo</span>
        <input v-model.number="modelo.por_grupo" type="number" min="1" />
      </label>
    </div>
    <p class="criterio__resumo">{{ resumo }}</p>
  </div>
</template>

<style scoped>
.criterio {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.criterio__campos {
  display: flex;
  gap: var(--space-2);
}
.criterio__campos .campo {
  flex: 1;
}
.criterio__resumo {
  margin: 0;
  font-size: 13px;
  color: var(--texto-suave);
}
</style>
