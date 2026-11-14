<script setup lang="ts">
import { computed } from 'vue'
import { ICONES, type DesenhoIcone, type NomeIcone } from '../icones'

const props = withDefaults(defineProps<{ nome: NomeIcone; tamanho?: number }>(), { tamanho: 16 })
const desenho = computed<DesenhoIcone>(() => ICONES[props.nome])
</script>

<template>
  <svg
    class="we-icone"
    :width="tamanho"
    :height="tamanho"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="square"
    stroke-linejoin="miter"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in desenho.traco" :key="`t${i}`" :d="d" />
    <path v-for="(d, i) in desenho.cheio ?? []" :key="`c${i}`" :d="d" fill="currentColor" stroke="none" />
  </svg>
</template>

<style scoped>
.we-icone {
  flex: 0 0 auto;
  display: block;
}
</style>
