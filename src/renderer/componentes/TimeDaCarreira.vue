<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import WeTime from './WeTime.vue'
import { useTemporada } from '../stores/temporada'
import { urlArquivoCarreira } from '../stores/carreira'

/**
 * Escudo + nome de um time da carreira aberta, pela sigla. Por padrão é um link para a página
 * do clube (elenco, escalação); `:link="false"` quando já está dentro de outro botão ou link.
 */
const props = withDefaults(defineProps<{ sigla: string; tamanho?: 'p' | 'g' | 'm'; escudoDepois?: boolean; link?: boolean }>(), {
  tamanho: 'p',
  escudoDepois: false,
  link: true,
})
const temporada = useTemporada()
const t = computed(() => temporada.times.get(props.sigla))
</script>

<template>
  <RouterLink v-if="link && t" class="link-time" :to="{ name: 'time', params: { sigla } }" :title="`Ver ${t.nome}`">
    <WeTime :nome="t.nome" :sigla="sigla" :cor="t.cores[0]" :escudo="urlArquivoCarreira(t.escudo)" :tamanho="tamanho" :escudo-depois="escudoDepois" />
  </RouterLink>
  <WeTime
    v-else
    :nome="t?.nome ?? sigla"
    :sigla="sigla"
    :cor="t?.cores[0]"
    :escudo="urlArquivoCarreira(t?.escudo ?? null)"
    :tamanho="tamanho"
    :escudo-depois="escudoDepois"
  />
</template>

<style scoped>
.link-time {
  color: inherit;
  text-decoration: none;
  border-radius: var(--radius-sm);
}
.link-time:hover :deep(.we-time) {
  text-decoration: underline;
}
</style>
