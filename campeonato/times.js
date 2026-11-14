'use strict';
// Validação e modelos dos arquivos de time (data/times/*.json). Sem dependências do Electron.

// Ordem e nomes do painel de atributos do jogo.
const ATRIBUTOS = [
  ['OFF', 'Ataque'], ['DEF', 'Defesa'], ['BAL', 'Equilíbrio'], ['STA', 'Fôlego'], ['SPD', 'Velocidade'],
  ['ACC', 'Aceleração'], ['RES', 'Reação'], ['JMP', 'Impulsão'], ['HEAD', 'Cabeceio'], ['TEC', 'Técnica'],
  ['PASS', 'Passe'], ['SHPW', 'Força do chute'], ['SHAC', 'Precisão do chute'], ['DRI', 'Drible'], ['CRV', 'Curva'],
  ['AGR', 'Agressividade (AGREC.)'],
];
const OPCIONAIS = new Set(['AGR']); // times antigos não têm: ausente = mantém o valor do jogo

// Posições do jogo (w0 bits 0-2): GK, CB, SB, DH, SH, OH, CF, WG. Guardamos o lado (LB/RB, LH/RH, LW/RW),
// que o jogo não distingue, porque ajuda a montar o time. Mesma tabela de tools/lib/registro.mjs.
const POSICOES = ['GK', 'CB', 'LB', 'RB', 'DH', 'LH', 'RH', 'OH', 'CF', 'LW', 'RW'];
const POS_JOGO = { GK: 'GK', CB: 'CB', SW: 'CB', SB: 'SB', LB: 'SB', RB: 'SB', WB: 'SB', DH: 'DH', DM: 'DH', CH: 'DH',
  SH: 'SH', LH: 'SH', RH: 'SH', OH: 'OH', AM: 'OH', CF: 'CF', SS: 'CF', WG: 'WG', LW: 'WG', RW: 'WG', WF: 'WG' };
const PES = ['destro', 'canhoto', 'ambidestro'];
const letras = n => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
const CABELOS = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'c1', 'c2', 'd1', 'd2', 'e1', 'e2', 'f1',
  'f2', 'f3', 'g1', 'h1', 'i1', 'i2', 'i3', 'j1', 'k1', 'l1', 'l2', 'l3', 'm1', 'n1', 'o1', 'p1'];
// Aparência (menu de edição do jogo). "dicas" vêm do que a base original usa (docs/offsets.md).
const APARENCIA = {
  pele: { rotulo: 'Pele', valores: [1, 2, 3, 4], dicas: { 1: 'mais clara', 4: 'mais escura' } },
  fisico: { rotulo: 'Físico', valores: letras(8), dicas: { A: 'magro', H: 'forte' } },
  cabelo: { rotulo: 'Cabelo', valores: CABELOS, dicas: { k1: 'raspado', o1: 'dreads', i1: 'o mais comum' } },
  cor_cabelo: { rotulo: 'Cor do cabelo', valores: letras(8), dicas: { A: 'preto', B: 'castanho', G: 'ruivo', H: 'loiro' } },
  barba: { rotulo: 'Barba', valores: letras(7), dicas: { A: 'sem barba' } },
  cor_barba: { rotulo: 'Cor da barba', valores: letras(7), dicas: { A: 'preta', B: 'castanha', C: 'loira?' } },
  chuteira: { rotulo: 'Chuteira', valores: letras(8), dicas: { A: 'padrão' } },
};
const APARENCIA_PADRAO = { pele: 2, fisico: 'F', cabelo: 'i1', cor_cabelo: 'B', barba: 'A', cor_barba: 'A', chuteira: 'A' };
const AJUSTES_BANDEIRA = ['esticar', 'ajustar', 'cortar'];
// Limites do jogo (docs/offsets.md): atributos de 3 bits (+12), altura de 6 bits (+148),
// camisa de 5 bits (1 a 32), nome com 10 bytes ASCII, 23 vagas (a 22 fica com o original).
const LIMITES = { nome: 10, nomeTime: 40, nomeTela: 15, sigla: 4, atributo: [12, 19], altura: [148, 211],
  camisa: [1, 32], condicao: [1, 5], idade: [15, 46], vagas: 22 };
const FORMACOES_PADRAO = ['5-3-2', '4-5-1A', '4-5-1B', '4-4-2A', '4-4-2B', '4-3-3A', '4-3-3B', 'holanda'];

const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const ascii = s => semAcento(s).replace(/[^ -~]/g, '');
const slug = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const COR = /^#[0-9a-f]{6}$/i;
const clone = x => JSON.parse(JSON.stringify(x));

function timeEmBranco(nome = 'Novo time') {
  const pos = ['GK', 'CB', 'CB', 'LB', 'RB', 'DH', 'LH', 'RH', 'OH', 'CF', 'CF',
    'GK', 'CB', 'LB', 'RB', 'DH', 'DH', 'LH', 'RH', 'OH', 'CF', 'CF'];
  return {
    nome,
    sigla: ascii(nome).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'NOV',
    formacao: '4-4-2A',
    bandeira: null,
    bandeira_ajuste: 'ajustar',
    observacao: 'Ocupa as vagas do time fixo do lado onde jogar (casa = Brasil, visitante = Holanda). Vaga 0 = goleiro; 1-10 = titulares na ordem da formação; 11-21 = reservas; a vaga 22 fica com o jogador original.',
    kit: { cor_numero: '#FFFFFF', design: { camisa: '#2F5DA8', detalhe: '#FFFFFF', calcao: '#FFFFFF', meiao: '#2F5DA8' } },
    jogadores: pos.map((p, i) => ({
      vaga: i, nome: `Jogador ${i + 1}`, posicao: p, camisa: i + 1, altura: p === 'GK' ? 188 : 180,
      idade: 25, pe: 'destro', outside: true, aparencia: { ...APARENCIA_PADRAO },
      atributos: Object.fromEntries(ATRIBUTOS.map(([k]) => [k, 15])),
    })),
  };
}

// Devolve { time, erros, avisos }. O time sai normalizado (vagas pela ordem, nomes em ASCII etc.).
function validarTime(dados, formacoes = FORMACOES_PADRAO) {
  const erros = [], avisos = [];
  if (!dados || typeof dados !== 'object') return { time: null, erros: ['Dados do time inválidos.'], avisos };
  const t = clone(dados);
  const inteiro = (v, [a, b]) => Number.isInteger(v) && v >= a && v <= b;

  t.nome = String(t.nome || '').trim();
  if (!t.nome) erros.push('O time precisa de um nome.');
  if (t.nome.length > LIMITES.nomeTime) erros.push(`Nome do time com mais de ${LIMITES.nomeTime} letras.`);

  if (t.nome_tela != null && String(t.nome_tela).trim()) {
    t.nome_tela = ascii(t.nome_tela).toUpperCase().trim().slice(0, LIMITES.nomeTela);
  } else delete t.nome_tela;

  t.sigla = ascii(t.sigla || '').toUpperCase().trim();
  if (!t.sigla) t.sigla = ascii(t.nome).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (t.sigla.length > LIMITES.sigla) erros.push(`Sigla com mais de ${LIMITES.sigla} letras.`);

  if (t.formacao && !formacoes.includes(t.formacao)) erros.push(`Formação "${t.formacao}" desconhecida pela ponte.`);
  if (!t.bandeira) t.bandeira = null;
  if (t.bandeira_ajuste && !AJUSTES_BANDEIRA.includes(t.bandeira_ajuste)) t.bandeira_ajuste = 'esticar';

  for (const [chave, rotulo] of [['kit', 'titular'], ['kit_reserva', 'reserva']]) {
    const k = t[chave];
    if (k == null) { delete t[chave]; continue; }
    if (typeof k !== 'object') { erros.push(`Uniforme ${rotulo} inválido.`); continue; }
    if (!k.arte) delete k.arte;
    if (k.cor_numero && !COR.test(k.cor_numero)) erros.push(`Cor do número do uniforme ${rotulo} inválida.`);
    const d = k.design || {};
    for (const c of ['camisa', 'detalhe', 'calcao', 'meiao'])
      if (d[c] != null && !COR.test(d[c])) erros.push(`Cor "${c}" do uniforme ${rotulo} inválida.`);
  }

  const js = Array.isArray(t.jogadores) ? t.jogadores : [];
  if (!js.length) erros.push('O time precisa de jogadores.');
  if (js.length > LIMITES.vagas) erros.push(`No máximo ${LIMITES.vagas} jogadores (vagas 0 a 21).`);
  const camisas = new Map();
  js.forEach((j, i) => {
    const rot = `Vaga ${i}`;
    j.vaga = i;
    const nome = ascii(j.nome).trim();
    if (nome !== String(j.nome || '').trim()) avisos.push(`${rot}: nome "${j.nome}" virou "${nome}" (o jogo só tem ASCII)`);
    j.nome = nome;
    if (!nome) erros.push(`${rot}: falta o nome.`);
    else if (nome.length > LIMITES.nome) erros.push(`${rot}: "${nome}" tem mais de ${LIMITES.nome} letras.`);
    if (!j.posicao) erros.push(`${rot}: falta a posição.`);
    else if (!POS_JOGO[String(j.posicao).toUpperCase()]) erros.push(`${rot}: posição "${j.posicao}" desconhecida.`);
    else j.posicao = String(j.posicao).toUpperCase();
    if (j.pe == null || j.pe === '') delete j.pe;
    else if (!PES.includes(j.pe)) erros.push(`${rot}: pé deve ser destro, canhoto ou ambidestro.`);
    if (j.idade == null || j.idade === '') delete j.idade;
    else {
      j.idade = Number(j.idade);
      if (!inteiro(j.idade, LIMITES.idade)) erros.push(`${rot}: idade deve ser de 15 a 46.`);
    }
    if (j.outside == null || j.outside === '') delete j.outside;
    else if (typeof j.outside !== 'boolean') j.outside = j.outside === 'true' || j.outside === 1;
    if (j.aparencia && typeof j.aparencia === 'object') {
      for (const [k, v] of Object.entries(j.aparencia)) {
        const def = APARENCIA[k];
        if (v == null || v === '') { delete j.aparencia[k]; continue; }
        const val = k === 'pele' ? Number(v) : k === 'cabelo' ? String(v).toLowerCase() : String(v).toUpperCase();
        if (!def || !def.valores.includes(val)) { erros.push(`${rot}: ${def ? def.rotulo.toLowerCase() : k} "${v}" inválido.`); continue; }
        j.aparencia[k] = val;
      }
      if (!Object.keys(j.aparencia).length) delete j.aparencia;
    } else delete j.aparencia;
    j.camisa = Number(j.camisa);
    if (!inteiro(j.camisa, LIMITES.camisa)) erros.push(`${rot}: camisa deve ser de 1 a 32.`);
    else camisas.set(j.camisa, [...(camisas.get(j.camisa) || []), nome || rot]);
    j.altura = Number(j.altura);
    if (!inteiro(j.altura, LIMITES.altura)) erros.push(`${rot}: altura deve ser de 148 a 211 cm.`);
    if (j.condicao == null || j.condicao === '') delete j.condicao;
    else {
      j.condicao = Number(j.condicao);
      if (!inteiro(j.condicao, LIMITES.condicao)) erros.push(`${rot}: condição deve ser de 1 a 5.`);
    }
    j.atributos = j.atributos || {};
    for (const [k, rotulo] of ATRIBUTOS) {
      if (OPCIONAIS.has(k) && (j.atributos[k] == null || j.atributos[k] === '')) { delete j.atributos[k]; continue; }
      const v = Number(j.atributos[k]);
      if (!inteiro(v, LIMITES.atributo)) erros.push(`${rot}: ${rotulo} deve ser de 12 a 19.`);
      j.atributos[k] = v;
    }
  });
  for (const [n, quem] of camisas) if (quem.length > 1) avisos.push(`camisa ${n} repetida (${quem.join(', ')})`);
  if (js[0] && js[0].posicao !== 'GK') avisos.push('a vaga 0 (goleiro titular) não é GK');
  if (js.length && js.length < 11) avisos.push(`só ${js.length} jogadores: as vagas que faltam ficam com os originais do jogo`);
  return { time: t, erros, avisos };
}

// ---------- uniformes ----------
// Mesma regra de tools/lib/times.mjs (conflitoKits): cor média da camisa (listras pela média),
// distância RGB < 140 = parecidas. No "auto", o visitante veste a reserva quando a titular dele
// se confunde com a camisa que o mandante vai usar, e a reserva não se confunde.
const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
function corCamisa(kit) {
  const d = (kit && kit.design) || {};
  const cores = (d.listras_verticais && d.listras_verticais.cores) || [d.camisa];
  const v = cores.map(rgb).filter(Boolean);
  if (!v.length) return null;
  return [0, 1, 2].map(i => v.reduce((a, c) => a + c[i], 0) / v.length);
}
function conflitoKits(a, b, limite = 140) {
  const ca = corCamisa(a), cb = corCamisa(b);
  if (!ca || !cb) return false;
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) < limite;
}
const UNIFORMES = ['auto', 'titular', 'reserva'];
// timeCasa/timeVis: dados dos arquivos de time, pelo MANDO REAL. Devolve 'titular' | 'reserva' para cada um.
function resolverUniformes(timeCasa, timeVis, pedidoCasa = 'auto', pedidoVis = 'auto') {
  const casa = pedidoCasa === 'reserva' && timeCasa && timeCasa.kit_reserva ? 'reserva' : 'titular';
  let visitante = 'titular';
  if (timeVis && timeVis.kit_reserva) {
    if (pedidoVis === 'reserva') visitante = 'reserva';
    else if (pedidoVis !== 'titular') {
      const kc = casa === 'reserva' ? timeCasa.kit_reserva : timeCasa && timeCasa.kit;
      if (kc && conflitoKits(kc, timeVis.kit) && !conflitoKits(kc, timeVis.kit_reserva)) visitante = 'reserva';
    }
  }
  const aviso = (() => {
    const kc = casa === 'reserva' ? timeCasa.kit_reserva : timeCasa && timeCasa.kit;
    const kv = visitante === 'reserva' ? timeVis.kit_reserva : timeVis && timeVis.kit;
    return kc && kv && conflitoKits(kc, kv) ? 'camisas parecidas' : null;
  })();
  return { casa, visitante, aviso };
}

module.exports = { UNIFORMES, conflitoKits, resolverUniformes, ATRIBUTOS, OPCIONAIS: [...OPCIONAIS], POSICOES, POS_JOGO, PES, APARENCIA, APARENCIA_PADRAO, AJUSTES_BANDEIRA, LIMITES, FORMACOES_PADRAO, timeEmBranco, validarTime, slug, ascii };
