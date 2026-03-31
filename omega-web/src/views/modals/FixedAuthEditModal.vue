<script setup lang="ts">
import { ref } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'

const props = defineProps<{
  auth: { username: string; password: string }
  authSupported: boolean
  protocolDisp: string
}>()

const emit = defineEmits<{
  (e: 'confirm', auth: { username: string; password: string }): void
  (e: 'cancel'): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

const username = ref(props.auth?.username ?? '')
const password = ref(props.auth?.password ?? '')
const showPassword = ref(false)

function submit() {
  emit('confirm', { username: username.value, password: password.value })
}
</script>

<template>
  <Teleport to="body">
    <div class="modal show" style="display: block;" tabindex="-1">
      <div class="modal-backdrop fade in" @click="emit('cancel')"></div>
      <div class="modal-dialog" :class="authSupported ? 'modal-sm' : 'modal-lg'">
        <div class="modal-content">
          <form @submit.prevent="submit()">
            <div class="modal-header">
              <button type="button" @click="emit('cancel')" class="close">
                <span aria-hidden="true">&times;</span>
                <span class="sr-only">Close</span>
              </button>
              <h4 class="modal-title">{{ tr('options_modalHeader_proxyAuth') }}</h4>
            </div>
            <div style="padding-bottom: 0;" class="modal-body">
              <div v-show="!authSupported" class="form-group">
                <div class="alert alert-danger">
                  <span class="glyphicon glyphicon-warning-sign"></span>
                  {{ tr('options_proxy_authNotSupported', [protocolDisp]) }}
                </div>
              </div>
              <div class="form-group">
                <label class="sr-only">{{ tr('options_proxyAuthUsername') }}</label>
                <div class="input-group">
                  <input
                    type="text"
                    v-model="username"
                    autofocus
                    :placeholder="tr('options_proxyAuthUsername')"
                    class="form-control"
                  >
                  <span class="input-group-btn">
                    <button
                      type="button"
                      @click="username = ''"
                      :disabled="!username"
                      class="btn btn-default"
                    >
                      <span class="glyphicon glyphicon-remove"></span>
                    </button>
                  </span>
                </div>
              </div>
              <div class="form-group">
                <label class="sr-only">{{ tr('options_proxyAuthPassword') }}</label>
                <div class="input-group">
                  <input
                    v-if="!!username"
                    :type="showPassword ? 'text' : 'password'"
                    v-model="password"
                    :placeholder="tr('options_proxyAuthPassword')"
                    class="form-control"
                  >
                  <input
                    v-if="!username"
                    type="text"
                    value=""
                    :placeholder="tr('options_proxyAuthNone')"
                    disabled
                    class="form-control"
                  >
                  <span class="input-group-btn">
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      :title="tr(showPassword ? 'options_proxyAuthHidePassword' : 'options_proxyAuthShowPassword')"
                      :disabled="!username"
                      class="btn btn-default"
                    >
                      <span :class="!showPassword ? 'glyphicon glyphicon-eye-close' : 'glyphicon glyphicon-eye-open'"></span>
                    </button>
                  </span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" @click="emit('cancel')" class="btn btn-default">{{ tr('dialog_cancel') }}</button>
              <button type="submit" class="btn btn-primary">{{ tr('dialog_save') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
