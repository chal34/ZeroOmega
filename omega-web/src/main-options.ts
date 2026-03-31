import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Error logging (from log_error.ts)
window.onerror = (message, source, lineno, _colno, err) => {
  try {
    if (!globalThis.localStorage) return
    let log = localStorage['log'] || ''
    if ((err as any)?.stack) {
      log += (err as any).stack + '\n\n'
    } else {
      log += `${source}:${lineno}:\t${message}\n\n`
    }
    localStorage['log'] = log
  } catch (_e) {
    // ignore
  }
}

const app = createApp(App)
app.use(router)
app.mount('#app')
