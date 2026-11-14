<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import WeBotao from './WeBotao.vue'
import WeSeletorTime from './WeSeletorTime.vue'
import { useUi } from '../stores/ui'
import { useCarreira } from '../stores/carreira'
import { useEditor } from '../stores/editor'
import { nomeDificuldade } from '../formato'

const emit = defineEmits<{ criada: [] }>()

const ui = useUi()
const carreira = useCarreira()
const editor = useEditor()
const router = useRouter()

const nova = reactive({ pacote: '', time: '', tecnico: '', nome: '', dificuldade: 'normal' as 'facil' | 'normal' | 'dificil' })
const criando = ref(false)

onMounted(async () => {
  try {
    await editor.listar()
    const primeiro = editor.aberto?.id ?? editor.pacotes[0]?.id
    if (primeiro) nova.pacote = primeiro
  } catch (e) {
    ui.avisar((e as Error).message)
  }
})

watch(
  () => nova.pacote,
  async (id) => {
    if (!id) return
    try {
      if (editor.aberto?.id !== id) await editor.abrir(id)
      if (!editor.aberto?.times.some((t) => t.sigla === nova.time)) nova.time = editor.aberto?.times.find((t) => t.pais === 'BRA')?.sigla ?? ''
    } catch (e) {
      ui.avisar((e as Error).message)
    }
  },
)

// Times escolhíveis: os do Brasil (estrangeiros não podem ser escolhidos por enquanto).
const times = computed(() => (editor.aberto?.times ?? []).filter((t) => t.pais === 'BRA').sort((a, b) => a.nome.localeCompare(b.nome)))
const podeCriar = computed(() => !!nova.pacote && !!nova.time && !!nova.tecnico.trim() && editor.erros.length === 0 && !criando.value)

async function criar(): Promise<void> {
  criando.value = true
  try {
    await carreira.criar({ ...nova })
    ui.avisar(`Carreira criada: ${carreira.atual?.nome}.`)
    emit('criada')
    void router.push({ name: 'inicio' })
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  } finally {
    criando.value = false
  }
}
</script>

<template>
  <form class="formulario" @submit.prevent="criar">
    <label class="campo">
      <span class="we-lb">Pacote de dados</span>
      <select v-model="nova.pacote">
        <option v-for="p in editor.pacotes" :key="p.id" :value="p.id">{{ p.nome }} ({{ p.versao }})</option>
      </select>
    </label>
    <div class="campo">
      <span class="we-lb">Clube</span>
      <WeSeletorTime v-model="nova.time" :times="times" rotulo="Clube" :escudo="editor.escudo" />
    </div>
    <label class="campo">
      <span class="we-lb">Nome do técnico</span>
      <input v-model="nova.tecnico" type="text" maxlength="40" />
    </label>
    <label class="campo">
      <span class="we-lb">Nome da carreira (opcional)</span>
      <input v-model="nova.nome" type="text" maxlength="60" placeholder="Ex.: Fla 2026" />
    </label>
    <div class="campo">
      <span class="we-lb">Dificuldade</span>
      <div class="acoes" role="group" aria-label="Dificuldade">
        <WeBotao v-for="d in ['facil', 'normal', 'dificil'] as const" :key="d" :ativo="nova.dificuldade === d" @click="nova.dificuldade = d">
          {{ nomeDificuldade(d) }}
        </WeBotao>
      </div>
    </div>

    <p v-if="editor.erros.length" class="we-vl--negativo">
      O pacote tem {{ editor.erros.length }} erro(s) e {{ editor.avisos.length }} aviso(s). Corrija os erros no editor para criar a carreira.
    </p>
    <p v-else-if="editor.aberto" class="we-lb">Pacote válido · {{ editor.avisos.length }} aviso(s).</p>

    <div class="acoes">
      <WeBotao icone="nova" tipo="submit" variante="principal" :desabilitado="!podeCriar">Criar carreira</WeBotao>
      <!-- Com carreira aberta o editor não abre (modos.ts): entra-se nele pela tela inicial. -->
      <WeBotao v-if="editor.erros.length && !carreira.atual" icone="editor" @click="router.push({ name: 'editor' })">Abrir o editor</WeBotao>
    </div>
  </form>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
