# Times da Série A 2026 (gerados em 11/11/2026)

- 20 arquivos em `data/times/` (os 4 antigos, fictícios, ficaram em `*.json.bak-20261111-ficticio`).
- Titulares = escalações prováveis/oficiais da 34ª rodada (3 a 6/11/2026). Reservas = outros nomes do elenco 2026 citados nas matérias + elenco conhecido; podem estar desatualizados.
- Gerador: `tools/serie-a-2026/elencos.py` (uma linha por jogador: nome | pos | camisa | altura | idade | pé | nível | tags | pele) e `gerar.py` (atributos = nível do time + nível do jogador + perfil da posição + tags vel/cab/fin/cri/dri/bola/for/mar/vet/baixo/lento, limitados a 12-19). Rodar: `python3 gerar.py data/times <saida>`. Quando o arquivo do time já existe na pasta de origem, o gerador só troca `formacao`, `observacao` e `jogadores` (kits, `kit_reserva` e bandeira ficam).
- Formações usadas e ordem das vagas 1-10: 4-3-3B (CB CB LB RB DH DH OH CF LW RW), 4-4-2A (CB CB LB RB DH LH RH OH CF CF), 5-3-2 (CB CB CB DH DH LH RH OH CF CF).
- Camisas acima de 32 (limite do jogo) viram o maior número livre; o real fica em `camisa_real`.
- Kits titulares dos 16 novos: cores no `kit.design` (listras em BOT, CAM, GRE, VIT, CAP) e desenho de `tools/desenhar-kit.mjs` em `kits/desenhos/<time>_4x.png`.
- Médias dos titulares: FLA 15,9 · PAL 15,8 · CRU 15,4 ... REM 14,0 · CHA 13,9.
- Validados com `campeonato/times.js` (0 erros) e `teste-logica.js`.

## Uniforme reserva (11/11/2026)

- Cada time tem `kit_reserva` (mesmo formato do `kit`), desenho em `kits/desenhos/<time>_reserva_4x.png`.
- `tools/lib/times.mjs` (`carregarPartida`) escolhe o kit: `partida[lado].uniforme` = `"titular"`, `"reserva"` ou `"auto"` (padrão). No auto, o **visitante** veste a reserva quando a cor média da camisa titular fica a menos de 140 (distância RGB; listras pela média) da camisa do mandante, e a reserva não conflita. Grava `partida[lado].uniforme_usado`. Backup: `times.mjs.bak-20261111e`.
- Como todas as ferramentas (cheats, kits DuckStation, kit PS1, bandeiras) passam por `carregarPartida`, a escolha vale para os dois emuladores sem mexer no app nem na ponte.
- Teste: `node tools/serie-a-2026/teste-uniformes.mjs` roda os 380 confrontos: 96 com visitante de reserva, 0 com camisas parecidas.
- Reservas brancas: FLA, PAL, FLU, CAM, CRU, INT, GRE, VIT, REM, CHA, BOT, CAP. Pretas: COR, VAS. SPFC vermelha; BAH listrada tricolor; SAN listrada preto/branco; RBB azul-marinho; MIR e CFC verdes. Cores aproximadas, sem escudo/patrocínio.
