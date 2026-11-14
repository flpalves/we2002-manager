# WE2002 Manager · Campeonato

App Electron pequeno para rodar um campeonato de pontos corridos com os times de `data/times/*.json`.
Ele cuida da tabela de jogos, grava o `partida.json`, abre o emulador, lê o `resultado.json` e monta a classificação.

## Instalação

1. Descompacte esta pasta dentro do projeto: `D:\we2002-manager\campeonato`.
2. Dê dois cliques em `iniciar.bat`. Na primeira vez ele roda `npm install` (precisa do Node.js).

O app procura o projeto uma pasta acima de si (`"raizProjeto": ".."` no `config.json`).

## Seu time

Ao criar o campeonato você escolhe o time que vai controlar (dá para trocar depois no topo da tela).

- **Jogos do seu time:** você joga no emulador. O seu time **sempre entra na vaga do Brasil (casa)**, que é a do
  controle 1 no save state base, mesmo quando o mando real é do adversário. Nesse caso o `partida.json` leva
  `"campeonato": { "mando_invertido": true }` e o app desinverte placar, gols e pênaltis ao confirmar.
  No jogo, o seu time aparece sempre do lado esquerdo do placar.
- **Jogos sem o seu time:** "Simular" (um jogo) ou "Simular os N jogos da rodada". A simulação usa os atributos
  dos 11 titulares (ataque dos atacantes x defesa dos defensores), Poisson com ~1,2 gol por time e uma pequena
  vantagem de mando: dá ~2,6 gols por jogo e ~25% de empates. Os autores dos gols são sorteados com peso para
  atacantes. Ainda dá para lançar o placar à mão ou jogar no emulador.

## Amistoso

Botão **Amistoso** no topo: partida avulsa, fora do campeonato (não mexe na tabela).

1. Escolha o time da casa e o visitante (qualquer time de `data/times`; ⇄ inverte o mando).
2. Escolha o cenário: **P1 x CPU** (você joga com a casa), **CPU x CPU** (só assiste) ou **CPU x P1** (você joga com o visitante).
   Cenários sem o estado base em `states/` ficam desativados. CPU x CPU e CPU x P1 abrem sempre no PCSX-Redux.
3. Opcional: "Se empatar, decide na prorrogação e nos pênaltis" (`modo: mata_mata`; desmarcado, vale o placar dos 90 min).
4. **Iniciar** grava o `partida.json` (`partida_id: amistoso-…`, `controle` = cenário) e abre o emulador.

O placar aparece ao vivo e o amistoso encerra sozinho no apito final (ou em "Encerrar amistoso").
O último amistoso fica em `data/amistoso.json` e a cópia do resultado em `data/amistosos/<id>.json`.
Enquanto um amistoso está em andamento, os jogos do campeonato não podem ser iniciados (e vice-versa).

## Editor de times

Aba **Times** no topo: cria times novos e edita os de `data/times/*.json`.

- **Dados do time:** nome, nome no placar (até 15, maiúsculas, sem acento), sigla (até 4), formação (as que a ponte
  conhece, lidas do `bridge/we2002.lua`), bandeira/escudo (`bandeiras/`) e ajuste, desenho do kit (`kits/desenhos/`)
  e as cores (camisa, detalhe, calção, meião, número).
- **Jogadores (22 vagas):** vaga 0 = goleiro, 1-10 titulares na ordem da formação, 11-21 reservas. ▲▼ trocam a vaga.
  Nome (até 10, ASCII: acentos saem sozinhos), posição, camisa (1-32), altura (148-211 cm), idade (15-46), pé,
  condição (1-5 ou sorteio), os 15 atributos e a agressividade (AGR), de 12 a 19 (laranja a partir de 17, como no jogo).
- **Visual** (por jogador): pele, físico, cabelo (a1…p1), cor do cabelo, barba, cor da barba, chuteira e outside,
  com os valores do menu de edição do jogo. "–" mantém o do jogador original da vaga.
- Posições: o jogo só tem GK, CB, SB, DH, SH, OH, CF e WG. LB/RB viram SB, LH/RH viram SH e LW/RW viram WG
  (o lado fica guardado no arquivo, para referência).
- Tudo isso é gravado no registro do jogador pela ponte do PCSX-Redux (`bridge/we2002.lua`) e pelos cheats do
  DuckStation (`tools/gerar-cheats.mjs`, via `tools/lib/registro.mjs`). Campos ausentes no arquivo mantêm o original.
- **Uniformes:** titular e reserva lado a lado, cada um com o desenho (PNG de `kits/desenhos/`, com miniatura),
  as cores (camisa, detalhe, calção, meião, número e, se houver, as listras) e o botão **Redesenhar pelas cores**
  (roda o `tools/desenhar-kit.mjs`; o PNG anterior fica em `<desenho>.anterior.png`). No jogo vale o desenho; as cores
  servem para redesenhar, para o escudo do app e para a escolha automática. Dá para adicionar ou remover a reserva.
- **Novo time** parte de um modelo genérico; **Duplicar este** copia o time aberto. O arquivo novo ganha o nome a partir
  do nome do time (dá para mudar antes de criar).
- **Salvar** valida tudo antes de gravar e guarda a versão anterior em `data/times/<time>.json.anterior`.
  Campos que o editor não mostra (faixas e listras do kit, `observacao` etc.) são preservados.
- Se o time está no campeonato atual, o nome, a sigla e as cores dele no campeonato são atualizados.
  Não dá para editar um time durante uma partida dele.
- **Excluir** move o arquivo para `data/times/excluidos/` (não apaga). Times do campeonato atual não podem ser excluídos.

## Uniforme do jogo

Antes de iniciar (próximo jogo do campeonato e amistoso) cada time tem **Auto / Titular / Reserva**, com a miniatura do
uniforme que vai entrar. No **Auto**, o visitante veste a reserva quando a camisa dele se confunde com a do mandante
(mesma regra do `tools/lib/times.mjs`); se as duas camisas escolhidas ficarem parecidas, o app avisa.
O app resolve a escolha pelo mando real e grava `"uniforme": "titular" | "reserva"` em `partida.json` → `casa`/`visitante`
(com o mando invertido, cada time leva o seu uniforme para a vaga onde entra). Vale para o PCSX-Redux e o DuckStation.

## Fluxo de uma rodada

1. **Novo campeonato:** escolha os times (os 4 primeiros já vêm marcados) e turno/returno.
   Com 4 times: 6 rodadas, 12 jogos, 3 em casa para cada um. Ordem e mando são sorteados.
2. **Iniciar partida:** grava o `data/partida.json` (o time da casa entra no lugar do Brasil, o visitante no da Holanda)
   e roda o `.bat` do emulador escolhido numa janela própria. O `partida.json` anterior fica em `partida.json.anterior`.
   "Só gravar partida.json" faz o mesmo sem abrir o emulador.
3. **Durante o jogo:** o app observa o `data/resultado.json` e mostra placar e gols ao vivo.
   Ele só aceita o arquivo se for desta partida (`partida_id`, nomes dos times e horário).
4. **Confirmar resultado:** fecha o jogo e guarda uma cópia do resultado em `data/resultados/`.
   **Lançar placar** serve para jogos simulados, ou quando a ponte falhar.
5. **Reabrir** um jogo apaga o placar dele e o devolve para a tabela.

A confirmação é sempre manual, porque o sinal de fim de jogo ainda não foi mapeado
(o `"final": true` da ponte não é confiável hoje).

## Arquivos

| Arquivo | O que é |
|---|---|
| `data/campeonato.json` | Campeonato atual (times, jogos, placares, gols). Ao criar outro, o anterior vira uma cópia com data |
| `data/partida.json` | Reescrito a cada partida: troca `partida_id`, `casa`, `visitante` e acrescenta `campeonato` (rodada, `mando_invertido`). Kits e o resto ficam como estavam |
| `data/resultados/<camp>-<jogo>.json` | Cópia do `resultado.json` de cada jogo confirmado |

## Classificação

Vitória 3, empate 1 (ajustável em `config.json`). Desempate: pontos, vitórias, saldo, gols pró.
Disputa de pênaltis não conta. Artilharia sai dos gols registrados pela ponte (placar manual não tem autores).

## Código

- `main.js`: processo principal (arquivos, emulador, IPC).
- `times.js`: validação e modelo dos arquivos de time (limites do jogo).
- `campeonato.js`: lógica pura (tabela, classificação, artilharia, seu time no controle 1, simulação, leitura do `resultado.json`). Testes: `npm test` (com `TIMES_DIR=../data/times` roda também 2000 simulações com os elencos reais).
- `src/`: interface em HTML/CSS/JS, sem etapa de build.
- Persistência em JSON por enquanto; o SQLite entra quando o manager crescer.
