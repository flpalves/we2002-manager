<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import WeBotao from './WeBotao.vue'
import WePainel from './WePainel.vue'
import { useUi } from '../stores/ui'

const ui = useUi()
const cancelar = ref<InstanceType<typeof WeBotao> | null>(null)

// Ao abrir, o foco vai para "Cancelar" (a opção segura).
watch(
  () => ui.dialogo,
  (d) => {
    if (d) void nextTick(() => (cancelar.value?.$el as HTMLElement | undefined)?.focus())
  },
)
</script>

<template>
  <div v-if="ui.dialogo" class="dialogo" role="dialog" aria-modal="true" :aria-label="ui.dialogo.titulo">
    <div class="dialogo__caixa">
      <WePainel :titulo="ui.dialogo.titulo" :clube="!ui.dialogo.perigo">
        <p>{{ ui.dialogo.texto }}</p>
        <div class="acoes">
          <WeBotao ref="cancelar" icone="descartar" @click="ui.responder(false)">Cancelar</WeBotao>
          <WeBotao :icone="ui.dialogo.perigo ? 'lixeira' : 'confirmar'" :class="{ perigo: ui.dialogo.perigo }" @click="ui.responder(true)">{{ ui.dialogo.botao }}</WeBotao>
        </div>
      </WePainel>
    </div>
  </div>
</template>

<style scoped>
.dialogo {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10;
}
.dialogo__caixa {
  width: 460px;
}
.perigo {
  border-color: var(--negativo);
  color: var(--negativo);
}
</style>
