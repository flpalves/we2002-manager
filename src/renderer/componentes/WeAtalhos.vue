<script setup lang="ts">
import { ROTULO_CONTROLE, type Comando } from '../gamepad/controle'

defineProps<{ atalhos: { comando: Comando; rotulo: string; tecla?: string }[] }>()
</script>

<template>
  <footer class="we-atalhos" aria-label="Atalhos do controle">
    <span v-for="a in atalhos" :key="a.comando">
      <span class="we-kb">{{ a.tecla ?? ROTULO_CONTROLE[a.comando] }}</span>{{ a.rotulo }}
    </span>
    <span v-if="$slots.default" class="rodape__direita"><slot /></span>
  </footer>
</template>
