<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string
    /** Cabeçalho na cor do clube: só o painel principal da tela. */
    clube?: boolean
    /** Sem padding no corpo (para tabelas encostadas na borda). */
    semCorpo?: boolean
  }>(),
  { clube: false, semCorpo: false },
)
</script>

<template>
  <section class="we-panel">
    <div class="we-panel__head" :class="{ 'we-panel__head--clube': clube }">
      <span>{{ titulo }}</span>
      <span v-if="$slots.extra" class="we-panel__extra"><slot name="extra" /></span>
    </div>
    <slot v-if="semCorpo" />
    <div v-else class="we-panel__body"><slot /></div>
  </section>
</template>

<style scoped>
.we-panel__extra {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0;
}
</style>
