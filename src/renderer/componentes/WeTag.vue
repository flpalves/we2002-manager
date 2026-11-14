<script setup lang="ts">
withDefaults(
  defineProps<{
    tipo?: 'padrao' | 'tit' | 'fora' | 'positivo' | 'atencao' | 'negativo' | 'info' | 'diretoria'
  }>(),
  { tipo: 'padrao' },
)
</script>

<template>
  <span class="we-tag" :class="tipo !== 'padrao' && `we-tag--${tipo}`"><slot /></span>
</template>
