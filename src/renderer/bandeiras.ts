/**
 * Bandeiras dos países (código de 3 letras do pacote, padrão FIFA), desenhadas em SVG simplificado
 * num quadro de 30x20. Sem arquivos externos: emblemas complicados viram formas simples.
 * Código sem bandeira aqui → o componente mostra só a sigla.
 */

export interface Bandeira {
  nome: string
  /** Conteúdo do <svg viewBox="0 0 30 20">. */
  svg: string
}

const ret = (x: number, y: number, w: number, h: number, cor: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cor}"/>`
const circ = (cx: number, cy: number, r: number, cor: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}"/>`

/** Estrela de 5 pontas centrada em (cx, cy). */
export function estrela(cx: number, cy: number, r: number, cor: string): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? r : r * 0.4
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + raio * Math.cos(a)).toFixed(2)},${(cy + raio * Math.sin(a)).toFixed(2)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${cor}"/>`
}

/** Três faixas horizontais (alturas iguais, ou as proporções dadas). */
const horizontal = (cores: string[], pesos = cores.map(() => 1)) => {
  const total = pesos.reduce((a, b) => a + b, 0)
  let y = 0
  return cores
    .map((c, i) => {
      const h = (20 * pesos[i]!) / total
      const s = ret(0, +y.toFixed(3), 30, +h.toFixed(3), c)
      y += h
      return s
    })
    .join('')
}
const vertical = (cores: string[]) => cores.map((c, i) => ret((30 / cores.length) * i, 0, 30 / cores.length, 20, c)).join('')
/** Cruz nórdica (deslocada para a esquerda). */
const nordica = (fundo: string, cruz: string) => ret(0, 0, 30, 20, fundo) + ret(9, 0, 4, 20, cruz) + ret(0, 8, 30, 4, cruz)

export const BANDEIRAS: Readonly<Record<string, Bandeira>> = {
  // América do Sul
  BRA: {
    nome: 'Brasil',
    svg:
      ret(0, 0, 30, 20, '#009C3B') +
      '<polygon points="3,10 15,2.2 27,10 15,17.8" fill="#FFDF00"/>' +
      circ(15, 10, 4.4, '#002776') +
      '<path d="M10.8 9.1 Q15 7.6 19.3 10.9" stroke="#fff" stroke-width="0.8" fill="none"/>',
  },
  ARG: { nome: 'Argentina', svg: horizontal(['#74ACDF', '#FFFFFF', '#74ACDF']) + circ(15, 10, 1.9, '#F6B40E') },
  URU: {
    nome: 'Uruguai',
    svg: horizontal(['#FFF', '#0038A8', '#FFF', '#0038A8', '#FFF', '#0038A8', '#FFF', '#0038A8', '#FFF']) + ret(0, 0, 11.1, 11.1, '#FFF') + circ(5.55, 5.55, 2.7, '#FCD116'),
  },
  COL: { nome: 'Colômbia', svg: horizontal(['#FCD116', '#003893', '#CE1126'], [2, 1, 1]) },
  CHI: { nome: 'Chile', svg: horizontal(['#FFFFFF', '#D52B1E']) + ret(0, 0, 10, 10, '#0039A6') + estrela(5, 5, 2.6, '#FFF') },
  ECU: { nome: 'Equador', svg: horizontal(['#FFDD00', '#034EA2', '#ED1C24'], [2, 1, 1]) + circ(15, 10, 2.4, '#7A5C2E') + circ(15, 10, 1.4, '#6CACE4') },
  PAR: { nome: 'Paraguai', svg: horizontal(['#D52B1E', '#FFFFFF', '#0038A8']) + `<circle cx="15" cy="10" r="2" fill="none" stroke="#0A7A3A" stroke-width="0.6"/>` + estrela(15, 10, 0.9, '#F6B40E') },
  PER: { nome: 'Peru', svg: vertical(['#D91023', '#FFFFFF', '#D91023']) },
  BOL: { nome: 'Bolívia', svg: horizontal(['#D52B1E', '#F9E300', '#007934']) },
  VEN: {
    nome: 'Venezuela',
    svg: horizontal(['#FFCC00', '#00247D', '#CF142B']) + [8, 10, 12.5, 15, 17.5, 20, 22].map((x, i) => circ(x, 10.4 - Math.sin((i / 6) * Math.PI) * 2.6, 0.55, '#FFF')).join(''),
  },
  // Américas
  MEX: { nome: 'México', svg: vertical(['#006847', '#FFFFFF', '#CE1126']) + circ(15, 10, 2, '#8C5A2B') },
  USA: {
    nome: 'Estados Unidos',
    svg: horizontal(Array.from({ length: 13 }, (_, i) => (i % 2 ? '#FFFFFF' : '#B22234'))) + ret(0, 0, 12, 10.77, '#3C3B6E') +
      [2, 6, 10].flatMap((x) => [2.2, 5.4, 8.6].map((y) => circ(x, y, 0.6, '#FFF'))).join(''),
  },
  CAN: { nome: 'Canadá', svg: ret(0, 0, 30, 20, '#FFF') + ret(0, 0, 7.5, 20, '#D80621') + ret(22.5, 0, 7.5, 20, '#D80621') + '<polygon points="15,4.5 16.3,8 18.5,7.2 17.6,11 19.5,11 15,15.5 10.5,11 12.4,11 11.5,7.2 13.7,8" fill="#D80621"/>' },
  PAN: {
    nome: 'Panamá',
    svg: ret(0, 0, 30, 20, '#FFF') + ret(15, 0, 15, 10, '#DA121A') + ret(0, 10, 15, 10, '#072357') + estrela(7.5, 5, 2.4, '#072357') + estrela(22.5, 15, 2.4, '#DA121A'),
  },
  CRC: { nome: 'Costa Rica', svg: horizontal(['#002B7F', '#FFFFFF', '#CE1126', '#FFFFFF', '#002B7F'], [1, 1, 2, 1, 1]) },
  HON: { nome: 'Honduras', svg: horizontal(['#0073CF', '#FFFFFF', '#0073CF']) + [12, 18, 15, 12, 18].map((x, i) => circ(x, [8.6, 8.6, 10, 11.4, 11.4][i]!, 0.6, '#0073CF')).join('') },
  JAM: { nome: 'Jamaica', svg: ret(0, 0, 30, 20, '#009B3A') + '<polygon points="0,0 15,10 0,20" fill="#000"/><polygon points="30,0 15,10 30,20" fill="#000"/><path d="M0 0 L30 20 M30 0 L0 20" stroke="#FED100" stroke-width="3"/>' },
  // Europa
  POR: { nome: 'Portugal', svg: ret(0, 0, 12, 20, '#046A38') + ret(12, 0, 18, 20, '#DA291C') + circ(12, 10, 3.6, '#FFE900') + circ(12, 10, 2.3, '#DA291C') + ret(10.8, 8.6, 2.4, 2.9, '#FFF') },
  ESP: { nome: 'Espanha', svg: horizontal(['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]) + ret(6.5, 7.5, 3, 4, '#AA151B') },
  ITA: { nome: 'Itália', svg: vertical(['#009246', '#FFFFFF', '#CE2B37']) },
  FRA: { nome: 'França', svg: vertical(['#002395', '#FFFFFF', '#ED2939']) },
  GER: { nome: 'Alemanha', svg: horizontal(['#000000', '#DD0000', '#FFCE00']) },
  NED: { nome: 'Holanda', svg: horizontal(['#AE1C28', '#FFFFFF', '#21468B']) },
  BEL: { nome: 'Bélgica', svg: vertical(['#000000', '#FDDA24', '#EF3340']) },
  ENG: { nome: 'Inglaterra', svg: ret(0, 0, 30, 20, '#FFF') + ret(13, 0, 4, 20, '#CE1124') + ret(0, 8, 30, 4, '#CE1124') },
  SCO: { nome: 'Escócia', svg: ret(0, 0, 30, 20, '#005EB8') + '<path d="M0 0 L30 20 M30 0 L0 20" stroke="#FFF" stroke-width="3.2"/>' },
  WAL: { nome: 'País de Gales', svg: horizontal(['#FFFFFF', '#00B140']) + '<ellipse cx="15" cy="10.5" rx="6" ry="4" fill="#C8102E"/>' },
  IRL: { nome: 'Irlanda', svg: vertical(['#169B62', '#FFFFFF', '#FF883E']) },
  DEN: { nome: 'Dinamarca', svg: nordica('#C8102E', '#FFFFFF') },
  SWE: { nome: 'Suécia', svg: nordica('#006AA7', '#FECC02') },
  NOR: { nome: 'Noruega', svg: nordica('#BA0C2F', '#FFFFFF') + ret(10, 0, 2, 20, '#00205B') + ret(0, 9, 30, 2, '#00205B') },
  FIN: { nome: 'Finlândia', svg: nordica('#FFFFFF', '#002F6C') },
  SUI: { nome: 'Suíça', svg: ret(0, 0, 30, 20, '#DA291C') + ret(13.5, 4.5, 3, 11, '#FFF') + ret(9.5, 8.5, 11, 3, '#FFF') },
  AUT: { nome: 'Áustria', svg: horizontal(['#ED2939', '#FFFFFF', '#ED2939']) },
  CRO: {
    nome: 'Croácia',
    svg: horizontal(['#FF0000', '#FFFFFF', '#171796']) + ret(12.5, 6, 5, 6, '#FFF') +
      [0, 1, 2, 3, 4].flatMap((c) => [0, 1, 2, 3, 4, 5].filter((l) => (c + l) % 2 === 0).map((l) => ret(12.5 + c, 6 + l, 1, 1, '#FF0000'))).join(''),
  },
  SRB: { nome: 'Sérvia', svg: horizontal(['#C6363C', '#0C4076', '#FFFFFF']) },
  POL: { nome: 'Polônia', svg: horizontal(['#FFFFFF', '#DC143C']) },
  RUS: { nome: 'Rússia', svg: horizontal(['#FFFFFF', '#0039A6', '#D52B1E']) },
  UKR: { nome: 'Ucrânia', svg: horizontal(['#0057B7', '#FFD700']) },
  ROU: { nome: 'Romênia', svg: vertical(['#002B7F', '#FCD116', '#CE1126']) },
  GRE: { nome: 'Grécia', svg: horizontal(Array.from({ length: 9 }, (_, i) => (i % 2 ? '#FFFFFF' : '#0D5EAF'))) + ret(0, 0, 11.1, 11.1, '#0D5EAF') + ret(4.44, 0, 2.22, 11.1, '#FFF') + ret(0, 4.44, 11.1, 2.22, '#FFF') },
  TUR: { nome: 'Turquia', svg: ret(0, 0, 30, 20, '#E30A17') + circ(11, 10, 5, '#FFF') + circ(12.3, 10, 4, '#E30A17') + estrela(17.5, 10, 2.2, '#FFF') },
  // África
  MAR: { nome: 'Marrocos', svg: ret(0, 0, 30, 20, '#C1272D') + '<polygon points="15,5 16.8,13.5 9.6,8.3 20.4,8.3 13.2,13.5" fill="none" stroke="#006233" stroke-width="0.9" stroke-linejoin="round"/>' },
  GHA: { nome: 'Gana', svg: horizontal(['#CE1126', '#FCD116', '#006B3F']) + estrela(15, 10, 3, '#000') },
  GUI: { nome: 'Guiné', svg: vertical(['#CE1126', '#FCD116', '#009460']) },
  CMR: { nome: 'Camarões', svg: vertical(['#007A5E', '#CE1126', '#FCD116']) + estrela(15, 10, 2.6, '#FCD116') },
  CPV: {
    nome: 'Cabo Verde',
    svg: ret(0, 0, 30, 20, '#003893') + ret(0, 10, 30, 1.67, '#FFF') + ret(0, 11.67, 30, 1.66, '#CF2027') + ret(0, 13.33, 30, 1.67, '#FFF') +
      Array.from({ length: 10 }, (_, i) => circ(+(11.25 + 4.2 * Math.cos((i * Math.PI) / 5)).toFixed(2), +(12.5 + 4.2 * Math.sin((i * Math.PI) / 5)).toFixed(2), 0.55, '#F7D116')).join(''),
  },
  ANG: { nome: 'Angola', svg: horizontal(['#CC092F', '#000000']) + `<path d="M12 12.5 A3.6 3.6 0 1 1 17.5 12.5" fill="none" stroke="#FFCB00" stroke-width="1.1"/>` + estrela(14, 8.2, 1.1, '#FFCB00') },
  NGA: { nome: 'Nigéria', svg: vertical(['#008751', '#FFFFFF', '#008751']) },
  SEN: { nome: 'Senegal', svg: vertical(['#00853F', '#FDEF42', '#E31B23']) + estrela(15, 10, 2.4, '#00853F') },
  CIV: { nome: 'Costa do Marfim', svg: vertical(['#F77F00', '#FFFFFF', '#009E60']) },
  MOZ: { nome: 'Moçambique', svg: horizontal(['#007168', '#FFFFFF', '#000000', '#FFFFFF', '#FCE100'], [6, 1, 6, 1, 6]) + '<polygon points="0,0 12,10 0,20" fill="#D21034"/>' },
  // Ásia
  KOR: {
    nome: 'Coreia do Sul',
    svg: ret(0, 0, 30, 20, '#FFF') + '<path d="M10.5 10 A4.5 4.5 0 0 1 19.5 10 Z" fill="#CD2E3A"/><path d="M10.5 10 A4.5 4.5 0 0 0 19.5 10 Z" fill="#0047A0"/>' +
      [[5, 4], [25, 4], [5, 16], [25, 16]].map(([x, y]) => ret(x! - 2, y! - 1.8, 4, 0.8, '#000') + ret(x! - 2, y! - 0.4, 4, 0.8, '#000') + ret(x! - 2, y! + 1, 4, 0.8, '#000')).join(''),
  },
  JPN: { nome: 'Japão', svg: ret(0, 0, 30, 20, '#FFF') + circ(15, 10, 6, '#BC002D') },
  CHN: { nome: 'China', svg: ret(0, 0, 30, 20, '#EE1C25') + estrela(5, 5, 3, '#FFFF00') },
  AUS: { nome: 'Austrália', svg: ret(0, 0, 30, 20, '#00008B') + ret(0, 0, 15, 10, '#012169') + ret(6, 0, 3, 10, '#FFF') + ret(0, 3.5, 15, 3, '#FFF') + ret(6.75, 0, 1.5, 10, '#C8102E') + ret(0, 4.25, 15, 1.5, '#C8102E') + estrela(7.5, 15, 2.2, '#FFF') + estrela(22.5, 6, 1.2, '#FFF') + estrela(22.5, 16, 1.2, '#FFF') },
}

export function bandeira(codigo: string): Bandeira | null {
  return BANDEIRAS[codigo.toUpperCase()] ?? null
}

/** Nome do país para a interface (a sigla, se não conhecer). */
export function nomePais(codigo: string): string {
  return bandeira(codigo)?.nome ?? codigo
}
