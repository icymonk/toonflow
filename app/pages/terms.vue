<script setup lang="ts">
import { terms } from '~/locales/legal'

definePageMeta({ layout: false })
</script>

<template>
  <AppLegalPage :doc="terms" />
</template>
