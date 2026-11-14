<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { Caminhos } from '@shared/esquemas/config'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import { useTela } from '../composables/useTela'
import { useUi } from '../stores/ui'
import { useCarreira } from '../stores/carreira'
import { chamar } from '../api'

const ui = useUi()
const caminhos = reactive<Caminhos>({ emulador: '', imagem: '', estados: '' })
const pastaCarreiras = ref('')
const carreirasNoOneDrive = ref(false)
const salvando = ref(false)
const carreira = useCarreira()
type Intensidade = 'baixa' | 'media' | 'alta'
const intensidade = ref<Intensidade | null>(null)
const INTENSIDADES: { id: Intensidade; nome: string; sub: string }[] = [
  { id: 'baixa', nome: 'Baixa', sub: 'Poucas transferências entre os clubes da CPU' },
  { id: 'media', nome: 'Média', sub: 'Padrão' },
  { id: 'alta', nome: 'Alta', sub: 'Mercado agitado a cada janela' },
]

async function definirIntensidade(valor: Intensidade): Promise<void> {
  try {
    intensidade.value = await chamar('mercado:intensidade', { valor })
    ui.avisar('Intensidade da IA de mercado salva nesta carreira.')
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

useTela([{ comando: 'acaoY', rotulo: 'Trocar tema' }], { acaoY: () => void ui.alternarTema() })

onMounted(async () => {
  try {
    const [config, info] = await Promise.all([chamar('config:obter', undefined), chamar('app:info', undefined)])
    Object.assign(caminhos, config.caminhos)
    pastaCarreiras.value = config.pastaCarreiras
    carreirasNoOneDrive.value = info.carreirasNoOneDrive
    intensidade.value = carreira.atual ? await chamar('mercado:intensidade', {}) : null
  } catch (e) {
    ui.avisar(`Não foi possível ler as configurações: ${(e as Error).message}`)
  }
})

async function salvar(): Promise<void> {
  salvando.value = true
  try {
    await chamar('config:salvar', { caminhos: { ...caminhos } })
    ui.avisar('Configurações salvas.')
  } catch (e) {
    ui.avisar(`Não foi possível salvar: ${(e as Error).message}`)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <h1 class="titulo-tela">Configurações</h1>
  <div class="grade">
    <WePainel titulo="Aparência">
      <span class="we-lb">Tema</span>
      <div class="acoes" role="group" aria-label="Tema">
        <WeBotao :ativo="ui.tema === 'escuro'" @click="ui.definirTema('escuro')">Escuro</WeBotao>
        <WeBotao :ativo="ui.tema === 'claro'" @click="ui.definirTema('claro')">Claro</WeBotao>
      </div>
    </WePainel>

    <WePainel titulo="Carreira aberta">
      <template v-if="carreira.atual && intensidade">
        <span class="we-lb">Intensidade da IA de mercado</span>
        <div class="opcoes" role="group" aria-label="Intensidade da IA de mercado">
          <WeBotao v-for="i in INTENSIDADES" :key="i.id" variante="opcao" :ativo="intensidade === i.id" :sub="i.sub" @click="definirIntensidade(i.id)">{{ i.nome }}</WeBotao>
        </div>
      </template>
      <p v-else class="we-lb">Abra uma carreira para ajustar a IA de mercado.</p>
      <div class="we-kv">
        <span class="we-lb">Salvamento automático</span>
        <span class="we-vl">Sempre ligado</span>
      </div>
      <p class="we-lb">
        A carreira é gravada no banco a cada ação (Continuar, negociação, escalação, treino); não há botão de salvar. Depois de cada jogo seu e da virada de temporada, uma
        cópia de segurança vai para a pasta autosave da carreira (as 3 últimas). Para voltar a uma delas, use Autosaves em Salvar / Carreiras.
      </p>
    </WePainel>

    <WePainel titulo="Carreiras">
      <div class="we-kv"><span class="we-lb">Pasta</span><span class="we-vl caminho">{{ pastaCarreiras }}</span></div>
      <p v-if="carreirasNoOneDrive" class="we-vl--atencao">
        Atenção: a pasta está dentro do OneDrive. A sincronização pode corromper o banco da carreira.
      </p>
    </WePainel>

    <WePainel titulo="Emulador (PCSX-Redux)" clube>
      <form class="formulario" @submit.prevent="salvar">
        <label class="campo">
          <span class="we-lb">Executável do PCSX-Redux</span>
          <input v-model="caminhos.emulador" type="text" spellcheck="false" />
        </label>
        <label class="campo">
          <span class="we-lb">Imagem do jogo (.cue, SLPM-87056)</span>
          <input v-model="caminhos.imagem" type="text" spellcheck="false" />
        </label>
        <label class="campo">
          <span class="we-lb">Pasta dos estados base</span>
          <input v-model="caminhos.estados" type="text" spellcheck="false" />
        </label>
        <div class="acoes">
          <WeBotao icone="salvar" tipo="submit" :desabilitado="salvando">Salvar caminhos</WeBotao>
        </div>
      </form>
    </WePainel>
  </div>
</template>

<style scoped>
.opcoes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-2) 0 var(--space-3);
}
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.caminho {
  overflow-wrap: anywhere;
  text-align: right;
}
</style>
