<script setup lang="ts">
import { ref } from 'vue'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'
import { downloadFile } from '../composables/useDownloadFile'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, showAlert, resetOptions } = useOptionsState()

const restoreOnlineUrl = ref('')
const gistId = ref('')
const gistToken = ref('')
const gistUrl = ref('')
const lastGistSync = ref<Date>(new Date())
const lastGistState = ref('')
const useBuiltInSync = ref(true)
const restoringLocal = ref(false)
const restoringOnline = ref(false)
const enableOptionsSyncing = ref(false)

// Load initial state
omegaTarget.state([
  'web.restoreOnlineUrl',
  'gistId',
  'gistToken',
  'lastGistSync',
  'lastGistState',
]).then(([url, gId, gToken, gSync, gState]: any[]) => {
  if (url) restoreOnlineUrl.value = url
  if (gId) {
    gistId.value = gId
    gistUrl.value = 'https://gist.github.com/' + getGistId(gId)
  }
  if (gToken) gistToken.value = gToken
  lastGistSync.value = new Date(gSync || Date.now())
  lastGistState.value = gState || ''
})

function getGistId(gistUrlStr: string = ''): string {
  let id = gistUrlStr.replace(/\/+$/, '')
  const parts = id.split('/')
  return parts[parts.length - 1]
}

function exportOptions() {
  // applyOptionsConfirm handled by parent
  const plainOptions = JSON.parse(JSON.stringify(state.options))
  const content = JSON.stringify(plainOptions)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const filename = `ZeroOmegaOptions-${new Date().toISOString()}.bak`
  downloadFile(blob, filename)
}

function importSuccess() {
  showAlert({
    type: 'success',
    i18n: 'options_importSuccess',
    message: 'Options imported.',
  })
}

function restoreLocal(content: string) {
  restoringLocal.value = true
  resetOptions(content).then(() => {
    importSuccess()
  }).catch(() => {
    restoreLocalError()
  }).finally(() => {
    restoringLocal.value = false
  })
}

function restoreLocalError() {
  showAlert({
    type: 'error',
    i18n: 'options_importFormatError',
    message: 'Invalid backup file!',
  })
}

function downloadError() {
  showAlert({
    type: 'error',
    i18n: 'options_importDownloadError',
    message: 'Error downloading backup file!',
  })
}

function triggerFileInput() {
  const el = document.getElementById('restore-local-file') as HTMLInputElement
  el?.click()
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0 && input.files[0].name.length > 0) {
    const reader = new FileReader()
    reader.addEventListener('load', (e) => {
      restoreLocal((e.target as FileReader).result as string)
    })
    reader.addEventListener('error', () => {
      restoreLocalError()
    })
    reader.readAsText(input.files[0])
    input.value = ''
  }
}

function restoreOnline() {
  omegaTarget.state('web.restoreOnlineUrl', restoreOnlineUrl.value)
  restoringOnline.value = true
  fetch(restoreOnlineUrl.value, { cache: 'no-cache' })
    .then(res => {
      if (!res.ok) throw new Error('Download failed')
      return res.text()
    })
    .then(data => {
      return resetOptions(data).then(() => {
        importSuccess()
      }).catch(() => {
        restoreLocalError()
      })
    })
    .catch(() => downloadError())
    .finally(() => {
      restoringOnline.value = false
    })
}

function enableOptionsSync(args: any = {}) {
  const enable = () => {
    if (!gistId.value || !gistToken.value) {
      showAlert({
        type: 'error',
        message: 'Gist Id or Gist Token is required',
      })
      return
    }
    args.gistId = gistId.value
    args.gistToken = gistToken.value
    args.useBuiltInSync = useBuiltInSync.value
    enableOptionsSyncing.value = true
    omegaTarget.setOptionsSync(true, args).then(() => {
      window.location.reload()
    }).catch((e: any) => {
      enableOptionsSyncing.value = false
      showAlert({ type: 'error', message: String(e) })
    })
  }
  if (args?.force) {
    enable()
  } else {
    enable()
  }
}

function cleanInput(target: string) {
  if (target === 'gistId') gistId.value = ''
  if (target === 'gistToken') gistToken.value = ''
  omegaTarget.state(target, '')
}

function checkOptionsSyncChange() {
  enableOptionsSyncing.value = true
  omegaTarget.checkOptionsSyncChange().then(() => {
    window.location.reload()
  })
}

function disableOptionsSync() {
  omegaTarget.setOptionsSync(false, {}).then(() => {
    window.location.reload()
  })
}

function resetOptionsSync() {
  if (!gistId.value || !gistToken.value) {
    showAlert({ type: 'error', message: 'Gist Id or Gist Token is required' })
    return
  }
  omegaTarget.resetOptionsSync({
    gistId: gistId.value,
    gistToken: gistToken.value,
  }).then(() => {
    window.location.reload()
  }).catch((e: any) => {
    showAlert({ type: 'error', message: String(e) })
  })
}

function formatDate(date: Date): string {
  return date.toLocaleString()
}
</script>

<template>
  <div class="page-header">
    <h2>{{ tr('options_tab_importExport') }}</h2>
  </div>
  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_importExportProfile') }}</h3>
    <div class="help-block">
      <div class="text-info">
        <span class="glyphicon glyphicon-info-sign"></span> {{ tr('options_exportProfileHelp') }}
      </div>
    </div>
    <div v-show="!(state.options['-showConditionTypes'] > 0)" class="checkbox">
      <label>
        <input type="checkbox" v-model="state.options['-exportLegacyRuleList']">
        <span>{{ tr('options_exportLegacyRuleList') }}</span>
      </label>
      <p class="help-block" v-html="tr('options_exportLegacyRuleListHelp')"></p>
    </div>
  </section>

  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_importExportSettings') }}</h3>
    <p>
      <button @click="exportOptions()" class="btn btn-default">
        <span class="glyphicon glyphicon-floppy-save"></span> {{ tr('options_makeBackup') }}
      </button>
      <span class="help-inline">{{ tr('options_makeBackupHelp') }}</span>
    </p>
    <p>
      <input
        id="restore-local-file"
        type="file"
        @change="handleFileUpload"
        style="display: none;"
      >
      <button @click="triggerFileInput()" :disabled="restoringLocal" class="btn btn-default">
        <span class="glyphicon glyphicon-folder-open"></span> {{ tr('options_restoreLocal') }}
      </button>
      <span class="help-inline">{{ tr('options_restoreLocalHelp') }}</span>
    </p>
    <div>
      <label>{{ tr('options_restoreOnline') }}</label>
      <div class="input-group width-limit">
        <input
          type="url"
          v-model="restoreOnlineUrl"
          :placeholder="tr('options_restoreOnlinePlaceholder')"
          class="form-control"
        >
        <span class="input-group-btn">
          <button
            @click="restoreOnline()"
            :disabled="restoringOnline"
            class="btn btn-default"
          >{{ tr('options_restoreOnlineSubmit') }}</button>
        </span>
      </div>
    </div>
  </section>

  <section class="settings-group" v-if="state.options">
    <h3>{{ tr('options_group_syncing') }}</h3>
    <div>
      <form class="sync-form" @submit.prevent>
        <div class="form-group">
          <label>Gist Id</label>
          <div class="input-group width-limit">
            <span class="input-group-addon">ID</span>
            <input
              type="text"
              v-model="gistId"
              :readonly="state.syncOptions === 'sync'"
              placeholder="Gist Id e.g. https://gist.github.com/{username}/{Gist Id}"
              class="form-control"
            >
            <span
              v-if="state.syncOptions !== 'sync'"
              @click="cleanInput('gistId')"
              class="glyphicon glyphicon-remove btn clean-btn"
            ></span>
          </div>
          <span class="help-block">
            <a href="https://gist.github.com/" role="button" target="_blank">Create a secret Gist. </a>
            <strong> Note: If it's a public Gist, your options can be searched by others。</strong>
          </span>
        </div>
        <div class="form-group">
          <label>Gist Token</label>
          <div class="input-group width-limit">
            <span class="input-group-addon">TOKEN</span>
            <input
              type="text"
              v-model="gistToken"
              :readonly="state.syncOptions === 'sync'"
              placeholder="Gist Token"
              class="form-control"
            >
            <span
              v-if="state.syncOptions !== 'sync'"
              @click="cleanInput('gistToken')"
              class="glyphicon glyphicon-remove btn clean-btn"
            ></span>
          </div>
          <span class="help-block">
            <a href="https://github.com/settings/tokens/new" role="button" target="_blank">
              Create a token that manages the Gist.<strong>(Gist permission is required.)</strong>
            </a>
          </span>
        </div>
      </form>
    </div>

    <div v-show="state.syncOptions === 'pristine' || state.syncOptions === 'disabled'">
      <div class="checkbox">
        <label>
          <input id="use-built-in-sync-enhance" type="checkbox" v-model="useBuiltInSync">
          <span>{{ tr('options_useBuiltInSyncEnhance') }}</span>
        </label>
        <details class="use-built-in-sync-enhance-tip">
          <summary><span class="glyphicon glyphicon-question-sign"></span></summary>
          <ol v-html="tr('options_useBuiltInSyncEnhanceTip')"></ol>
        </details>
      </div>
      <p class="help-block" v-html="tr('options_syncPristineHelp')"></p>
      <p>
        <button
          @click="enableOptionsSync()"
          :disabled="enableOptionsSyncing"
          class="btn btn-default"
        >
          <span class="glyphicon glyphicon-cloud-upload"></span> {{ tr('options_syncEnable') }}
        </button>
      </p>
    </div>

    <div v-show="state.syncOptions === 'sync'">
      <p class="alert alert-success width-limit">
        <button
          @click="checkOptionsSyncChange()"
          :disabled="enableOptionsSyncing"
          class="btn btn-sm btn-success"
        >
          <span class="glyphicon glyphicon-refresh"></span>
        </button>
        <span>   last sync date: </span>{{ formatDate(lastGistSync) }}
        ({{ lastGistState }})
        <a :href="gistUrl" role="button" target="_blank">
          &nbsp;<span class="glyphicon glyphicon-link"></span>
        </a>
        <br><br>
        <span class="glyphicon glyphicon-ok"></span> {{ tr('options_syncSyncAlert') }}
      </p>
      <p>
        <button @click="disableOptionsSync()" class="btn btn-warning">
          <span class="glyphicon glyphicon-remove-sign"></span> {{ tr('options_syncDisable') }}
        </button>
      </p>
    </div>

    <div v-show="state.syncOptions === 'conflict'">
      <div class="checkbox">
        <label>
          <input id="use-built-in-sync-enhance" type="checkbox" v-model="useBuiltInSync">
          <span>{{ tr('options_useBuiltInSyncEnhance') }}</span>
        </label>
      </div>
      <p class="alert alert-danger width-limit">
        <span class="glyphicon glyphicon-info-sign"></span> {{ tr('options_syncConflictAlert') }}
      </p>
      <p class="help-block" v-html="tr('options_syncConflictHelp')"></p>
      <p>
        <button
          @click="enableOptionsSync({ force: true })"
          :disabled="enableOptionsSyncing"
          class="btn btn-danger"
        >
          <span class="glyphicon glyphicon-cloud-download"></span> {{ tr('options_syncEnableForce') }}
        </button>&nbsp;
        <button @click="resetOptionsSync()" class="btn btn-link">
          <span class="glyphicon glyphicon-erase"></span> {{ tr('options_syncReset') }}
        </button>
      </p>
    </div>

    <div v-show="state.syncOptions === 'unsupported'">
      <p class="help-block" v-html="tr('options_syncUnsupportedHelp')"></p>
    </div>
  </section>
</template>
