'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const C = require('./campeonato');

// ---------- configuração e caminhos ----------
const APP_DIR = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf-8'));
const RAIZ = path.resolve(APP_DIR, config.raizProjeto || '..');
const caminho = rel => path.join(RAIZ, rel);
const ARQ = {
  times: caminho(config.pastaTimes),
  partida: caminho(config.arquivoPartida),
  resultado: caminho(config.arquivoResultado),
  campeonato: caminho(config.arquivoCampeonato),
};

function lerJson(arq, padrao = null) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf-8').replace(/^﻿/, '')); }
  catch { return padrao; }
}
function gravarJson(arq, dados) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2), 'utf-8');
  fs.renameSync(tmp, arq); // grava inteiro ou nada
}

// ---------- times ----------
// Cores de um uniforme para as miniaturas do app.
function resumoKit(k) {
  if (!k || typeof k !== 'object') return null;
  const d = k.design || {};
  return { camisa: d.camisa || null, detalhe: d.detalhe || null, calcao: d.calcao || null, meiao: d.meiao || null,
    numero: k.cor_numero || null, listras: (d.listras_verticais && d.listras_verticais.cores) || null, arte: k.arte || null };
}
const T = require('./times');
const dadosTime = arquivo => lerJson(caminho(arquivo)) || {};
// Resolve "auto" pelo mando real e devolve { casa, visitante } = 'titular' | 'reserva'.
function uniformesDoJogo(arqCasa, arqVis, pedidos = {}) {
  const ped = x => (T.UNIFORMES.includes(x) ? x : 'auto');
  return T.resolverUniformes(dadosTime(arqCasa), dadosTime(arqVis), ped(pedidos.casa), ped(pedidos.visitante));
}
function listarTimes() {
  let arquivos = [];
  try { arquivos = fs.readdirSync(ARQ.times).filter(f => /\.json$/i.test(f)); } catch { return []; }
  return arquivos.map(f => {
    const d = lerJson(path.join(ARQ.times, f));
    if (!d || !d.nome) return null;
    return {
      id: path.basename(f, '.json').toLowerCase(),
      nome: d.nome,
      sigla: d.sigla || d.nome.slice(0, 3).toUpperCase(),
      arquivo: path.posix.join(config.pastaTimes.replace(/\\/g, '/'), f),
      jogadores: Array.isArray(d.jogadores) ? d.jogadores.length : 0,
      cor: (d.kit && d.kit.design && d.kit.design.camisa) || null,
      cor2: (d.kit && (d.kit.cor_numero || (d.kit.design && d.kit.design.detalhe))) || null,
      uniformes: { titular: resumoKit(d.kit), reserva: resumoKit(d.kit_reserva) },
    };
  }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------- campeonato ----------
let camp = lerJson(ARQ.campeonato);
const salvar = () => gravarJson(ARQ.campeonato, camp);
const acharJogo = id => {
  const j = camp && camp.jogos.find(x => x.id === id);
  if (!j) throw new Error(`Jogo ${id} não encontrado.`);
  return j;
};
const timeDe = id => camp.times.find(t => t.id === id);

function lerResultado() {
  let st;
  try { st = fs.statSync(ARQ.resultado); } catch { return null; }
  const r = C.normalizarResultado(lerJson(ARQ.resultado));
  if (!r) return null;
  r.mtime = st.mtimeMs;
  return r;
}

// O resultado.json pertence ao jogo em andamento?
function conferirResultado(jogo, r) {
  if (!jogo || !r) return { ok: false, motivo: 'sem resultado' };
  if (jogo.iniciadoEm && r.mtime < Date.parse(jogo.iniciadoEm) - 2000)
    return { ok: false, motivo: 'resultado.json é anterior ao início desta partida' };
  if (r.partidaId && r.partidaId !== jogo.partidaId)
    return { ok: false, motivo: `resultado.json é da partida ${r.partidaId}` };
  const vg = C.vagasDoJogo(jogo, jogo.invertido ? jogo.visitante : null);
  const c = timeDe(vg.slotCasa), v = timeDe(vg.slotVisitante);
  if (r.casaNome && r.visitanteNome && (r.casaNome !== c.nome || r.visitanteNome !== v.nome))
    return { ok: false, motivo: `resultado.json é de ${r.casaNome} x ${r.visitanteNome}` };
  return { ok: true };
}

function estado() {
  const times = listarTimes();
  if (!camp) return { raiz: RAIZ, pastaTimes: ARQ.times, config: publicoConfig(), timesDisponiveis: times, campeonato: null, amistoso: estadoAmistoso() };
  const prox = C.proximoJogo(camp);
  const andamento = camp.jogos.find(j => j.status === 'em_andamento') || null;
  const res = andamento ? lerResultado() : null;
  return {
    raiz: RAIZ,
    pastaTimes: ARQ.times,
    config: publicoConfig(),
    timesDisponiveis: times,
    amistoso: estadoAmistoso(),
    campeonato: camp,
    classificacao: C.classificacao(camp, config.pontos),
    artilharia: C.artilharia(camp),
    proximoJogoId: prox && prox.id,
    resultadoAoVivo: res ? { ...C.desinverter(res, andamento.invertido), conferencia: conferirResultado(andamento, res) } : null,
  };
}
const publicoConfig = () => ({ emuladores: config.emuladores, emuladorPadrao: config.emuladorPadrao,
  estados: [...estadosDisponiveis()] });

// ---------- partida.json e emulador ----------
// Estados base que existem na pasta states/ (p1_cpu, cpu_p1, p1_p2, cpu_cpu)
function estadosDisponiveis() {
  const est = config.estados || { p1_cpu: 'states/amistoso.sstate' };
  return new Set(Object.keys(est).filter(id => fs.existsSync(caminho(est[id]))));
}

function prepararPartida(jogo, opcao = null, pedidosUniforme = null) {
  // Escolhe o estado base: seu time em casa → P1 x CPU; fora → CPU x P1 (mando real).
  // Sem o estado CPU x P1, o time do usuário vai para a casa (controle 1) e o mando é invertido.
  const esc = C.escolherControle(jogo, camp.meuTime, estadosDisponiveis(), opcao);
  jogo.invertido = esc.invertido;
  jogo.controle = esc.controle;
  const vg = esc.invertido
    ? { slotCasa: jogo.visitante, slotVisitante: jogo.casa, invertido: true }
    : { slotCasa: jogo.casa, slotVisitante: jogo.visitante, invertido: false };
  const c = timeDe(vg.slotCasa), v = timeDe(vg.slotVisitante);
  // Parte do partida.json atual (mantém kits, estado base etc.) e troca só os times.
  const p = lerJson(ARQ.partida, {}) || {};
  if (fs.existsSync(ARQ.partida)) fs.copyFileSync(ARQ.partida, ARQ.partida + '.anterior');
  jogo.partidaId = `${camp.id || 'camp'}-${jogo.id}-${Date.now().toString(36)}`;
  p.partida_id = jogo.partidaId;
  p.modo = 'pontos_corridos'; // empate vale: sem prorrogação nem pênaltis na leitura da ponte
  p.controle = esc.controle; // a ponte carrega o estado base correspondente
  p.campeonato = { nome: camp.nome, rodada: jogo.rodada, jogo: jogo.id, mando_invertido: vg.invertido, controle: esc.controle };
  p.casa = { nome: c.nome, id_we: config.idWe.casa, time: c.arquivo };
  p.visitante = { nome: v.nome, id_we: config.idWe.visitante, time: v.arquivo };
  // uniformes pelo mando real; cada time leva o seu para a vaga onde entrar
  const uni = uniformesDoJogo(timeDe(jogo.casa).arquivo, timeDe(jogo.visitante).arquivo, pedidosUniforme || {});
  jogo.uniformes = { casa: uni.casa, visitante: uni.visitante };
  p.casa.uniforme = vg.invertido ? uni.visitante : uni.casa;
  p.visitante.uniforme = vg.invertido ? uni.casa : uni.visitante;
  if (!Array.isArray(p.edicoes)) p.edicoes = [];
  // a ponte fecha o emulador 10 s depois do resultado final
  p.fechar_ao_final = { ...(p.fechar_ao_final || {}), ativo: true, espera_segundos: 10 };
  gravarJson(ARQ.partida, p);
}

function abrirEmulador(chave) {
  const em = config.emuladores[chave] || config.emuladores[config.emuladorPadrao];
  if (process.platform !== 'win32') throw new Error('Iniciar o emulador só funciona no Windows.');
  // `start` abre o .bat numa janela própria e não prende o app.
  const filho = spawn(`start "WE2002" cmd /c ${em.comando}`, {
    cwd: RAIZ, shell: true, detached: true, stdio: 'ignore', windowsHide: false,
  });
  filho.unref();
  return em.nome;
}

// ---------- janela ----------
let janela;
function criarJanela() {
  janela = new BrowserWindow({
    width: 1180, height: 780, minWidth: 900, minHeight: 600,
    title: 'WE2002 Manager · Campeonato',
    backgroundColor: '#0f1512',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  janela.loadFile(path.join(APP_DIR, 'src', 'index.html'));
}

// Observa o resultado.json (polling: é o que funciona sempre no Windows).
fs.watchFile(ARQ.resultado, { interval: 1000 }, () => {
  const am = autoAmistoso();
  if (am && janela && !janela.isDestroyed())
    janela.webContents.send('amistoso-fim', `${am.casa.nome} ${am.placar.casa} x ${am.placar.visitante} ${am.visitante.nome}`);
  const jogo = autoConfirmar();
  if (janela && !janela.isDestroyed()) {
    janela.webContents.send('atualizado');
    if (jogo) janela.webContents.send('confirmado', `${timeDe(jogo.casa).nome} ${jogo.placar.casa} x ${jogo.placar.visitante} ${timeDe(jogo.visitante).nome}`);
  }
});

// ---------- IPC ----------
const tratar = (canal, fn) => ipcMain.handle(canal, async (_e, ...args) => {
  try { return { ok: true, dados: await fn(...args) }; }
  catch (err) { return { ok: false, erro: err.message }; }
});

tratar('estado', () => estado());

tratar('criar-campeonato', ({ nome, timeIds, idaVolta, meuTime }) => {
  const disp = listarTimes();
  const times = timeIds.map(id => {
    const t = disp.find(x => x.id === id);
    if (!t) throw new Error(`Time ${id} não encontrado em ${config.pastaTimes}.`);
    return { id: t.id, nome: t.nome, sigla: t.sigla, arquivo: t.arquivo, cor: t.cor, cor2: t.cor2 };
  });
  // embaralha para o sorteio da tabela
  for (let i = times.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [times[i], times[k]] = [times[k], times[i]];
  }
  if (camp && fs.existsSync(ARQ.campeonato))
    fs.copyFileSync(ARQ.campeonato, ARQ.campeonato.replace(/\.json$/, `.${Date.now()}.json`));
  camp = C.novoCampeonato({ nome, times, idaVolta, meuTime: meuTime || null });
  camp.id = 'c' + Date.now().toString(36);
  salvar();
  return estado();
});

tratar('jogar', ({ jogoId, emulador, abrir, opcao, uniformes }) => {
  const jogo = acharJogo(jogoId);
  if (jogo.status === 'encerrado') throw new Error('Este jogo já foi encerrado. Reabra antes.');
  const outro = camp.jogos.find(j => j.status === 'em_andamento' && j.id !== jogoId);
  if (outro) throw new Error(`O jogo ${timeDe(outro.casa).nome} x ${timeDe(outro.visitante).nome} ainda está em andamento.`);
  if (amistosoEmAndamento()) throw new Error('Há um amistoso em andamento. Encerre ou cancele o amistoso antes.');
  prepararPartida(jogo, opcao || null, uniformes || null);
  jogo.status = 'em_andamento';
  jogo.iniciadoEm = new Date().toISOString();
  salvar();
  const aberto = abrir ? abrirEmulador(emulador) : null;
  return { estado: estado(), aberto };
});

tratar('cancelar-jogo', ({ jogoId }) => {
  const jogo = acharJogo(jogoId);
  if (jogo.status === 'em_andamento') { jogo.status = 'agendado'; jogo.iniciadoEm = null; }
  salvar();
  return estado();
});

// Encerra com o resultado.json (origem 'jogo') ou com um placar digitado (origem 'manual').
tratar('encerrar-jogo', ({ jogoId, manual }) => {
  const jogo = acharJogo(jogoId);
  if (manual) {
    const gc = Number(manual.casa), gv = Number(manual.visitante);
    if (!Number.isInteger(gc) || !Number.isInteger(gv) || gc < 0 || gv < 0) throw new Error('Placar inválido.');
    jogo.placar = { casa: gc, visitante: gv };
    jogo.gols = Array.isArray(manual.gols) ? manual.gols : [];
    jogo.penaltis = null;
    jogo.origem = 'manual';
    jogo.status = 'encerrado';
    jogo.encerradoEm = new Date().toISOString();
    salvar();
  } else {
    encerrarComResultado(jogo);
  }
  return estado();
});

function encerrarComResultado(jogo) {
  const r = lerResultado();
  const conf = conferirResultado(jogo, r);
  if (!conf.ok) throw new Error(`Não dá para usar o resultado.json: ${conf.motivo}.`);
  const r2 = C.desinverter(r, jogo.invertido);
  jogo.placar = { casa: r2.golsCasa, visitante: r2.golsVisitante };
  jogo.gols = r2.gols;
  jogo.penaltis = r2.penaltis;
  jogo.origem = 'jogo';
  jogo.status = 'encerrado';
  jogo.encerradoEm = new Date().toISOString();
  // guarda uma cópia do resultado bruto junto do campeonato
  const pasta = path.join(path.dirname(ARQ.campeonato), 'resultados');
  fs.mkdirSync(pasta, { recursive: true });
  fs.copyFileSync(ARQ.resultado, path.join(pasta, `${camp.id}-${jogo.id}.json`));
  salvar();
}

// A ponte grava "final": true no apito final (bytes de fim de jogo mapeados em 08/11):
// o app confirma sozinho. Dá para desfazer com "reabrir".
function autoConfirmar() {
  if (!camp || config.confirmarAutomatico === false) return null;
  const jogo = camp.jogos.find(j => j.status === 'em_andamento');
  if (!jogo) return null;
  const r = lerResultado();
  if (!r || !r.final || !conferirResultado(jogo, r).ok) return null;
  try { encerrarComResultado(jogo); return jogo; } catch { return null; }
}

tratar('reabrir-jogo', ({ jogoId }) => {
  const jogo = acharJogo(jogoId);
  Object.assign(jogo, { status: 'agendado', invertido: false, controle: null, uniformes: null, placar: null, gols: [], penaltis: null, origem: null, iniciadoEm: null, encerradoEm: null });
  salvar();
  return estado();
});

function simular(jogo) {
  if (jogo.status !== 'agendado') throw new Error('Só dá para simular um jogo agendado.');
  const dados = id => {
    const d = lerJson(caminho(timeDe(id).arquivo));
    if (!d) throw new Error(`Não consegui ler ${timeDe(id).arquivo}.`);
    return d;
  };
  const r = C.simularPartida(dados(jogo.casa), dados(jogo.visitante));
  Object.assign(jogo, { placar: r.placar, gols: r.gols, penaltis: null, origem: 'simulado',
    status: 'encerrado', encerradoEm: new Date().toISOString() });
}

tratar('simular', ({ jogoId }) => {
  const jogo = acharJogo(jogoId);
  if (camp.meuTime && (jogo.casa === camp.meuTime || jogo.visitante === camp.meuTime))
    throw new Error('Este é um jogo do seu time: jogue no emulador ou lance o placar.');
  simular(jogo);
  salvar();
  return estado();
});

// Simula os jogos pendentes da rodada que não são do usuário.
tratar('simular-rodada', ({ rodada }) => {
  const meus = j => camp.meuTime && (j.casa === camp.meuTime || j.visitante === camp.meuTime);
  const alvo = camp.jogos.filter(j => j.rodada === rodada && j.status === 'agendado' && !meus(j));
  alvo.forEach(simular);
  salvar();
  return { estado: estado(), n: alvo.length };
});

tratar('meu-time', ({ timeId }) => {
  if (timeId && !camp.times.some(t => t.id === timeId)) throw new Error('Time fora do campeonato.');
  camp.meuTime = timeId || null;
  salvar();
  return estado();
});

tratar('abrir-pasta', () => shell.openPath(RAIZ));

// ---------- amistoso ----------
// Partida avulsa entre dois times de data/times, fora do campeonato. O time escolhido como
// casa entra na vaga do Brasil e o visitante na da Holanda; o cenário escolhe o estado base:
//   p1_cpu → você controla a casa · cpu_p1 → você controla o visitante · cpu_cpu → só assiste
ARQ.amistoso = caminho('data/amistoso.json');
const CENARIOS = { p1_cpu: 'P1 x CPU', cpu_cpu: 'CPU x CPU', cpu_p1: 'CPU x P1' };
let amistoso = lerJson(ARQ.amistoso);
const salvarAmistoso = () => gravarJson(ARQ.amistoso, amistoso);
const amistosoEmAndamento = () => !!(amistoso && amistoso.status === 'em_andamento');

function conferirAmistoso(a, r) {
  if (!a || !r) return { ok: false, motivo: 'sem resultado' };
  if (a.iniciadoEm && r.mtime < Date.parse(a.iniciadoEm) - 2000)
    return { ok: false, motivo: 'resultado.json é anterior ao início deste amistoso' };
  if (r.partidaId && r.partidaId !== a.partidaId)
    return { ok: false, motivo: `resultado.json é da partida ${r.partidaId}` };
  if (r.casaNome && r.visitanteNome && (r.casaNome !== a.casa.nome || r.visitanteNome !== a.visitante.nome))
    return { ok: false, motivo: `resultado.json é de ${r.casaNome} x ${r.visitanteNome}` };
  return { ok: true };
}

function estadoAmistoso() {
  if (!amistoso) return null;
  if (!amistosoEmAndamento()) return { ...amistoso, aoVivo: null };
  const r = lerResultado();
  return { ...amistoso, aoVivo: r ? { ...r, conferencia: conferirAmistoso(amistoso, r) } : null };
}

tratar('amistoso-iniciar', ({ casaId, visitanteId, cenario, emulador, mataMata, uniformes }) => {
  if (!CENARIOS[cenario]) throw new Error('Cenário inválido.');
  if (!estadosDisponiveis().has(cenario))
    throw new Error(`Falta o estado base de ${CENARIOS[cenario]} (${(config.estados || {})[cenario] || '?'}).`);
  if (!casaId || !visitanteId || casaId === visitanteId) throw new Error('Escolha dois times diferentes.');
  const disp = listarTimes();
  const pega = id => {
    const t = disp.find(x => x.id === id);
    if (!t) throw new Error(`Time ${id} não encontrado em ${config.pastaTimes}.`);
    return { id: t.id, nome: t.nome, sigla: t.sigla, arquivo: t.arquivo, cor: t.cor, cor2: t.cor2 };
  };
  const c = pega(casaId), v = pega(visitanteId);
  if (amistosoEmAndamento()) throw new Error('Já há um amistoso em andamento. Encerre ou cancele antes.');
  const doCamp = camp && camp.jogos.find(j => j.status === 'em_andamento');
  if (doCamp) throw new Error(`O jogo ${timeDe(doCamp.casa).nome} x ${timeDe(doCamp.visitante).nome} do campeonato está em andamento.`);

  // CPU x P1 e CPU x CPU dependem dos estados base da ponte, que só existem no PCSX-Redux.
  const em = cenario === 'p1_cpu' && config.emuladores[emulador] ? emulador : 'pcsx';
  const id = `amistoso-${Date.now().toString(36)}`;
  const p = lerJson(ARQ.partida, {}) || {};
  if (fs.existsSync(ARQ.partida)) fs.copyFileSync(ARQ.partida, ARQ.partida + '.anterior');
  delete p.campeonato;
  p.partida_id = id;
  p.tipo = 'amistoso';
  p.modo = mataMata ? 'mata_mata' : 'pontos_corridos';
  p.controle = cenario;
  p.amistoso = { cenario };
  p.casa = { nome: c.nome, id_we: config.idWe.casa, time: c.arquivo };
  p.visitante = { nome: v.nome, id_we: config.idWe.visitante, time: v.arquivo };
  const uni = uniformesDoJogo(c.arquivo, v.arquivo, uniformes || {});
  p.casa.uniforme = uni.casa;
  p.visitante.uniforme = uni.visitante;
  if (!Array.isArray(p.edicoes)) p.edicoes = [];
  p.fechar_ao_final = { ...(p.fechar_ao_final || {}), ativo: true, espera_segundos: 10 };
  gravarJson(ARQ.partida, p);

  amistoso = { id, partidaId: id, casa: c, visitante: v, cenario, modo: p.modo, emulador: em,
    uniformes: { casa: uni.casa, visitante: uni.visitante },
    status: 'em_andamento', iniciadoEm: new Date().toISOString(), placar: null, gols: [], penaltis: null };
  salvarAmistoso();
  const aberto = abrirEmulador(em);
  return { estado: estado(), aberto };
});

// Fecha o amistoso. Com resultado.json válido guarda placar e cópia em data/amistosos/;
// com descartar: true (ou sem resultado) apenas encerra.
function encerrarAmistoso(descartar = false) {
  if (!amistosoEmAndamento()) throw new Error('Não há amistoso em andamento.');
  const r = descartar ? null : lerResultado();
  if (!descartar) {
    const conf = conferirAmistoso(amistoso, r);
    if (!conf.ok) throw new Error(`Não dá para usar o resultado.json: ${conf.motivo}.`);
    amistoso.placar = { casa: r.golsCasa, visitante: r.golsVisitante };
    amistoso.gols = r.gols;
    amistoso.penaltis = r.penaltis;
    const pasta = caminho('data/amistosos');
    fs.mkdirSync(pasta, { recursive: true });
    fs.copyFileSync(ARQ.resultado, path.join(pasta, `${amistoso.id}.json`));
  }
  amistoso.status = descartar ? 'cancelado' : 'encerrado';
  amistoso.encerradoEm = new Date().toISOString();
  salvarAmistoso();
  return amistoso;
}

function autoAmistoso() {
  if (!amistosoEmAndamento() || config.confirmarAutomatico === false) return null;
  const r = lerResultado();
  if (!r || !r.final || !conferirAmistoso(amistoso, r).ok) return null;
  try { return encerrarAmistoso(); } catch { return null; }
}

tratar('amistoso-encerrar', ({ descartar } = {}) => { encerrarAmistoso(!!descartar); return estado(); });

// ---------- editor de times ----------
const ID_TIME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const arqTime = id => {
  if (!ID_TIME.test(id || '')) throw new Error('Nome de arquivo inválido: use letras minúsculas, números e "-".');
  return path.join(ARQ.times, id + '.json');
};
// Formações que a ponte conhece (lidas do we2002.lua, para não ficarem fora de sincronia).
function formacoes() {
  try {
    const lua = fs.readFileSync(caminho('bridge/we2002.lua'), 'utf-8');
    const bloco = /local FORMACOES = \{([\s\S]*?)\n\}/.exec(lua);
    const nomes = bloco ? [...bloco[1].matchAll(/\["([^"]+)"\]\s*=/g)].map(m => m[1]) : [];
    if (nomes.length) return nomes;
  } catch { /* usa a lista padrão */ }
  return T.FORMACOES_PADRAO;
}
function listarArquivos(rel, re) {
  try { return fs.readdirSync(caminho(rel)).filter(f => re.test(f)).sort().map(f => `${rel}/${f}`); }
  catch { return []; }
}
// Time num jogo em andamento (campeonato ou amistoso)?
function timeEmJogo(id) {
  const j = camp && camp.jogos.find(x => x.status === 'em_andamento' && (x.casa === id || x.visitante === id));
  if (j) return `${timeDe(j.casa).nome} x ${timeDe(j.visitante).nome}`;
  if (amistosoEmAndamento() && (amistoso.casa.id === id || amistoso.visitante.id === id))
    return `o amistoso ${amistoso.casa.nome} x ${amistoso.visitante.nome}`;
  return null;
}

tratar('times-recursos', () => ({
  formacoes: formacoes(),
  bandeiras: listarArquivos('bandeiras', /\.(png|jpe?g)$/i),
  artes: listarArquivos('kits/desenhos', /\.png$/i),
  atributos: T.ATRIBUTOS, opcionais: T.OPCIONAIS, posicoes: T.POSICOES, posJogo: T.POS_JOGO, pes: T.PES,
  aparencia: T.APARENCIA, aparenciaPadrao: T.APARENCIA_PADRAO,
  ajustes: T.AJUSTES_BANDEIRA, limites: T.LIMITES,
  modelo: T.timeEmBranco(),
}));

tratar('time-ler', ({ id }) => {
  const dados = lerJson(arqTime(id));
  if (!dados) throw new Error(`Não consegui ler data/times/${id}.json.`);
  if (!Array.isArray(dados.jogadores)) dados.jogadores = [];
  dados.jogadores.sort((a, b) => (a.vaga ?? 99) - (b.vaga ?? 99));
  return { id, dados };
});

tratar('time-salvar', ({ id, novo, dados }) => {
  const arq = arqTime(id);
  if (novo && fs.existsSync(arq)) throw new Error(`Já existe um time em data/times/${id}.json. Escolha outro nome de arquivo.`);
  if (!novo && !fs.existsSync(arq)) throw new Error(`data/times/${id}.json não existe mais.`);
  const jogo = !novo && timeEmJogo(id);
  if (jogo) throw new Error(`Este time está em ${jogo}. Termine a partida antes de editar.`);
  const { time, erros, avisos } = T.validarTime(dados, formacoes());
  if (erros.length) throw new Error(erros.slice(0, 6).join(' · ') + (erros.length > 6 ? ` · e mais ${erros.length - 6}` : ''));
  if (!novo) fs.copyFileSync(arq, arq + '.anterior'); // versão anterior, por segurança
  gravarJson(arq, time);
  // o campeonato guarda um retrato do time (nome, sigla, cores): atualiza
  const t = camp && camp.times.find(x => x.id === id);
  const m = t && listarTimes().find(x => x.id === id);
  if (m) { Object.assign(t, { nome: m.nome, sigla: m.sigla, arquivo: m.arquivo, cor: m.cor, cor2: m.cor2 }); salvar(); }
  return { estado: estado(), id, avisos };
});

// "Excluir" move o arquivo para data/times/excluidos/ (dá para recuperar).
tratar('time-excluir', ({ id }) => {
  const arq = arqTime(id);
  if (camp && camp.times.some(t => t.id === id)) throw new Error('Este time está no campeonato atual. Crie outro campeonato antes de excluí-lo.');
  const jogo = timeEmJogo(id);
  if (jogo) throw new Error(`Este time está em ${jogo}.`);
  const pasta = path.join(ARQ.times, 'excluidos');
  fs.mkdirSync(pasta, { recursive: true });
  fs.renameSync(arq, path.join(pasta, `${id}.${Date.now()}.json`));
  return estado();
});

// ---------- uniformes ----------
// Prévia da escolha antes do jogo: casaId/visitanteId pelo mando real.
tratar('uniformes-previa', ({ casaId, visitanteId, casa, visitante }) => {
  const disp = listarTimes();
  const a = disp.find(t => t.id === casaId), b = disp.find(t => t.id === visitanteId);
  if (!a || !b) throw new Error('Time não encontrado.');
  return uniformesDoJogo(a.arquivo, b.arquivo, { casa, visitante });
});

// Miniatura do desenho do kit (PNG de kits/desenhos), como data URL.
tratar('kit-imagem', ({ arte }) => {
  const rel = String(arte || '').replace(/\\/g, '/');
  if (!/^kits\/desenhos\/[^/]+\.png$/i.test(rel)) throw new Error('Desenho de kit inválido.');
  const arq = caminho(rel);
  if (!fs.existsSync(arq)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(arq).toString('base64');
});

// Redesenha o PNG do uniforme a partir das cores (tools/desenhar-kit.mjs), sobre o kit base da casa.
tratar('kit-desenhar', async ({ id, uniforme }) => {
  const arq = arqTime(id);
  const time = lerJson(arq);
  if (!time) throw new Error(`Não consegui ler data/times/${id}.json.`);
  const chave = uniforme === 'reserva' ? 'kit_reserva' : 'kit';
  const kit = time[chave];
  if (!kit || !kit.design || !kit.design.camisa) throw new Error('Defina as cores do uniforme antes de desenhar.');
  if (!kit.arte) { // primeiro desenho: dá um nome ao arquivo e grava no time
    kit.arte = `kits/desenhos/${id}${chave === 'kit_reserva' ? '_reserva' : ''}_4x.png`;
    fs.copyFileSync(arq, arq + '.anterior');
    gravarJson(arq, time);
  }
  const destino = caminho(kit.arte);
  if (fs.existsSync(destino)) fs.copyFileSync(destino, destino.replace(/\.png$/i, '.anterior.png'));
  const p = lerJson(ARQ.partida, {}) || {};
  const tmp = path.join(path.dirname(ARQ.partida), 'partida.desenho.json');
  gravarJson(tmp, { ...p, casa: { ...(p.casa || {}), nome: time.nome, time: path.posix.join(config.pastaTimes, `${id}.json`), uniforme: chave === 'kit_reserva' ? 'reserva' : 'titular' },
    visitante: { ...(p.visitante || {}), time: undefined },
    // só a casa é desenhada: o visitante fica sem time e sem design
    kits: { ...(p.kits || {}), visitante: { ...((p.kits || {}).visitante || {}), design: undefined } } });
  try {
    const saida = await new Promise((ok, erro) => execFile('node', [caminho('tools/desenhar-kit.mjs'), tmp], { cwd: RAIZ, windowsHide: true },
      (e, out, err) => (e ? erro(new Error((err || e.message).trim().split('\n').pop())) : ok(out.trim()))));
    return { arte: kit.arte, saida, estado: estado() };
  } finally { try { fs.unlinkSync(tmp); } catch { /* ok */ } }
});

app.whenReady().then(criarJanela);
app.on('window-all-closed', () => app.quit());
