import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { randomBytes, randomInt } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { canais, type Canal, type PacoteAberto } from '@shared/esquemas/ipc'
import type { ConfigApp } from '@shared/esquemas/config'
import { regrasDoPacote } from '@core/pacote/importar'
import { PADROES } from '@core/config/padroes'
import { validarPacote } from '@core/pacote/validar'
import { ArquivoConfig } from './config'
import { caminhosPadrao, estaNoOneDrive, pastaCarreirasPadrao } from './caminhos'
import { executar, ErroApp, type Handler, type Handlers } from './ipc/registrar'
import { abrirBanco, abrirLeitura, adaptarSql, VERSAO_ESQUEMA } from './db/conexao'
import { lerResumo } from './db/repositorios/carreira'
import { Carreiras } from './carreira/servico'
import { gerarKit, lerBaseKit } from './pacote/kits'
import { problemasDoDesign, type DesignKit } from '@core/we/estampas'
import { importarEscudo, lerPacote, listarPacotes, removerCompeticao, removerTime, salvarCompeticao, salvarDivisoes, salvarJanelas, salvarNoticias, salvarTemporada, salvarTime } from './pacote/leitor'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'
import { ESQUEMA, resolverUrl } from './protocolo'
import * as temporada from './carreira/temporada'
import * as elenco from './carreira/elenco'
import * as ponte from './we/ponte'
import * as mercado from './carreira/mercado'
import * as clube from './carreira/clube'
import * as noticias from './carreira/noticias'
import * as escalacao from './carreira/escalacao'
import * as virada from './carreira/virada'
import * as times from './carreira/times'

const aqui = dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

/** Raiz do projeto em desenvolvimento; ao lado do executável quando instalado. */
function raizProjeto(): string {
  return app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
}

function criarCarreiras(config: ArquivoConfig): Carreiras {
  return new Carreiras({
    pastaCarreiras: () => config.obter().pastaCarreiras,
    pastaPacotes: () => config.obter().pastaPacotes,
    abrirBanco: (arquivo) => {
      const { db } = abrirBanco(arquivo)
      return { sql: adaptarSql(db), versaoEsquema: VERSAO_ESQUEMA, fechar: () => db.close() }
    },
    lerResumoArquivo: (arquivo) => {
      try {
        const db = abrirLeitura(arquivo)
        try {
          const versao = db.pragma('user_version', { simple: true }) as number
          return versao > VERSAO_ESQUEMA || versao < 2 ? null : (lerResumo(adaptarSql(db)) ?? null)
        } finally {
          db.close()
        }
      } catch {
        return null
      }
    },
    sementeNova: () => randomInt(0, 2 ** 32 - 1),
    agora: () => new Date().toISOString(),
    sufixoId: () => randomBytes(3).toString('hex'),
  })
}

function criarHandlers(config: ArquivoConfig, carreiras: Carreiras, janela: () => BrowserWindow | null): Handlers {
  let versao = 0
  /**
   * Depois de um jogo do usuário (ou da virada), uma cópia de segurança da carreira.
   * O jogo já está gravado no banco: se a cópia falhar, só fica registrado no log.
   */
  const comAutosave = <T>(motivo: string, fn: () => T): T => {
    const r = fn()
    try {
      carreiras.autosave(motivo)
    } catch (e) {
      console.error('Autosave falhou:', e)
    }
    return r
  }
  /** Configuração da ponte com o WE para a carreira aberta. */
  const cfgPonte = (): ponte.ConfigPonte => {
    const pasta = carreiras.pastaAberta()
    const atual = carreiras.resumoAtual()
    if (!pasta || !atual) throw new ErroApp('sem_carreira', 'Nenhuma carreira aberta.')
    return { raiz: raizProjeto(), caminhos: config.obter().caminhos, pastaCarreira: pasta, carreiraId: atual.id }
  }
  const abrirPacote = (id: string): PacoteAberto => {
    const p = lerPacote(carreiras.pastaPacote(id))
    const regras = regrasDoPacote(p)
    const mercadoDoPacote = p.regras['mercado']
    const temporadaDoPacote = p.regras['temporada']
    return {
      id,
      manifesto: p.manifesto,
      paises: p.paises,
      times: p.times,
      competicoes: p.competicoes,
      divisoes: p.divisoes ?? null,
      janelas: {
        lista: regras.mercado.janelas,
        doPacote: !!mercadoDoPacote && typeof mercadoDoPacote === 'object' && 'janelas' in mercadoDoPacote,
        semanas: regras.temporada.semanas_por_temporada,
        blocos: (p.temporada?.blocos ?? []).map(({ competicao, semana_inicio, semana_fim }) => ({ competicao, semana_inicio, semana_fim })),
      },
      temporada: {
        arquivo: p.temporada,
        semanas: regras.temporada.semanas_por_temporada,
        semanasDoPacote: !!temporadaDoPacote && typeof temporadaDoPacote === 'object' && 'semanas_por_temporada' in temporadaDoPacote,
        semanasPadrao: PADROES.temporada.semanas_por_temporada,
      },
      noticias: {
        catalogo: p.noticias ?? catalogoPadrao(),
        doPacote: !!p.noticias,
        arquivoInvalido: p.invalidos.some((i) => i.arquivo === 'noticias.json'),
        regras: { fator_chance: regras.noticias.fator_chance, maximo_por_avaliacao: regras.noticias.maximo_por_avaliacao },
        regrasPadrao: { fator_chance: PADROES.noticias.fator_chance, maximo_por_avaliacao: PADROES.noticias.maximo_por_avaliacao },
        semanas: regras.temporada.semanas_por_temporada,
        janelas: regras.mercado.janelas.length,
      },
      escudos: p.escudos,
      problemas: validarPacote(p, regras),
      versao: ++versao,
    }
  }

  /** O pacote só é editado sem carreira aberta: o editor e a carreira não se misturam (renderer/modos.ts). */
  const pacoteEditavel = () => {
    if (carreiras.temAberta()) throw new ErroApp('carreira_aberta', 'Feche a carreira para editar o pacote (entre no editor pela tela inicial).')
  }

  return {
    'app:info': () => {
      const pasta = config.obter().pastaCarreiras
      return { versao: app.getVersion(), pastaCarreiras: pasta, carreirasNoOneDrive: estaNoOneDrive(pasta, process.env) }
    },
    'config:obter': () => config.obter(),
    'config:salvar': (parcial) => config.salvar(parcial),

    'pacote:listar': () =>
      listarPacotes(config.obter().pastaPacotes).map((p) => ({
        id: p.id,
        nome: p.manifesto?.nome ?? p.id,
        versao: p.manifesto?.versao ?? '?',
        temporada: p.manifesto?.temporada_inicial ?? null,
      })),
    'pacote:abrir': ({ pacote }) => abrirPacote(pacote),
    'pacote:salvarTime': ({ pacote, time, siglaAnterior }) => {
      pacoteEditavel()
      salvarTime(carreiras.pastaPacote(pacote), time, siglaAnterior)
      return abrirPacote(pacote)
    },
    'pacote:removerTime': ({ pacote, sigla }) => {
      pacoteEditavel()
      removerTime(carreiras.pastaPacote(pacote), sigla)
      return abrirPacote(pacote)
    },
    'pacote:salvarCompeticao': ({ pacote, competicao, idAnterior }) => {
      pacoteEditavel()
      salvarCompeticao(carreiras.pastaPacote(pacote), competicao, idAnterior)
      return abrirPacote(pacote)
    },
    'pacote:salvarJanelas': ({ pacote, janelas }) => {
      pacoteEditavel()
      salvarJanelas(carreiras.pastaPacote(pacote), janelas)
      return abrirPacote(pacote)
    },
    'pacote:salvarTemporada': ({ pacote, temporada: arquivo, semanas }) => {
      pacoteEditavel()
      salvarTemporada(carreiras.pastaPacote(pacote), arquivo, semanas)
      return abrirPacote(pacote)
    },
    'pacote:salvarDivisoes': ({ pacote, divisoes }) => {
      pacoteEditavel()
      salvarDivisoes(carreiras.pastaPacote(pacote), divisoes)
      return abrirPacote(pacote)
    },
    'pacote:salvarNoticias': ({ pacote, catalogo, regras }) => {
      pacoteEditavel()
      salvarNoticias(carreiras.pastaPacote(pacote), catalogo, regras)
      return abrirPacote(pacote)
    },
    'pacote:removerCompeticao': ({ pacote, id }) => {
      pacoteEditavel()
      removerCompeticao(carreiras.pastaPacote(pacote), id)
      return abrirPacote(pacote)
    },
    'pacote:importarEscudo': async ({ pacote, sigla }) => {
      pacoteEditavel()
      const raiz = carreiras.pastaPacote(pacote)
      const j = janela()
      const opcoes = { title: `Escudo de ${sigla}`, properties: ['openFile' as const], filters: [{ name: 'PNG', extensions: ['png'] }] }
      const r = j ? await dialog.showOpenDialog(j, opcoes) : await dialog.showOpenDialog(opcoes)
      const arquivo = r.filePaths[0]
      if (r.canceled || !arquivo) return null
      try {
        importarEscudo(raiz, sigla, arquivo)
      } catch (e) {
        throw new ErroApp('escudo_invalido', (e as Error).message)
      }
      return abrirPacote(pacote)
    },

    'kit:base': () => {
      const base = lerBaseKit(join(raizProjeto(), 'kits'))
      return base && { rgba: Buffer.from(base.rgba).toString('base64'), pagina: Buffer.from(base.pagina).toString('base64') }
    },
    'pacote:gerarKit': ({ pacote, sigla, campo, design, cor_numero }) => {
      pacoteEditavel()
      const problemas = problemasDoDesign(design)
      if (problemas.length) throw new ErroApp('kit_invalido', `Uniforme inválido: ${problemas.join('; ')}`)
      const base = lerBaseKit(join(raizProjeto(), 'kits'))
      if (!base) throw new ErroApp('kit_base_faltando', 'Faltam kits/brasil_original.png e kits/brasil_pagina.bin na pasta do projeto.')
      try {
        gerarKit(carreiras.pastaPacote(pacote), base, sigla, campo, design as unknown as DesignKit, cor_numero)
      } catch (e) {
        throw new ErroApp('kit_nao_gerado', (e as Error).message)
      }
      return abrirPacote(pacote)
    },

    'carreira:listar': () => carreiras.listar(),
    'carreira:criar': (entrada) => carreiras.criar(entrada),
    'carreira:abrir': ({ id }) => carreiras.abrir(id),
    'carreira:atual': () => carreiras.resumoAtual(),
    'carreira:fechar': () => {
      carreiras.fechar()
      return null
    },
    'carreira:apagar': ({ id }) => {
      carreiras.apagar(id)
      return null
    },
    'carreira:autosaves': ({ id }) => carreiras.autosaves(id),
    'carreira:restaurar': ({ id, numero }) => carreiras.restaurar(id, numero),
    'carreira:continuar': () => temporada.continuar(carreiras.sql()),
    'carreira:times': () => temporada.times(carreiras.sql()),
    'temporada:calendario': () => temporada.calendario(carreiras.sql()),
    'temporada:edicoes': () => temporada.edicoes(carreiras.sql()),
    'temporada:edicao': ({ id }) => temporada.detalheEdicao(carreiras.sql(), id),
    'temporada:artilharia': ({ edicao }) => temporada.artilharia(carreiras.sql(), edicao),
    'virada:previa': () => virada.previaVirada(carreiras.sql()),
    'virada:executar': () => comAutosave('virada de temporada', () => virada.virarTemporada(carreiras.sql())),
    'virada:relatorio': ({ temporada: t }) => virada.relatorioTemporada(carreiras.sql(), t),
    'partida:sumula': ({ id }) => temporada.sumula(carreiras.sql(), id),
    'elenco:listar': () => elenco.elenco(carreiras.sql()),
    'elenco:ficha': ({ id }) => elenco.ficha(carreiras.sql(), id),
    'elenco:salvarAparencia': ({ id, aparencia }) => elenco.salvarAparencia(carreiras.sql(), id, aparencia),
    'treino:obter': () => elenco.treino(carreiras.sql()),
    'treino:definir': ({ foco }) => elenco.definirFoco(carreiras.sql(), foco),
    'escalacao:obter': () => escalacao.escalacao(carreiras.sql()),
    'escalacao:salvar': (e) => escalacao.salvarEscalacao(carreiras.sql(), e),
    'escalacao:sugerir': ({ formacao }) => escalacao.sugerirEscalacao(carreiras.sql(), formacao),
    'escalacao:automatica': () => escalacao.escalacaoAutomatica(carreiras.sql()),
    'time:detalhe': ({ sigla }) => times.detalheTime(carreiras.sql(), sigla),
    'time:transferencias': (filtro) => times.transferencias(carreiras.sql(), filtro),
    'prejogo:obter': () => ponte.preJogo(carreiras.sql(), cfgPonte()),
    'prejogo:simular': () => comAutosave('jogo simulado', () => ponte.simular(carreiras.sql(), cfgPonte())),
    'we:iniciar': ({ modo }) => ponte.iniciar(carreiras.sql(), cfgPonte(), modo),
    'we:status': () => ponte.status(carreiras.sql(), cfgPonte()),
    'we:jogarDeNovo': () => ponte.jogarDeNovo(carreiras.sql(), cfgPonte()),
    'we:confirmar': (opcoes) => comAutosave('resultado do WE', () => ponte.confirmar(carreiras.sql(), cfgPonte(), opcoes)),
    'we:descartar': () => {
      ponte.descartar(cfgPonte())
      return null
    },
    'we:manual': (placar) => comAutosave('resultado digitado', () => ponte.resultadoManual(carreiras.sql(), cfgPonte(), placar)),
    'mercado:situacao': () => mercado.situacao(carreiras.sql()),
    'mercado:intensidade': ({ valor }) => (valor ? mercado.definirIntensidade(carreiras.sql(), valor) : mercado.intensidade(carreiras.sql())),
    'mercado:buscar': (filtros) => mercado.buscar(carreiras.sql(), filtros),
    'mercado:negociacao': ({ jogadorId, tipo }) => mercado.negociacao(carreiras.sql(), jogadorId, tipo),
    'mercado:propor': (p) => mercado.propor(carreiras.sql(), p),
    'mercado:propostas': () => mercado.propostas(carreiras.sql()),
    'mercado:responder': ({ id, aceitar }) => mercado.responderProposta(carreiras.sql(), id, aceitar),
    'mercado:contrapropor': ({ id, valor }) => mercado.contrapropor(carreiras.sql(), id, valor),
    'mercado:aVenda': ({ jogadorId, aVenda }) => mercado.definirAVenda(carreiras.sql(), jogadorId, aVenda),
    'financas:obter': () => clube.financas(carreiras.sql()),
    'financas:ingresso': ({ preco }) => clube.definirIngresso(carreiras.sql(), preco),
    'diretoria:obter': () => clube.diretoria(carreiras.sql()),
    'diretoria:assumir': ({ sigla }) => clube.assumirClube(carreiras.sql(), sigla),
    'noticias:caixa': ({ tipo }) => noticias.caixa(carreiras.sql(), tipo ? { tipo } : {}),
    'noticias:lidas': ({ ids }) => {
      noticias.marcarLidas(carreiras.sql(), ids)
      return null
    },
    'noticias:responder': ({ id, escolha }) => {
      temporada.responderEvento(carreiras.sql(), id, escolha)
      return noticias.caixa(carreiras.sql())
    },
  }
}

function registrarIpc(handlers: Handlers): void {
  for (const canal of canais) {
    const handler = handlers[canal] as Handler<Canal>
    ipcMain.handle(canal, (_evento, bruto: unknown) => executar(canal, handler, bruto))
  }
}

function registrarProtocolo(carreiras: Carreiras): void {
  protocol.handle(ESQUEMA, (req) => {
    const caminho = resolverUrl(req.url, {
      pacote: (id) => {
        try {
          return carreiras.pastaPacote(id)
        } catch {
          return null
        }
      },
      carreira: () => carreiras.pastaAberta(),
    })
    if (!caminho) return new Response('não encontrado', { status: 404 })
    return net.fetch(pathToFileURL(caminho).toString())
  })
}

let janelaPrincipal: BrowserWindow | null = null

function criarJanela(): BrowserWindow {
  const janela = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#151515',
    autoHideMenuBar: true,
    title: 'WE2002 Manager',
    webPreferences: {
      preload: join(aqui, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // O controle e o acompanhamento do emulador precisam rodar mesmo com a janela encoberta.
      backgroundThrottling: false,
    },
  })
  janela.once('ready-to-show', () => janela.show())
  janela.on('closed', () => {
    if (janelaPrincipal === janela) janelaPrincipal = null
  })
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  const urlDev = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && urlDev) void janela.loadURL(urlDev)
  else void janela.loadFile(join(aqui, '../renderer/index.html'))
  janelaPrincipal = janela
  return janela
}

void app.whenReady().then(() => {
  const userData = app.getPath('userData')
  const padrao: ConfigApp = {
    versao: 1,
    tema: 'escuro',
    pastaCarreiras: pastaCarreirasPadrao(userData),
    pastaPacotes: join(raizProjeto(), 'pacotes'),
    caminhos: caminhosPadrao(raizProjeto()),
  }
  const config = new ArquivoConfig(join(userData, 'config.json'), padrao)
  const carreiras = criarCarreiras(config)
  registrarProtocolo(carreiras)
  registrarIpc(criarHandlers(config, carreiras, () => janelaPrincipal))
  criarJanela()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
  app.on('before-quit', () => carreiras.fechar())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
