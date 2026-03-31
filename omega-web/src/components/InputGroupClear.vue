<template>
  <div class="input-group">
    <input
      :value="modelValue"
      :type="type || 'text'"
      :pattern="pattern?.source"
      :placeholder="placeholder"
      class="form-control"
      @input="onInput"
    />
    <span class="input-group-btn">
      <button
        type="button"
        class="btn btn-default input-group-clear-btn"
        :disabled="!modelValue && !oldModel"
        :title="oldModel ? 'Restore' : 'Clear'"
        @click="toggleClear"
      >
        <span
          class="glyphicon"
          :class="oldModel ? 'glyphicon-repeat' : 'glyphicon-remove'"
        />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  type?: string
  pattern?: RegExp
  placeholder?: string
}>(), {
  type: 'text',
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const oldModel = ref('')

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  if (value) {
    oldModel.value = ''
  }
}

function toggleClear() {
  const tmp = oldModel.value
  oldModel.value = props.modelValue
  emit('update:modelValue', tmp)
}
</script>
