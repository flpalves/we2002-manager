<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Diretoria } from '@shared/esquemas/mercado'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTag from '../componentes/WeTag.vue'
import BarraCondicao from '../componentes/BarraCondicao.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { useRouter } from 'vue-router'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { dinheiro } from '../formato'

const carreira = useCarreira()
const router = useRouter()
const temporada = useTemporada()
const ui = useUi()
const d = ref<Diretoria | null>(null)

useTela([{ comando: 'acaoY', rotulo: 'Finanças' }], { acaoY: () => void router.push({ name: 'financas' }) })

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    d.value = await chamar('diretoria:obter', undefined)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual], carregar, { immediate: true })

async function assumir(sigla: string, nome: string): Promise<void> {
  if (!(await ui.confirmar('Novo clube', `Assumir o ${nome}? A carreira continua no clube novo.`, 'Assumir'))) return
  try {
    d.value = await chamar('diretoria:assumir', { sigla })
    await carreira.atualizar()
    await temporada.recarregar()
    ui.avisar(`Bem-vindo ao ${nome}!`)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

const PORTE: Record<string, string> = { grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' }

function situacao(m: Diretoria['metas'][number]): string {
  if (m.tipo === 'posicao_liga') return m.atual === null ? 'Liga ainda não começou' : `Hoje: ${m.atual}º lugar`
  if (m.tipo === 'saldo_positivo') return `Saldo hoje: ${dinheiro(m.atual ?? 0)}`
  return `Folha: ${dinheiro(m.atual ?? 0)} de ${dinheiro(m.alvo ?? 0)}`
}

function statusMeta(m: Diretoria['metas'][number]): { tipo: 'positivo' | 'negativo' | 'atencao'; texto: string } {
  if (m.status === 'atingida') return { tipo: 'positivo', texto: 'Atingida' }
  if (m.status === 'perdida') return { tipo: 'negativo', texto: 'Perdida' }
  return m.noCaminho ? { tipo: 'positivo', texto: 'No caminho' } : { tipo: 'atencao', texto: 'Fora da meta' }
}
</script>

<template>
  <h1 class="titulo-tela">Clube e diretoria</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver a diretoria.</p></WePainel>
  <template v-else-if="d">
    <WePainel v-if="d.demitido" titulo="Você foi demitido">
      <p>A diretoria perdeu a confiança no seu trabalho. A carreira continua: escolha um dos clubes interessados.</p>
      <div class="clubes">
        <WeBotao v-for="c in d.clubesInteressados" :key="c.sigla" variante="opcao" :sub="`Porte ${PORTE[c.porte] ?? c.porte}`" @click="assumir(c.sigla, c.nome)">
          <TimeDaCarreira :sigla="c.sigla" :link="false" />
        </WeBotao>
      </div>
    </WePainel>

    <div class="duas">
      <WePainel titulo="Metas da temporada" sem-corpo>
        <ul class="metas">
          <li v-for="(m, i) in d.metas" :key="i">
            <div>
              <div class="meta__titulo">{{ m.descricao }} <WeTag v-if="m.critica" tipo="diretoria">Crítica</WeTag></div>
              <div class="we-lb">{{ situacao(m) }}</div>
            </div>
            <WeTag :tipo="statusMeta(m).tipo">{{ statusMeta(m).texto }}</WeTag>
          </li>
          <li v-if="!d.metas.length" class="we-lb">Sem metas nesta temporada.</li>
        </ul>
      </WePainel>

      <WePainel titulo="Confiança da diretoria" clube>
        <div class="we-kv"><span class="we-lb">Confiança</span><BarraCondicao :valor="d.confianca" rotulo="Confiança" /></div>
        <div class="we-kv"><span class="we-lb">Limite de demissão</span><span class="we-vl">{{ d.limite }}</span></div>
        <div class="we-kv">
          <span class="we-lb">Avaliações ruins seguidas</span>
          <span class="we-vl" :class="{ 'we-vl--negativo': d.avaliacoesRuins > 0 }">{{ d.avaliacoesRuins }} de 2</span>
        </div>
        <p class="we-lb">
          A confiança sobe e desce a cada jogo (resultado contra o esperado pela força dos times) e é avaliada a cada 4 semanas: saldo negativo e folha acima
          do orçamento pesam. Abaixo do limite em 2 avaliações seguidas, ou meta crítica perdida no fim da temporada, é demissão.
        </p>
        <p v-if="d.confianca < d.limite + 10 && !d.demitido" class="we-vl--atencao">Cargo ameaçado.</p>
      </WePainel>
    </div>
  </template>
</template>

<style scoped>
.duas {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 1fr);
  gap: var(--gap-painel);
  align-items: start;
  margin-top: var(--gap-painel);
}
.metas {
  list-style: none;
  margin: 0;
  padding: 0;
}
.metas li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--linha);
}
.meta__titulo {
  font-weight: 600;
  color: var(--texto-forte);
}
.clubes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>
