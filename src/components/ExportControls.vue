<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Calendar, Image as ImageIcon, Database, Upload, Loader2 } from 'lucide-vue-next'
import { exportToICS, exportToImage, exportToJSON, importFromJSON } from '../utils/export-utils'
import { useConfigStore } from '../store/config'
import ConfirmDialog from './ui/ConfirmDialog.vue'
import ToastMessage from './ui/ToastMessage.vue'

const { t } = useI18n()
const store = useConfigStore()
const isOpen = ref(false)
const isExportingImage = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingImportFile = ref<File | null>(null)
const confirmImportOpen = ref(false)
const toastOpen = ref(false)
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'info'>('info')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  toastMessage.value = message
  toastType.value = type
  toastOpen.value = true

  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastOpen.value = false
    toastMessage.value = ''
  }, 2200)
}

const handleExportICS = () => {
  exportToICS(Array.from(store.markedDays), store.year, t)
  showToast(t('export.successExport'), 'success')
  isOpen.value = false
}

const handleExportImage = async () => {
  try {
    isExportingImage.value = true
    await exportToImage('year-grid-container', `vacations_${store.year}.png`)
    showToast(t('export.successExport'), 'success')
    isOpen.value = false
  } catch {
    showToast(t('export.exportError'), 'error')
  } finally {
    isExportingImage.value = false
  }
}

const handleExportJSON = () => {
  const data = {
    markedDays: Array.from(store.markedDays),
    selectedMunicipalityId: store.selectedMunicipalityId,
    maxVacationDays: store.maxVacationDays,
    carryOverDays: store.carryOverDays,
    year: store.year,
    theme: store.theme,
    locale: store.locale
  }
  exportToJSON(data, `vacations_backup_${store.year}.json`)
  showToast(t('export.successExport'), 'success')
  isOpen.value = false
}

const triggerImport = () => {
  fileInput.value?.click()
}

const handleImportJSON = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  pendingImportFile.value = file
  confirmImportOpen.value = true
  target.value = ''
}

const cancelImport = () => {
  confirmImportOpen.value = false
  pendingImportFile.value = null
}

const confirmImport = async () => {
  const file = pendingImportFile.value
  if (!file) {
    confirmImportOpen.value = false
    return
  }

  try {
    const data = await importFromJSON(file)

    if (data.markedDays) store.markedDays = new Set(data.markedDays)
    if (data.selectedMunicipalityId !== undefined) store.selectedMunicipalityId = data.selectedMunicipalityId
    if (data.maxVacationDays !== undefined) store.maxVacationDays = data.maxVacationDays
    if (data.carryOverDays !== undefined) store.carryOverDays = data.carryOverDays
    if (data.year) store.year = data.year
    if (data.theme) store.theme = data.theme
    if (data.locale) store.locale = data.locale

    showToast(t('export.successImport'), 'success')
    isOpen.value = false
  } catch {
    showToast(t('export.importError'), 'error')
  } finally {
    pendingImportFile.value = null
    confirmImportOpen.value = false
  }
}
</script>

<template>
  <div class="relative inline-block">
    <ToastMessage :open="toastOpen" :message="toastMessage" :type="toastType" />

    <button
      @click="isOpen = !isOpen"
      class="py-[10px] px-3 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 transition-colors flex items-center justify-center"
      :title="t('export.title')"
      :aria-label="t('export.title')"
    >
      <Download class="w-4 h-4" role="img" :aria-label="t('export.title')" />
      <span class="hidden md:inline text-sm font-medium ml-2">{{ t('export.action') }}</span>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-[100] transform transition-all"
    >
      <button
        @click="handleExportICS"
        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
      >
        <Calendar class="w-4 h-4 text-blue-500" />
        {{ t('export.calendar') }}
      </button>

      <button
        @click="handleExportImage"
        :disabled="isExportingImage"
        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left disabled:opacity-50"
      >
        <Loader2 v-if="isExportingImage" class="w-4 h-4 animate-spin text-green-500" />
        <ImageIcon v-else class="w-4 h-4 text-green-500" />
        {{ isExportingImage ? t('export.exporting') : t('export.image') }}
      </button>

      <div class="my-1 border-t border-gray-100 dark:border-gray-700"></div>

      <button
        @click="handleExportJSON"
        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
      >
        <Database class="w-4 h-4 text-amber-500" />
        {{ t('export.json') }}
      </button>

      <button
        @click="triggerImport"
        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
      >
        <Upload class="w-4 h-4 text-purple-500" />
        {{ t('export.import') }}
      </button>

      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImportJSON"
      />

    </div>

    <!-- Backdrop to close -->
    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-[-1]"
    ></div>

    <ConfirmDialog
      :open="confirmImportOpen"
      :title="t('export.importConfirmTitle')"
      :message="t('export.importConfirm')"
      :confirm-label="t('common.confirm')"
      :cancel-label="t('common.cancel')"
      @confirm="confirmImport"
      @cancel="cancelImport"
    />
  </div>
</template>
