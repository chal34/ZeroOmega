<template>
  <span class="profile-inline">
    <ProfileIcon :profile="profile" :options="options" />
    {{ displayName }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProfileIcon from './ProfileIcon.vue'

const props = defineProps<{
  profile: any
  icon?: string
  options?: any
  dispName?: (profile: any) => string
}>()

const displayName = computed(() => {
  if (props.dispName) {
    return props.dispName(props.profile) || props.profile?.name
  }
  return props.profile?.name
})
</script>
