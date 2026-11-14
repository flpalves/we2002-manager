<script setup lang="ts">
import { computed } from 'vue'
import type { NivelSeta } from './tipos'

const props = defineProps<{ nivel: NivelSeta }>()

const NOMES: Record<NivelSeta, string> = {
  otima: 'ótima',
  boa: 'boa',
  normal: 'normal',
  ruim: 'ruim',
  pessima: 'péssima',
}

const rotulo = computed(() => `Seta ${NOMES[props.nivel]}`)
</script>

<template>
  <svg class="we-seta" :class="`we-seta--${nivel}`" viewBox="0 0 14 14" role="img" :aria-label="rotulo">
    <path d="M7 1 L12 7 H8.6 V13 H5.4 V7 H2 Z" />
  </svg>
</template>
