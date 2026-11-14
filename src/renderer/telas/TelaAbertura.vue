<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ResumoCarreira } from '@shared/esquemas/carreira'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WeIcone from '../componentes/WeIcone.vue'
import FormNovaCarreira from '../componentes/FormNovaCarreira.vue'
import { useTela } from '../composables/useTela'
import { useUi } from '../stores/ui'
import { urlArquivoCarreira, useCarreira } from '../stores/carreira'
import { chamar } from '../api'
import { dinheiro, nomeDificuldade } from '../formato'
import type { NomeIcone } from '../icones'

type Secao = 'nova' | 'carregar'

const ui = useUi()
const carreira = useCarreira()
const router = useRouter()

const secao = ref<Secao | null>(null)
const lista = ref<ResumoCarreira[]>([])
const versao = ref('')
const menu = ref<HTMLElement | null>(null)
const lado = ref<HTMLElement | null>(null)

async function recarregar(): Promise<void> {
  try {
    lista.value = await chamar('carreira:listar', undefined)
  } catch (e) {
    ui.avisar(`Não foi possível listar as carreiras: ${(e as Error).message}`)
  }
}

onMounted(async () => {
  await recarregar()
  try {
    versao.value = (await chamar('app:info', undefined)).versao
  } catch {
    versao.value = ''
  }
})

/** Abre a seção à direita e leva o foco para ela (o controle continua de onde a escolha levou). */
async function abrirSecao(s: Secao): Promise<void> {
  secao.value = s
  if (s === 'carregar') await recarregar()
  await nextTick()
  lado.value?.querySelector<HTMLElement>('select, input, button:not([disabled])')?.focus()
}

/** B: fecha a seção aberta e devolve o foco ao item do menu. */
function fecharSecao(): void {
  const aberta = secao.value
  if (!aberta) return
  secao.value = null
  void nextTick(() => menu.value?.querySelector<HTMLElement>(`[data-secao="${aberta}"]`)?.focus())
}

const irParaCarreira = () => void router.push({ name: 'inicio' })

useTela([], {
  voltar: fecharSecao,
  continuar: () => (carreira.atual ? irParaCarreira() : void abrirSecao('nova')),
  acaoY: () => void ui.alternarTema(),
})

async function carregar(c: ResumoCarreira): Promise<void> {
  try {
    if (carreira.atual?.id !== c.id) await carreira.abrir(c.id)
    irParaCarreira()
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

/**
 * O editor do pacote só abre sem carreira (ver modos.ts). Com uma aberta, pede para fechá-la:
 * o banco já grava a cada ação, então nada se perde; depois é só carregar de novo.
 */
async function entrarNoEditor(): Promise<void> {
  const c = carreira.atual
  if (c) {
    const sim = await ui.confirmar(
      'Editar o pacote',
      `O editor do pacote não abre com uma carreira em andamento. A carreira "${c.nome}" vai ser fechada (está salva) e você pode carregá-la de novo depois.`,
      'Fechar e editar',
    )
    if (!sim) return
    try {
      await carreira.fechar()
    } catch (e) {
      ui.avisar(`Não foi possível fechar a carreira: ${(e as Error).message}`, 6000)
      return
    }
  }
  void router.push({ name: 'editor' })
}

interface ItemMenu {
  chave: string
  titulo: string
  sub: string
  icone: NomeIcone
  secao?: Secao
  acao: () => void
}

const itens = computed<ItemMenu[]>(() => {
  const c = carreira.atual
  const r: ItemMenu[] = []
  if (c) {
    r.push({
      chave: 'continuar',
      titulo: 'Continuar carreira',
      sub: `${c.nome} · ${c.time.nome} · ${c.temporada}, semana ${c.semana}`,
      icone: 'continuar',
      acao: irParaCarreira,
    })
  }
  r.push(
    { chave: 'nova', titulo: 'Nova carreira', sub: 'Escolha o clube e comece do zero', icone: 'nova', secao: 'nova', acao: () => void abrirSecao('nova') },
    {
      chave: 'carregar',
      titulo: 'Carregar carreira',
      sub: lista.value.length ? `${lista.value.length} carreira(s) salva(s)` : 'Nenhuma carreira salva ainda',
      icone: 'carregar',
      secao: 'carregar',
      acao: () => void abrirSecao('carregar'),
    },
    {
      chave: 'editor',
      titulo: 'Editor do pacote',
      sub: c ? 'Fecha a carreira aberta (ela fica salva) para editar o pacote' : 'Times, jogadores, uniformes e competições',
      icone: 'editor',
      acao: () => void entrarNoEditor(),
    },
    {
      chave: 'configuracoes',
      titulo: 'Configurações',
      sub: 'Emulador, imagem do jogo e tema',
      icone: 'configuracoes',
      acao: () => void router.push({ name: 'configuracoes' }),
    },
  )
  return r
})
</script>

<template>
  <div class="abertura">
    <div class="abertura__coluna">
      <div class="logo">
        <div class="logo__we">WE2002</div>
        <div class="logo__manager">Manager</div>
        <div class="we-lb logo__sub">Winning Eleven 2002 · PCSX-Redux{{ versao ? ` · v${versao}` : '' }}</div>
      </div>

      <div ref="menu" class="menu" role="menu" aria-label="Tela inicial">
        <button
          v-for="(item, i) in itens"
          :key="item.chave"
          type="button"
          role="menuitem"
          class="menu__item"
          :class="{ 'menu__item--ativo': item.secao && secao === item.secao, 'menu__item--principal': i === 0 }"
          :data-secao="item.secao"
          :data-foco-inicial="i === 0 ? '' : undefined"
          @click="item.acao"
        >
          <WeIcone :nome="item.icone" :tamanho="22" />
          <span class="menu__texto">
            <span class="menu__titulo">{{ item.titulo }}</span>
            <span class="menu__sub">{{ item.sub }}</span>
          </span>
          <WeIcone nome="seta" :tamanho="14" class="menu__seta" />
        </button>
      </div>
    </div>

    <div ref="lado" class="abertura__lado">
      <WePainel v-if="secao === 'nova'" titulo="Nova carreira" clube>
        <FormNovaCarreira @criada="recarregar" />
      </WePainel>

      <WePainel v-else-if="secao === 'carregar'" titulo="Carregar carreira" clube sem-corpo>
        <p v-if="!lista.length" class="vazio">Nenhuma carreira salva. Crie uma em Nova carreira.</p>
        <ul v-else class="carreiras">
          <li v-for="c in lista" :key="c.id">
            <button type="button" class="carreira" @click="carregar(c)">
              <WeEscudo
                :sigla="c.time.sigla"
                :cor="c.time.cores[0]"
                :src="carreira.atual?.id === c.id ? urlArquivoCarreira(c.time.escudo) : undefined"
                tamanho="g"
                :nome="c.time.nome"
              />
              <span class="carreira__texto">
                <span class="carreira__nome">{{ c.nome }}</span>
                <span class="we-lb">{{ c.time.nome }} · técnico {{ c.tecnico }}</span>
              </span>
              <span class="carreira__info">
                <span class="we-vl">{{ c.temporada }} · S{{ c.semana }}</span>
                <span class="we-lb">{{ nomeDificuldade(c.dificuldade) }} · {{ dinheiro(c.saldo) }}</span>
              </span>
            </button>
          </li>
        </ul>
        <div class="acoes acoes--painel">
          <WeBotao icone="historico" @click="router.push({ name: 'carreiras' })">Autosaves e apagar</WeBotao>
        </div>
      </WePainel>

      <WePainel v-else-if="carreira.atual" titulo="Carreira aberta">
        <div class="resumo">
          <WeEscudo
            :sigla="carreira.atual.time.sigla"
            :cor="carreira.atual.time.cores[0]"
            :src="urlArquivoCarreira(carreira.atual.time.escudo)"
            tamanho="g"
            :nome="carreira.atual.time.nome"
          />
          <div>
            <div class="carreira__nome">{{ carreira.atual.nome }}</div>
            <div class="we-lb">{{ carreira.atual.time.nome }} · técnico {{ carreira.atual.tecnico }}</div>
          </div>
        </div>
        <div class="we-kv"><span class="we-lb">Temporada</span><span class="we-vl">{{ carreira.atual.temporada }}, semana {{ carreira.atual.semana }}</span></div>
        <div class="we-kv">
          <span class="we-lb">Saldo</span>
          <span class="we-vl" :class="{ 'we-vl--negativo': carreira.atual.saldo < 0 }">{{ dinheiro(carreira.atual.saldo) }}</span>
        </div>
        <div class="we-kv"><span class="we-lb">Dificuldade</span><span class="we-vl">{{ nomeDificuldade(carreira.atual.dificuldade) }}</span></div>
        <p class="we-lb">START volta para a carreira.</p>
      </WePainel>

      <WePainel v-else titulo="Bem-vindo">
        <p>Nenhuma carreira aberta. Crie uma carreira nova ou carregue uma salva.</p>
        <p class="we-lb">O WE2002 joga as partidas do seu time no PCSX-Redux; o resto da rodada é simulado. Confira o emulador e a imagem do jogo em Configurações.</p>
      </WePainel>
    </div>
  </div>
</template>

<style scoped>
.abertura {
  display: grid;
  grid-template-columns: 420px minmax(0, 620px);
  justify-content: center;
  align-items: start;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-6);
  min-height: 100%;
  box-sizing: border-box;
}
.abertura__coluna {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.abertura__lado {
  padding-top: 132px;
}

.logo {
  border-left: 6px solid var(--clube);
  padding-left: var(--space-4);
}
.logo__we {
  font-family: var(--font-display);
  font-size: 64px;
  line-height: 60px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--texto-forte);
  text-shadow: 4px 4px 0 var(--sombra-dura);
}
.logo__manager {
  display: inline-block;
  margin-top: var(--space-2);
  padding: 2px 10px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  background: var(--clube);
  color: var(--sobre-clube);
  box-shadow: 3px 3px 0 var(--sombra-dura);
}
.logo__sub {
  margin-top: var(--space-3);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font: inherit;
  color: var(--botao-texto);
  background: var(--botao);
  border: 1px solid var(--linha-forte);
  border-left: 4px solid var(--linha-forte);
  border-radius: var(--radius-sm);
  box-shadow: 3px 3px 0 var(--sombra-dura);
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s;
}
.menu__item:hover,
.menu__item:focus-visible {
  background: var(--botao-hover);
  border-left-color: var(--clube);
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--sombra-dura);
}
.menu__item:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: 2px;
}
.menu__item:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--sombra-dura);
}
.menu__item--principal {
  border-left-color: var(--clube);
}
.menu__item--ativo,
.menu__item--ativo:hover {
  background: var(--clube);
  color: var(--sobre-clube);
  border-left-color: var(--sobre-clube);
}
.menu__item--ativo .menu__sub {
  color: inherit;
  opacity: 0.85;
}
.menu__texto {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.menu__titulo {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.menu__sub {
  font-size: 12px;
  color: var(--texto-suave);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu__seta {
  opacity: 0.6;
}

.vazio {
  padding: var(--space-2);
  margin: 0;
}
.carreiras {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow: auto;
}
.carreira {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  font: inherit;
  color: var(--texto);
  background: var(--painel-alt);
  border: 1px solid var(--linha);
  border-left: 4px solid var(--linha-forte);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.carreira:hover,
.carreira:focus-visible {
  background: var(--botao-hover);
  border-left-color: var(--clube);
}
.carreira:focus-visible {
  outline: 2px solid var(--foco);
  outline-offset: -2px;
}
.carreira__texto,
.carreira__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.carreira__texto {
  flex: 1;
  min-width: 0;
}
.carreira__info {
  align-items: flex-end;
}
.carreira__nome {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--texto-forte);
}
.resumo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}
.acoes--painel {
  padding: 0 var(--space-2) var(--space-2);
}
</style>
