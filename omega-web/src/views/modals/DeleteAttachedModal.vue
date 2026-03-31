<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'

const props = defineProps<{
  attached: any
  options: any
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

function ruleListLineCount(): number {
  if (props.attached?.ruleList) {
    return props.attached.ruleList.split('\n').length
  }
  return 0
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
            <h4 class="modal-title">{{ tr('options_modalHeader_deleteAttached') }}</h4>
          </div>
          <div class="modal-body">
            <p>{{ tr('options_deleteAttachedConfirm') }}</p>
            <div class="well">
              {{ attached.sourceUrl || tr('options_ruleListLineCount', [String(ruleListLineCount())]) }}
            </div>
          </div>
          <div class="modal-footer">
            <button @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
            <button type="button" @click="emit('confirm')" class="btn btn-danger">{{ tr('options_deleteAttached') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
