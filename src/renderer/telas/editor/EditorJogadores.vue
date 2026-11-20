<script setup lang="ts">
import EditorElenco from './EditorElenco.vue'
import EditorSemClube from './EditorSemClube.vue'
import { useEditor } from '../../stores/editor'

/**
 * Aba Jogadores: todos os jogadores do pacote num lugar só. A origem (no topo da lista) escolhe
 * entre o elenco de um time, os disponíveis do exterior e os livres; o filtro por posição vale
 * para as três.
 */
const editor = useEditor()
</script>

<template>
  <EditorElenco v-if="editor.origemJogadores === 'times'" />
  <EditorSemClube v-else />
</template>
