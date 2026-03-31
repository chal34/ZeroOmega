<template>
  <div
    v-if="visible && alert"
    class="alert alert-dismissible"
    :class="`alert-${alert.type || 'warning'}`"
    role="alert"
  >
    <button type="button" class="close" aria-label="Close" @click="emit('close')">
      <span aria-hidden="true">&times;</span>
    </button>
    <span
      v-if="alert.type === 'danger'"
      class="glyphicon glyphicon-exclamation-sign"
    />
    <span
      v-else-if="alert.type === 'success'"
      class="glyphicon glyphicon-ok-sign"
    />
    <span
      v-else
      class="glyphicon glyphicon-info-sign"
    />
    {{ ' ' }}
    <span v-if="alert.i18n">{{ alert.i18n }}</span>
    <span v-else>{{ alert.message }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  alert?: {
    type?: string
    message?: string
    i18n?: string
  }
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
