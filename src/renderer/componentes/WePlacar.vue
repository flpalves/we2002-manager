<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ casa?: number | null; visitante?: number | null }>()

const texto = computed(() => {
  const g = (n: number | null | undefined) => (n === null || n === undefined ? '–' : String(n))
  return `${g(props.casa)} x ${g(props.visitante)}`
})
</script>

<template>
  <span class="we-placar" role="img" :aria-label="`Placar ${texto}`">{{ texto }}</span>
</template>
