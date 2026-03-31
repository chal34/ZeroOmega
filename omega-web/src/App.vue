<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useOmegaTarget } from './composables/useOmegaTarget'
import { useOptionsState } from './composables/useOptionsState'
import {
  profileColors,
  getAttachedName,
  isProfileNameReserved,
  isProfileNameHidden,
  profileOrder,
  dispName as dispNameFn,
  getVirtualTarget,
} from './composables/useProfiles'
import { getProfileIcon } from './composables/useProfileIcons'
import ProfileInline from './components/ProfileInline.vue'
import AlertBanner from './components/AlertBanner.vue'
import NewProfileModal from './views/modals/NewProfileModal.vue'
import RenameProfileModal from './views/modals/RenameProfileModal.vue'
import ReplaceProfileModal from './views/modals/ReplaceProfileModal.vue'
import ApplyOptionsConfirm from './views/modals/ApplyOptionsConfirm.vue'
import OptionsWelcome from './views/modals/OptionsWelcome.vue'
import * as OmegaPac from 'omega-pac'

const router = useRouter()
const route = useRoute()
const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const {
  state,
  init,
  sortedProfiles,
  showAlert,
  hideAlert,
  profileByName,
  applyOptions,
  revertOptions,
  updateProfile,
  exportScript,
  onFirstRun,
} = useOptionsState()

// Profile icons map (extended with RuleList format types)
const profileIcons: Record<string, string> = {
  DirectProfile: 'glyphicon-transfer',
  SystemProfile: 'glyphicon-off',
  AutoDetectProfile: 'glyphicon-file',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  VirtualProfile: 'glyphicon-question-sign',
}

const alertIcons: Record<string, string> = {
  success: 'glyphicon-ok',
  warning: 'glyphicon-warning-sign',
  error: 'glyphicon-remove',
  danger: 'glyphicon-danger',
}

function alertClassForType(type: string | undefined): string {
  if (!type) return ''
  const t = type === 'error' ? 'danger' : type
  return 'alert-' + t
}

function dispNameFilter(profile: any): string {
  return dispNameFn(profile, tr)
}

// Extend profileIcons with RuleList format types once OmegaPac is available
function extendProfileIcons() {
  try {
    const OmegaPac = OmegaPac
    if (OmegaPac?.Profiles?.formatByType) {
      for (const type in OmegaPac.Profiles.formatByType) {
        if (OmegaPac.Profiles.formatByType.hasOwnProperty(type)) {
          profileIcons[type] = profileIcons['RuleListProfile']
        }
      }
    }
  } catch (_) {}
}

// Modal states
const showNewProfileModal = ref(false)
const showRenameModal = ref(false)
const showReplaceModal = ref(false)
const showApplyConfirmModal = ref(false)
const showWelcomeModal = ref(false)
const welcomeIsUpgrade = ref(false)
const renameFromName = ref('')
const replaceFromName = ref('')
const replaceToName = ref('')
let applyConfirmResolve: ((v: boolean) => void) | null = null

function newProfile() {
  showNewProfileModal.value = true
}

function onNewProfileConfirm(profile: any) {
  showNewProfileModal.value = false
  try {
    const OmegaPac = OmegaPac
    profile = OmegaPac.Profiles.create(profile)
    const choice = Math.floor(Math.random() * profileColors.length)
    profile.color = profile.color ?? profileColors[choice]
    OmegaPac.Profiles.updateRevision(profile)
    state.options[OmegaPac.Profiles.nameAsKey(profile)] = profile
    router.push({ name: 'profile', params: { name: profile.name } })
  } catch (_) {}
}

function onNewProfileCancel() {
  showNewProfileModal.value = false
}

function renameProfile(fromName: string) {
  applyOptionsConfirm().then((ok) => {
    if (!ok) return
    renameFromName.value = fromName
    showRenameModal.value = true
  })
}

function onRenameConfirm(toName: string) {
  showRenameModal.value = false
  const fromName = renameFromName.value
  if (toName === fromName) return

  const OmegaPac = OmegaPac
  const profile = profileByName(fromName)
  let rename = omegaTarget.renameProfile(fromName, toName)
  const attachedName = getAttachedName(fromName)
  if (profileByName(attachedName)) {
    const toAttachedName = getAttachedName(toName)
    let defaultProfileName: any = undefined
    if (profileByName(toAttachedName)) {
      defaultProfileName = profile.defaultProfileName
      rename = rename.then(() => {
        const toAttachedKey = OmegaPac.Profiles.nameAsKey(toAttachedName)
        const p = profileByName(toName)
        p.defaultProfileName = 'direct'
        OmegaPac.Profiles.updateRevision(p)
        delete state.options[toAttachedKey]
        applyOptions()
      })
    }
    rename = rename.then(() =>
      omegaTarget.renameProfile(attachedName, toAttachedName)
    )
    if (defaultProfileName) {
      rename = rename.then(() => {
        const p = profileByName(toName)
        p.defaultProfileName = defaultProfileName
        applyOptions()
      })
    }
  }
  rename
    .then(() => router.push({ name: 'profile', params: { name: toName } }))
    .catch((err: any) => showAlert({ type: 'error', message: String(err) }))
}

function onRenameCancel() {
  showRenameModal.value = false
}

function replaceProfile(fromName: string, toName?: string) {
  applyOptionsConfirm().then((ok) => {
    if (!ok) return
    replaceFromName.value = fromName
    replaceToName.value = toName || ''
    showReplaceModal.value = true
  })
}

function onReplaceConfirm(result: { fromName: string; toName: string }) {
  showReplaceModal.value = false
  omegaTarget
    .replaceRef(result.fromName, result.toName)
    .then(() => showAlert({ type: 'success', i18n: 'options_replaceProfileSuccess' }))
    .catch((err: any) => showAlert({ type: 'error', message: String(err) }))
}

function onReplaceCancel() {
  showReplaceModal.value = false
}

function applyOptionsConfirm(): Promise<boolean> {
  if (!state.optionsDirty) return Promise.resolve(true)
  return new Promise((resolve) => {
    applyConfirmResolve = resolve
    showApplyConfirmModal.value = true
  })
}

function onApplyConfirm() {
  showApplyConfirmModal.value = false
  applyOptions()
  applyConfirmResolve?.(true)
  applyConfirmResolve = null
}

function onApplyConfirmCancel() {
  showApplyConfirmModal.value = false
  applyConfirmResolve?.(false)
  applyConfirmResolve = null
}

function resetOptions(options?: any): Promise<void> {
  return omegaTarget.resetOptions(options).then(() => {
    showAlert({ type: 'success', i18n: 'options_resetSuccess' })
  }).catch((err: any) => {
    showAlert({ type: 'error', message: String(err) })
    return Promise.reject(err)
  })
}

// Options dirty tracking
watch(
  () => state.options,
  (newVal, oldVal) => {
    if (newVal === oldVal || oldVal == null) return
    state.optionsDirty = true
  },
  { deep: true }
)

// Warn before unload if options are dirty
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (state.optionsDirty) {
    e.preventDefault()
    e.returnValue = tr('options_optionsNotSaved')
    return tr('options_optionsNotSaved')
  }
}

// Hide alert on click
function onDocClick() {
  hideAlert()
}

// First run / welcome handling
function showFirstRun() {
  omegaTarget.state('firstRun').then((firstRun: any) => {
    if (!firstRun) return
    omegaTarget.state('firstRun', '')

    const OmegaPac = OmegaPac
    let profileName: string | null = null
    OmegaPac.Profiles.each(state.options, (key: any, profile: any) => {
      if (!profileName && profile.profileType === 'FixedProfile') {
        profileName = profile.name
      }
    })
    if (!profileName) return

    welcomeIsUpgrade.value = firstRun === 'upgrade'
    showWelcomeModal.value = true
  })
}

function onWelcomeResult(result: string) {
  showWelcomeModal.value = false
  if (result === 'show') {
    const OmegaPac = OmegaPac
    let profileName: string | null = null
    OmegaPac.Profiles.each(state.options, (key: any, profile: any) => {
      if (!profileName && profile.profileType === 'FixedProfile') {
        profileName = profile.name
      }
    })
    if (profileName) {
      router.push({ name: 'profile', params: { name: profileName } })
    }
  }
}

function onWelcomeCancel() {
  showWelcomeModal.value = false
}

// Provide methods to child components via provide/inject
import { provide } from 'vue'
provide('profileIcons', profileIcons)
provide('dispNameFilter', dispNameFilter)
provide('profileByName', profileByName)
provide('showAlert', showAlert)
provide('hideAlert', hideAlert)
provide('applyOptions', applyOptions)
provide('applyOptionsConfirm', applyOptionsConfirm)
provide('revertOptions', revertOptions)
provide('resetOptions', resetOptions)
provide('updateProfile', updateProfile)
provide('exportScript', exportScript)
provide('newProfile', newProfile)
provide('renameProfile', renameProfile)
provide('replaceProfile', replaceProfile)
provide('alertClassForType', alertClassForType)
provide('alertIcons', alertIcons)

onMounted(() => {
  extendProfileIcons()
  init()

  onFirstRun(() => {
    showFirstRun()
  })

  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('click', onDocClick, false)

  // Track URL changes for lastUrl
  router.afterEach((to) => {
    omegaTarget.lastUrl(to.fullPath)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  document.removeEventListener('click', onDocClick, false)
})

const openShortcutConfig = omegaTarget.openShortcutConfig.bind(omegaTarget)
provide('openShortcutConfig', openShortcutConfig)
</script>

<template>
  <style class="om-style">{{ state.customCss }}</style>
  <div
    v-if="state.options"
    class="container-fluid"
  >
    <header class="col-lg-2 col-sm-3 side-nav">
      <h1>
        <router-link :to="{ name: 'about' }" :title="tr('about_title')">
          Zero Omega
        </router-link>
        <sup
          v-if="state.isExperimental"
          class="om-experimental text-danger"
        >{{ tr('options_experimental_badge') }}</sup>
      </h1>
      <nav class="nav nav-pills nav-stacked">
        <li class="nav-header">{{ tr('options_navHeader_setting') }}</li>
        <li :class="{ active: route.name === 'ui' }">
          <router-link :to="{ name: 'ui' }">
            <span class="glyphicon glyphicon-wrench"></span> {{ tr('options_tab_ui') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'general' }">
          <router-link :to="{ name: 'general' }">
            <span class="glyphicon glyphicon-cog"></span> {{ tr('options_tab_general') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'io' }">
          <router-link :to="{ name: 'io' }">
            <span class="glyphicon glyphicon-floppy-save"></span> {{ tr('options_tab_importExport') }}
          </router-link>
        </li>
        <li :class="{ active: route.name === 'theme' }">
          <router-link :to="{ name: 'theme' }">
            <span class="glyphicon glyphicon-adjust"></span> {{ tr('options_theme') }}
          </router-link>
        </li>
        <li class="divider"></li>
        <li class="nav-header">{{ tr('options_navHeader_profiles') }}</li>
        <li :class="{ active: route.name === 'builtin' }">
          <router-link :to="{ name: 'builtin' }">
            <span class="glyphicon glyphicon-globe"></span> {{ tr('options_builtin') }}
          </router-link>
        </li>
        <li
          v-for="profile in sortedProfiles"
          :key="profile.name"
          :class="{ active: route.name === 'profile' && route.params.name === profile.name }"
          :data-profile-type="profile.profileType"
          class="nav-profile"
        >
          <router-link :to="{ name: 'profile', params: { name: profile.name } }">
            <ProfileInline
              :profile="profile"
              :options="state.options"
              :disp-name="dispNameFilter"
            />
          </router-link>
        </li>
        <li class="nav-new-profile">
          <a role="button" @click="newProfile()">
            <span class="glyphicon glyphicon-plus"></span>
            <span>{{ tr('options_newProfile') }}</span>
          </a>
        </li>
        <li class="divider"></li>
        <li class="nav-header">{{ tr('options_navHeader_actions') }}</li>
        <li>
          <a
            role="button"
            class="btn-default btn align-initial"
            :class="{ 'btn-success': state.optionsDirty }"
            @click="applyOptions()"
          >
            <span class="glyphicon glyphicon-ok-circle"></span> {{ tr('options_apply') }}
          </a>
        </li>
        <li :class="{ disabled: !state.optionsDirty }">
          <a role="button" class="text-danger" @click="revertOptions()">
            <span class="glyphicon glyphicon-remove-circle"></span> {{ tr('options_discard') }}
          </a>
        </li>
      </nav>
    </header>
    <main class="col-lg-10 col-sm-9 col-lg-offset-2 col-sm-offset-3">
      <router-view />
    </main>
  </div>

  <!-- Alert banner -->
  <div
    v-show="state.alertShown"
    class="alert-top-wrapper"
  >
    <div
      :class="alertClassForType(state.alert?.type)"
      class="alert"
      @click.stop
    >
      <span
        v-if="state.alert?.type"
        class="glyphicon"
        :class="alertIcons[state.alert.type] || ''"
      ></span>
      {{ state.alert?.i18n ? tr(state.alert.i18n) : state.alert?.message }}
    </div>
  </div>

  <!-- Modals -->
  <NewProfileModal
    v-if="showNewProfileModal"
    :options="state.options"
    :profile-icons="profileIcons"
    :disp-name-filter="dispNameFilter"
    :pac-profiles-unsupported="state.pacProfilesUnsupported"
    @confirm="onNewProfileConfirm"
    @cancel="onNewProfileCancel"
  />

  <RenameProfileModal
    v-if="showRenameModal"
    :from-name="renameFromName"
    :options="state.options"
    :disp-name-filter="dispNameFilter"
    @confirm="onRenameConfirm"
    @cancel="onRenameCancel"
  />

  <ReplaceProfileModal
    v-if="showReplaceModal"
    :from-name="replaceFromName"
    :to-name="replaceToName"
    :options="state.options"
    :disp-name-filter="dispNameFilter"
    @confirm="onReplaceConfirm"
    @cancel="onReplaceCancel"
  />

  <ApplyOptionsConfirm
    v-if="showApplyConfirmModal"
    @confirm="onApplyConfirm"
    @cancel="onApplyConfirmCancel"
  />

  <OptionsWelcome
    v-if="showWelcomeModal"
    :upgrade="welcomeIsUpgrade"
    @result="onWelcomeResult"
    @cancel="onWelcomeCancel"
  />
</template>
