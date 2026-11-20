<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Time } from '@shared/esquemas/pacote'
import { desenharKit } from '@core/we/desenharKit'
import { problemasDoDesign, type DesignKit } from '@core/we/estampas'
import {
  MODELOS_UNIFORME,
  ajusteDoModelo,
  aplicarModelo,
  corContraste,
  corDoModelo,
  definirAjuste,
  definirCorCamisa,
  definirCorDoModelo,
  definirLado,
  designDasCores,
  designGoleiro,
  designReserva,
  ladoDoModelo,
  modeloDoDesign,
  type ModeloUniforme,
} from '@core/we/modelosUniforme'
import { conflitoKits } from '@core/we/uniformes'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import CampoCor from './CampoCor.vue'
import PreviaUniforme from './PreviaUniforme.vue'
import { useEditor } from '../../stores/editor'
import { useUi } from '../../stores/ui'
import { copiar, igual } from './rascunho'

type CampoKit = 'kit' | 'kit_reserva' | 'kit_goleiro'
interface Rascunho {
  design: DesignKit
  cor_numero: string
  /** O kit não tinha `design` válido: o rascunho é uma sugestão a partir das cores do clube. */
  sugerido: boolean
}

/**
 * Editor dos três uniformes de um time (titular, reserva, goleiro), com prévia ao vivo.
 * Usado na aba Uniformes e na seção Uniformes da aba Times. Quem usa pergunta `algumAlterado`
 * antes de trocar de time (os rascunhos se perdem na troca).
 */
const props = defineProps<{ time: Time }>()

const editor = useEditor()
const ui = useUi()

const CAMPOS: { id: CampoKit; nome: string }[] = [
  { id: 'kit', nome: 'Titular' },
  { id: 'kit_reserva', nome: 'Reserva' },
  { id: 'kit_goleiro', nome: 'Goleiro' },
]
const BASICAS = ['#F2F2F2', '#151515', '#C8102E', '#0B3D91', '#1E8C3A', '#F2C200', '#E05A00', '#5A2D82', '#7A1F2B', '#6FB2FF', '#8A8A8A']

const time = computed<Time>(() => props.time)
const campo = ref<CampoKit>('kit')
const modo = ref<'jogador' | 'textura'>('jogador')
const rascunhos = ref<Partial<Record<CampoKit, Rascunho>>>({})
const erroBase = ref<string | null>(null)

function designValido(v: unknown): DesignKit | null {
  return v && typeof v === 'object' && problemasDoDesign(v).length === 0 ? (copiar(v) as DesignKit) : null
}

/** Rascunho a partir do que está salvo no pacote (ou sugestão, se o kit não tem design). */
function doPacote(t: Time, c: CampoKit): Rascunho {
  const kit = t[c] as Record<string, unknown> | undefined
  const salvo = designValido(kit?.['design'])
  const corNumero = typeof kit?.['cor_numero'] === 'string' && /^#[0-9a-f]{6}$/i.test(kit['cor_numero']) ? kit['cor_numero'].toUpperCase() : null
  if (salvo) return { design: salvo, cor_numero: corNumero ?? corContraste(salvo.camisa), sugerido: false }
  const titular = designValido((t.kit as Record<string, unknown> | undefined)?.['design']) ?? designDasCores(t.cores)
  const design = c === 'kit' ? titular : c === 'kit_reserva' ? designReserva(titular) : designGoleiro(titular)
  return { design, cor_numero: corNumero ?? corContraste(design.camisa), sugerido: true }
}

function recarregar(): void {
  const t = time.value
  rascunhos.value = t ? Object.fromEntries(CAMPOS.map(({ id }) => [id, doPacote(t, id)])) : {}
}
watch(time, recarregar, { immediate: true })

const atual = computed(() => rascunhos.value[campo.value] ?? null)
const kitSalvo = computed(() => (time.value?.[campo.value] as Record<string, unknown> | undefined) ?? null)
const alterado = (c: CampoKit) => {
  const r = rascunhos.value[c]
  const t = time.value
  return !!r && !!t && (r.sugerido || !igual(r, doPacote(t, c)))
}
const algumAlterado = computed(() => CAMPOS.some(({ id }) => alterado(id) && !rascunhos.value[id]?.sugerido))

const modelo = computed(() => (atual.value ? modeloDoDesign(atual.value.design) : 'lisa'))
const corModelo = computed(() => (atual.value ? corDoModelo(atual.value.design) : null))
const ajuste = computed(() => (atual.value ? ajusteDoModelo(atual.value.design) : null))
const lado = computed(() => (atual.value ? ladoDoModelo(atual.value.design) : null))
const amostras = computed(() => [...(time.value?.cores ?? []), ...BASICAS])

function mudar(fn: (d: DesignKit) => DesignKit): void {
  if (atual.value) atual.value.design = fn(atual.value.design)
}
const escolherModelo = (m: ModeloUniforme) => mudar((d) => aplicarModelo(d, m))
const corCampo = (nome: 'detalhe' | 'calcao' | 'meiao') =>
  computed({
    get: () => atual.value?.design[nome] ?? atual.value?.design.camisa ?? '#FFFFFF',
    set: (cor: string) => mudar((d) => ({ ...d, [nome]: cor })),
  })
const corCamisa = computed({ get: () => atual.value?.design.camisa ?? '#FFFFFF', set: (cor: string) => mudar((d) => definirCorCamisa(d, cor)) })
const corDoModeloEdit = computed({ get: () => corModelo.value ?? '#FFFFFF', set: (cor: string) => mudar((d) => definirCorDoModelo(d, cor)) })
const corDetalhe = corCampo('detalhe')
const corCalcao = corCampo('calcao')
const corMeiao = corCampo('meiao')
const corNumero = computed({
  get: () => atual.value?.cor_numero ?? '#FFFFFF',
  set: (cor: string) => {
    if (atual.value) atual.value.cor_numero = cor
  },
})

// Prévia ao vivo: a mesma função que gera a arte do jogo, na escala 1.
const textura = computed<Uint8ClampedArray | null>(() => {
  const base = editor.baseKit
  const r = atual.value
  if (!base || !r) return null
  try {
    return desenharKit(base, r.design, 1)
  } catch {
    return null
  }
})
const problemas = computed(() => (atual.value ? problemasDoDesign(atual.value.design) : []))

/** Aviso de confusão entre titular e reserva (a escolha automática de uniforme usa isso). */
const reservaConfunde = computed(() => {
  const k = rascunhos.value.kit
  const r = rascunhos.value.kit_reserva
  return !!k && !!r && conflitoKits({ design: k.design }, { design: r.design })
})

onMounted(async () => {
  try {
    if (!(await editor.carregarBaseKit())) erroBase.value = 'Faltam kits/brasil_original.png e kits/brasil_pagina.bin na pasta do projeto: sem eles não há prévia nem geração.'
  } catch (e) {
    erroBase.value = (e as Error).message
  }
})

// `recarregar` descarta todos os rascunhos (de volta ao que está no pacote).
defineExpose({ algumAlterado, recarregar })

function sugerir(): void {
  const t = time.value
  const r = atual.value
  if (!t || !r) return
  const titular = campo.value === 'kit' ? null : (rascunhos.value.kit?.design ?? designDasCores(t.cores))
  r.design = campo.value === 'kit' ? designDasCores(t.cores) : campo.value === 'kit_reserva' ? designReserva(titular!) : designGoleiro(titular!)
  r.cor_numero = corContraste(r.design.camisa)
}

function descartar(): void {
  const t = time.value
  if (t) rascunhos.value[campo.value] = doPacote(t, campo.value)
}

async function gerar(): Promise<void> {
  const t = time.value
  const r = atual.value
  if (!t || !r || problemas.value.length) return
  const nome = CAMPOS.find((c) => c.id === campo.value)!.nome.toLowerCase()
  const arte = kitSalvo.value?.['arte']
  const aviso = typeof arte === 'string' ? ` A arte atual (${arte}) será substituída; retoques feitos à mão nela se perdem.` : ''
  const ok = await ui.confirmar('Gerar uniforme', `Gerar o uniforme ${nome} do ${t.nome} para o jogo?${aviso}`, 'Gerar')
  if (!ok) return
  const sigla = t.sigla
  const c = campo.value
  if (await editor.gerarKit(sigla, c, copiar(r.design), r.cor_numero)) {
    // Os outros uniformes do time continuam como estavam no rascunho.
    const outros = Object.fromEntries(CAMPOS.filter(({ id }) => id !== c).map(({ id }) => [id, rascunhos.value[id]]))
    const novo = editor.aberto?.times.find((x) => x.sigla === sigla)
    if (novo) rascunhos.value = { ...outros, [c]: doPacote(novo, c) }
  }
}
</script>

<template>
  <WePainel v-if="atual" :titulo="`Uniformes · ${time.nome}`" clube>
    <template #extra>
      <span class="tipos" role="group" aria-label="Uniforme">
        <WeBotao v-for="c in CAMPOS" :key="c.id" :ativo="campo === c.id" @click="campo = c.id">
          {{ c.nome }}<span v-if="alterado(c.id) && !rascunhos[c.id]?.sugerido"> •</span>
        </WeBotao>
      </span>
    </template>

    <p v-if="erroBase" class="we-vl--negativo">{{ erroBase }}</p>

    <div class="grade">
      <section class="col-previa">
        <PreviaUniforme :textura="textura" :cor-numero="atual.cor_numero" :numero="10" :modo="modo" />
        <div class="acoes centro" role="group" aria-label="Tipo de prévia">
          <WeBotao :ativo="modo === 'jogador'" @click="modo = 'jogador'">Jogador</WeBotao>
          <WeBotao :ativo="modo === 'textura'" @click="modo = 'textura'">Textura do jogo</WeBotao>
        </div>
        <p class="we-lb nota">
          {{ modo === 'jogador' ? 'Prévia aproximada, montada com os pedaços da textura.' : 'Página de textura (128x256) que vai para o WE; a arte gravada é 4x.' }}
        </p>
      </section>

      <section class="col-controles">
        <div v-if="atual.sugerido || !kitSalvo" class="aviso-linha">
          <WeTag tipo="atencao">Sugestão</WeTag>
          <span class="we-lb">
            {{ kitSalvo?.['arte'] ? 'Este uniforme tem arte própria, sem cores editáveis. Começando pelas cores do clube.' : 'Este uniforme ainda não existe. Começando pelas cores do clube.' }}
          </span>
        </div>

        <h3 class="secao-form">Modelo</h3>
        <div class="modelos" role="group" aria-label="Modelo da camisa">
          <WeBotao v-for="m in MODELOS_UNIFORME" :key="m.id" variante="opcao" :ativo="modelo === m.id" :sub="m.descricao" @click="escolherModelo(m.id)">{{ m.nome }}</WeBotao>
        </div>

        <div v-if="ajuste || lado" class="campos">
          <label v-if="ajuste" class="campo">
            <span class="we-lb">{{ ajuste.rotulo }}: {{ ajuste.valor }}</span>
            <input type="range" :min="ajuste.min" :max="ajuste.max" :value="ajuste.valor" @input="(e) => mudar((d) => definirAjuste(d, Number((e.target as HTMLInputElement).value)))" />
          </label>
          <div v-if="lado" class="campo">
            <span class="we-lb">{{ modelo === 'faixa_diagonal' ? 'Ombro da faixa' : 'Metade colorida' }}</span>
            <div class="acoes" role="group">
              <WeBotao :ativo="lado === 'esquerda'" @click="mudar((d) => definirLado(d, 'esquerda'))">Esquerda</WeBotao>
              <WeBotao :ativo="lado === 'direita'" @click="mudar((d) => definirLado(d, 'direita'))">Direita</WeBotao>
            </div>
          </div>
        </div>

        <h3 class="secao-form">Cores</h3>
        <div class="cores">
          <CampoCor v-model="corCamisa" rotulo="Camisa" :amostras="amostras" />
          <CampoCor v-if="corModelo" v-model="corDoModeloEdit" :rotulo="modelo === 'mangas' ? 'Mangas' : modelo.startsWith('listras') ? '2ª listra' : modelo === 'meio_a_meio' ? 'Outra metade' : 'Faixa'" :amostras="amostras" />
          <CampoCor v-model="corDetalhe" rotulo="Detalhes (gola, punhos)" :amostras="amostras" />
          <CampoCor v-model="corCalcao" rotulo="Calção" :amostras="amostras" />
          <CampoCor v-model="corMeiao" rotulo="Meião" :amostras="amostras" />
          <CampoCor v-model="corNumero" rotulo="Número" :amostras="amostras" />
        </div>

        <ul v-if="problemas.length || reservaConfunde" class="problemas">
          <li v-for="p in problemas" :key="p" class="we-vl--negativo">{{ p }}</li>
          <li v-if="reservaConfunde" class="we-vl--atencao">Titular e reserva têm camisas parecidas: a escolha automática não vai conseguir evitar confusão de cores.</li>
        </ul>

        <div class="acoes rodape-form">
          <WeBotao icone="camisa" variante="principal" :desabilitado="!textura || !!problemas.length || editor.ocupado" @click="gerar">Confirmar e gerar uniforme</WeBotao>
          <WeBotao icone="ideia" @click="sugerir">Sugerir pelas cores do clube</WeBotao>
          <WeBotao icone="descartar" :desabilitado="!alterado(campo) || atual.sugerido" @click="descartar">Descartar alterações</WeBotao>
        </div>
        <p class="we-lb nota">
          Gera <code>kits/desenhos/{{ time.sigla.toLowerCase() }}{{ campo === 'kit' ? '' : campo === 'kit_reserva' ? '_reserva' : '_goleiro' }}_4x.png</code> no pacote e grava as cores no time. Vale para carreiras novas; o
          <code>run-pcsx.bat</code> converte a arte para o PS1 ao abrir a partida.
        </p>
      </section>
    </div>
  </WePainel>
</template>

<style scoped>
.tipos {
  display: inline-flex;
  gap: var(--space-1);
}
.tipos .we-btn {
  padding: 2px 10px;
}
.grade {
  display: grid;
  grid-template-columns: minmax(280px, 420px) 1fr;
  gap: var(--space-6);
  align-items: start;
}
@media (max-width: 1100px) {
  .grade {
    grid-template-columns: 1fr;
  }
}
.col-previa {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--painel-fundo);
  border: 1px solid var(--linha);
}
.col-controles {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.centro {
  justify-content: center;
}
.nota {
  text-align: left;
  margin: 0;
}
.modelos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: var(--space-2);
}
.cores {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-3) var(--space-4);
}
.aviso-linha {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.problemas {
  margin: 0;
  padding-left: 18px;
}
.rodape-form {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--linha);
}
</style>
