<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { useOptionsState } from '../../composables/useOptionsState'
import {
  isProfileNameReserved,
  isProfileNameHidden,
  profileColors,
} from '../../composables/useProfiles'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  options: any
}>()

const emit = defineEmits<{
  (e: 'confirm', profile: any): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state } = useOptionsState()

const profileByName = (name: string) => OmegaPac.Profiles.byName(name, props.options)

const profileName = ref('')
const profileType = ref('FixedProfile')

const profileIcons: Record<string, string> = {
  FixedProfile: 'glyphicon-globe',
  SwitchProfile: 'glyphicon-retweet',
  PacProfile: 'glyphicon-file',
  VirtualProfile: 'glyphicon-question-sign',
}

const nameEmpty = computed(() => !profileName.value)
const nameReserved = computed(() => !!profileName.value && isProfileNameReserved(profileName.value))
const nameConflict = computed(() => !!profileName.value && !nameReserved.value && !!profileByName(profileName.value))
const nameValid = computed(() => !!profileName.value && !nameReserved.value && !nameConflict.value)
const nameHidden = computed(() => nameValid.value && isProfileNameHidden(profileName.value))
const formValid = computed(() => nameValid.value && !!profileType.value)

function submit() {
  if (!formValid.value) return
  const profile = OmegaPac.Profiles.create({
    name: profileName.value,
    profileType: profileType.value,
  })
  const choice = Math.floor(Math.random() * profileColors.length)
  profile.color = profile.color ?? profileColors[choice]
  OmegaPac.Profiles.updateRevision(profile)
  emit('confirm', profile)
}
</script>

<template>
  <Teleport to="body">
    <div class="modal show" style="display: block;" tabindex="-1">
      <div class="modal-backdrop fade in" @click="emit('cancel')"></div>
      <div class="modal-dialog">
        <div class="modal-content">
          <form @submit.prevent="submit()">
            <div class="modal-header">
              <button type="button" @click="emit('cancel')" class="close">
                <span aria-hidden="true">&times;</span>
                <span class="sr-only">Close</span>
              </button>
              <h4 class="modal-title">{{ tr('options_modalHeader_newProfile') }}</h4>
            </div>
            <div class="modal-body">
              <div :class="{ 'has-error': !nameValid && profileName }" class="form-group">
                <label for="profile-new-name">{{ tr('options_newProfileName') }}</label>
                <input
                  id="profile-new-name"
                  type="text"
                  required
                  v-model="profileName"
                  autofocus
                  class="form-control"
                >
                <div v-show="nameEmpty" class="help-block">{{ tr('options_profileNameEmpty') }}</div>
                <div v-show="nameReserved" class="help-block">{{ tr('options_profileNameReserved') }}</div>
                <div v-show="!nameReserved && nameConflict" class="help-block">{{ tr('options_profileNameConflict') }}</div>
                <div v-show="nameHidden" class="help-block">
                  <div class="text-info">
                    <span class="glyphicon glyphicon-info-sign"></span> {{ tr('options_profileNameHidden') }}
                  </div>
                </div>
              </div>
              <label>{{ tr('options_profileType') }}</label>
              <div class="radio">
                <label>
                  <input type="radio" name="profile-new-type" value="FixedProfile" v-model="profileType">
                  <span class="profile-type">
                    <span :class="'glyphicon ' + profileIcons['FixedProfile']"></span>
                    <span>{{ tr('options_profileTypeFixedProfile') }}</span>
                  </span>
                  <div class="help-block">{{ tr('options_profileDescFixedProfile') }}</div>
                </label>
              </div>
              <div class="radio">
                <label>
                  <input type="radio" name="profile-new-type" value="SwitchProfile" v-model="profileType">
                  <span class="profile-type">
                    <span :class="'glyphicon ' + profileIcons['SwitchProfile']"></span>
                    <span>{{ tr('options_profileTypeSwitchProfile') }}</span>
                  </span>
                  <div class="help-block">{{ tr('options_profileDescSwitchProfile') }}</div>
                </label>
              </div>
              <div class="radio">
                <label>
                  <input
                    type="radio"
                    name="profile-new-type"
                    value="PacProfile"
                    v-model="profileType"
                    :disabled="state.pacProfilesUnsupported"
                  >
                  <span class="profile-type">
                    <span :class="'glyphicon ' + profileIcons['PacProfile']"></span>
                    <span>{{ tr('options_profileTypePacProfile') }}</span>
                  </span>
                  <div class="help-block">{{ tr('options_profileDescPacProfile') }}</div>
                  <div v-show="!state.pacProfilesUnsupported" class="help-block">{{ tr('options_profileDescMorePacProfile') }}</div>
                  <div v-show="state.pacProfilesUnsupported" class="has-error">
                    <div class="help-block">
                      <span class="glyphicon glyphicon-warning-sign"></span> {{ tr('options_pac_profile_unsupported_moz') }}
                    </div>
                  </div>
                </label>
              </div>
              <div class="radio">
                <label>
                  <input type="radio" name="profile-new-type" value="VirtualProfile" v-model="profileType">
                  <span class="profile-type">
                    <span :class="'glyphicon ' + profileIcons['VirtualProfile'] + ' virtual-profile-icon'"></span>
                    <span>{{ tr('options_profileTypeVirtualProfile') }}</span>
                  </span>
                  <div class="help-block">{{ tr('options_profileDescVirtualProfile') }}</div>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
              <button type="submit" :disabled="!formValid" class="btn btn-primary">{{ tr('options_createProfile') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
