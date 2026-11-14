// Lógica pura do campeonato: sem Electron, sem disco. Testável com `node teste-logica.js`.
'use strict';

// Pontos corridos pelo método do círculo. Com 4 times: 3 rodadas no turno, 6 com returno.
function gerarJogos(ids, idaVolta = true) {
  const lista = ids.slice();
  if (lista.length % 2) lista.push(null); // folga se for ímpar
  const n = lista.length;
  const turno = [];
  let arr = lista.slice();
  for (let r = 0; r < n - 1; r++) {
    const jogosRodada = [];
    for (let i = 0; i < n / 2; i++) {
      let casa = arr[i];
      let fora = arr[n - 1 - i];
      // alterna o mando do time fixo para ninguém jogar sempre em casa
      if (i === 0 && r % 2 === 1) [casa, fora] = [fora, casa];
      if (casa !== null && fora !== null) jogosRodada.push({ casa, visitante: fora });
    }
    turno.push(jogosRodada);
    // gira todos menos o primeiro
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const rodadas = idaVolta
    ? [...turno, ...turno.map(r => r.map(j => ({ casa: j.visitante, visitante: j.casa })))]
    : turno;

  const jogos = [];
  rodadas.forEach((rodada, ri) => {
    rodada.forEach((j, ji) => {
      jogos.push({
        id: `r${ri + 1}j${ji + 1}`,
        rodada: ri + 1,
        casa: j.casa,
        visitante: j.visitante,
        status: 'agendado', // agendado | em_andamento | encerrado
        placar: null,
        gols: [],
        penaltis: null,
        origem: null, // 'jogo' (resultado.json) | 'manual'
        iniciadoEm: null,
        encerradoEm: null,
      });
    });
  });
  return jogos;
}

function novoCampeonato({ nome, times, idaVolta = true, meuTime = null }) {
  if (!Array.isArray(times) || times.length < 2) throw new Error('Escolha pelo menos 2 times.');
  const ids = times.map(t => t.id);
  if (new Set(ids).size !== ids.length) throw new Error('Time repetido.');
  if (meuTime && !ids.includes(meuTime)) throw new Error('O seu time precisa estar entre os participantes.');
  return {
    versao: 1,
    nome: nome || 'Campeonato WE2002',
    meuTime,
    criadoEm: new Date().toISOString(),
    idaVolta,
    times,
    jogos: gerarJogos(ids, idaVolta),
  };
}

function classificacao(camp, pontos = { vitoria: 3, empate: 1, derrota: 0 }) {
  const tab = new Map(camp.times.map(t => [t.id, {
    id: t.id, nome: t.nome, sigla: t.sigla,
    pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, ultimos: [],
  }]));
  const encerrados = camp.jogos
    .filter(j => j.status === 'encerrado' && j.placar)
    .sort((a, b) => a.rodada - b.rodada);
  for (const jogo of encerrados) {
    const c = tab.get(jogo.casa), v = tab.get(jogo.visitante);
    if (!c || !v) continue;
    const gc = jogo.placar.casa, gv = jogo.placar.visitante;
    c.j++; v.j++;
    c.gp += gc; c.gc += gv; v.gp += gv; v.gc += gc;
    if (gc > gv) { c.v++; v.d++; c.pts += pontos.vitoria; v.pts += pontos.derrota; c.ultimos.push('V'); v.ultimos.push('D'); }
    else if (gc < gv) { v.v++; c.d++; v.pts += pontos.vitoria; c.pts += pontos.derrota; v.ultimos.push('V'); c.ultimos.push('D'); }
    else { c.e++; v.e++; c.pts += pontos.empate; v.pts += pontos.empate; c.ultimos.push('E'); v.ultimos.push('E'); }
  }
  const linhas = [...tab.values()];
  for (const l of linhas) { l.sg = l.gp - l.gc; l.ultimos = l.ultimos.slice(-5); }
  // Critérios: pontos, vitórias, saldo, gols pró, nome
  linhas.sort((a, b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg || b.gp - a.gp || a.nome.localeCompare(b.nome));
  linhas.forEach((l, i) => { l.pos = i + 1; });
  return linhas;
}

function artilharia(camp) {
  const mapa = new Map();
  for (const jogo of camp.jogos) {
    if (jogo.status !== 'encerrado') continue;
    for (const g of jogo.gols || []) {
      if (g.contra || !g.nome) continue;
      const timeId = g.lado === 'visitante' ? jogo.visitante : jogo.casa;
      const chave = `${timeId}|${g.nome}`;
      const item = mapa.get(chave) || { nome: g.nome, time: timeId, gols: 0 };
      item.gols++;
      mapa.set(chave, item);
    }
  }
  return [...mapa.values()].sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome));
}

function proximoJogo(camp) {
  return camp.jogos.find(j => j.status === 'em_andamento')
    || camp.jogos.find(j => j.status === 'agendado')
    || null;
}

// Converte o data/resultado.json da ponte num formato estável.
// Tolerante a campos ausentes: a ponte ainda está evoluindo.
function normalizarResultado(r) {
  if (!r || typeof r !== 'object') return null;
  const num = x => (typeof x === 'number' && isFinite(x) ? x : null);
  const casa = r.casa || {}, vis = r.visitante || {};
  const gols = Array.isArray(r.gols) ? r.gols.map(g => ({
    lado: g.lado === 'visitante' ? 'visitante' : 'casa',
    nome: g.nome || (g.vaga != null ? `Vaga ${g.vaga}` : '?'),
    vaga: num(g.vaga),
    minuto: num(g.minuto),
    assistencia: g.assist_nome || (typeof g.assistencia === 'string' ? g.assistencia
      : (g.assistencia && g.assistencia.nome) || null),
    contra: !!g.contra,
  })) : [];
  let pen = null;
  // formato da ponte: casa.penaltis / visitante.penaltis (null sem disputa)
  if (num(casa.penaltis) != null || num(vis.penaltis) != null) {
    pen = { casa: num(casa.penaltis) ?? 0, visitante: num(vis.penaltis) ?? 0 };
  } else if (r.penaltis && typeof r.penaltis === 'object') {
    pen = { casa: num(r.penaltis.casa), visitante: num(r.penaltis.visitante) };
    if (pen.casa == null && pen.visitante == null) pen = null;
  }
  return {
    partidaId: r.partida_id || null,
    casaNome: casa.nome || null,
    visitanteNome: vis.nome || null,
    golsCasa: num(casa.gols) ?? gols.filter(g => g.lado === 'casa').length,
    golsVisitante: num(vis.gols) ?? gols.filter(g => g.lado === 'visitante').length,
    gols,
    penaltis: pen,
    final: r.final === true,
  };
}

// ---------- jogos do usuário: o time dele sempre ocupa a vaga do controle 1 (casa) ----------
// Retorna os ids na ordem das vagas do emulador e se o mando foi invertido.
function vagasDoJogo(jogo, meuTime) {
  if (meuTime && jogo.visitante === meuTime) return { slotCasa: jogo.visitante, slotVisitante: jogo.casa, invertido: true };
  return { slotCasa: jogo.casa, slotVisitante: jogo.visitante, invertido: false };
}

// Escolhe o estado base (quem controla cada lado) e se é preciso inverter o mando.
// disponiveis: Set com os estados que existem ('p1_cpu', 'cpu_p1', 'p1_p2', 'cpu_cpu').
// opcao: null (automático) | 'p1_p2' (dois jogadores) | 'cpu_cpu' (assistir).
function escolherControle(jogo, meuTime, disponiveis, opcao = null) {
  const tem = id => disponiveis.has(id);
  if (opcao === 'p1_p2' && tem('p1_p2')) return { controle: 'p1_p2', invertido: false };
  if (opcao === 'cpu_cpu' && tem('cpu_cpu')) return { controle: 'cpu_cpu', invertido: false };
  if (meuTime && jogo.visitante === meuTime) {
    // seu time fora: CPU x P1 mantém o mando real; sem esse estado, inverte os lados
    if (tem('cpu_p1')) return { controle: 'cpu_p1', invertido: false };
    return { controle: 'p1_cpu', invertido: true };
  }
  return { controle: 'p1_cpu', invertido: false };
}

// Converte um resultado normalizado (lados = vagas do emulador) para o mando real do jogo.
function desinverter(r, invertido) {
  if (!invertido || !r) return r;
  const troca = l => (l === 'casa' ? 'visitante' : 'casa');
  return {
    ...r,
    casaNome: r.visitanteNome, visitanteNome: r.casaNome,
    golsCasa: r.golsVisitante, golsVisitante: r.golsCasa,
    gols: r.gols.map(g => ({ ...g, lado: troca(g.lado) })),
    penaltis: r.penaltis ? { casa: r.penaltis.visitante, visitante: r.penaltis.casa } : null,
  };
}

// ---------- simulação dos jogos sem o usuário ----------
const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 15);
const ATAQUE = ['OFF', 'SHAC', 'SHPW', 'TEC', 'DRI', 'PASS'];
const DEFESA = ['DEF', 'BAL', 'RES', 'SPD', 'HEAD', 'JMP'];
const POS_ATAQUE = /^(CF|SS|LW|RW|OH|WF|AM)$/;
const POS_DEFESA = /^(GK|CB|SW|LB|RB|WB|DH|DM)$/;

// Força a partir dos 11 titulares (vagas 0-10). Atributos de 12 a 19.
function forcaTime(dadosTime) {
  const tit = (dadosTime.jogadores || []).filter(j => (j.vaga ?? 99) <= 10 && j.atributos);
  const val = (j, ks) => media(ks.map(k => j.atributos[k]).filter(v => typeof v === 'number'));
  const atk = tit.filter(j => POS_ATAQUE.test(j.posicao || ''));
  const def = tit.filter(j => POS_DEFESA.test(j.posicao || ''));
  return {
    ataque: media((atk.length ? atk : tit).map(j => val(j, ATAQUE))),
    defesa: media((def.length ? def : tit).map(j => val(j, DEFESA))),
    titulares: tit,
  };
}

function poisson(lambda, rnd) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

function sortearAutor(tit, rnd) {
  const cand = tit.filter(j => j.posicao !== 'GK');
  if (!cand.length) return null;
  const peso = j => {
    const a = j.atributos;
    const base = Math.max(1, (a.OFF || 15) + (a.SHAC || 15) - 24);
    return POS_ATAQUE.test(j.posicao || '') ? base * 3 : POS_DEFESA.test(j.posicao || '') ? base * 0.4 : base;
  };
  const total = cand.reduce((s, j) => s + peso(j), 0);
  let x = rnd() * total;
  for (const j of cand) { x -= peso(j); if (x <= 0) return j; }
  return cand[cand.length - 1];
}

// Placar com Poisson: ~1,2 gol por time, ajustado pela vantagem do ataque de um sobre a defesa do
// outro, comparada à do adversário (ataque e defesa usam atributos diferentes, então só a
// diferença entre os dois times importa), mais uma pequena vantagem de mando.
function simularPartida(dadosCasa, dadosVis, rnd = Math.random) {
  const c = forcaTime(dadosCasa), v = forcaTime(dadosVis);
  const dif = (c.ataque - v.defesa) - (v.ataque - c.defesa); // > 0: casa mais forte
  const lambda = (d, mando) => Math.min(4, Math.max(0.25, 1.2 * Math.exp(d * 0.6) + mando));
  const gc = poisson(lambda(dif / 2, 0.15), rnd);
  const gv = poisson(lambda(-dif / 2, 0), rnd);
  const gols = [];
  const add = (n, lado, tit) => {
    for (let i = 0; i < n; i++) {
      const a = sortearAutor(tit, rnd);
      const ass = rnd() < 0.6 ? sortearAutor(tit.filter(j => j !== a), rnd) : null;
      gols.push({ lado, nome: a ? a.nome : '?', vaga: a ? a.vaga : null, minuto: 1 + Math.floor(rnd() * 90),
        assistencia: ass ? ass.nome : null, contra: false });
    }
  };
  add(gc, 'casa', c.titulares);
  add(gv, 'visitante', v.titulares);
  gols.sort((a, b) => a.minuto - b.minuto);
  return { placar: { casa: gc, visitante: gv }, gols };
}

module.exports = {
  escolherControle, vagasDoJogo, desinverter, simularPartida, forcaTime, gerarJogos, novoCampeonato, classificacao, artilharia, proximoJogo, normalizarResultado };
