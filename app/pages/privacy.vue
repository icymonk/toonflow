<script setup lang="ts">
import { privacy } from '~/locales/legal'

definePageMeta({ layout: false })
</script>

<template>
  <AppLegalPage :doc="privacy" />
</template>
