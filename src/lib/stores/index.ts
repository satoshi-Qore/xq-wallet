/**
 * Barrel export for all Zustand stores.
 * Import stores from here, not from their individual files.
 */

export { usePreferencesStore } from './preferencesStore'
export type { PreferencesState, Theme, FiatCurrency, AutoLockMinutes } from './preferencesStore'

export { useUIStore } from './uiStore'
export type { UIState, Toast, ToastVariant, ModalId } from './uiStore'
