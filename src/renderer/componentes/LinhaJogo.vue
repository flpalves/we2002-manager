<script setup lang="ts">
import { computed } from 'vue'
import type { Jogo } from '@shared/esquemas/temporada'
import { RouterLink } from 'vue-router'
import TimeDaCarreira from './TimeDaCarreira.vue'

/** Mandante (escudo virado para o "x") · placar · visitante. */
const props = defineProps<{ jogo: Jogo; destaque?: string | null }>()

const placar = computed(() => {
  const p = props.jogo.placar
  if (!p) return 'x'
  return `${p.golsCasa} x ${p.golsVisitante}`
})
const extra = computed(() => {
  const p = props.jogo.placar
  if (!p) return ''
  if (p.penaltisCasa !== null) return `pên. ${p.penaltisCasa}-${p.penaltisVisitante}`
  return p.prorrogacao ? 'prorr.' : ''
})
</script>

<template>
  <span class="linha-jogo" :class="{ 'linha-jogo--usuario': destaque && (jogo.casa === destaque || jogo.visitante === destaque) }">
    <span class="lado lado--casa"><TimeDaCarreira :sigla="jogo.casa" escudo-depois /></span>
    <RouterLink v-if="jogo.placar" class="placar placar--link" :to="{ name: 'partida', params: { id: jogo.id } }" :title="'Ver súmula'">
      {{ placar }}<small v-if="extra">{{ extra }}</small>
    </RouterLink>
    <span v-else class="placar">{{ placar }}</span>
    <span class="lado"><TimeDaCarreira :sigla="jogo.visitante" /></span>
  </span>
</template>

<style scoped>
.linha-jogo {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
}
.lado--casa {
  justify-self: end;
}
.placar {
  min-width: 52px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.placar--link {
  text-decoration: none;
  border-radius: var(--radius-sm);
  padding: 0 4px;
}
.placar--link:hover {
  background: var(--botao-hover);
}
.placar small {
  font-family: var(--font-sans);
  font-weight: 500;
  font-size: 10px;
  color: var(--texto-suave);
}
.linha-jogo--usuario {
  font-weight: 700;
}
</style>
