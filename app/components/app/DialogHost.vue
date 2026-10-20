<script setup lang="ts">
import { ko } from '~/locales/ko'

const current = computed(() => dialogQueue.value[0] ?? null)
const value = ref('')
watch(current, (req) => {
  if (req?.kind === 'prompt') value.value = req.value
})

function close(open: boolean) {
  if (!open && current.value) settleDialog(current.value, null)
}
function ok() {
  if (!current.value) return
  settleDialog(current.value, current.value.kind === 'prompt' ? value.value : true)
}
</script>

<template>
  <AlertDialog :open="current?.kind === 'confirm'" @update:open="close">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="text-base leading-relaxed font-normal whitespace-pre-line">
          {{ current?.message }}
        </AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ ko.dialog.cancel }}</AlertDialogCancel>
        <Button @click="ok">
          {{ ko.dialog.ok }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  <Dialog :open="current?.kind === 'prompt'" @update:open="close">
    <DialogContent class="sm:max-w-sm" :show-close-button="false">
      <form class="flex flex-col gap-4" @submit.prevent="ok">
        <DialogHeader>
          <DialogTitle class="text-base leading-relaxed font-normal whitespace-pre-line">
            {{ current?.message }}
          </DialogTitle>
          <DialogDescription class="sr-only">
            {{ current?.message }}
          </DialogDescription>
        </DialogHeader>
        <Input v-model="value" :aria-label="current?.message" autofocus />
        <DialogFooter>
          <Button type="button" variant="outline" @click="close(false)">
            {{ ko.dialog.cancel }}
          </Button>
          <Button type="submit">
            {{ ko.dialog.ok }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
