<script setup lang="ts">
import { computed } from 'vue'

/** Cor "#RRGGBB" com seletor nativo e amostras rápidas (alcançáveis pelo controle). */
const props = defineProps<{ rotulo: string; modelValue: string; amostras: readonly string[] }>()
const emit = defineEmits<{ 'update:modelValue': [cor: string] }>()

const unicas = computed(() => [...new Set(props.amostras.map((c) => c.toUpperCase()))])
const definir = (cor: string) => emit('update:modelValue', cor.toUpperCase())
</script>

<template>
  <div class="campo campo-cor">
    <span class="we-lb">{{ rotulo }}</span>
    <div class="linha">
      <input type="color" :value="modelValue" :aria-label="rotulo" @input="(e) => definir((e.target as HTMLInputElement).value)" />
      <span class="hex">{{ modelValue.toUpperCase() }}</span>
    </div>
    <div class="amostras" role="group" :aria-label="`Cores sugeridas para ${rotulo}`">
      <button
        v-for="c in unicas"
        :key="c"
        type="button"
        class="amostra"
        :style="{ background: c }"
        :aria-label="c"
        :aria-pressed="c === modelValue.toUpperCase()"
        :title="c"
        @click="definir(c)"
      />
    </div>
  </div>
</template>

<style scoped>
.linha {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.hex {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  color: var(--texto-suave);
}
.amostras {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.amostra {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--linha-forte);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.amostra[aria-pressed='true'] {
  outline: 2px solid var(--texto-forte);
  outline-offset: 1px;
}
.amostra:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 1px;
}
</style>
