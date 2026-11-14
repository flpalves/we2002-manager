<script setup lang="ts">
import { computed } from 'vue'

/** Barra de 0-100 com o número ao lado; a cor repete o que o número diz. */
const props = withDefaults(defineProps<{ valor: number; rotulo?: string }>(), { rotulo: 'Condição' })
const cor = computed(() => (props.valor >= 75 ? 'var(--positivo)' : props.valor >= 50 ? 'var(--atencao)' : 'var(--negativo)'))
</script>

<template>
  <span class="barra" role="meter" :aria-label="rotulo" :aria-valuenow="Math.round(valor)" aria-valuemin="0" aria-valuemax="100">
    <span class="barra__trilho"><span class="barra__cheio" :style="{ width: `${Math.max(0, Math.min(100, valor))}%`, background: cor }"></span></span>
    <span class="barra__n">{{ Math.round(valor) }}</span>
  </span>
</template>

<style scoped>
.barra {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.barra__trilho {
  width: 56px;
  height: 6px;
  background: var(--linha);
  border-radius: 1px;
  overflow: hidden;
}
.barra__cheio {
  display: block;
  height: 100%;
}
.barra__n {
  min-width: 24px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
