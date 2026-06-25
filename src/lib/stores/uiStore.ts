/**
 * uiStore — ephemeral UI state: modals, toasts, sidebar.
 * Resets on page reload. Never persisted.
 *
 * Architecture: STATE_MANAGEMENT.md §2.4
 */

import { create } from 'zustand'

// ─── Types ─────────────────────────────────────────────────────────────────

export type ModalId =
  | 'confirm-send'
  | 'receive-qr'
  | 'export-key'
  | 'delete-account'
  | null

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** Duration in ms. 0 = persist until dismissed. Default: 4000 */
  duration?: number
}

export interface UIState {
  // ── Modal ────────────────────────────────────────────────────────────────
  activeModal: ModalId
  modalProps: Record<string, unknown>

  // ── Toasts ───────────────────────────────────────────────────────────────
  toasts: Toast[]

  // ── Navigation ───────────────────────────────────────────────────────────
  /** Controls the mobile sidebar drawer. Desktop sidebar is always visible. */
  isSidebarOpen: boolean

  // Actions
  openModal: (id: NonNullable<ModalId>, props?: Record<string, unknown>) => void
  closeModal: () => void
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  toggleSidebar: () => void
  closeSidebar: () => void
}

// ─── Store ─────────────────────────────────────────────────────────────────

let toastIdCounter = 0

export const useUIStore = create<UIState>()((set) => ({
  // Defaults
  activeModal: null,
  modalProps: {},
  toasts: [],
  isSidebarOpen: false,

  // Actions
  openModal: (id, props = {}) => set({ activeModal: id, modalProps: props }),
  closeModal: () => set({ activeModal: null, modalProps: {} }),

  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `toast-${++toastIdCounter}` },
      ],
    })),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}))
