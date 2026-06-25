# Component Architecture — XQ Wallet

> **Status:** Approved  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering

---

## 1. Guiding Principles

1. **Single responsibility.** Each component does exactly one thing.
2. **Props down, events up.** Data flows down via props; user intent flows up via callbacks.
3. **No business logic in components.** Components call hooks; hooks own logic.
4. **Composition over inheritance.** Build complex UI from simple, composable primitives.
5. **Accessibility by default.** Every interactive component is keyboard-navigable and screen-reader friendly before styling.
6. **No inline styles.** Use Tailwind utility classes or CSS custom properties only.

---

## 2. Component Taxonomy

XQ Wallet uses a four-tier component hierarchy, mirroring the `src/components/` folder structure.

### Tier 1 — Primitives (`src/components/ui/`)

Pure presentational atoms. No state. No side effects. No direct hook calls (except `useState` for internal UI state like hover/focus).

**Characteristics:**
- Accept explicit props — no implicit context reads (with the sole exception of theme context)
- Fully typed `Props` interface exported alongside the component
- ARIA attributes must be explicit or forwarded via `...rest`
- Covered by visual snapshot tests

**Examples:**

```
ui/
├── Button/
│   ├── Button.tsx
│   ├── Button.test.tsx
│   └── index.ts
├── Input/
├── Badge/
├── Card/
├── Spinner/
├── Modal/
├── Tooltip/
├── Avatar/
└── Divider/
```

**Anatomy of a primitive:**

```tsx
// src/components/ui/Button/Button.tsx

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps) { ... }
```

### Tier 2 — Layout Components (`src/components/layout/`)

Structural components that compose the page shell. May read from theme or navigation context. Do not read wallet state.

**Examples:**

```
layout/
├── AppShell/          ← root layout wrapper
├── Header/
├── Sidebar/
├── BottomNav/         ← mobile navigation
├── PageContainer/     ← max-width + padding wrapper
└── SectionHeader/
```

### Tier 3 — Shared / Domain Components (`src/components/shared/`)

Composite components that combine primitives with domain knowledge. May read from wallet state via hooks. Do not own state themselves — they consume it.

**Examples:**

```
shared/
├── AddressDisplay/    ← shows shortened + full address, copy button
├── TokenAmount/       ← formats + displays a token balance with symbol
├── NetworkBadge/      ← shows current network with status indicator
├── TransactionRow/    ← single transaction in a list
├── GasFeeEstimate/    ← displays fee estimate with USD equivalent
└── QRCodeDisplay/     ← renders QoreChain address as QR code
```

### Tier 4 — Feature Modules (`src/app/**/`)

Page-level and route-level components. These are Next.js route segments (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`). They assemble layout and shared components, and may call multiple hooks.

```
app/
├── (wallet)/              ← authenticated route group
│   ├── layout.tsx         ← wallet shell (sidebar, header)
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── loading.tsx
│   ├── send/
│   │   ├── page.tsx
│   │   └── _components/   ← co-located, route-private components
│   │       ├── SendForm.tsx
│   │       └── ConfirmationModal.tsx
│   ├── receive/
│   ├── history/
│   └── settings/
├── (onboarding)/          ← unauthenticated route group
│   ├── layout.tsx
│   ├── create/
│   └── import/
└── (marketing)/           ← static, server-rendered
    └── page.tsx           ← landing page
```

---

## 3. File & Naming Conventions

### File naming

| Pattern | Usage |
|---|---|
| `PascalCase.tsx` | React component |
| `PascalCase.test.tsx` | Component unit test |
| `camelCase.ts` | Non-component module |
| `camelCase.test.ts` | Module unit test |
| `index.ts` | Barrel export |
| `_components/` | Private components, co-located with their route |

### Component file structure (within a component folder)

```
Button/
├── Button.tsx          ← component implementation
├── Button.test.tsx     ← tests
└── index.ts            ← re-exports: export { Button } from './Button'
```

Single-file components (under ~60 lines) may skip the folder and live as `Button.tsx` directly.

### Naming rules

- Component names are **PascalCase** and match the filename.
- Props interfaces are named `<ComponentName>Props`.
- Internal sub-components (not exported) are named with a `_` prefix: `_DropdownItem`.
- Event handler props are named `on<Event>`: `onConfirm`, `onClose`, `onChange`.
- Boolean props use `is` / `has` / `can` prefix: `isLoading`, `hasError`, `canSubmit`.

---

## 4. Hook Architecture

Hooks are the bridge between components and business logic. They live in `src/hooks/`.

### Hook categories

| Category | Location | Responsibility |
|---|---|---|
| **Data hooks** | `src/hooks/` | Fetch and subscribe to chain data via TanStack Query |
| **Mutation hooks** | `src/hooks/` | Execute write operations (send tx, sign message) |
| **Wallet hooks** | `src/hooks/` | Read from Zustand wallet store |
| **UI hooks** | `src/hooks/` | Generic UI utilities (useDebounce, useMediaQuery, useClipboard) |
| **Form hooks** | co-located with feature | React Hook Form setup + Zod schema for a specific form |

### Hook naming

```
use<Subject><Action?>

useBalance          ← data hook: reads balance
useTransaction      ← data hook: reads a transaction
useSendTransaction  ← mutation hook: sends a transaction
useWallet           ← wallet store hook
useClipboard        ← UI utility hook
```

### Hook contract

Every hook must:
1. Export its return type explicitly.
2. Handle the loading and error states — never expose raw promises.
3. Not have side effects that outlive the component (cleanup in `useEffect` return).

---

## 5. Context Usage

React Context is used **sparingly** — only for cross-cutting concerns that are genuinely global.

| Context | Location | Purpose |
|---|---|---|
| `ThemeContext` | `src/lib/theme/` | Light/dark mode preference |
| `WalletSessionContext` | `src/lib/wallet/` | Locked/unlocked session state (boolean + session token) |

**Do not** use Context for: wallet balances, transaction lists, settings, or any data that changes on a timer. Use TanStack Query or Zustand for these.

---

## 6. Rendering Strategy

| Route Group | Rendering | Reason |
|---|---|---|
| `(marketing)` | Static (SSG) | Public landing pages; can be fully pre-rendered |
| `(onboarding)` | Client-side | Mnemonic generation must happen in the browser |
| `(wallet)` | Client-side | All wallet screens contain sensitive state; must not be server-rendered |

All wallet-sensitive pages must include:

```tsx
'use client'
```

at the top of the file. This is enforced by an ESLint rule (to be added in Phase 1 setup).

---

## 7. Error Boundaries

Each route group has an `error.tsx` boundary:

```
app/
├── (wallet)/
│   ├── error.tsx      ← catches wallet feature errors
│   └── ...
└── error.tsx          ← catches global errors
```

Error boundaries must:
- Log to the structured logger (not `console.error` directly)
- Display a user-friendly message — never raw error details
- Offer a recovery action (retry or go home)
- Never show stack traces in production

---

## 8. Loading States

Use Next.js `loading.tsx` files for route-level Suspense boundaries. Within a component, use the `isLoading` prop pattern on primitives rather than conditional rendering of skeletons at the feature level.

```
dashboard/
├── page.tsx
└── loading.tsx    ← renders skeleton while page data loads
```

---

## 9. Component Checklist

Before a component is considered complete:

- [ ] Props interface defined and exported
- [ ] All interactive elements are keyboard-accessible (`tabIndex`, `onKeyDown`)
- [ ] ARIA roles/labels applied where semantic HTML is insufficient
- [ ] Loading, empty, and error states handled
- [ ] No business logic or direct chain calls
- [ ] No hardcoded strings — strings from `src/config/strings.ts`
- [ ] Unit test written covering the primary interaction
- [ ] Works in both light and dark mode
