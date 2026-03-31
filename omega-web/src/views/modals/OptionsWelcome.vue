<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'

const props = defineProps<{
  upgrade?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', action: string): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
</script>

<template>
  <Teleport to="body">
    <div class="modal show" style="display: block;" tabindex="-1">
      <div class="modal-backdrop fade in opacity-half"></div>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" @click="emit('cancel')" class="close">
              <span aria-hidden="true">&times;</span>
              <span class="sr-only">{{ tr('dialog_close') }}</span>
            </button>
            <h4 class="modal-title">{{ tr('options_modalHeader_welcome') }}</h4>
          </div>
          <div class="modal-body">
            <p v-show="upgrade">{{ tr('options_welcomeUpgrade') }}</p>
            <p v-show="upgrade">{{ tr('options_welcomeUpgradeGuide') }}</p>
            <p v-show="!upgrade">{{ tr('options_welcomeNormal') }}</p>
            <p v-show="!upgrade">{{ tr('options_welcomeNormalGuide') }}</p>
          </div>
          <div class="modal-footer">
            <button @click="emit('confirm', 'skip')" class="btn btn-default">{{ tr('options_guideSkip') }}</button>
            <button type="button" @click="emit('confirm', 'show')" class="btn btn-primary">{{ tr('options_guideNext') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
