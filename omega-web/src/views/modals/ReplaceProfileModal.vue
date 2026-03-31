<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { dispName } from '../../composables/useProfiles'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  fromName: string
  toName: string
  options: any
}>()

const emit = defineEmits<{
  (e: 'confirm', result: { fromName: string; toName: string }): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

function dispNameFn(name: any): string {
  return dispName(name, tr)
}

function profileByName(name: string) {
  return OmegaPac.Profiles.byName(name, props.options)
}
</script>

<template>
  <Teleport to="body">
    <div class="modal show" style="display: block;" tabindex="-1">
      <div class="modal-backdrop fade in" @click="emit('cancel')"></div>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" @click="emit('cancel')" class="close">
              <span aria-hidden="true">&times;</span>
              <span class="sr-only">{{ tr('dialog_close') }}</span>
            </button>
            <h4 class="modal-title">{{ tr('options_modalHeader_replaceProfile') }}</h4>
          </div>
          <div class="modal-body">
            <p v-html="tr('options_replaceProfileConfirm', [dispNameFn(fromName), dispNameFn(toName)])"></p>
            <div class="well">
              <span>{{ dispNameFn(fromName) }}</span>
              <span class="glyphicon glyphicon-chevron-right"></span>
              <span>{{ dispNameFn(toName) }}</span>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
            <button
              type="button"
              @click="emit('confirm', { fromName, toName })"
              class="btn btn-warning"
            >{{ tr('options_replaceProfile') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
