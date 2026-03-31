<script setup lang="ts">
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state } = useOptionsState()
</script>

<template>
  <div class="page-header">
    <h2>{{ tr('options_tab_general') }}</h2>
  </div>
  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_networkRequests') }}</h3>
    <div class="checkbox">
      <label>
        <input
          id="revert-proxy-changes"
          type="checkbox"
          v-model="state.options['-monitorWebRequests']"
        >
        <span>{{ tr('options_monitorWebRequests') }}</span>
      </label>
      <p class="help-block" v-html="tr('options_monitorWebRequestsHelp')"></p>
    </div>
    <p>
      <a href="./popup/network/index.html" role="button" target="_blank" class="btn btn-default">
        <span class="glyphicon glyphicon-dashboard"></span> Network monitor
      </a>
      <span class="help-inline">Inspect network traffic</span>
    </p>
  </section>
  <section class="settings-group width-limit" v-if="state.options">
    <h3>{{ tr('options_downloadOptions') }}</h3>
    <p class="help-block">{{ tr('options_downloadOptionsHelp') }}</p>
    <div class="form-group">
      <label for="download-interval">{{ tr('options_downloadInterval') }}</label>
      <select
        id="download-interval"
        v-model="state.options['-downloadInterval']"
        class="form-control inline-form-control"
      >
        <option
          v-for="interval in downloadIntervals"
          :key="interval"
          :value="interval"
        >{{ tr(downloadIntervalI18n(interval)) }}</option>
      </select>
    </div>
  </section>
  <section class="settings-group width-limit" v-if="state.options">
    <h3>{{ tr('options_group_conflicts') }}</h3>
    <p>{{ tr('options_conflicts_introduction') }}</p>
    <p class="help-text text-danger">
      <span style="padding: 1px 4px; background: #da4f49; color: #fff; box-shadow: #ccc 1px 1px 1px 1px;">=</span>
      {{ tr('options_conflicts_lowerPriority') }}
    </p>
    <p class="help-text text-info">
      <span class="glyphicon glyphicon-info-sign"></span>
      <span v-html="tr('options_conflicts_higherPriority')"></span>
    </p>
    <div class="checkbox">
      <label>
        <input
          id="revert-proxy-changes"
          type="checkbox"
          v-model="state.options['-showExternalProfile']"
        >
        <span>{{ tr('options_showExternalProfile') }}</span>
      </label>
    </div>
    <p class="help-block" v-html="tr('options_showExternalProfileHelp')"></p>
  </section>
</template>

<script lang="ts">
const downloadIntervals = [15, 60, 180, 360, 720, 1440, -1]

function downloadIntervalI18n(interval: number): string {
  return 'options_downloadInterval_' + (interval < 0 ? 'never' : interval)
}
</script>
