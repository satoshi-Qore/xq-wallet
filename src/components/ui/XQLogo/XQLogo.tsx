/**
 * XQLogo — XQ Wallet brand mark.
 *
 * Used in Sidebar, MobileSidebarDrawer, and any branded surface.
 * aria-hidden by default — purely decorative beside the app name text.
 */

export function XQLogo() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
    >
      XQ
    </div>
  )
}
