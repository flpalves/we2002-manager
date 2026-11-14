<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import WeAbas from '../componentes/WeAbas.vue'
import WePainel from '../componentes/WePainel.vue'
import { useTela } from '../composables/useTela'
import { acoesAbas } from '../composables/useAbas'
import { useEditor } from '../stores/editor'
import { useUi } from '../stores/ui'
import EditorTimes from './editor/EditorTimes.vue'
import EditorJogadores from './editor/EditorJogadores.vue'
import EditorUniformes from './editor/EditorUniformes.vue'
import EditorCompeticoes from './editor/EditorCompeticoes.vue'
import EditorDivisoes from './editor/EditorDivisoes.vue'
import EditorTemporada from './editor/EditorTemporada.vue'
import EditorJanelas from './editor/EditorJanelas.vue'
import EditorNoticias from './editor/EditorNoticias.vue'
import EditorValidacao from './editor/EditorValidacao.vue'

const editor = useEditor()
const ui = useUi()
const pacoteId = ref('')

const ids = ['times', 'uniformes', 'jogadores', 'competicoes', 'divisoes', 'temporada', 'janelas', 'noticias', 'validacao'] as const
const abas = computed(() => [
  { id: 'times' as const, titulo: 'Times', contagem: editor.aberto?.times.length },
  { id: 'uniformes' as const, titulo: 'Uniformes' },
  { id: 'jogadores' as const, titulo: 'Jogadores' },
  { id: 'competicoes' as const, titulo: 'Competições', contagem: editor.aberto?.competicoes.length },
  { id: 'divisoes' as const, titulo: 'Divisões', contagem: editor.aberto?.divisoes?.divisoes.length },
  { id: 'temporada' as const, titulo: 'Temporada', contagem: editor.aberto?.temporada.arquivo?.blocos.length },
  { id: 'janelas' as const, titulo: 'Janelas', contagem: editor.aberto?.janelas.lista.length },
  { id: 'noticias' as const, titulo: 'Notícias', contagem: editor.aberto?.noticias.catalogo.length },
  { id: 'validacao' as const, titulo: 'Validação', contagem: editor.erros.length + editor.avisos.length },
])

useTela(
  [
    { comando: 'abaAnterior', rotulo: 'Aba', tecla: 'LT/RT' },
  ],
  acoesAbas(
    computed({ get: () => editor.aba, set: (v) => (editor.aba = v) }),
    () => ids,
  ),
)

onMounted(async () => {
  try {
    await editor.listar()
    pacoteId.value = editor.aberto?.id ?? editor.pacotes[0]?.id ?? ''
  } catch (e) {
    ui.avisar((e as Error).message)
  }
})

watch(pacoteId, async (id) => {
  if (!id || editor.aberto?.id === id) return
  try {
    await editor.abrir(id)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
})
</script>

<template>
  <div class="cabecalho">
    <h1 class="titulo-tela">Editor do pacote</h1>
    <label class="campo campo--linha">
      <span class="we-lb">Pacote</span>
      <select v-model="pacoteId">
        <option v-for="p in editor.pacotes" :key="p.id" :value="p.id">{{ p.nome }} ({{ p.versao }})</option>
      </select>
    </label>
    <span v-if="editor.aberto" class="resumo">
      <span :class="editor.erros.length ? 'we-vl--negativo' : 'we-vl--positivo'">{{ editor.erros.length }} erro(s)</span>
      · <span class="we-vl--atencao">{{ editor.avisos.length }} aviso(s)</span>
    </span>
  </div>

  <WePainel v-if="!editor.pacotes.length" titulo="Nenhum pacote">
    <p>Nenhum pacote encontrado na pasta de pacotes (veja Configurações). Gere o pacote com <code>npm run pacote:gerar</code>.</p>
  </WePainel>

  <template v-else-if="editor.aberto">
    <WeAbas v-model="editor.aba" :abas="abas" rotulo="Seções do editor" />
    <EditorTimes v-if="editor.aba === 'times'" />
    <EditorUniformes v-else-if="editor.aba === 'uniformes'" />
    <EditorJogadores v-else-if="editor.aba === 'jogadores'" />
    <EditorCompeticoes v-else-if="editor.aba === 'competicoes'" />
    <EditorDivisoes v-else-if="editor.aba === 'divisoes'" />
    <EditorTemporada v-else-if="editor.aba === 'temporada'" />
    <EditorJanelas v-else-if="editor.aba === 'janelas'" />
    <EditorNoticias v-else-if="editor.aba === 'noticias'" />
    <EditorValidacao v-else />
  </template>
</template>

<style scoped>
.cabecalho {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.campo--linha {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}
.resumo {
  font-family: var(--font-display);
  font-weight: 600;
}
</style>
