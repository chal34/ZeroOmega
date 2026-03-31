<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { useOptionsState } from '../../composables/useOptionsState'
import { filterProfiles, dispName } from '../../composables/useProfiles'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  profile: any
  options: any
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, updateProfile } = useOptionsState()

const ruleListFormats = OmegaPac.Profiles.ruleListFormats

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
      <h3>{{ tr('options_group_ruleListConfig') }}</h3>
      <div class="form-group">
        <label>{{ tr('options_ruleListMatchProfile') }}</label>&nbsp;
        <select
          v-model="profile.matchProfileName"
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
      <div class="form-group">
        <label>{{ tr('options_ruleListDefaultProfile') }}</label>&nbsp;
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
      <form class="form-group" @submit.prevent>
        <label>{{ tr('options_ruleListFormat') }}</label>
        <div
          v-for="format in ruleListFormats"
          :key="format"
          class="radio inline-form-control no-min-width"
        >
          <label>
            <input
              type="radio"
              name="formatInput"
              :value="format"
              v-model="profile.format"
            >{{ tr('ruleListFormat_' + format) }}
          </label>
        </div>
      </form>
    </section>
    <section class="settings-group">
      <h3>{{ tr('options_group_ruleListUrl') }}</h3>
      <div class="input-group width-limit" v-if="profile">
        <input
          type="url"
          v-model="profile.sourceUrl"
          class="form-control"
        >
        <span class="input-group-btn">
          <button type="button" @click="profile.sourceUrl = ''" :disabled="!profile.sourceUrl" class="btn btn-default">
            <span class="glyphicon glyphicon-remove"></span>
          </button>
        </span>
      </div>
      <p class="help-block">{{ tr('options_ruleListUrlHelp') }}</p>
    </section>
    <section class="settings-group">
      <h3>{{ tr('options_group_ruleListText') }}</h3>
      <p>
        <button
          :disabled="!profile.sourceUrl"
          @click="updateProfile(profile.name)"
          :class="state.updatingProfile[profile.name] ? 'btn btn-default' : 'btn btn-default'"
          class="btn btn-default"
        >
          <span class="glyphicon glyphicon-download-alt"></span> {{ tr('options_downloadProfileNow') }}
        </button>
      </p>
      <textarea
        v-model="profile.ruleList"
        rows="20"
        :readonly="!!profile.sourceUrl"
        class="monospace form-control width-limit"
      ></textarea>
    </section>
  </div>
</template>
