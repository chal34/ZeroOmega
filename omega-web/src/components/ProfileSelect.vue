<template>
  <div class="btn-group omega-profile-select" :class="{ open: isOpen }">
    <button
      type="button"
      class="btn btn-default dropdown-toggle"
      role="listbox"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <ProfileIcon
        :profile="selectedProfile"
        :options="options"
        :icon="selectedProfile ? undefined : 'glyphicon-time'"
      />
      <span v-if="modelValue">{{ getName(selectedProfile) }}</span>
      <span v-else>{{ defaultText }}</span>
      <span class="caret" />
    </button>
    <ul v-if="dispProfiles" role="listbox" class="dropdown-menu">
      <li
        v-if="defaultText"
        role="option"
        :class="{ active: modelValue === '' }"
      >
        <a @click.prevent="setProfileName('')">
          <span class="glyphicon glyphicon-time" />
          {{ defaultText }}
        </a>
      </li>
      <li
        v-for="p in dispProfiles"
        :key="p.name"
        role="option"
        :class="{ active: modelValue === p.name }"
      >
        <a @click.prevent="setProfileName(p.name)">
          <ProfileIcon :profile="p" :options="options" />
          {{ getName(p) }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import ProfileIcon from './ProfileIcon.vue'

const props = withDefaults(defineProps<{
  modelValue: string
  profiles: any[]
  options?: any
  defaultText?: string
  dispName?: (profile: any) => string
}>(), {
  defaultText: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const dispProfiles = ref<any[] | null>(null)

const selectedProfile = computed(() => {
  return props.profiles?.find((p: any) => p.name === props.modelValue) ?? null
})

function getName(profile: any) {
  if (!profile) return ''
  if (props.dispName) {
    return props.dispName(profile) || profile.name
  }
  return profile.name
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value && dispProfiles.value == null) {
    dispProfiles.value = props.profiles || []
  }
}

function setProfileName(name: string) {
  emit('update:modelValue', name)
  isOpen.value = false
}

watch(() => props.profiles, (profiles) => {
  if (dispProfiles.value != null) {
    dispProfiles.value = profiles || []
  }
}, { deep: true })

function onClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement)
  if (!el.closest('.omega-profile-select')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})
</script>
