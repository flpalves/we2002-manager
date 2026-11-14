# 07 · Integração com o WE2002 (PCSX-Redux)

O que funciona hoje está documentado em `docs/we/aprendizados-we2002.md`, `docs/we/offsets-we2002.md` e `docs/we/estados-base-we2002.md`. **Leia os três antes de mexer aqui.** O manager novo **reaproveita** a ponte; não reescreve o que já funciona.

## Peças que já existem

| Peça | Papel |
|---|---|
| `bridge/we2002.lua` | ponte no PCSX-Redux: carrega o estado base pelo `controle`, aplica as edições na base mestre (com guarda), confirma a seleção (○), kit PS1 |
| `bridge/resultado.lua` | lê gols (autor, assistência, minuto), estatísticas e pênaltis da RAM; grava `data/resultado.json` parcial e final; detecta o fim (cena 12 → 0/13, fase 1, 4 leituras); fecha o emulador |
| `bridge/bandeiras.lua`, `tools/converter-bandeira.mjs` | bandeira do time na VRAM |
| `tools/converter-kit-ps1.mjs` | kit desenhado → 8 bits + paleta para a ponte |
| `tools/lib/times.mjs` (`carregarPartida`) | lê `partida.json` + times; escolhe uniforme (`titular`/`reserva`/`auto`) |
| `tools/lib/registro.mjs` | monta o registro de 12 bytes do jogador |
| `run-pcsx.bat` | converte os kits e abre o PCSX-Redux em Interpreter com a ponte |
| `states/*.sstate` | estados base `p1_cpu`, `cpu_p1`, `cpu_cpu` (`p1_p2` pausado) |
| `campeonato/` | app antigo: `escolherControle`, desinversão, validação do resultado, observação do arquivo |

## Fluxo de uma partida no WE

1. **Pré-jogo** (usuário escolhe "Jogar no WE" ou "Assistir CPU x CPU").
2. Main monta a partida: 23 convocados de cada lado (ordem: 11 titulares nas vagas da formação + 12 reservas), atributos convertidos 1-20 → WE com a **redução por condição**, setas (quando mapeadas), nomes `nome_we`, camisas, aparência, uniforme, bandeira.
3. **Escolha do controle** (port de `escolherControle`):
   - "Assistir" → `cpu_cpu`.
   - Usuário visitante e existe `base_cpu_p1` → `cpu_p1`, sem inverter mando.
   - Usuário visitante e não existe → `p1_cpu` com `mando_invertido: true` (desinverter ao gravar).
   - Resto → `p1_cpu`.
4. Grava `data/partida.json` (formato atual, **versionado**: adicionar `"versao": 2` e os campos novos sem quebrar os antigos) com `partida_id` único (`<carreira>-<temporada>-<partidaId>`).
5. Executa `run-pcsx.bat` (caminho nas configurações).
6. Observa `data/resultado.json` (watcher): aceita só se `partida_id` e nomes batem; mostra parciais ("2º tempo, 31'") na tela "No emulador".
7. Resultado final → **pós-jogo**: o usuário confere e **confirma**. Só então o resultado entra na carreira. Cópia do JSON vai para `carreiras/<id>/resultados/`.
8. Falha (emulador fechou, sem final, `partida_id` diferente): opções **jogar de novo**, **simular**, **digitar placar**.

### Conversões na saída

| Manager | WE |
|---|---|
| atributo 1-20 | nível 0-7 pela tabela do pacote, menos a redução por condição |
| posição (8) | posição do WE (mesma lista) |
| idade | valor = idade − 15, saturado em 3-23 |
| altura | valor = cm − 148, saturado em 0-63 |
| camisa | 1-32; acima de 32 → maior número livre (como o gerador atual) |
| nome | `nome_we`, ASCII maiúsculo, 10 caracteres |
| mando real | vaga do emulador (casa = Brasil, visitante = Holanda) conforme o controle |

### Leitura do resultado

- Gols com autor, assistência e minuto; estatísticas; pênaltis; prorrogação. Lados são as **vagas do emulador**: desinverter quando `mando_invertido`.
- **Pontos corridos**: vale o placar dos 90'. **Mata-mata**: a partida no WE precisa ter vencedor (prorrogação/pênaltis do próprio WE); em ida e volta, o manager decide o agregado e só pede ao WE prorrogação/pênaltis no jogo de volta quando necessário (ver em aberto).

## Como ficou na fase 5

- Times gerados em `data/gerado/casa.json` e `visitante.json` no formato antigo de `data/times` (a ponte e as ferramentas de kit/bandeira não mudaram). `data/partida.json` sai de `data/partida.modelo.json` (kits fixos das vagas Brasil/Holanda) com `"versao": 2` e o bloco `carreira`.
- **Seta**: a ponte já grava a condição (`condicao` 5 = ótima … 1 = péssima, reescrita a cada 30 frames); o manager manda a seta calculada (spec 05).
- O `resultado.json` da partida anterior é renomeado para `resultado.anterior.json` antes de abrir o emulador. A partida pendente fica em `<carreira>/we-pendente.json` (sobrevive a fechar o app) e a cópia do resultado confirmado vai para `<carreira>/resultados/`.
- Do WE entram gols (autor, assistência, minuto), pênaltis e prorrogação; os 11 titulares contam os minutos todos e gastam condição; amarelos só como total do time.
- Código: `src/core/we/` (controle, uniformes, exportar, resultado) e `src/main/we/ponte.ts`.

## Mapeamentos de RAM necessários antes da v1 (trilha de engenharia reversa)

| Item | Para quê | Situação |
|---|---|---|
| **Substituições e minutos jogados** | estatísticas, condição, evolução | não mapeado |
| **Setas de condição** (escrita) | seta do manager no jogo | **mapeado** na ponte (`condicao` por jogador, ver bridge/we2002.lua) |
| **Formações do WE** (lista e escrita) | formação escolhida no manager vai para o jogo | escrita mapeada na ponte (`trocar_formacao`); papéis das vagas de 4 formações ainda provisórios (decisão 7) |
| Cartões e lesões por jogador | registrar no manager | depois da v1 (v1 ignora; registro manual opcional) |
| Atribuição de controles na RAM | um estado base só | candidatos em `estados-base-we2002.md` |

Cada item segue o método do projeto: mudar uma coisa por vez, comparar dumps, validar em **partidas inteiras** (não só telas finais), registrar em `offsets-we2002.md`.

## Interface com a ponte (contrato)

- `src/shared/esquemas/partida.ts` e `resultado.ts`: esquemas Zod dos dois JSON, gerados a partir dos arquivos reais atuais (testes com fixtures copiadas de `data/resultados/`).
- `src/main/we/ponte.ts`: `prepararPartida()`, `abrirEmulador()`, `observarResultado()`, `cancelar()`; eventos `parcial`, `final`, `falha`.
- Teste de integração sem emulador: escrever um `resultado.json` de fixture no diretório observado e verificar a desinversão e a validação.
