import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unlock — XQ Wallet',
}

export default function LockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
