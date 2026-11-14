import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'
import { useUi, type AcoesTela, type Atalho } from '../stores/ui'

/** Registra os atalhos do controle da tela (aparecem no rodapé) e suas ações. */
export function useTela(atalhos: Atalho[] = [], acoes: AcoesTela = {}): void {
  const ui = useUi()
  const registrar = () => ui.definirTela(atalhos, acoes)
  onMounted(registrar)
  onActivated(registrar)
  onDeactivated(() => ui.limparTela())
  onBeforeUnmount(() => ui.limparTela())
}
