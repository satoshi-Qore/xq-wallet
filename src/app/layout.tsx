import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClientProviders } from '@/lib/providers'
import './globals.css'

/* ─── Fonts ──────────────────────────────────────────────────────────────── */

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

/* ─── Metadata ───────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: {
    default: 'XQ Wallet',
    template: '%s | XQ Wallet',
  },
  description: 'A premium, open-source, non-custodial wallet for the QoreChain ecosystem.',
  keywords: ['wallet', 'QoreChain', 'crypto', 'non-custodial', 'web3', 'blockchain'],
  authors: [{ name: 'XQ Wallet Contributors' }],
  robots: {
    index: false, // Wallet UI should not be indexed
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/* ─── Root Layout ────────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
