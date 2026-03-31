<template>
  <input
    ref="fileInput"
    type="file"
    @change="onFileChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  success: [content: string]
  error: [error: any]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange() {
  const input = fileInput.value
  if (!input || input.files!.length === 0 || input.files![0].name.length === 0) {
    return
  }

  const reader = new FileReader()
  reader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
    emit('success', e.target!.result as string)
  })
  reader.addEventListener('error', (e: ProgressEvent<FileReader>) => {
    emit('error', e.target!.error)
  })
  reader.readAsText(input.files![0])
  input.value = ''
}
</script>
