<script setup lang="ts" generic="T extends string">
/** Abas da tela (LT/RT trocam pelo controle; ver useAbas). */
defineProps<{ abas: { id: T; titulo: string; contagem?: number }[]; rotulo: string }>()
const modelo = defineModel<T>({ required: true })
</script>

<template>
  <div class="abas" role="tablist" :aria-label="rotulo">
    <button
      v-for="a in abas"
      :key="a.id"
      type="button"
      role="tab"
      class="we-btn"
      :class="{ 'we-btn--ativo': modelo === a.id }"
      :aria-selected="modelo === a.id"
      @click="modelo = a.id"
    >
      {{ a.titulo }}<span v-if="a.contagem !== undefined" class="abas__n">{{ a.contagem }}</span>
    </button>
  </div>
</template>

<style scoped>
.abas {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.abas__n {
  margin-left: 6px;
  opacity: 0.8;
}
</style>
