<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { useOptionsState } from '../../composables/useOptionsState'
import FixedAuthEditModal from '../modals/FixedAuthEditModal.vue'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  profile: any
  options: any
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, updateProfile } = useOptionsState()

const urlRegex = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/
const urlWithFile = /^(ftp|http|https|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/

const isFileUrl = OmegaPac.Profiles.isFileUrl
const pacUrlIsFile = ref(false)
const showAuthModal = ref(false)

const set = OmegaPac.Profiles.referencedBySet(props.profile, props.options)
const referenced = Object.keys(set).length > 0

let oldPacUrl: string | null = null
let oldLastUpdate: any = null
let oldPacScript: string | null = null

watch(
  () => props.profile,
  (profile, oldProfile) => {
    if (!profile || !oldProfile) return
    if (profile.pacUrl !== oldProfile.pacUrl) {
      if (profile.lastUpdate) {
        oldPacUrl = oldProfile.pacUrl
        oldLastUpdate = profile.lastUpdate
        oldPacScript = oldProfile.pacScript
        profile.lastUpdate = null
      } else if (oldPacUrl && profile.pacUrl === oldPacUrl) {
        profile.lastUpdate = oldLastUpdate
        profile.pacScript = oldPacScript
      }
    }
    pacUrlIsFile.value = isFileUrl(profile.pacUrl)
  },
  { deep: true, immediate: true }
)

function editProxyAuth() {
  showAuthModal.value = true
}

function onAuthConfirm(auth: any) {
  showAuthModal.value = false
  const prop = 'all'
  if (!auth?.username) {
    if (props.profile.auth) {
      props.profile.auth[prop] = undefined
    }
  } else {
    props.profile.auth = props.profile.auth ?? {}
    props.profile.auth[prop] = auth
  }
}

const authForAll = computed(() => {
  return props.profile.auth?.['all']
    ? JSON.parse(JSON.stringify(props.profile.auth['all']))
    : { username: '', password: '' }
})

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}
</script>

<template>
  <div>
    <p v-show="state.pacProfilesUnsupported" class="alert alert-danger width-limit">
      <span class="glyphicon glyphicon-remove"></span> {{ tr('options_pac_profile_unsupported_moz') }}
    </p>
    <section class="settings-group">
      <h3>{{ tr('options_group_pacUrl') }}</h3>
      <div class="input-group width-limit">
        <input
          type="text"
          v-model="profile.pacUrl"
          class="form-control"
        >
        <span class="input-group-btn">
          <button
            type="button"
            @click="profile.pacUrl = ''"
            :disabled="!profile.pacUrl"
            class="btn btn-default"
          >
            <span class="glyphicon glyphicon-remove"></span>
          </button>
        </span>
      </div>
      <p class="help-block">{{ tr('options_pacUrlHelp') }}</p>
      <div v-show="pacUrlIsFile && !referenced" class="has-warning">
        <p class="help-block">
          <span class="glyphicon glyphicon-warning-sign"></span> {{ tr('options_pacUrlFile') }}
        </p>
      </div>
      <div v-show="isFileUrl(profile.pacUrl) && referenced" class="has-error">
        <p class="help-block">
          <span class="glyphicon glyphicon-remove-sign"></span> {{ tr('options_pacUrlFile') }}
        </p>
        <p class="help-block">{{ tr('options_pacUrlFileDisabled') }}</p>
      </div>
      <p v-show="profile.pacUrl && !pacUrlIsFile">
        <button
          @click="updateProfile(profile.name)"
          :disabled="state.updatingProfile[profile.name]"
          :class="profile.pacUrl && !profile.lastUpdate ? 'btn btn-primary' : 'btn btn-default'"
        >
          <span class="glyphicon glyphicon-download-alt"></span> {{ tr('options_downloadProfileNow') }}
        </button>
      </p>
    </section>
    <section class="settings-group">
      <h3>
        {{ tr('options_group_pacScript') }}&nbsp;
        <button
          :class="profile.auth?.['all'] ? 'btn btn-xs btn-success proxy-auth-toggle' : 'btn btn-xs btn-default proxy-auth-toggle'"
          type="button"
          role="button"
          @click="editProxyAuth()"
          :title="tr('options_proxy_auth')"
        >
          <span class="glyphicon glyphicon-lock"></span>
        </button>
      </h3>
      <div v-show="profile.auth?.['all']" class="alert alert-warning width-limit">
        <p>{{ tr('options_proxy_authAllWarningPac') }}</p>
        <p v-show="!!profile.pacUrl">{{ tr('options_proxy_authAllWarningPacUrl') }}</p>
        <p v-show="!profile.pacUrl">{{ tr('options_proxy_authAllWarningPacScript') }}</p>
        <p v-show="!!referenced">
          <span class="glyphicon glyphicon-warning-sign"></span> {{ tr('options_proxy_authReferencedWarning') }}
        </p>
      </div>
      <div v-show="!pacUrlIsFile">
        <p v-show="profile.pacUrl && profile.lastUpdate" class="alert alert-success width-limit">
          {{ tr('options_pacScriptLastUpdate', [formatDate(profile.lastUpdate)]) }}
        </p>
        <p v-show="profile.pacUrl && !profile.lastUpdate" class="alert alert-danger width-limit">
          {{ tr('options_pacScriptObsolete') }}
        </p>
        <textarea
          v-model="profile.pacScript"
          rows="20"
          :readonly="!!profile.pacUrl"
          class="monospace form-control width-limit"
        ></textarea>
      </div>
    </section>

    <FixedAuthEditModal
      v-if="showAuthModal"
      :auth="authForAll"
      :auth-supported="true"
      protocol-disp=""
      @confirm="onAuthConfirm"
      @cancel="showAuthModal = false"
    />
  </div>
</template>
