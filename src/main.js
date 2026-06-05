import { createApp, defineComponent, ref, h } from 'vue'
import App         from './App.vue'
import LandingPage from './LandingPage.vue'
import './style.css'

const Root = defineComponent({
  setup() {
    const hasStravaCallback = new URLSearchParams(window.location.search).has('code')
    const inApp = ref(window.location.pathname !== '/' || hasStravaCallback)

    function setAppClass(on) {
      document.getElementById('app')?.classList.toggle('in-app', on)
    }

    setAppClass(inApp.value)

    function launch() {
      inApp.value = true
      setAppClass(true)
      history.pushState({}, '', '/app')
    }

    window.addEventListener('popstate', () => {
      inApp.value = window.location.pathname !== '/'
      setAppClass(inApp.value)
    })

    return () => inApp.value
      ? h(App)
      : h(LandingPage, { onLaunch: launch })
  },
})

createApp(Root).mount('#app')
