<template>
  <span
    class="glyphicon"
    :class="[iconClass, { 'virtual-profile-icon': isVirtual }]"
    :style="{ color: colorValue }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getProfileIcon, getProfileColor } from '../composables/useProfileIcons'

const props = defineProps<{
  profile?: any
  icon?: string
  color?: string
  options?: any
}>()

const isVirtual = computed(() => props.profile?.profileType === 'VirtualProfile')

const iconClass = computed(() => props.icon || getProfileIcon(props.profile, props.options))

const colorValue = computed(() => props.color || getProfileColor(props.profile, props.options))
</script>
