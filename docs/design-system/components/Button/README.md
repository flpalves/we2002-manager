# Button

Botão chapado com sombra preta sólida deslocada: sobe 1px com o ponteiro ou o foco do gamepad, afunda 2px quando pressionado.

- `we-btn`: padrão, para ações secundárias ("Sugestão automática", "Revisar escalação").
- `we-btn we-btn--principal`: cor do clube. **Uma vez por tela**, para a ação que a tela existe para fazer ("CONTINUAR", "CONFIRMAR RESULTADO").
- `we-btn we-btn--ativo`: opção selecionada num grupo de botões (formação, etapa, filtro). Use `aria-pressed="true"`.
- `we-btn we-btn--opcao` + `<span class="we-btn__sub">`: escolha grande com explicação, como no pré-jogo (Jogar no WE / Assistir / Simular).

Texto em MAIÚSCULAS (o CSS cuida disso), começando por verbo. Sempre `<button>` ou `<a href>` reais; o foco (`foco`) nunca é removido.
