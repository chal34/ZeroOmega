<script setup lang="ts">
import { ref } from 'vue'
import { useOmegaDebug } from '../composables/useOmegaDebug'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'
import ResetOptionsConfirm from './modals/ResetOptionsConfirm.vue'

const omegaDebug = useOmegaDebug()
const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, resetOptions } = useOptionsState()

const logDownloading = ref(false)
const issueReporting = ref(false)
const optionsReseting = ref(false)
const showResetModal = ref(false)

let version: string
try {
  version = (omegaDebug as any).getProjectVersion?.() ?? '?.?.?'
} catch (_) {
  version = '?.?.?'
}

function downloadLog() {
  logDownloading.value = true
  Promise.resolve(omegaDebug.downloadLog()).then(() => {
    logDownloading.value = false
  })
}

function reportIssue() {
  issueReporting.value = true
  Promise.resolve(omegaDebug.reportIssue()).then(() => {
    issueReporting.value = false
  })
}

function showResetOptionsModal() {
  showResetModal.value = true
}

function onResetConfirm() {
  showResetModal.value = false
  optionsReseting.value = true
  Promise.resolve(omegaDebug.resetOptions()).then(() => {
    optionsReseting.value = false
  })
}

function onResetCancel() {
  showResetModal.value = false
}
</script>

<template>
  <div class="page-header">
    <h2>{{ tr('about_title') }}</h2>
  </div>
  <section v-show="state.isExperimental" class="omega-experimental">
    <p class="alert alert-warning">
      <span class="glyphicon glyphicon-warning-sign"></span>
      <span>{{ tr('about_experimental_warning_moz') }}</span>
    </p>
  </section>
  <section>
    <div style="margin: 1em 0" class="media">
      <div class="media-left">
        <img src="/img/icons/omega-action-32.png" class="media-object">
      </div>
      <div class="media-body">
        <h4 class="media-heading">{{ tr('appNameShort') }}</h4>
        <p>{{ tr('about_app_description') }}</p>
      </div>
    </div>
  </section>
  <section>
    <p>
      <button @click="reportIssue()" :disabled="issueReporting" class="btn btn-info">
        <span class="glyphicon glyphicon-comment"></span> {{ tr('popup_reportIssues') }}
      </button>&nbsp;
      <button @click="downloadLog()" :disabled="logDownloading" class="btn btn-default">
        <span class="glyphicon glyphicon-download"></span> {{ tr('popup_errorLog') }}
      </button>&nbsp;
      <button @click="showResetOptionsModal()" :disabled="optionsReseting" class="btn btn-danger">
        <span class="glyphicon glyphicon-alert"></span> {{ tr('options_reset') }}
      </button>
    </p>
  </section>
  <section>
    <p>{{ tr('about_version', [version]) }}</p>
    <p class="text-warning">
      <span class="glyphicon glyphicon-info-sign"></span>
      <span v-html="tr('about_disclaimer_networkService')"></span>
    </p>
    <p class="text-success">
      <span class="glyphicon glyphicon-eye-close"></span>
      <span v-html="tr('about_disclaimer_privacy')"></span>
    </p>
    <p class="text-info">
      <span class="glyphicon glyphicon-question-sign"></span>
      <span v-html="tr('about_help')"></span>
    </p>
  </section>
  <section style="margin-top: 7em">
    <p>
      {{ tr('appNameShort') }}<br>
      <span v-html="tr('about_copyright')"></span><br>
      <span v-html="tr('about_license')"></span><br>
      <span v-html="tr('about_credits')"></span>
    </p>
  </section>

  <ResetOptionsConfirm
    v-if="showResetModal"
    @confirm="onResetConfirm"
    @cancel="onResetCancel"
  />
</template>
