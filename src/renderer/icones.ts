/**
 * Ícones de traço do app (SVG inline, grade 24×24), como pede o design system:
 * "setas/ícones de traço desenhados em SVG inline". Cada ícone é uma lista de
 * caminhos de traço e, opcionalmente, caminhos preenchidos.
 */

const circulo = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`
const ret = (x: number, y: number, l: number, a: number) => `M${x} ${y}H${x + l}V${y + a}H${x}Z`

export interface DesenhoIcone {
  traco: string[]
  cheio?: string[]
}

export const ICONES = {
  inicio: { traco: ['M3 11L12 3L21 11', 'M5 9V21H19V9', 'M10 21V14H14V21'] },
  elenco: {
    traco: [circulo(9, 8, 3.5), 'M2 20C2 15.5 5 13.5 9 13.5C13 13.5 16 15.5 16 20', 'M15.5 4.6A3.5 3.5 0 0 1 15.5 11.4', 'M18 13.8C20.5 14.6 22 16.6 22 20'],
  },
  escalacao: { traco: [ret(3, 3, 18, 18), 'M3 12H21', circulo(12, 12, 3), 'M8 3V7H16V3', 'M8 21V17H16V21'] },
  treino: { traco: [circulo(12, 13, 8), 'M12 13V9', 'M10 2H14', 'M12 2V5', 'M18.5 6.5L20.5 4.5'] },
  calendario: { traco: [ret(3, 5, 18, 16), 'M3 10H21', 'M8 3V7', 'M16 3V7', 'M7 14H9M11 14H13M15 14H17M7 17H9M11 17H13'] },
  competicoes: {
    traco: ['M7 4H17V10A5 5 0 0 1 7 10Z', 'M7 6H4V8A3 3 0 0 0 7 11', 'M17 6H20V8A3 3 0 0 1 17 11', 'M12 15V19', 'M8 21H16', 'M9 19H15'],
  },
  mercado: { traco: ['M4 8H19', 'M15 4L19 8L15 12', 'M20 16H5', 'M9 12L5 16L9 20'] },
  // Jogador (cabeça e ombros) passando entre duas setas: as transferências de todos os clubes.
  transferencias: { traco: [circulo(12, 8, 3), 'M7 19A5 5 0 0 1 17 19', 'M2 12H6', 'M4 10L6 12L4 14', 'M18 12H22', 'M20 10L22 12L20 14'] },
  financas: { traco: [ret(2, 6, 20, 12), circulo(12, 12, 3), 'M5.5 9V15M18.5 9V15'] },
  clube: { traco: ['M12 3L21 8H3Z', 'M4 10H20', 'M6 10V18M10 10V18M14 10V18M18 10V18', 'M4 18H20', 'M3 21H21'] },
  noticias: { traco: [ret(3, 4, 18, 16), 'M7 8H17', 'M7 12H11M7 16H11', ret(14, 12, 3, 4)] },
  editor: { traco: ['M4 20V16L16 4L20 8L8 20Z', 'M13 7L17 11'] },
  configuracoes: { traco: ['M4 6H20', 'M4 12H20', 'M4 18H20'], cheio: [ret(7, 4, 4, 4), ret(14, 10, 4, 4), ret(5, 16, 4, 4)] },
  carreiras: { traco: ['M4 4H17L20 7V20H4Z', 'M8 4V9H15V4', ret(7, 13, 10, 7)] },
  sair: { traco: ['M14 4H20V20H14', 'M10 8L6 12L10 16', 'M6 12H16'] },
  continuar: { traco: [], cheio: ['M7 4L19 12L7 20Z'] },
  nova: { traco: ['M12 5V19', 'M5 12H19'] },
  carregar: { traco: ['M3 5H10L12 8H21V19H3Z', 'M3 11H21'] },
  seta: { traco: ['M9 5L16 12L9 19'] },

  // Ações dos botões (WeBotao icone="…").
  anterior: { traco: ['M15 5L8 12L15 19'] },
  voltar: { traco: ['M20 12H5', 'M11 6L5 12L11 18'] },
  subir: { traco: ['M12 20V5', 'M6 11L12 5L18 11'] },
  descer: { traco: ['M12 4V19', 'M6 13L12 19L18 13'] },
  confirmar: { traco: ['M4 12L10 18L20 6'] },
  descartar: { traco: ['M6 6L18 18', 'M18 6L6 18'] },
  salvar: { traco: ['M4 4H17L20 7V20H4Z', 'M8 4V9H15V4', ret(7, 13, 10, 7)] },
  lixeira: { traco: ['M4 7H20', 'M9 7V4H15V7', 'M6 7L7 21H17L18 7', 'M10 11V17M14 11V17'] },
  restaurar: { traco: ['M20 12A8 8 0 1 1 17.7 6.3', 'M20 3V8H15'] },
  historico: { traco: [circulo(12, 12, 9), 'M12 7V12L16 14'] },
  buscar: { traco: [circulo(10, 10, 6), 'M15 15L21 21'] },
  importar: { traco: ['M12 3V15', 'M7 10L12 15L17 10', 'M4 15V21H20V15'] },
  enviar: { traco: ['M3 11L21 3L13 21L11 13Z', 'M11 13L21 3'] },
  contrato: { traco: ['M6 3H14L19 8V21H6Z', 'M14 3V8H19', 'M9 13H16M9 17H14'] },
  codigo: { traco: ['M8 7L3 12L8 17', 'M16 7L21 12L16 17', 'M14 4L10 20'] },
  simular: { traco: ['M13 2L4 14H11L10 22L20 10H13Z'] },
  jogar: {
    traco: ['M6 8H18A4 4 0 0 1 22 12V15A3 3 0 0 1 16.8 17L15 15H9L7.2 17A3 3 0 0 1 2 15V12A4 4 0 0 1 6 8Z', 'M7 10.5V14.5M5 12.5H9'],
    cheio: [ret(15, 10, 2, 2), ret(17, 13, 2, 2)],
  },
  assistir: { traco: ['M2 12C5 7 8.5 5 12 5C15.5 5 19 7 22 12C19 17 15.5 19 12 19C8.5 19 5 17 2 12Z', circulo(12, 12, 3)] },
  parar: { traco: [], cheio: [ret(6, 6, 12, 12)] },
  ideia: { traco: ['M9 18H15', 'M10 21H14', 'M12 3A6 6 0 0 0 8 13.5V15H16V13.5A6 6 0 0 0 12 3Z'] },
  jogador: { traco: [circulo(12, 8, 4), 'M4 21C4 16 7.5 14 12 14C16.5 14 20 16 20 21'] },
  camisa: { traco: ['M8 3L3 6L5 11L7 10V21H17V10L19 11L21 6L16 3C15 5 14 6 12 6C10 6 9 5 8 3Z'] },
} satisfies Record<string, DesenhoIcone>

export type NomeIcone = keyof typeof ICONES
