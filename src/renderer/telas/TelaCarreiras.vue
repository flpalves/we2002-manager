<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Autosave, ResumoCarreira } from '@shared/esquemas/carreira'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTime from '../componentes/WeTime.vue'
import WeTag from '../componentes/WeTag.vue'
import { useTela } from '../composables/useTela'
import { useUi } from '../stores/ui'
import { useCarreira } from '../stores/carreira'
import FormNovaCarreira from '../componentes/FormNovaCarreira.vue'
import { chamar } from '../api'
import { dinheiro, nomeDificuldade } from '../formato'

const ui = useUi()
const carreira = useCarreira()
const router = useRouter()

const lista = ref<ResumoCarreira[]>([])

useTela()

async function recarregar(): Promise<void> {
  try {
    lista.value = await chamar('carreira:listar', undefined)
  } catch (e) {
    ui.avisar(`Não foi possível listar as carreiras: ${(e as Error).message}`)
  }
}

onMounted(recarregar)

async function abrir(c: ResumoCarreira): Promise<void> {
  try {
    await carreira.abrir(c.id)
    void router.push({ name: 'inicio' })
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

/** Carreira com a lista de autosaves aberta (uma por vez). */
const autosavesDe = ref<{ id: string; lista: Autosave[] } | null>(null)

async function verAutosaves(c: ResumoCarreira): Promise<void> {
  if (autosavesDe.value?.id === c.id) {
    autosavesDe.value = null
    return
  }
  try {
    autosavesDe.value = { id: c.id, lista: await chamar('carreira:autosaves', { id: c.id }) }
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

async function restaurar(c: ResumoCarreira, a: Autosave): Promise<void> {
  const ok = await ui.confirmar(
    'Restaurar autosave',
    `Voltar "${c.nome}" para a temporada ${a.temporada}, semana ${a.semana} (${a.motivo})? O que foi jogado depois se perde; o estado atual fica guardado em autosave/antes-de-restaurar.sqlite.`,
    'Restaurar',
    true,
  )
  if (!ok) return
  try {
    await carreira.restaurar(c.id, a.numero)
    autosavesDe.value = null
    await recarregar()
    ui.avisar(`Carreira restaurada: temporada ${a.temporada}, semana ${a.semana}.`)
    void router.push({ name: 'inicio' })
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

const quando = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function apagar(c: ResumoCarreira): Promise<void> {
  const ok = await ui.confirmar(
    'Apagar carreira',
    `Apagar "${c.nome}" (${c.time.nome}, temporada ${c.temporada})? A pasta da carreira e os autosaves serão excluídos e isso não pode ser desfeito.`,
    'Apagar',
    true,
  )
  if (!ok) return
  try {
    await carreira.apagar(c.id)
    await recarregar()
    ui.avisar('Carreira apagada.')
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}
</script>

<template>
  <h1 class="titulo-tela">Carreiras</h1>
  <div class="grade">
    <WePainel titulo="Nova carreira" clube>
      <FormNovaCarreira @criada="recarregar" />
    </WePainel>

    <WePainel titulo="Carregar carreira" sem-corpo>
      <p v-if="!lista.length" class="vazio">Nenhuma carreira salva.</p>
      <WeTabela v-else>
        <thead>
          <tr><th>Carreira</th><th>Clube</th><th>Temp.</th><th>Saldo</th><th>Dific.</th><th></th></tr>
        </thead>
        <tbody>
          <template v-for="c in lista" :key="c.id">
            <tr :class="{ 'we-destaque': carreira.atual?.id === c.id }">
              <td>
                {{ c.nome }} <WeTag v-if="carreira.atual?.id === c.id" tipo="positivo">Aberta</WeTag>
                <div class="we-lb">Técnico {{ c.tecnico }}</div>
              </td>
              <td><WeTime :nome="c.time.nome" :sigla="c.time.sigla" :cor="c.time.cores[0]" /></td>
              <td>{{ c.temporada }} · S{{ c.semana }}</td>
              <td>{{ dinheiro(c.saldo) }}</td>
              <td>{{ nomeDificuldade(c.dificuldade) }}</td>
              <td class="acoes-linha">
                <WeBotao icone="carregar" @click="abrir(c)">Carregar</WeBotao>
                <WeBotao icone="historico" :desabilitado="!c.ultimoAutosave" @click="verAutosaves(c)">Autosaves</WeBotao>
                <WeBotao icone="lixeira" @click="apagar(c)">Apagar</WeBotao>
              </td>
            </tr>
            <tr v-if="autosavesDe?.id === c.id">
              <td colspan="6">
                <p v-if="!autosavesDe.lista.length" class="we-lb">Nenhum autosave.</p>
                <div v-for="a in autosavesDe.lista" :key="a.numero" class="autosave">
                  <span>{{ a.temporada }} · semana {{ a.semana }}</span>
                  <span class="we-lb">{{ a.motivo }} · {{ quando(a.em) }}</span>
                  <WeBotao icone="restaurar" @click="restaurar(c, a)">Restaurar</WeBotao>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </WeTabela>
    </WePainel>
  </div>
</template>

<style scoped>
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.acoes-linha {
  display: flex;
  gap: var(--space-2);
}
.autosave {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 4px 0;
}
.acoes-linha .we-btn {
  padding: 4px 10px;
}
</style>
