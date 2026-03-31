<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { isProfileNameReserved, isProfileNameHidden } from '../../composables/useProfiles'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  fromName: string
  options: any
}>()

const emit = defineEmits<{
  (e: 'confirm', newName: string): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

const profileByName = (name: string) => OmegaPac.Profiles.byName(name, props.options)

const newName = ref(props.fromName)

const nameEmpty = computed(() => !newName.value)
const nameReserved = computed(() => !!newName.value && isProfileNameReserved(newName.value))
const nameConflict = computed(() => {
  return !!newName.value && newName.value !== props.fromName && !nameReserved.value && !!profileByName(newName.value)
})
const nameValid = computed(() => !!newName.value && !nameReserved.value && !nameConflict.value)
const nameHidden = computed(() => nameValid.value && isProfileNameHidden(newName.value))

function submit() {
  if (!nameValid.value) return
  emit('confirm', newName.value)
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
                <span class="sr-only">{{ tr('dialog_close') }}</span>
              </button>
              <h4 class="modal-title">{{ tr('options_modalHeader_renameProfile') }}</h4>
            </div>
            <div class="modal-body">
              <div :class="{ 'has-error': !nameValid && newName !== fromName }" class="form-group">
                <label for="profile-new-name">{{ tr('options_renameProfileName') }}</label>
                <input
                  id="profile-new-name"
                  type="text"
                  required
                  v-model="newName"
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
            </div>
            <div class="modal-footer">
              <button type="button" @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
              <button type="submit" :disabled="!nameValid" class="btn btn-primary">{{ tr('options_renameProfile') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
