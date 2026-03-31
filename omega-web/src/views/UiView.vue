<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'
import { filterProfiles, dispName } from '../composables/useProfiles'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state } = useOptionsState()

const openShortcutConfig = () => omegaTarget.openShortcutConfig()

// Quick switch profiles
const notCycledProfiles = ref<string[]>([])

watch(
  () => state.options,
  (options) => {
    if (!options) return
    const allProfiles: any[] = filterProfiles(options, 'all')
    const quickSwitch = options['-quickSwitchProfiles'] || []
    notCycledProfiles.value = allProfiles
      .filter((profile: any) => quickSwitch.indexOf(profile.name) < 0)
      .map((profile: any) => profile.name)
  },
  { deep: true }
)

function dispNameFn(name: string): string {
  return dispName(name, tr)
}
</script>

<template>
  <div class="page-header">
    <h2>{{ tr('options_tab_ui') }}</h2>
  </div>
  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_miscOptions') }}</h3>
    <div class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-confirmDeletion']">
        <span>{{ tr('options_confirmDeletion') }}</span>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <input id="refresh-on-profile-change" type="checkbox" v-model="state.options['-refreshOnProfileChange']">
        <span>{{ tr('options_refreshOnProfileChange') }}</span>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-showInspectMenu']">
        <span>{{ tr('options_showInspectMenu') }}</span>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-addConditionsToBottom']">
        <span>{{ tr('options_addConditionsToBottom') }}</span>
      </label>
    </div>
    <div class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-showResultProfileOnActionBadgeText']">
        <span>{{ tr('options_showResultProfileOnActionBadgeText') }}</span>
      </label>
    </div>
  </section>

  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_keyboardShortcut') }}</h3>
    <p>
      <button type="button" role="button" @click="openShortcutConfig()" class="btn btn-default">
        <span class="glyphicon glyphicon-share-alt"></span> {{ tr('options_menuShortcutConfigure') }}
      </button>
      {{ tr('options_menuShortcutHelp') }}
    </p>
    <p class="help-block">{{ tr('options_menuShortcutMore') }}</p>
  </section>

  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_switchOptions') }}</h3>
    <div class="form-group">
      <label>{{ tr('options_startupProfile') }}</label>&nbsp;
      <!-- TODO: omega-profile-select component -->
      <select
        v-model="state.options['-startupProfileName']"
        style="display: inline-block; width: auto;"
        class="form-control"
      >
        <option value="">{{ tr('options_startupProfile_none') }}</option>
        <option
          v-for="p in filterProfiles(state.options, 'all')"
          :key="p.name"
          :value="p.name"
        >{{ dispNameFn(p.name) }}</option>
      </select>
    </div>
    <div class="checkbox">
      <label>
        <input
          type="checkbox"
          :checked="state.options['-showConditionTypes'] > 0"
          @change="state.options['-showConditionTypes'] = ($event.target as HTMLInputElement).checked ? 1 : 0"
        >
        <span>{{ tr('options_showConditionTypesAdvanced') }}</span>
      </label>
      <p class="help-block">{{ tr('options_showConditionTypesAdvancedHelp') }}</p>
    </div>
    <div class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-enableQuickSwitch']">
        <span>{{ tr('options_quickSwitch') }}</span>
      </label>
    </div>
    <div
      v-show="state.options['-enableQuickSwitch']"
      id="quick-switch-settings"
      class="settings-group"
    >
      <h4>{{ tr('options_cycledProfiles') }}</h4>
      <p class="help-block">{{ tr('options_cycledProfilesHelp') }}</p>
      <div
        v-show="(state.options['-quickSwitchProfiles'] || []).length < 2"
        class="has-error"
      >
        <p class="help-block">{{ tr('options_cycledProfilesTooFew') }}</p>
      </div>
      <ul class="cycle-profile-container cycle-enabled">
        <li v-for="name in (state.options['-quickSwitchProfiles'] || [])" :key="name">
          <span>{{ dispNameFn(name) }}</span>
        </li>
      </ul>
      <h4>{{ tr('options_notCycledProfiles') }}</h4>
      <ul class="cycle-profile-container">
        <li v-for="name in notCycledProfiles" :key="name" class="bg-success">
          <span>{{ dispNameFn(name) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script lang="ts">
import { filterProfiles as filterProfilesFn } from '../composables/useProfiles'
export { filterProfilesFn as filterProfiles }
</script>
