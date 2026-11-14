# Escudo

O escudo aparece ao lado de **todo nome de time**: tabelas de classificação, artilharia, rodadas, chaves de mata-mata, mercado, propostas, notícias e placar. O PNG vem do pacote de dados (obrigatório por time) e entra num `<img>` dentro de `we-escudo`, com `object-fit: contain`.

Tamanhos:
- `we-escudo we-escudo--p` (20x22): em linhas de tabela e listas, antes do nome do time.
- `we-escudo we-escudo--g` (44x48): em destaques (confronto do mata-mata, partes de uma negociação).
- `we-escudo` (56x56): placar do pré-jogo e próximo jogo no painel.

Junto do nome use `<span class="we-time"><span class="we-escudo we-escudo--p">…</span>Flamengo</span>`. Em listas de confronto, o escudo fica virado para o "x": depois do nome do mandante, antes do nome do visitante.

**Escudo provisório** (`we-escudo--provisorio`): enquanto o PNG não existe (mockups, times novos no editor), mostra um escudo com a cor principal e a sigla do time, pelas variáveis `--escudo-cor` e `--escudo-texto` no próprio elemento. O editor do pacote continua acusando o PNG faltando.

O escudo é decorativo ao lado de um nome visível (`aria-hidden="true"`); sozinho, leva `alt` com o nome do time.
