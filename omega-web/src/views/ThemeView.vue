<script setup lang="ts">
import { ref } from 'vue'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state } = useOptionsState()

interface ThemeItem {
  key: string
  displayName: string
  dark: boolean
  [key: string]: any
}

// Build theme items from the global themes object
const themeItems = ref<ThemeItem[]>([])
try {
  const themes = (window as any).themes || {}
  for (const key in themes) {
    const val = themes[key]
    val.key = 'others/base16-' + key
    val.displayName = '(' + (val.dark ? '🌚' : '🌞') + ')    ' + key
    themeItems.value.push(val)
  }
} catch (_) {
  // themes may not be available
}

const selectedThemeKey = ref('')

function changeTheme(themeKey: string) {
  if (!themeKey) {
    if (state.options) {
      state.options['-customCss'] = ''
    }
    state.customCss = ''
    return
  }

  const getText = (url: string) => fetch(url).then(res => res.text())

  let variableCss = ''
  let baseCss = ''
  let themeCss = ''

  getText('lib/themes/variable.css')
    .then(result => {
      variableCss = result
      return getText('lib/themes/' + themeKey + '.css')
    })
    .then(result => {
      themeCss = result
      return getText('lib/themes/base.css')
    })
    .then(result => {
      baseCss = result
    })
    .then(() => {
      const css = [variableCss, themeCss, baseCss].join('\n')
      state.customCss = css
      if (state.options) {
        state.options['-customCss'] = css
      }
    })
    .catch(() => {
      state.customCss = ''
      if (state.options) {
        state.options['-customCss'] = ''
      }
    })
}

function selectTheme() {
  const item = themeItems.value.find(t => t.key === selectedThemeKey.value)
  if (item) {
    changeTheme(item.key)
  }
}
</script>

<template>
  <div class="page-header">
    <h2>Theme</h2>
  </div>
  <section class="settings-group" v-if="state.options">
    <h3>Theme</h3>
    <p>
      <button type="button" role="button" @click="changeTheme('default-dark')" class="btn btn-default">
        <span class="glyphicon glyphicon-heart"></span> Dark
      </button>
      <button type="button" role="button" @click="changeTheme('default-light')" class="btn btn-default">
        <span class="glyphicon glyphicon-heart-empty"></span> Light
      </button>
      <button type="button" role="button" @click="changeTheme('default-auto')" class="btn btn-default">
        <span class="glyphicon glyphicon-adjust"></span> Auto
      </button>
      <button type="button" role="button" @click="changeTheme('')" class="btn btn-default">
        <span class="glyphicon glyphicon-remove"></span> Clear
      </button>
      <select
        v-model="selectedThemeKey"
        @change="selectTheme()"
        class="form-control inline-form-control"
      >
        <option value="">-- Select theme --</option>
        <option
          v-for="item in themeItems"
          :key="item.key"
          :value="item.key"
        >{{ item.displayName }}</option>
      </select>
    </p>
    <p class="help-block">
      <a href="https://en.wikipedia.org/wiki/CSS" target="_blank">Cascading Style Sheets (CSS) Wiki</a>
    </p>
    <textarea
      rows="30"
      spellcheck="false"
      v-model="state.options['-customCss']"
      class="monospace form-control width-limit"
    ></textarea>
  </section>
</template>
