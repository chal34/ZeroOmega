<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { dispName } from '../../composables/useProfiles'

const props = defineProps<{
  refs: any[]
  options: any
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

function dispNameFn(name: any): string {
  return dispName(name, tr)
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
            <h4 class="modal-title">{{ tr('options_modalHeader_cannotDeleteProfile') }}</h4>
          </div>
          <div class="modal-body">
            <p>{{ tr('options_profileReferredBy') }}</p>
            <div class="well">
              <ul class="list-style-none">
                <li v-for="(p, idx) in refs" :key="idx">
                  <span>{{ dispNameFn(p) }}</span>
                </li>
              </ul>
            </div>
            <p>{{ tr('options_modifyReferringProfiles') }}</p>
          </div>
          <div class="modal-footer">
            <button @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
