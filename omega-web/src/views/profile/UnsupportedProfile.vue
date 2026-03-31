<script setup lang="ts">
import { useOmegaTarget } from '../../composables/useOmegaTarget'

const props = defineProps<{
  profile: any
  options: any
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
</script>

<template>
  <div>
    <div class="lead">{{ tr('options_profileUnsupported', [profile.profileType]) }}</div>
    <p>{{ tr('options_profileUnsupportedHelp') }}</p>
  </div>
</template>
