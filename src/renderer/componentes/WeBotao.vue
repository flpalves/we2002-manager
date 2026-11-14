<script setup lang="ts">
import { computed } from 'vue'
import WeIcone from './WeIcone.vue'
import type { NomeIcone } from '../icones'

const props = withDefaults(
  defineProps<{
    /** principal: cor do clube, uma vez por tela. opcao: escolha grande com subtítulo. */
    variante?: 'padrao' | 'principal' | 'opcao'
    /** Opção selecionada num grupo (formação, filtro, tema). */
    ativo?: boolean
    sub?: string
    tipo?: 'button' | 'submit'
    desabilitado?: boolean
    /** Ícone de traço à esquerda do rótulo (ver icones.ts). Filtros e seleções ficam sem ícone. */
    icone?: NomeIcone
  }>(),
  { variante: 'padrao', ativo: false, sub: undefined, tipo: 'button', desabilitado: false, icone: undefined },
)

const classes = computed(() => ({
  'we-btn--principal': props.variante === 'principal',
  'we-btn--opcao': props.variante === 'opcao',
  'we-btn--ativo': props.ativo,
  'we-btn--icone': !!props.icone,
}))
</script>

<template>
  <button
    class="we-btn"
    :class="classes"
    :type="tipo"
    :disabled="desabilitado"
    :aria-pressed="ativo ? 'true' : undefined"
  >
    <span v-if="icone" class="we-btn__rotulo">
      <WeIcone :nome="icone" :tamanho="variante === 'opcao' ? 16 : 14" class="we-btn__icone" />
      <span><slot /></span>
    </span>
    <slot v-else />
    <span v-if="sub" class="we-btn__sub">{{ sub }}</span>
  </button>
</template>

<style scoped>
.we-btn__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.we-btn--opcao .we-btn__rotulo {
  display: flex;
  gap: var(--space-2);
}
/* Ícone sozinho (ex.: subir/descer): sem o vão do texto vazio. */
.we-btn__rotulo > span:empty {
  display: none;
}
</style>
