<script setup lang="ts">
import { ref, watch } from 'vue'
import { centavosParaReais, reaisParaCentavos } from '../formato'

/** Campo em reais; o modelo é em centavos (inteiro). */
defineProps<{ rotulo: string }>()
const modelo = defineModel<number>({ required: true })
const texto = ref(centavosParaReais(modelo.value))
const invalido = ref(false)

watch(modelo, (v) => {
  if (reaisParaCentavos(texto.value) !== v) texto.value = centavosParaReais(v)
})

function aoDigitar(): void {
  const c = reaisParaCentavos(texto.value)
  invalido.value = c === null
  if (c !== null) modelo.value = c
}
</script>

<template>
  <label class="campo">
    <span class="we-lb">{{ rotulo }} (R$)</span>
    <input v-model="texto" type="text" inputmode="decimal" :aria-invalid="invalido" @input="aoDigitar" @blur="texto = centavosParaReais(modelo)" />
  </label>
</template>
