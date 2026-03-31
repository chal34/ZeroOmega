<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOmegaTarget } from '../composables/useOmegaTarget'
import { useOptionsState } from '../composables/useOptionsState'
import {
  profileColorPalette,
  getAttachedName,
  getParentName,
  getVirtualTarget,
  dispName,
} from '../composables/useProfiles'
import FixedProfile from './profile/FixedProfile.vue'
import PacProfile from './profile/PacProfile.vue'
import SwitchProfile from './profile/SwitchProfile.vue'
import RuleListProfile from './profile/RuleListProfile.vue'
import VirtualProfile from './profile/VirtualProfile.vue'
import UnsupportedProfile from './profile/UnsupportedProfile.vue'
import DeleteProfileModal from './modals/DeleteProfileModal.vue'
import CannotDeleteModal from './modals/CannotDeleteModal.vue'
import RenameProfileModal from './modals/RenameProfileModal.vue'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{ name: string }>()

const route = useRoute()
const router = useRouter()
const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, showAlert, applyOptions, exportScript } = useOptionsState()

const profile = ref<any>(null)
const scriptable = ref(true)
const exportRuleList = ref<((name: string) => void) | null>(null)
const exportRuleListOptions = ref<{ warning?: boolean } | null>(null)

const showDeleteModal = ref(false)
const showCannotDeleteModal = ref(false)
const showRenameModal = ref(false)
const cannotDeleteRefs = ref<any[]>([])

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

const profileComponent = computed(() => {
  if (!profile.value) return null
  switch (profile.value.profileType) {
    case 'FixedProfile': return FixedProfile
    case 'PacProfile': return PacProfile
    case 'SwitchProfile': return SwitchProfile
    case 'RuleListProfile': return RuleListProfile
    case 'VirtualProfile': return VirtualProfile
    default: return UnsupportedProfile
  }
})

function getProfileColor(): string | undefined {
  let color: string | undefined
  let p = profile.value
  while (p) {
    color = p.color
    p = getVirtualTarget(p, state.options)
  }
  return color
}

function setExportRuleListHandler(handler: ((name: string) => void) | null, options?: { warning?: boolean }) {
  exportRuleList.value = handler
  exportRuleListOptions.value = options ?? null
}

function deleteProfile() {
  const profileName = profile.value.name
  const refs = OmegaPac.Profiles.referencedBySet(profileName, state.options)

  if (Object.keys(refs).length > 0) {
    const refSet: any = {}
    for (const key in refs) {
      if (refs.hasOwnProperty(key)) {
        const pname = refs[key]
        const parent = getParentName(pname)
        if (parent) {
          const parentKey = OmegaPac.Profiles.nameAsKey(parent)
          refSet[parentKey] = parent
        } else {
          refSet[key] = pname
        }
      }
    }
    const refProfiles: any[] = []
    for (const key in refSet) {
      if (refSet.hasOwnProperty(key)) {
        refProfiles.push(OmegaPac.Profiles.byKey(key, state.options))
      }
    }
    cannotDeleteRefs.value = refProfiles
    showCannotDeleteModal.value = true
    return
  }

  showDeleteModal.value = true
}

function onDeleteConfirm() {
  showDeleteModal.value = false
  const profileName = profile.value.name
  const attachedName = getAttachedName(profileName)
  delete state.options[OmegaPac.Profiles.nameAsKey(attachedName)]
  delete state.options[OmegaPac.Profiles.nameAsKey(profileName)]
  if (state.options['-startupProfileName'] === profileName) {
    state.options['-startupProfileName'] = ''
  }
  const quickSwitch = state.options['-quickSwitchProfiles']
  if (quickSwitch) {
    for (let i = 0; i < quickSwitch.length; i++) {
      if (profileName === quickSwitch[i]) {
        quickSwitch.splice(i, 1)
        break
      }
    }
  }
  router.push({ name: 'ui' })
}

function renameProfile() {
  showRenameModal.value = true
}

function onRenameConfirm(toName: string) {
  showRenameModal.value = false
  const fromName = profile.value.name
  if (toName === fromName) return

  let rename = omegaTarget.renameProfile(fromName, toName)
  const attachedName = getAttachedName(fromName)
  const profileByName = (name: string) => OmegaPac.Profiles.byName(name, state.options)

  if (profileByName(attachedName)) {
    const toAttachedName = getAttachedName(toName)
    let defaultProfileName: string | undefined
    if (profileByName(toAttachedName)) {
      defaultProfileName = profile.value.defaultProfileName
      rename = rename.then(() => {
        const toAttachedKey = OmegaPac.Profiles.nameAsKey(toAttachedName)
        const p = profileByName(toName)
        p.defaultProfileName = 'direct'
        OmegaPac.Profiles.updateRevision(p)
        delete state.options[toAttachedKey]
        applyOptions()
      })
    }
    rename = rename.then(() => omegaTarget.renameProfile(attachedName, toAttachedName))
    if (defaultProfileName) {
      rename = rename.then(() => {
        const p = profileByName(toName)
        p.defaultProfileName = defaultProfileName
        applyOptions()
      })
    }
  }

  rename.then(() => {
    router.push({ name: 'profile', params: { name: toName } })
  }).catch((err: any) => {
    showAlert({ type: 'error', message: String(err) })
  })
}

function watchAndUpdateRevision(expression: () => any) {
  let revisionChanged = false
  watch(expression, (val, oldVal) => {
    if (val === oldVal || !val || !oldVal) return
    if (revisionChanged && val.revision !== oldVal.revision) {
      revisionChanged = false
    } else {
      OmegaPac.Profiles.updateRevision(val)
      revisionChanged = true
    }
  }, { deep: true })
}

// Watch for profile changes based on route name
watch(
  [() => props.name, () => state.options],
  ([name, options]) => {
    if (!options || !name) return
    const key = '+' + name
    const p = options[key]
    if (!p) {
      router.push({ path: '/' })
      return
    }
    if (OmegaPac.Profiles.formatByType[p.profileType]) {
      p.format = OmegaPac.Profiles.formatByType[p.profileType]
      p.profileType = 'RuleListProfile'
    }
    profile.value = p
    scriptable.value = true
  },
  { immediate: true }
)

watchAndUpdateRevision(() => profile.value)

function dispNameFn(name: any): string {
  return dispName(name, tr)
}
</script>

<template>
  <div v-if="profile">
    <div class="page-header">
      <div class="profile-actions">
        <button
          v-show="exportRuleList"
          @click="exportRuleList?.(profile.name)"
          :title="tr('options_profileExportRuleListHelp')"
          :class="exportRuleListOptions?.warning ? 'btn btn-warning' : 'btn btn-default'"
        >
          <span class="glyphicon glyphicon-list"></span> {{ tr('options_profileExportRuleList') }}
        </button>&nbsp;
        <button
          v-show="scriptable"
          @click="exportScript($event as MouseEvent, profile.name)"
          :title="tr('options_exportPacFileHelp')"
          class="btn btn-default"
        >
          <span class="glyphicon glyphicon-download"></span> {{ tr('options_profileExportPac') }}
        </button>&nbsp;
        <button @click="renameProfile()" class="btn btn-default">
          <span class="glyphicon glyphicon-edit"></span> {{ tr('options_renameProfile') }}
        </button>&nbsp;
        <button @click="deleteProfile()" class="btn btn-danger">
          <span class="glyphicon glyphicon-trash"></span> {{ tr('options_deleteProfile') }}
        </button>
      </div>
      <span class="profile-color-editor">
        <div
          v-if="profile.profileType === 'VirtualProfile'"
          :style="{ 'background-color': getProfileColor() }"
          class="profile-color-editor-fake"
        ></div>
        <input
          v-if="profile.profileType !== 'VirtualProfile'"
          type="color"
          v-model="profile.color"
        >
      </span>
      <h2 class="profile-name">{{ tr('options_profileTabPrefix') }}{{ profile.name }}</h2>
    </div>

    <component
      :is="profileComponent"
      :profile="profile"
      :options="state.options"
      @set-export-rule-list="setExportRuleListHandler"
    />

    <DeleteProfileModal
      v-if="showDeleteModal"
      :profile="profile"
      :options="state.options"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
    <CannotDeleteModal
      v-if="showCannotDeleteModal"
      :refs="cannotDeleteRefs"
      :options="state.options"
      @cancel="showCannotDeleteModal = false"
    />
    <RenameProfileModal
      v-if="showRenameModal"
      :from-name="profile.name"
      :options="state.options"
      @confirm="onRenameConfirm"
      @cancel="showRenameModal = false"
    />
  </div>
</template>
