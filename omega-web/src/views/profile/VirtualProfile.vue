<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { useOptionsState } from '../../composables/useOptionsState'
import { filterProfiles, dispName } from '../../composables/useProfiles'

const props = defineProps<{
  profile: any
  options: any
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

function replaceProfile() {
  const { state } = useOptionsState()
  omegaTarget.replaceRef(props.profile.defaultProfileName, props.profile.name).then(() => {
    // handled by options refresh
  })
}

function allProfiles(): any[] {
  return filterProfiles(props.options, props.profile)
}

function dispNameFn(name: any): string {
  return dispName(name, tr)
}
</script>

<template>
  <div>
    <section class="settings-group">
      <h3>{{ tr('options_group_virtualProfile') }}</h3>
      <p class="help-block">{{ tr('options_virtualProfileTargetHelp') }}</p>
      <div class="form-group">
        <label>{{ tr('options_virtualProfileTarget') }}</label>&nbsp;
        <select
          v-model="profile.defaultProfileName"
          style="display: inline-block; width: auto;"
          class="form-control"
        >
          <option
            v-for="p in allProfiles()"
            :key="p.name"
            :value="p.name"
          >{{ dispNameFn(p.name) }}</option>
        </select>
      </div>
    </section>
    <section class="settings-group">
      <h3>{{ tr('options_group_virtualProfileReplace') }}</h3>
      <p class="help-block" v-html="tr('options_virtualProfileReplaceHelp')"></p>
      <div class="form-group">
        <button @click="replaceProfile()" class="btn btn-default">
          <span class="glyphicon glyphicon-search"></span> {{ tr('options_virtualProfileReplace') }}
        </button>
      </div>
    </section>
  </div>
</template>
