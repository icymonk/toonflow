<script setup lang="ts">
import { dataDeletion } from '~/locales/legal'

definePageMeta({ layout: false })
</script>

<template>
  <AppLegalPage :doc="dataDeletion" />
</template>
