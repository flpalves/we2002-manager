<script setup lang="ts">
import { computed, ref } from 'vue'
import WePainel from '../../componentes/WePainel.vue'
import WeBotao from '../../componentes/WeBotao.vue'
import WeTag from '../../componentes/WeTag.vue'
import { useEditor } from '../../stores/editor'

const editor = useEditor()
const filtro = ref<'todos' | 'erro' | 'aviso'>('todos')
const aberto = ref<string | null>(null)

const DESCRICAO: Record<string, string> = {
  arquivo_invalido: 'Arquivo fora do formato',
  manifesto_ausente: 'Manifesto ausente',
  sem_times: 'Pacote sem times',
  sigla_repetida: 'Sigla repetida',
  escudo_faltando: 'Escudo faltando',
  pais_inexistente: 'País inexistente',
  nome_curto_vazio: 'Nome curto vazio',
  nome_longo: 'Nome com mais de 10 caracteres',
  elenco_incompleto: 'Elenco com menos de 23 convocáveis',
  goleiros_insuficientes: 'Menos de 2 goleiros',
  financas_vazias: 'Finanças vazias (padrão do porte)',
  estadio_vazio: 'Estádio vazio (padrão do porte)',
  kit_goleiro_faltando: 'Kit de goleiro faltando',
  kit_arquivo_faltando: 'Arquivo de kit faltando',
  jogador_id_repetido: 'Id de jogador repetido',
  camisa_repetida: 'Camisa repetida',
  nome_we_vazio: 'Nome para o WE vazio',
  sem_posicao_secundaria: 'Sem posição secundária',
  contrato_sem_salario: 'Salário zero',
  time_inexistente: 'Time referenciado não existe',
  participante_repetido: 'Participante repetido',
  competicao_tamanho: 'Número de times errado na competição',
  zona_invalida: 'Zona fora da tabela',
  fase_inexistente: 'Fase inexistente',
  grupos_invalidos: 'Grupos inválidos',
  destino_inexistente: 'Saída para competição inexistente',
  divisao_repetida: 'Divisão repetida na escada',
  divisao_inexistente: 'Divisão com competição inexistente',
  divisao_sem_lista: 'Divisão sem participantes por lista',
  divisao_sem_troca: 'Divisão sem número de troca',
  divisao_troca_grande: 'Troca maior que a série',
  divisao_criterio: 'Critério de acesso/rebaixamento impossível',
  divisao_topo: '1ª divisão com troca',
  saida_substituida: 'Saídas substituídas pela escada',
  sem_janela: 'Sem janela de transferências',
  janela_invalida: 'Janela de transferências inválida',
  janelas_sobrepostas: 'Janelas sobrepostas',
  janelas_coladas: 'Janelas coladas',
  bloco_invalido: 'Janela de competição inválida (temporada.json)',
  bloco_repetido: 'Competição com mais de uma janela',
  sem_bloco: 'Competição sem janela no calendário',
  semanas_invalidas: 'Duração da temporada inválida',
  nome_we_repetido: 'Nome para o WE repetido (sem clube)',
  taxa_invalida: 'Taxa do exterior zero ou negativa',
}

const grupos = computed(() => {
  const mapa = new Map<string, { codigo: string; nivel: 'erro' | 'aviso'; itens: NonNullable<typeof editor.aberto>['problemas'] }>()
  for (const p of editor.aberto?.problemas ?? []) {
    if (filtro.value !== 'todos' && p.nivel !== filtro.value) continue
    const g = mapa.get(p.codigo) ?? { codigo: p.codigo, nivel: p.nivel, itens: [] }
    g.itens.push(p)
    mapa.set(p.codigo, g)
  }
  return [...mapa.values()].sort((a, b) => (a.nivel === b.nivel ? b.itens.length - a.itens.length : a.nivel === 'erro' ? -1 : 1))
})
</script>

<template>
  <WePainel titulo="Validação do pacote">
    <template #extra>{{ editor.erros.length }} erro(s) · {{ editor.avisos.length }} aviso(s)</template>
    <p class="we-lb">Erros bloqueiam criar carreira; avisos só informam.</p>
    <div class="acoes" role="group" aria-label="Filtro">
      <WeBotao :ativo="filtro === 'todos'" @click="filtro = 'todos'">Todos</WeBotao>
      <WeBotao :ativo="filtro === 'erro'" @click="filtro = 'erro'">Erros</WeBotao>
      <WeBotao :ativo="filtro === 'aviso'" @click="filtro = 'aviso'">Avisos</WeBotao>
    </div>
    <p v-if="!grupos.length" class="we-vl--positivo">Nada a mostrar.</p>
    <div v-for="g in grupos" :key="g.codigo" class="grupo">
      <button type="button" class="grupo__cab" :aria-expanded="aberto === g.codigo" @click="aberto = aberto === g.codigo ? null : g.codigo">
        <WeTag :tipo="g.nivel === 'erro' ? 'negativo' : 'atencao'">{{ g.nivel }}</WeTag>
        {{ DESCRICAO[g.codigo] ?? g.codigo }}
        <span class="grupo__n">{{ g.itens.length }}</span>
      </button>
      <ul v-if="aberto === g.codigo" class="grupo__itens">
        <li v-for="(p, i) in g.itens.slice(0, 200)" :key="i">
          <button
            v-if="p.time || p.competicao || p.arquivo === 'exterior.json' || p.arquivo === 'livres.json' || p.arquivo === 'divisoes.json' || p.arquivo === 'regras.json' || p.arquivo === 'temporada.json'"
            type="button"
            class="link"
            @click="editor.irPara({ time: p.time, jogador: p.jogador, competicao: p.competicao, arquivo: p.arquivo, codigo: p.codigo })"
          >
            {{ p.mensagem }}
          </button>
          <span v-else>{{ p.mensagem }}</span>
        </li>
        <li v-if="g.itens.length > 200" class="we-lb">… e mais {{ g.itens.length - 200 }}</li>
      </ul>
    </div>
  </WePainel>
</template>

<style scoped>
.grupo {
  border-bottom: 1px solid var(--linha);
}
.grupo__cab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 6px 4px;
  font: inherit;
  color: var(--texto);
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
}
.grupo__cab:hover {
  background: var(--botao-hover);
}
.grupo__n {
  margin-left: auto;
  font-family: var(--font-display);
  font-weight: 700;
}
.grupo__itens {
  margin: 0 0 var(--space-2);
  padding-left: 22px;
}
.link {
  font: inherit;
  color: var(--atencao);
  background: none;
  border: 0;
  padding: 1px 0;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
}
</style>
