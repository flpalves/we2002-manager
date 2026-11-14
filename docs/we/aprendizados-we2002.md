# WE2002 Manager: o que aprendemos até aqui

Registro consolidado em 04/11/2026. Os endereços e formatos detalhados estão em [`offsets.md`](offsets.md).
Aqui ficam o raciocínio, as regras que descobrimos na prática e os erros que não devemos repetir.

## 1. O jogo e o ambiente

- **Versão:** Winning Eleven 2002 japonês com tradução BR, serial **SLPM-87056**. Imagem `we2002.bin` (474.784.128 bytes, Mode2/2352, faixa única) + `we2002.cue` criado por nós.
- **Todos os endereços valem só para esta imagem.** Trocar de ISO exige revalidar o mapa inteiro.
- **Emuladores em uso:**
  - **PCSX-Redux**: tem Lua, debugger e acesso à memória. É onde mapeamos tudo e onde roda a ponte (`bridge/we2002.lua`).
  - **DuckStation**: não tem scripting, mas tem cheats (GameShark) e **substituição de texturas** (kits em HD). É o destino visual.
- **Rotas no disco:** projeto em `D:\we2002-manager`; PCSX-Redux em `D:\pcsx-redux`; dados do DuckStation em `C:\Users\felip\AppData\Local\DuckStation` (`cheats`, `gamesettings`, `savestates`, `textures\SLPM-87056\{dumps,replacements}`).

## 2. Arquitetura que funcionou: "times fixos, conteúdo variável"

Em vez de trocar o ID dos times, o save state base é sempre **Brasil (casa) x Holanda (visitante)**, parado na **tela das bandeiras, antes de confirmar o visitante**. O manager troca o *conteúdo* desses dois times:

1. Carregar o estado base (tela das bandeiras).
2. Aplicar as edições do `data/partida.json` (nomes, atributos, camisas) na **base mestre**.
3. Confirmar a seleção (a ponte do PCSX-Redux aperta ○ sozinha; no DuckStation é manual).
4. O jogo copia a base mestre para o buffer da partida e desenha os nomes na VRAM: as edições entram em tudo.

**Regra de ouro:** tudo precisa ser escrito **antes de confirmar a seleção de times**. Depois disso o jogo já montou a partida.

## 3. Como o jogo organiza os dados (resumo)

| Coisa | Onde | Observação |
|---|---|---|
| IDs dos times na partida | `0x80075564` (casa), `0x80075565` (visitante) | ID = posição da bandeira na grade (Brasil 41, Holanda 8) |
| Nomes (base mestre) | `0x80055FF8`, 10 bytes, 23 por time | ASCII, máx. 10 caracteres |
| Registro do jogador (base mestre) | `0x800A5124`, 12 bytes, 23 por time | 15 atributos de 3 bits (exibido = bruto + 12), altura, pé, **camisa (5 bits, 1 a 32)** |
| Buffer da partida | nomes `0x80064570`, registros `0x80065A58`, camisas `0x80064970` | cópia dos 46 jogadores; **não escrever a cada frame** |
| Nomes na tela | VRAM, 4 bits, a partir de x=512 | desenhados uma vez, ao confirmar a seleção |
| Kit (uniforme) | VRAM: Brasil x=576 y=256, Holanda x=640 y=256; paletas nas linhas 486/490 e 487/491 | 8 bits, 128x256, números das costas desenhados dentro da textura |

## 4. Lições aprendidas (o que deu errado e por quê)

1. **Escrever no pré-jogo é tarde demais.** Trocar o ID do visitante no pré-jogo não trocou o time; trocar o nome no buffer também não. O jogo já tinha copiado os dados.
2. **O jogo recarrega dados do CD.** Escritas pontuais somem; por isso usamos **patches contínuos** (estilo GameShark), reescritos a cada frame.
3. **Nomes viram imagem.** Mesmo com "Felipe" na RAM, a tela mostrava "Edmilson": os letreiros são texturas pré-renderizadas na VRAM ao confirmar a seleção. Descobrimos olhando a VRAM do save state.
4. **O `loadSaveState` do PCSX-Redux só vale no fim do frame.** Ler a RAM logo depois de carregar o estado devolveu os times errados (Japão x Coreia) e zerou a altura do Felipe (148 cm). Solução: esperar ~10 frames antes de montar os patches.
5. **A "tabela de referência" `0x800649F8` não é o elenco.** Escrever nela trocou "SUBSTITUIR 3" por "SUBSTITUIR –". Parece controlar substituições. Não escrever.
6. **Forçar o buffer da partida trava substituições.** O jogo reorganiza o buffer ao substituir; o patch brigava com ele. Solução: escrever **só na base mestre**.
7. **A base mestre vira código durante a partida.** O PCSX-Redux travou com `ReservedInstruction from 0x800a7d6c` (dentro do registro do Felipe): na partida, o jogo carrega ali o código da tela de substituição. Solução: os patches só escrevem se a área ainda tiver os **dados originais** (ponte: bloco inteiro; cheats: códigos `D0` com sentinela).
8. **Números das camisas fazem parte da textura do kit.** Mudar a camisa mudou o hash e quebrou a substituição. Resolvido recalculando o hash (seção 6).
9. **Breakpoints de memória do Lua não dispararam nesta build** (mesmo em Interpreter, com o debugger, nos três espelhos `0x00`/`0x80`/`0xA0`). Mapeamos os atributos **desmontando o código** do painel de atributos (capstone).
10. **O Kernel checker do debugger pausa o jogo** ("Idle"): o WE lê o endereço `0x00000002` o tempo todo. Desligar o Kernel checker.
11. **Transferências para o computador:** cópias de arquivos às vezes chegaram desatualizadas. Sempre conferir com `md5sum` depois de enviar.
12. **`.bat` com parênteses no caminho quebra** dentro de blocos `if (...)`. Por isso o jogo virou `we2002.bin`/`we2002.cue` e o `.bat` usa `goto`.

## 5. Técnicas de mapeamento que funcionaram

- **Comparar dumps de RAM** mudando uma coisa por vez (ex.: Holanda → Suíça revelou os IDs dos times).
- **Ler a RAM e a VRAM direto do save state do PCSX-Redux** (protobuf não compactado: RAM em `0x27`, VRAM no campo `[5,3]`).
- **Usar o que o jogo mostra na tela como gabarito**: os 15 atributos de 4 jogadores levaram à função que monta o painel (`0x80153D28`) e à função que formata cada valor (`0x801596E4`, soma 12, laranja a partir de 17).
- **Reproduzir o hash do DuckStation** (XXH3 64 bits sobre as linhas do retângulo) e validar contra nomes de arquivos reais antes de confiar.

## 6. Uniformes

### DuckStation (substituição de texturas, HD)
- Precisa de `DumpTexturePages: true` no `config.yaml` do jogo (modo padrão só despeja glifos 16x16).
- No modo página, cada arquivo de substituição é testado pelo hash do **seu próprio retângulo**, e vários se aplicam na mesma página (`GetTexturePageTextureReplacements` em `gpu_hw_texture_cache.cpp`).
- Por isso o kit é gerado em **pedaços**: topo (0,0 100x80), base (0,128 100x107) e cada uma das 10 costas (20x24) com **todas as camisas de 0 a 99**: 1002 arquivos por kit. Qualquer escalação, número ou substituição já tem arquivo pronto.
- Como o jogo desenha os números: algarismos (índices F0-F3) copiados da fita em x=64+6·d, linhas 68-79, células 6x12. Um algarismo na coluna 7 da costa; dois nas colunas 3 e 11; linhas 7-18. As 10 costas são iguais fora dos números.
- Validação: remontando os kits, os hashes bateram com os arquivos reais (`36B8884BF3418FCE`, `FB51BCCDD47CF405` e `417CE7DCDB659844` com o 22).

### PCSX-Redux (kit dentro do jogo, 256 cores, sem HD)
- O PCSX-Redux não tem substituição de texturas.
- O kit não fica na RAM durante a partida (é descompactado e mandado direto para a VRAM) e não aparece cru no CD (é compactado).
- Solução em teste: `tools/converter-kit-ps1.mjs` quantiza o desenho nas **121 cores livres** da paleta do Brasil (as cores da pele, cabeça e números ficam reservadas); a ponte detecta o kit na VRAM e grava o convertido com uma rotina MIPS de 12 instruções via `PCSX.callGuest` (exige CPU em **Interpreter**), preservando os algarismos que o jogo desenha.

### Kits desenhados
- Modelo 4x e guia de regiões em `kits/modelos/`; desenhos em `kits/desenhos/` (ver `LEIA-ME.md`).
- Desenhe a **1ª costa sem número**; o gerador replica para as 10 e coloca os números.
- O mapa de regiões é aproximado e pode precisar de ajuste.

## 7. Ferramentas do projeto

| Ferramenta | O que faz |
|---|---|
| `bridge/we2002.lua` | Ponte no PCSX-Redux: carrega o estado, aplica edições (com guarda), aperta ○, busca por diferença, watches, dumps, save states extras, kit PS1 |
| `tools/gerar-cheats.mjs` | Gera os cheats do DuckStation a partir do `partida.json` (só base mestre, códigos condicionais) e habilita no `gamesettings` |
| `tools/gerar-kits.mjs` | Gera os 1002 PNGs por kit para o DuckStation (aceita arte HD), com verificação de hash (`--verificar`) |
| `tools/converter-kit-ps1.mjs` | Converte o desenho para 8 bits + paleta, para a ponte do PCSX-Redux |
| `run-pcsx.bat` | Abre o PCSX-Redux em Interpreter com a ponte (`debug` mostra os logs no terminal) |
| `run-duckstation.bat` | Gera cheats e kits e abre o DuckStation no save state (falta preencher o caminho do executável) |

## 8. Em aberto

- Testar o kit PS1 e a guarda dos patches no PCSX-Redux (último travamento era o da base mestre).
- Kit dos goleiros (página separada, 80x128).
- Byte de estado do jogo (candidato visto no código: `0x80075560`, comparado com 0x0D e 0x10).
- Placar, autores dos gols, cartões e lesões para o `resultado.json` (passo 3 do roadmap).
- Bits não identificados do registro do jogador (posição, habilidades especiais, aparência).
- Save state base do DuckStation no slot 1 e caminho do executável no `run-duckstation.bat`.
- Esqueleto do manager (Electron + Vue) gerando o `partida.json`.
