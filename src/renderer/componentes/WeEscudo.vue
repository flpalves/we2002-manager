<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { corSobreClube } from '../cores'

const props = withDefaults(
  defineProps<{
    sigla: string
    /** 1ª cor do time, para o escudo provisório. */
    cor?: string
    /** PNG do pacote. Sem ele (ou se falhar), mostra o escudo provisório. */
    src?: string
    /** p: listas (20px) · g: destaques (44px) · m: placar (56px). */
    tamanho?: 'p' | 'g' | 'm'
    /** Nome do time; sem ele o escudo é decorativo (fica ao lado de um nome visível). */
    nome?: string
  }>(),
  { cor: '#555555', src: undefined, tamanho: 'p', nome: undefined },
)

const falhou = ref(false)
watch(
  () => props.src,
  () => (falhou.value = false),
)

const provisorio = computed(() => !props.src || falhou.value)
const estilo = computed(() =>
  provisorio.value ? { '--escudo-cor': props.cor, '--escudo-texto': corSobreClube(props.cor) } : undefined,
)
</script>

<template>
  <span
    class="we-escudo"
    :class="{ 'we-escudo--p': tamanho === 'p', 'we-escudo--g': tamanho === 'g', 'we-escudo--provisorio': provisorio }"
    :style="estilo"
    :role="nome ? 'img' : undefined"
    :aria-label="nome"
    :aria-hidden="nome ? undefined : 'true'"
  >
    <img v-if="src && !falhou" :src="src" alt="" @error="falhou = true" />
    <template v-else>{{ sigla }}</template>
  </span>
</template>
