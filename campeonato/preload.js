'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const chamar = async (canal, arg) => {
  const r = await ipcRenderer.invoke(canal, arg);
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
};

contextBridge.exposeInMainWorld('we', {
  estado: () => chamar('estado'),
  criarCampeonato: arg => chamar('criar-campeonato', arg),
  jogar: arg => chamar('jogar', arg),
  cancelarJogo: arg => chamar('cancelar-jogo', arg),
  encerrarJogo: arg => chamar('encerrar-jogo', arg),
  reabrirJogo: arg => chamar('reabrir-jogo', arg),
  simular: arg => chamar('simular', arg),
  simularRodada: arg => chamar('simular-rodada', arg),
  meuTime: arg => chamar('meu-time', arg),
  abrirPasta: () => chamar('abrir-pasta'),
  amistosoIniciar: arg => chamar('amistoso-iniciar', arg),
  amistosoEncerrar: arg => chamar('amistoso-encerrar', arg),
  timesRecursos: () => chamar('times-recursos'),
  timeLer: arg => chamar('time-ler', arg),
  timeSalvar: arg => chamar('time-salvar', arg),
  timeExcluir: arg => chamar('time-excluir', arg),
  uniformesPrevia: arg => chamar('uniformes-previa', arg),
  kitImagem: arg => chamar('kit-imagem', arg),
  kitDesenhar: arg => chamar('kit-desenhar', arg),
  aoFimAmistoso: fn => ipcRenderer.on('amistoso-fim', (_e, txt) => fn(txt)),
  aoAtualizar: fn => ipcRenderer.on('atualizado', () => fn()),
  aoConfirmar: fn => ipcRenderer.on('confirmado', (_e, txt) => fn(txt)),
});
