<script setup lang="ts">
import { computed } from 'vue'
import { bandeira, nomePais } from '../bandeiras'

/** Bandeira do país (código de 3 letras); sem desenho, mostra a sigla. */
const props = withDefaults(defineProps<{ codigo: string; tamanho?: 'p' | 'g' }>(), { tamanho: 'p' })
const b = computed(() => bandeira(props.codigo))
</script>

<template>
  <span class="we-bandeira" :class="{ 'we-bandeira--g': tamanho === 'g' }" role="img" :aria-label="nomePais(codigo)" :title="nomePais(codigo)">
    <!-- eslint-disable-next-line vue/no-v-html -- SVG vem de constantes do próprio app (bandeiras.ts) -->
    <svg v-if="b" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true" v-html="b.svg" />
    <span v-else class="we-bandeira__sigla">{{ codigo }}</span>
  </span>
</template>

<style scoped>
.we-bandeira {
  display: inline-flex;
  flex: none;
  width: 21px;
  height: 14px;
  vertical-align: -2px;
  overflow: hidden;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  background: var(--painel-alt);
}
.we-bandeira--g {
  width: 33px;
  height: 22px;
  vertical-align: -5px;
}
.we-bandeira svg {
  width: 100%;
  height: 100%;
  display: block;
}
.we-bandeira__sigla {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--texto-forte);
}
.we-bandeira--g .we-bandeira__sigla {
  font-size: 10px;
}
</style>
