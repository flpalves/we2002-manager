<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { JogadorMercadoDto, NegociacaoDto, PropostaRecebida } from '@shared/esquemas/mercado'
import type { Entrada } from '@shared/esquemas/ipc'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import WeAbas from '../componentes/WeAbas.vue'
import CampoDinheiro from '../componentes/CampoDinheiro.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { useTela } from '../composables/useTela'
import { acoesAbas } from '../composables/useAbas'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { dinheiro, nomePosicao, ORDEM_POSICAO } from '../formato'

const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const route = useRoute()

type Aba = 'buscar' | 'meus' | 'propostas'
const aba = ref<Aba>('buscar')
const lista = ref<JogadorMercadoDto[]>([])
const recebidas = ref<PropostaRecebida[]>([])
const neg = ref<NegociacaoDto | null>(null)
const enviando = ref(false)

// Filtros da busca.
const nome = ref('')
const posicao = ref<string | null>(null)
const geralMin = ref<number | null>(null)
const idadeMax = ref<number | null>(null)
const somenteLivres = ref(false)
const somenteAVenda = ref(false)

// Proposta recebida aberta no painel da direita (contraproposta).
const propostaSel = ref<PropostaRecebida | null>(null)
const pedido = ref(0)

// Proposta em edição.
const valor = ref(0)
const salario = ref(0)
const temporadas = ref(2)

const abas = computed(() => [
  { id: 'buscar' as const, titulo: 'Buscar' },
  { id: 'meus' as const, titulo: 'Meu elenco' },
  { id: 'propostas' as const, titulo: 'Propostas recebidas', contagem: recebidas.value.length },
])

useTela(
  [
    { comando: 'abaProxima', rotulo: 'Trocar aba' },
    { comando: 'acaoX', rotulo: 'Enviar proposta' },
  ],
  { ...acoesAbas(aba, () => abas.value.map((a) => a.id)), acaoX: () => void propor() },
)

const m = computed(() => carreira.mercado)

async function buscar(): Promise<void> {
  if (!carreira.atual) return
  try {
    const filtros: Entrada<'mercado:buscar'> = aba.value === 'meus' ? { somenteMeus: true } : {
      ...(nome.value.trim() && { nome: nome.value.trim() }),
      ...(posicao.value && { posicao: posicao.value }),
      ...(geralMin.value && { geralMin: geralMin.value }),
      ...(idadeMax.value && { idadeMax: idadeMax.value }),
      ...(somenteLivres.value && { somenteLivres: true }),
      ...(somenteAVenda.value && { somenteAVenda: true }),
    }
    lista.value = await chamar('mercado:buscar', filtros)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    recebidas.value = await chamar('mercado:propostas', undefined)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
  await buscar()
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual], carregar, { immediate: true })
watch([posicao, somenteLivres, somenteAVenda, aba], buscar)

const visiveis = computed(() => (aba.value === 'meus' ? lista.value.filter((j) => j.doUsuario) : lista.value.filter((j) => !j.doUsuario)))

/** Valores sugeridos na proposta a partir do estado da negociação. */
function sugerir(n: NegociacaoDto): void {
  valor.value = n.pedida
  salario.value = n.contraSalario ?? Math.round((n.jogador.salario || 1_500_000) * 1.15)
}

async function abrir(j: { id: string }, tipo?: NegociacaoDto['tipo']): Promise<void> {
  propostaSel.value = null
  try {
    neg.value = await chamar('mercado:negociacao', { jogadorId: j.id, ...(tipo && { tipo }) })
    sugerir(neg.value)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

// `?renovar=<id>` (fim de temporada): abre direto a renovação do jogador.
onMounted(() => {
  const id = route.query['renovar']
  if (typeof id !== 'string' || !id) return
  aba.value = 'meus'
  void abrir({ id }, 'renovacao')
})

async function propor(): Promise<void> {
  const n = neg.value
  if (!n || enviando.value) return
  enviando.value = true
  try {
    const proposta: Entrada<'mercado:propor'> =
      n.etapa === 'clube'
        ? { jogadorId: n.jogador.id, tipo: n.tipo, valor: valor.value }
        : { jogadorId: n.jogador.id, tipo: n.tipo, salario: salario.value, temporadas: temporadas.value }
    neg.value = await chamar('mercado:propor', proposta)
    sugerir(neg.value)
    if (neg.value.mensagem) ui.avisar(neg.value.mensagem)
    await carreira.atualizar()
    if (neg.value.etapa === 'concluida') await carregar()
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  } finally {
    enviando.value = false
  }
}

/** Abre a proposta no painel da direita para contrapropor (sugere 20% acima da oferta). */
function abrirProposta(p: PropostaRecebida): void {
  neg.value = null
  propostaSel.value = p
  pedido.value = Math.round((p.valor * 1.2) / 100_000) * 100_000
}

async function contrapropor(): Promise<void> {
  const p = propostaSel.value
  if (!p || enviando.value) return
  enviando.value = true
  try {
    const r = await chamar('mercado:contrapropor', { id: p.id, valor: pedido.value })
    recebidas.value = r.propostas
    propostaSel.value = r.propostas.find((x) => x.id === p.id) ?? null
    ui.avisar(r.mensagem, 6000)
    if (r.resposta === 'aceita') {
      await carreira.atualizar()
      await buscar()
    }
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  } finally {
    enviando.value = false
  }
}

/** Põe ou tira um jogador do seu elenco da lista de venda (atrai mais propostas da CPU). */
async function alternarVenda(j: JogadorMercadoDto): Promise<void> {
  try {
    const novo = await chamar('mercado:aVenda', { jogadorId: j.id, aVenda: !j.aVenda })
    lista.value = lista.value.map((x) => (x.id === novo.id ? novo : x))
    ui.avisar(novo.aVenda ? `${novo.nome} está à venda: os clubes vão saber.` : `${novo.nome} saiu da lista de venda.`)
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

const NOME_A_VENDA: Record<NonNullable<JogadorMercadoDto['aVenda']>, string> = {
  excedente: 'À venda',
  financeiro: 'À venda (crise)',
  emprestimo: 'Para empréstimo',
  usuario: 'À venda',
}

async function responder(p: PropostaRecebida, aceitar: boolean): Promise<void> {
  if (aceitar && !(await ui.confirmar('Vender jogador', `Vender ${p.jogador} por ${dinheiro(p.valor)}? Não dá para desfazer.`, 'Vender'))) return
  try {
    recebidas.value = await chamar('mercado:responder', { id: p.id, aceitar })
    if (propostaSel.value?.id === p.id) propostaSel.value = null
    ui.avisar(aceitar ? `${p.jogador} vendido.` : 'Proposta recusada.')
    await carreira.atualizar()
    await buscar()
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
  }
}

const NOME_TIPO: Record<NegociacaoDto['tipo'], string> = {
  compra: 'Compra',
  emprestimo: 'Empréstimo',
  livre: 'Livre',
  renovacao: 'Renovação',
  multa: 'Multa rescisória',
  exterior: 'Do exterior',
}
const NOME_QUEM = { usuario: 'Você', clube: 'Clube', jogador: 'Jogador' } as const
const NOME_MOV = { proposta: 'propôs', aceita: 'aceitou', contraproposta: 'contrapropôs', recusa: 'recusou', encerrada: 'encerrou' } as const

const semMovimento = computed(() => !m.value || m.value.movimentos <= 0)
const etapaAberta = computed(() => neg.value && (neg.value.etapa === 'clube' || neg.value.etapa === 'jogador') && neg.value.tiposPossiveis.includes(neg.value.tipo))
</script>

<template>
  <h1 class="titulo-tela">Mercado</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para usar o mercado.</p></WePainel>
  <template v-else>
    <div v-if="m" class="resumo">
      <span class="we-kv"><span class="we-lb">Janela</span>
        <WeTag :tipo="m.janelaAberta ? 'positivo' : 'atencao'">{{ m.janelaAberta ? 'Aberta' : 'Fechada: só livres e renovações' }}</WeTag>
      </span>
      <span class="we-kv"><span class="we-lb">Movimentos</span><span class="we-vl" :class="{ 'we-vl--atencao': m.movimentos === 0 }">{{ m.movimentos }} de {{ m.movimentosMaximo }}</span></span>
      <span class="we-kv"><span class="we-lb">Saldo</span><span class="we-vl" :class="{ 'we-vl--negativo': m.saldo < 0 }">{{ dinheiro(m.saldo) }}</span></span>
      <span class="we-kv"><span class="we-lb">Folha</span><span class="we-vl" :class="{ 'we-vl--negativo': m.folha > m.orcamentoFolha }">{{ dinheiro(m.folha) }} / {{ dinheiro(m.orcamentoFolha) }}</span></span>
      <span class="we-kv"><span class="we-lb">Elenco</span><span class="we-vl">{{ m.elenco }} ({{ m.elencoMinimo }}–{{ m.elencoMaximo }})</span></span>
    </div>

    <div class="duas">
      <div class="coluna">
        <WeAbas v-model="aba" :abas="abas" rotulo="Mercado" />

        <WePainel v-if="aba === 'buscar'" titulo="Filtros">
          <div class="filtros">
            <label class="campo"><span class="we-lb">Nome</span><input v-model="nome" type="text" maxlength="40" @keydown.enter="buscar" /></label>
            <label class="campo curto"><span class="we-lb">Geral mín.</span><input v-model.number="geralMin" type="number" min="1" max="20" /></label>
            <label class="campo curto"><span class="we-lb">Idade máx.</span><input v-model.number="idadeMax" type="number" min="15" max="45" /></label>
            <WeBotao icone="buscar" @click="buscar">Buscar</WeBotao>
          </div>
          <div class="posicoes">
            <WeBotao :ativo="posicao === null" @click="posicao = null">Todas</WeBotao>
            <WeBotao v-for="p in ORDEM_POSICAO" :key="p" :ativo="posicao === p" @click="posicao = p">{{ nomePosicao(p) }}</WeBotao>
            <WeBotao :ativo="somenteLivres" @click="somenteLivres = !somenteLivres">Só livres</WeBotao>
            <WeBotao :ativo="somenteAVenda" @click="somenteAVenda = !somenteAVenda">À venda</WeBotao>
          </div>
        </WePainel>

        <WePainel v-if="aba !== 'propostas'" :titulo="aba === 'meus' ? 'Renovar e pôr à venda' : `Jogadores (${visiveis.length})`" sem-corpo>
          <p v-if="!visiveis.length" class="vazio">Nenhum jogador com esses filtros.</p>
          <WeTabela v-else>
            <thead><tr><th>Jogador</th><th>Pos.</th><th>Idade</th><th>Geral</th><th>Clube</th><th>Valor</th><th>Salário</th><th>Contrato</th><th v-if="aba === 'meus'"></th></tr></thead>
            <tbody>
              <tr v-for="j in visiveis" :key="j.id" :class="{ sel: neg?.jogador.id === j.id }">
                <td>
                  <button type="button" class="link" @click="abrir(j)">{{ j.nome }}</button>
                  <WeTag v-if="j.aVenda" :tipo="j.aVenda === 'financeiro' ? 'negativo' : 'atencao'" class="tag-venda">{{ NOME_A_VENDA[j.aVenda] }}</WeTag>
                </td>
                <td>{{ nomePosicao(j.posicao) }}</td>
                <td>{{ j.idade }}</td>
                <td class="geral">{{ j.geral }}</td>
                <td><TimeDaCarreira v-if="j.time" :sigla="j.time" /><WeTag v-else tipo="info">Livre</WeTag></td>
                <td>{{ dinheiro(j.valor) }}</td>
                <td>{{ j.salario ? dinheiro(j.salario) : '—' }}</td>
                <td :class="{ 'we-vl--atencao': j.contratoAte !== null && j.contratoAte <= carreira.atual.temporada }">{{ j.contratoAte ?? '—' }}</td>
                <td v-if="aba === 'meus'" class="acoes">
                  <WeBotao :icone="j.aVenda ? 'descartar' : 'financas'" @click="alternarVenda(j)">{{ j.aVenda ? 'Tirar da venda' : 'Pôr à venda' }}</WeBotao>
                </td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>

        <WePainel v-else titulo="Propostas pelos seus jogadores" sem-corpo>
          <p class="vazio we-lb">Valem até o prazo (no máximo até a janela fechar) e não gastam movimentos. Você pode fazer uma contraproposta por proposta.</p>
          <p v-if="!recebidas.length" class="vazio">Nenhuma proposta aberta.</p>
          <WeTabela v-else>
            <thead><tr><th>Jogador</th><th>Clube</th><th>Oferta</th><th>Valor de mercado</th><th>Prazo</th><th></th></tr></thead>
            <tbody>
              <tr v-for="p in recebidas" :key="p.id" :class="{ sel: propostaSel?.id === p.id }">
                <td>{{ p.jogador }} <WeTag v-if="p.aVenda" tipo="atencao" class="tag-venda">À venda</WeTag></td>
                <td><TimeDaCarreira :sigla="p.clube" /></td>
                <td :class="p.valor >= p.valorMercado ? 'we-vl--positivo' : ''">{{ dinheiro(p.valor) }}</td>
                <td>{{ dinheiro(p.valorMercado) }}</td>
                <td>sem. {{ p.prazo }}</td>
                <td class="acoes">
                  <WeBotao icone="financas" @click="responder(p, true)">Vender</WeBotao>
                  <WeBotao v-if="p.contraproposta === null" icone="enviar" @click="abrirProposta(p)">Contrapropor</WeBotao>
                  <WeBotao icone="descartar" @click="responder(p, false)">Recusar</WeBotao>
                </td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
      </div>

      <WePainel v-if="propostaSel" :titulo="`Proposta por ${propostaSel.jogador}`" clube>
        <div class="ficha">
          <div class="we-kv"><span class="we-lb">Clube</span><TimeDaCarreira :sigla="propostaSel.clube" /></div>
          <div class="we-kv"><span class="we-lb">Oferta</span><span class="we-vl">{{ dinheiro(propostaSel.valor) }}</span></div>
          <div class="we-kv"><span class="we-lb">Valor de mercado</span><span class="we-vl">{{ dinheiro(propostaSel.valorMercado) }}</span></div>
          <div class="we-kv"><span class="we-lb">Prazo</span><span class="we-vl">semana {{ propostaSel.prazo }}</span></div>
        </div>
        <template v-if="propostaSel.contraproposta === null">
          <p class="we-lb">Peça um valor. Se couber no que o clube pode pagar, o negócio fecha na hora; se passar um pouco, ele pode subir a oferta; se passar muito, desiste. Uma contraproposta só.</p>
          <CampoDinheiro v-model="pedido" rotulo="Você pede" />
          <WeBotao icone="enviar" variante="principal" :desabilitado="enviando" @click="contrapropor">Enviar contraproposta</WeBotao>
        </template>
        <template v-else>
          <p class="we-lb">Você pediu <strong>{{ dinheiro(propostaSel.contraproposta) }}</strong>; o clube subiu para <strong>{{ dinheiro(propostaSel.valor) }}</strong>. Agora é vender ou recusar.</p>
          <div class="acoes">
            <WeBotao icone="financas" variante="principal" @click="responder(propostaSel, true)">Vender</WeBotao>
            <WeBotao icone="descartar" @click="responder(propostaSel, false)">Recusar</WeBotao>
          </div>
        </template>
      </WePainel>

      <WePainel v-else :titulo="neg ? `Negociação: ${neg.jogador.nome}` : 'Negociação'" clube>
        <p v-if="!neg" class="we-lb">Escolha um jogador na lista para negociar. Primeiro com o clube (valor), depois com o jogador (salário e duração). Cada proposta gasta 1 movimento.</p>
        <template v-else>
          <div class="ficha">
            <div class="we-kv"><span class="we-lb">Clube</span><TimeDaCarreira v-if="neg.jogador.time" :sigla="neg.jogador.time" /><WeTag v-else tipo="info">Livre</WeTag></div>
            <div class="we-kv"><span class="we-lb">Posição / idade</span><span class="we-vl">{{ nomePosicao(neg.jogador.posicao) }} · {{ neg.jogador.idade }} anos</span></div>
            <div class="we-kv"><span class="we-lb">Geral</span><span class="we-vl">{{ neg.jogador.geral }}</span></div>
            <div class="we-kv"><span class="we-lb">Valor de mercado</span><span class="we-vl">{{ dinheiro(neg.jogador.valor) }}</span></div>
            <div class="we-kv"><span class="we-lb">Salário atual</span><span class="we-vl">{{ neg.jogador.salario ? dinheiro(neg.jogador.salario) : '—' }}</span></div>
            <div class="we-kv"><span class="we-lb">Contrato até</span><span class="we-vl">{{ neg.jogador.contratoAte ?? '—' }}</span></div>
            <div class="we-kv"><span class="we-lb">Multa rescisória</span><span class="we-vl">{{ dinheiro(neg.jogador.multa) }}</span></div>
          </div>

          <div v-if="neg.tiposPossiveis.length" class="tipos">
            <WeBotao v-for="t in neg.tiposPossiveis" :key="t" :ativo="neg.tipo === t" @click="abrir(neg.jogador, t)">{{ NOME_TIPO[t] }}</WeBotao>
          </div>
          <p v-if="neg.mensagem" class="mensagem"><WeTag :tipo="neg.etapa === 'concluida' ? 'positivo' : neg.etapa === 'encerrada' ? 'negativo' : 'info'">{{ neg.mensagem }}</WeTag></p>

          <template v-if="etapaAberta">
            <div v-if="neg.etapa === 'clube'" class="proposta">
              <p class="we-lb">
                {{ neg.tipo === 'multa' ? 'Pagando a multa, o clube é obrigado a aceitar.' : neg.tipo === 'emprestimo' ? 'Taxa de empréstimo até o fim da temporada; você paga o salário.' : 'O clube pede' }}
                <strong>{{ dinheiro(neg.pedida) }}</strong>
              </p>
              <CampoDinheiro v-if="neg.tipo !== 'multa'" v-model="valor" rotulo="Sua oferta" />
            </div>
            <div v-else class="proposta">
              <p class="we-lb">Acordo com o clube: <strong>{{ dinheiro(neg.valorAcordado ?? 0) }}</strong>. Agora o salário mensal{{ neg.tipo === 'emprestimo' ? '' : ' e a duração' }}.</p>
              <p v-if="neg.contraSalario" class="we-lb">O jogador pede <strong>{{ dinheiro(neg.contraSalario) }}</strong> por mês.</p>
              <CampoDinheiro v-model="salario" rotulo="Salário mensal" />
              <div v-if="neg.tipo !== 'emprestimo'" class="duracao">
                <span class="we-lb">Temporadas</span>
                <WeBotao v-for="n in 5" :key="n" :ativo="temporadas === n" @click="temporadas = n">{{ n }}</WeBotao>
              </div>
            </div>
            <WeBotao icone="enviar" variante="principal" :desabilitado="enviando || semMovimento" @click="propor">
              {{ semMovimento ? 'Sem movimentos até o próximo jogo' : `Enviar proposta (1 movimento)` }}
            </WeBotao>
          </template>

          <div v-if="neg.historico.length" class="historico">
            <span class="we-lb">Histórico</span>
            <ol>
              <li v-for="(h, i) in neg.historico" :key="i">
                <strong>{{ NOME_QUEM[h.quem] }}</strong> {{ NOME_MOV[h.tipo] }}
                <template v-if="h.tipo !== 'recusa' || h.quem === 'usuario'">{{ dinheiro(h.valor) }}</template>
                <template v-else>(agora pede {{ dinheiro(h.valor) }})</template>
                <span class="we-lb"> · {{ h.etapa === 'clube' ? 'valor' : 'salário' }}</span>
              </li>
            </ol>
          </div>
        </template>
      </WePainel>
    </div>
  </template>
</template>

<style scoped>
.resumo {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: center;
}
.resumo .we-kv {
  gap: 6px;
}
.duas {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(340px, 1fr);
  gap: var(--gap-painel);
  align-items: start;
}
.coluna {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
  min-width: 0;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: flex-end;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.campo.curto input {
  width: 80px;
}
.posicoes,
.tipos,
.duracao {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--space-3);
  align-items: center;
}
.posicoes .we-btn,
.duracao .we-btn {
  padding: 4px 10px;
}
.ficha {
  display: grid;
  gap: 4px;
}
.mensagem {
  margin: var(--space-3) 0 0;
}
.proposta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}
.historico ol {
  margin: 4px 0 0;
  padding-left: 20px;
  display: grid;
  gap: 2px;
}
.historico {
  margin-top: var(--space-4);
}
.geral {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.acoes {
  display: flex;
  gap: 6px;
}
.tag-venda {
  margin-left: 6px;
}
.link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: var(--texto-forte);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.link:hover,
.link:focus-visible {
  text-decoration: underline;
}
tr.sel td {
  background: var(--painel-alt);
}
</style>
