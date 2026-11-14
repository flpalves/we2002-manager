import { CatalogoSchema, type EventoCatalogo, type EventoCatalogoEntrada } from '@shared/esquemas/noticias'

/**
 * Catálogo padrão de eventos aleatórios (09b). Vale quando o pacote não traz `noticias.json`.
 * Chances são por avaliação (semana ou pós-jogo); valores em centavos.
 */
const EVENTOS: EventoCatalogoEntrada[] = [
  // ------------------------------------------------------------ elenco (semana)
  {
    id: 'destaque-treino',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '<=', valor: 23 }] },
    alvo: 'jogador_aleatorio_do_usuario',
    chance: 0.03,
    intervalo_minimo_semanas: 6,
    texto: '{jogador} chama atenção no treino e ganha elogios da comissão.',
    efeitos: [
      { campo: 'moral', delta: 8 },
      { campo: 'atributo_aleatorio_do_foco', delta: 1, chance: 0.5 },
    ],
  },
  {
    id: 'jovem-promessa',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '<=', valor: 20 }] },
    alvo: 'jogador_condicionado',
    chance: 0.01,
    intervalo_minimo_semanas: 26,
    texto: 'Comissão técnica vê {jogador} como a grande promessa da base.',
    efeitos: [
      { campo: 'moral', delta: 5 },
      { campo: 'potencial', delta: 1, chance: 0.5 },
    ],
  },
  {
    id: 'veterano-lideranca',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '>=', valor: 31 }] },
    alvo: 'jogador_condicionado',
    chance: 0.02,
    intervalo_minimo_semanas: 10,
    texto: '{jogador} reúne o grupo e assume a liderança no vestiário.',
    efeitos: [{ campo: 'moral_elenco', delta: 3 }],
  },
  {
    id: 'atrito-vestiario',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.moral', op: '<=', valor: 35 }] },
    alvo: 'jogador_condicionado',
    chance: 0.03,
    intervalo_minimo_semanas: 8,
    texto: '{jogador} discute com companheiros no treino. Como você reage?',
    escolhas: [
      { id: 'multar', texto: 'Multar o jogador', resultado: 'Multa aplicada; o grupo aprova a firmeza.', efeitos: [{ campo: 'moral', delta: -8 }, { campo: 'moral_elenco', delta: 2 }] },
      { id: 'conversar', texto: 'Conversar em particular', resultado: 'A conversa acalma o jogador.', efeitos: [{ campo: 'moral', delta: 10 }, { campo: 'confianca', delta: -1 }] },
    ],
  },
  {
    id: 'assuntos-pessoais',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'jogador_aleatorio_do_usuario',
    chance: 0.015,
    intervalo_minimo_semanas: 8,
    texto: '{jogador} é liberado por uma semana para resolver assuntos pessoais.',
    efeitos: [
      { campo: 'disponibilidade', semanas: 1 },
      { campo: 'moral', delta: 5 },
    ],
  },
  {
    id: 'lesao-treino',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'jogador_aleatorio_do_usuario',
    chance: 0.01,
    intervalo_minimo_semanas: 6,
    texto: '{jogador} sente a coxa no treino e fica fora por duas semanas.',
    efeitos: [{ campo: 'lesao', semanas: 2 }],
  },
  {
    id: 'nutricionista',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.condicao', op: '<=', valor: 70 }] },
    alvo: 'jogador_condicionado',
    chance: 0.02,
    intervalo_minimo_semanas: 6,
    texto: 'Departamento médico monta um plano especial de recuperação para {jogador}.',
    efeitos: [{ campo: 'condicao', delta: 15 }],
  },

  // ------------------------------------------------------------ imprensa (semana)
  {
    id: 'balada',
    tipo: 'imprensa',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '<=', valor: 27 }] },
    alvo: 'jogador_condicionado',
    chance: 0.015,
    intervalo_minimo_semanas: 10,
    texto: 'Fotos de {jogador} numa festa de madrugada circulam nas redes. O que fazer?',
    escolhas: [
      { id: 'multar', texto: 'Multar e afastar por uma semana', resultado: 'Jogador afastado; a diretoria aprova.', efeitos: [{ campo: 'moral', delta: -10 }, { campo: 'disponibilidade', semanas: 1 }, { campo: 'confianca', delta: 2 }] },
      { id: 'abafar', texto: 'Defender o jogador', resultado: 'O jogador agradece; a diretoria torce o nariz.', efeitos: [{ campo: 'moral', delta: 4 }, { campo: 'confianca', delta: -3 }] },
    ],
  },
  {
    id: 'imprensa-critica',
    tipo: 'imprensa',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.titular', op: '==', valor: 1 }] },
    alvo: 'jogador_condicionado',
    chance: 0.015,
    intervalo_minimo_semanas: 8,
    texto: 'Colunista detona a fase de {jogador}: "não rende o que ganha".',
    efeitos: [{ campo: 'moral', delta: -5 }],
  },

  // ------------------------------------------------------------ finanças (semana)
  {
    id: 'patrocinador-bonus',
    tipo: 'financas',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'time.aproveitamento', op: '>=', valor: 0.6 }] },
    alvo: 'time_usuario',
    chance: 0.02,
    intervalo_minimo_semanas: 12,
    texto: 'Patrocinador comemora a boa fase do {time} e paga um bônus de {valor}.',
    efeitos: [{ campo: 'saldo', valor: 50_000_000 }],
  },
  {
    id: 'acao-promocional',
    tipo: 'financas',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'time_usuario',
    chance: 0.012,
    intervalo_minimo_semanas: 12,
    texto: 'Patrocinador propõe uma ação promocional com o elenco por {valor}. Aceita?',
    escolhas: [
      { id: 'aceitar', texto: 'Aceitar (o elenco não gosta)', resultado: 'Ação feita; o caixa agradece.', efeitos: [{ campo: 'saldo', valor: 30_000_000 }, { campo: 'moral_elenco', delta: -2 }] },
      { id: 'recusar', texto: 'Recusar e poupar o grupo', resultado: 'Proposta recusada.', efeitos: [] },
    ],
  },
  {
    id: 'multa-federacao',
    tipo: 'financas',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'time_usuario',
    chance: 0.01,
    intervalo_minimo_semanas: 15,
    texto: 'Federação multa o {time} em {valor} por atraso na entrada em campo.',
    efeitos: [{ campo: 'saldo', valor: -10_000_000 }],
  },

  // ------------------------------------------------------------ torcida e diretoria (semana)
  {
    id: 'torcida-protesto',
    tipo: 'torcida',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'time.aproveitamento', op: '<=', valor: 0.3 }] },
    alvo: 'time_usuario',
    chance: 0.05,
    intervalo_minimo_semanas: 6,
    texto: 'Torcida protesta no CT e cobra o elenco do {time}.',
    efeitos: [
      { campo: 'moral_elenco', delta: -4 },
      { campo: 'confianca', delta: -3 },
    ],
  },
  {
    id: 'torcida-festa',
    tipo: 'torcida',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'time.aproveitamento', op: '>=', valor: 0.7 }] },
    alvo: 'time_usuario',
    chance: 0.04,
    intervalo_minimo_semanas: 6,
    texto: 'Torcida lota o treino aberto e faz festa para o {time}.',
    efeitos: [{ campo: 'moral_elenco', delta: 3 }],
  },
  {
    id: 'presidente-garante',
    tipo: 'diretoria',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'time.confianca', op: '<=', valor: 35 }] },
    alvo: 'time_usuario',
    chance: 0.04,
    intervalo_minimo_semanas: 10,
    texto: 'Presidente garante o técnico no cargo, mas avisa que precisa de resultados.',
    efeitos: [{ campo: 'confianca', delta: 4 }],
  },
  {
    id: 'diretoria-folha',
    tipo: 'diretoria',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'time.folha_acima', op: '==', valor: 1 }] },
    alvo: 'time_usuario',
    chance: 0.05,
    intervalo_minimo_semanas: 4,
    texto: 'Diretoria reclama da folha salarial acima do orçamento.',
    efeitos: [{ campo: 'confianca', delta: -3 }],
  },

  // ------------------------------------------------------------ mercado
  {
    id: 'sondagem',
    tipo: 'mercado',
    gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.titular', op: '==', valor: 1 }] },
    alvo: 'jogador_condicionado',
    chance: 0.015,
    intervalo_minimo_semanas: 8,
    texto: '{clube} sonda a situação de {jogador}; o jogador fica balançado.',
    efeitos: [
      { campo: 'interesse_mercado' },
      { campo: 'moral', delta: -3 },
    ],
  },
  {
    id: 'janela-interesse',
    tipo: 'mercado',
    gatilho: { momento: 'janela_abre', condicoes: [{ campo: 'jogador.titular', op: '==', valor: 1 }] },
    alvo: 'jogador_condicionado',
    chance: 0.3,
    intervalo_minimo_semanas: 0,
    texto: 'Janela aberta: {clube} demonstra interesse em {jogador}.',
    efeitos: [{ campo: 'interesse_mercado' }],
  },
  {
    id: 'janela-frustrado',
    tipo: 'elenco',
    gatilho: { momento: 'janela_fecha', condicoes: [{ campo: 'jogador.titular', op: '==', valor: 0 }] },
    alvo: 'jogador_condicionado',
    chance: 0.2,
    intervalo_minimo_semanas: 0,
    texto: '{jogador} queria sair na janela e fica frustrado por continuar na reserva.',
    efeitos: [{ campo: 'moral', delta: -6 }],
  },

  // ------------------------------------------------------------ depois do jogo
  {
    id: 'goleada',
    tipo: 'jogo',
    gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'V' }, { campo: 'partida.gols_pro', op: '>=', valor: 4 }] },
    alvo: 'time_usuario',
    chance: 0.6,
    intervalo_minimo_semanas: 2,
    texto: 'Goleada! A imprensa exalta o {time} e a diretoria comemora.',
    efeitos: [
      { campo: 'moral_elenco', delta: 2 },
      { campo: 'confianca', delta: 2 },
    ],
  },
  {
    id: 'vexame',
    tipo: 'jogo',
    gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'D' }, { campo: 'partida.gols_contra', op: '>=', valor: 4 }] },
    alvo: 'time_usuario',
    chance: 0.6,
    intervalo_minimo_semanas: 2,
    texto: 'Vexame: o {time} é goleado e a pressão aumenta.',
    efeitos: [
      { campo: 'moral_elenco', delta: -2 },
      { campo: 'confianca', delta: -3 },
    ],
  },
  {
    id: 'craque-do-jogo',
    tipo: 'imprensa',
    gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'V' }, { campo: 'jogador.titular', op: '==', valor: 1 }] },
    alvo: 'jogador_condicionado',
    chance: 0.12,
    intervalo_minimo_semanas: 3,
    texto: '{jogador} é eleito o craque do jogo pela imprensa.',
    efeitos: [{ campo: 'moral', delta: 6 }],
  },
  {
    id: 'bicho-vitoria',
    tipo: 'financas',
    gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'V' }] },
    alvo: 'time_usuario',
    chance: 0.05,
    intervalo_minimo_semanas: 8,
    texto: 'Os jogadores pedem um bicho de {valor} pela vitória. Paga?',
    escolhas: [
      { id: 'pagar', texto: 'Pagar o bicho', resultado: 'Bicho pago; o grupo fica motivado.', efeitos: [{ campo: 'saldo', valor: -20_000_000 }, { campo: 'moral_elenco', delta: 4 }] },
      { id: 'negar', texto: 'Negar', resultado: 'Pedido negado; clima pesado no vestiário.', efeitos: [{ campo: 'moral_elenco', delta: -3 }] },
    ],
  },
  {
    id: 'bate-boca',
    tipo: 'elenco',
    gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'D' }, { campo: 'jogador.titular', op: '==', valor: 1 }] },
    alvo: 'jogador_condicionado',
    chance: 0.05,
    intervalo_minimo_semanas: 8,
    texto: '{jogador} reclama publicamente da substituição depois da derrota. Como você reage?',
    escolhas: [
      { id: 'afastar', texto: 'Afastar por uma semana', resultado: 'Jogador afastado; o grupo entende o recado.', efeitos: [{ campo: 'disponibilidade', semanas: 1 }, { campo: 'moral', delta: -8 }, { campo: 'moral_elenco', delta: 2 }] },
      { id: 'relevar', texto: 'Relevar', resultado: 'Você deixa passar.', efeitos: [{ campo: 'moral', delta: 2 }, { campo: 'confianca', delta: -1 }] },
    ],
  },
]

export function catalogoPadrao(): EventoCatalogo[] {
  return CatalogoSchema.parse(EVENTOS)
}
