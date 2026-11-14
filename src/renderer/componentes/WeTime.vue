<script setup lang="ts">
import WeEscudo from './WeEscudo.vue'

withDefaults(
  defineProps<{
    nome: string
    sigla: string
    cor?: string
    escudo?: string
    tamanho?: 'p' | 'g' | 'm'
    /** Escudo depois do nome (mandante numa linha de confronto: escudo virado para o "x"). */
    escudoDepois?: boolean
  }>(),
  { cor: undefined, escudo: undefined, tamanho: 'p', escudoDepois: false },
)
</script>

<template>
  <span class="we-time">
    <template v-if="escudoDepois">{{ nome }}</template>
    <WeEscudo :sigla="sigla" :cor="cor" :src="escudo" :tamanho="tamanho" />
    <template v-if="!escudoDepois">{{ nome }}</template>
  </span>
</template>
