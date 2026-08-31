import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExportControls from './ExportControls.vue'
import i18n from '../i18n'
import { useConfigStore } from '../store/config'
import {
  exportToICS,
  exportToImage,
  exportToJSON,
  importFromJSON
} from '../utils/export-utils'

vi.mock('../utils/export-utils', () => ({
  exportToICS: vi.fn(),
  exportToImage: vi.fn(),
  exportToJSON: vi.fn(),
  importFromJSON: vi.fn()
}))

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function findButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('ExportControls modal and toast flows', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-01-01', localName: 'Ano Novo', global: true }]
    }) as any
  })

  it('exports ICS and shows success toast', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(ExportControls, {
      global: { plugins: [pinia, i18n] }
    })

    await wrapper.find('button').trigger('click')
    const exportButton = findButtonByText(wrapper, 'Exportar para Calendário')
    expect(exportButton).toBeTruthy()

    await exportButton!.trigger('click')

    expect(exportToICS).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Exportação concluída!')
  })

  it('asks for in-app confirmation before import and applies imported data on confirm', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useConfigStore()

    ;(importFromJSON as any).mockResolvedValue({
      markedDays: ['2026-06-03'],
      maxVacationDays: 24,
      carryOverDays: 2,
      year: 2027,
      locale: 'en',
      theme: 'dark'
    })

    const wrapper = mount(ExportControls, {
      global: { plugins: [pinia, i18n] }
    })

    await wrapper.find('button').trigger('click')
    const importButton = findButtonByText(wrapper, 'Importar Dados')
    expect(importButton).toBeTruthy()
    await importButton!.trigger('click')

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await fileInput.trigger('change')

    expect(wrapper.text()).toContain('Confirmar importação')

    const confirmButton = findButtonByText(wrapper, 'Confirmar')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(importFromJSON).toHaveBeenCalledWith(file)
    expect(store.markedDays.has('2026-06-03')).toBe(true)
    expect(store.maxVacationDays).toBe(24)
    expect(store.carryOverDays).toBe(2)
    expect(store.year).toBe(2027)
    expect(store.locale).toBe('en')
    expect(store.theme).toBe('dark')
    expect(wrapper.text()).toContain('Importação concluída!')
  })
  it('imports zero-valued vacation settings', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useConfigStore()
    store.maxVacationDays = 24
    store.carryOverDays = 3

    vi.mocked(importFromJSON).mockResolvedValue({
      markedDays: [],
      maxVacationDays: 0,
      carryOverDays: 0
    })

    const wrapper = mount(ExportControls, {
      global: { plugins: [pinia, i18n] }
    })

    await wrapper.find('button').trigger('click')
    await findButtonByText(wrapper, 'Importar Dados')!.trigger('click')

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await fileInput.trigger('change')
    await findButtonByText(wrapper, 'Confirmar')!.trigger('click')
    await flushPromises()

    expect(store.maxVacationDays).toBe(0)
    expect(store.carryOverDays).toBe(0)
  })


  it('cancels import without calling parser and keeps confirm closed', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(ExportControls, {
      global: { plugins: [pinia, i18n] }
    })

    await wrapper.find('button').trigger('click')
    const importButton = findButtonByText(wrapper, 'Importar Dados')
    await importButton!.trigger('click')

    const fileInput = wrapper.find('input[type="file"]')
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await fileInput.trigger('change')

    const cancelButton = findButtonByText(wrapper, 'Cancelar')
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')

    expect(importFromJSON).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Confirmar importação')
  })

  it('shows error toast when image export fails', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    ;(exportToImage as any).mockRejectedValue(new Error('fail'))

    const wrapper = mount(ExportControls, {
      global: { plugins: [pinia, i18n] }
    })

    await wrapper.find('button').trigger('click')
    const imageButton = findButtonByText(wrapper, 'Guardar como Imagem')
    expect(imageButton).toBeTruthy()

    await imageButton!.trigger('click')
    await flushPromises()

    expect(exportToImage).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Falha ao exportar o ficheiro.')
    expect(exportToJSON).not.toHaveBeenCalled()
  })
})
