import { createApp, watch } from 'vue'
import { START_LOCATION } from 'vue-router'
import { createPinia } from 'pinia'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import './estilos/tokens.css'
import './estilos/bundle.css'
import './estilos/app.css'
import App from './App.vue'
import { router } from './router'
import { useUi } from './stores/ui'
import { useCarreira } from './stores/carreira'
import { instalarNavegacao } from './gamepad/navegacao'
import { AVISO_BLOQUEIO, bloqueioDoModo, modoDaTela } from './modos'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const ui = useUi(pinia)
const carreira = useCarreira(pinia)

// Editor do pacote e carreira não se misturam (ver modos.ts): telas da carreira só com carreira
// aberta, o editor só sem. O que não pode abrir volta para a tela inicial.
router.beforeEach((para, de) => {
  const bloqueio = bloqueioDoModo(modoDaTela(para.name as string), !!carreira.atual)
  if (!bloqueio) return true
  // Na abertura do app (ou ao recarregar a janela) só redireciona, sem aviso.
  if (de !== START_LOCATION) ui.avisar(AVISO_BLOQUEIO[bloqueio], 5000)
  return de.name === 'abertura' || de === START_LOCATION ? { name: 'abertura' } : false
})
// Carreira fechada ou apagada com uma tela dela aberta: volta para a tela inicial.
watch(
  () => carreira.atual,
  (atual) => {
    if (!atual && modoDaTela(router.currentRoute.value.name as string) === 'carreira') void router.push({ name: 'abertura' })
  },
)
void Promise.all([ui.carregar(), carreira.carregar()]).finally(() => {
  app.mount('#app')
  instalarNavegacao(router, ui)
})
