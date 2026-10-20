<script setup lang="ts">
import 'vue-sonner/style.css'
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator color="var(--primary)" :height="2" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster rich-colors position="top-center" />
  <AppDialogHost />
</template>
