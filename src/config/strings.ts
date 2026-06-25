/**
 * UI string definitions — all user-facing text lives here.
 * Never hardcode strings in component files.
 * Designed for future i18n extraction (Phase 2).
 *
 * Architecture: SYSTEM_ARCHITECTURE.md §7 (Internationalisation)
 */

// ─── App ───────────────────────────────────────────────────────────────────

export const APP = {
  name: 'XQ Wallet',
  tagline: 'Your keys. Your assets. Your chain.',
  description: 'A premium, open-source, non-custodial wallet for the QoreChain ecosystem.',
} as const

// ─── Navigation ────────────────────────────────────────────────────────────

export const NAV = {
  openMenu: 'Open navigation menu',
  closeMenu: 'Close navigation menu',
  skipToMain: 'Skip to main content',
} as const

// ─── Dashboard ─────────────────────────────────────────────────────────────

export const DASHBOARD = {
  title: 'Dashboard',
  balanceLabel: 'Total Balance',
  balancePlaceholder: '-- XQ',
  connectPrompt: 'Create or import a wallet to view your balance.',
  quickActions: 'Quick Actions',
  recentActivity: 'Recent Activity',
  noActivity: 'No transactions yet',
  noActivityDescription: 'Your transaction history will appear here once you start using your wallet.',
} as const

// ─── Stub pages ────────────────────────────────────────────────────────────

export const STUBS = {
  comingSoon: 'Coming in Sprint 2',
  send: {
    title: 'Send XQ',
    description: 'Send XQ tokens to any QoreChain address. This feature will be available once your wallet is set up.',
  },
  receive: {
    title: 'Receive XQ',
    description: 'Share your QoreChain address or QR code to receive XQ tokens.',
  },
  history: {
    title: 'Transaction History',
    description: 'Your full transaction history with status, amounts, and timestamps.',
  },
  settings: {
    title: 'Settings',
    description: 'Manage your wallet preferences, security settings, and network configuration.',
  },
} as const

// ─── Network ───────────────────────────────────────────────────────────────

export const NETWORK = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  devnet: 'Devnet',
  connected: 'Connected',
  disconnected: 'Disconnected',
  degraded: 'Degraded',
} as const

// ─── Theme ─────────────────────────────────────────────────────────────────

export const THEME = {
  toggleLight: 'Switch to light mode',
  toggleDark: 'Switch to dark mode',
  toggleSystem: 'Use system theme',
} as const

// ─── Errors ────────────────────────────────────────────────────────────────

export const ERRORS = {
  generic: 'Something went wrong. Please try again.',
  tryAgain: 'Try again',
  goHome: 'Go to dashboard',
} as const
