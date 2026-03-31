<script setup lang="ts">
import { ref, watch } from 'vue'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'
import { profileColorPalette, builtinProfiles } from '../composables/useProfiles'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state } = useOptionsState()

const systemProfile = ref<any>(null)
const directProfile = ref<any>(null)

const spectrumOptions = {
  localStorageKey: 'spectrum.profileColor',
  palette: profileColorPalette,
  preferredFormat: 'hex',
  showButtons: false,
  showInitial: true,
  showInput: true,
  showPalette: true,
  showAlpha: true,
  showSelectionPalette: true,
  maxSelectionSize: 5,
}

const customBuiltinProfiles: any = {}

function decorateBuiltinProfile(newOptions: any) {
  Object.assign(customBuiltinProfiles, builtinProfiles, newOptions?.['-builtinProfiles'])
  systemProfile.value = customBuiltinProfiles['+system']
  directProfile.value = customBuiltinProfiles['+direct']
}

omegaTarget.addOptionsChangeCallback(decorateBuiltinProfile)

watch(
  () => state.options,
  (options) => {
    if (options) decorateBuiltinProfile(options)
  },
  { immediate: true }
)

function moveColor(color: string, key: string) {
  customBuiltinProfiles[key].color = color
  if (state.options) {
    state.options['-builtinProfiles'] = JSON.parse(JSON.stringify(customBuiltinProfiles))
  }
}
</script>

<template>
  <div class="page-header">
    <h2>{{ tr('options_builtinProfile') }}</h2>
  </div>
  <section class="settings-group" v-if="systemProfile">
    <span class="profile-color-editor">
      <div class="profile-color-editor-fake">
        <input
          type="color"
          :value="systemProfile.color"
          @input="moveColor(($event.target as HTMLInputElement).value, '+system')"
        >
      </div>
    </span>
    <h2 class="profile-name">{{ tr('options_profileTabPrefix') }}System</h2>
  </section>
  <section class="settings-group" v-if="directProfile">
    <span class="profile-color-editor">
      <div class="profile-color-editor-fake">
        <input
          type="color"
          :value="directProfile.color"
          @input="moveColor(($event.target as HTMLInputElement).value, '+direct')"
        >
      </div>
    </span>
    <h2 class="profile-name">{{ tr('options_profileTabPrefix') }}Direct</h2>
  </section>
</template>
