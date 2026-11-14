<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ItemNav } from './tipos'
import WeIcone from './WeIcone.vue'

defineProps<{ itens: ItemNav[]; pe?: ItemNav[] }>()
</script>

<template>
  <nav class="we-nav menu" aria-label="Menu principal">
    <RouterLink v-for="item in itens" :key="item.nome" :to="{ name: item.nome }">
      <WeIcone v-if="item.icone" :nome="item.icone" />
      <span class="menu__titulo">{{ item.titulo }}</span><span v-if="item.contagem" class="menu__n" :class="{ 'menu__n--alerta': item.alerta }">{{ item.contagem }}</span>
    </RouterLink>
    <div v-if="pe?.length" class="menu__pe">
      <RouterLink v-for="item in pe" :key="item.nome" :to="{ name: item.nome }">
        <WeIcone v-if="item.icone" :nome="item.icone" />
        <span class="menu__titulo">{{ item.titulo }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.we-nav a {
  display: flex;
  align-items: center;
  gap: 8px;
}
.we-nav a .we-icone {
  opacity: 0.75;
}
.we-nav a[aria-current='page'] .we-icone,
.we-nav a:hover .we-icone {
  opacity: 1;
}
.menu__titulo {
  flex: 1;
  min-width: 0;
}
.menu__n {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: var(--radius-round);
  background: var(--painel-alt);
  color: var(--texto-forte);
  font-size: 11px;
  font-weight: 700;
}
.menu__n--alerta {
  background: var(--atencao);
  color: #111111;
}
</style>
