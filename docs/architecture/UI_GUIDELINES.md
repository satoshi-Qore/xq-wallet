# UI Guidelines — XQ Wallet

> **Status:** Approved  
> **Last updated:** 2026-06-25  
> **Authors:** XQ Wallet Engineering

---

## 1. Design Principles

XQ Wallet is a **premium** product. Every UI decision should reflect trust, clarity, and precision.

1. **Trust through clarity.** Financial interfaces must be unambiguous. Addresses, amounts, and confirmation states are always shown in full when it matters.
2. **Performance is UX.** Perceived performance (optimistic updates, skeleton states, instant feedback) is a first-class design concern.
3. **Calm, not cluttered.** Remove everything that does not directly serve the user's current task. Defaults are always safe.
4. **Accessible by default.** Accessibility is not an afterthought — it is part of the definition of "working."
5. **Dark mode is equal.** Dark mode receives the same visual quality as light mode. It is not a dimmed version of light mode.

---

## 2. Design Tokens

All visual values are defined as Tailwind config extensions and CSS custom properties. Engineers never use raw values — they use tokens.

### Colour Palette

The palette is defined in `tailwind.config.ts`. The full semantic token set lives in `src/app/globals.css` and `src/styles/variables.css`.

#### Brand (XQ Green)

| Token | Value | Usage |
|---|---|---|
| `brand-50` | `#f0fdf4` | Tinted backgrounds |
| `brand-100` | `#dcfce7` | Subtle highlights |
| `brand-500` | `#22c55e` | Primary action elements |
| `brand-600` | `#16a34a` | Primary button background |
| `brand-700` | `#15803d` | Hover state |
| `brand-900` | `#14532d` | Dark mode accent |

#### Semantic Colours (via CSS custom properties)

Do not hardcode these — use the CSS variable:

| Variable | Light | Dark | Usage |
|---|---|---|---|
| `--surface` | `hsl(0 0% 100%)` | `hsl(222 47% 6%)` | Page/card background |
| `--surface-subtle` | `hsl(0 0% 97%)` | `hsl(222 47% 9%)` | Input backgrounds, subtle sections |
| `--surface-elevated` | `hsl(0 0% 100%)` | `hsl(222 47% 12%)` | Modals, dropdowns |
| `--foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 98%)` | Primary text |
| `--muted` | `hsl(215 16% 47%)` | `hsl(215 20% 65%)` | Secondary text, placeholders |
| `--border` | `hsl(220 13% 91%)` | `hsl(217 33% 17%)` | Dividers, input borders |

#### Status Colours

Use Tailwind utilities for status — do not introduce new CSS variables for these:

| Status | Class | Usage |
|---|---|---|
| Success | `text-green-600` / `bg-green-50` | Confirmed transactions, success toasts |
| Warning | `text-amber-600` / `bg-amber-50` | Low balance warnings, slow network |
| Error | `text-red-600` / `bg-red-50` | Failed transactions, validation errors |
| Info | `text-blue-600` / `bg-blue-50` | Informational banners |

### Typography

Fonts are loaded via `next/font/google` in the root layout:

| Role | Variable | Family | Usage |
|---|---|---|---|
| Body / UI | `--font-sans` | Geist Sans | All UI text, labels, body copy |
| Addresses / Keys | `--font-mono` | Geist Mono | Wallet addresses, tx hashes, amounts, keys |

**Type scale** — use Tailwind's standard scale:

| Class | Size | Weight | Usage |
|---|---|---|---|
| `text-xs` | 12px | 400 | Timestamps, footnotes, metadata |
| `text-sm` | 14px | 400/500 | Secondary labels, descriptions |
| `text-base` | 16px | 400 | Body text |
| `text-lg` | 18px | 500/600 | Section headings, card titles |
| `text-2xl` | 24px | 600/700 | Page headings |
| `text-4xl` | 36px | 700 | Balance display, hero numbers |
| `text-5xl+` | 48px+ | 700 | Reserved for marketing/landing |

**Amounts and addresses always use `font-mono`.** This prevents character confusion (0/O, l/1/I) in a financial context.

### Spacing

Use Tailwind's default spacing scale. The most common spacing values in wallet UIs:

| Scale | px | Usage |
|---|---|---|
| `2` | 8px | Tight inline gaps |
| `3` | 12px | Small internal padding |
| `4` | 16px | Standard component padding |
| `6` | 24px | Card padding, section gaps |
| `8` | 32px | Page section spacing |
| `12` | 48px | Major section breaks |

Page gutters: `px-4 md:px-6 lg:px-8`.

### Border Radius

| Class | Usage |
|---|---|
| `rounded-md` (6px) | Inputs, small buttons |
| `rounded-lg` (8px) | Cards, standard buttons |
| `rounded-xl` (12px) | Modals, large containers |
| `rounded-full` | Avatar, badge, pill buttons |

---

## 3. Component Patterns

### Buttons

Four variants — choose the weakest appropriate variant:

| Variant | Class pattern | Usage |
|---|---|---|
| Primary | `bg-brand-600 hover:bg-brand-700 text-white` | The one main action per screen |
| Secondary | `border border-border bg-transparent hover:bg-surface-subtle` | Alternative action |
| Ghost | `text-brand-600 hover:bg-brand-50` | Tertiary action, navigation |
| Destructive | `bg-red-600 hover:bg-red-700 text-white` | Delete, revoke — always confirm |

**Rules:**
- One primary button per screen.
- Destructive actions require a confirmation step — never single-click delete.
- Buttons that trigger async operations must enter `isLoading` state immediately and disable themselves.
- Minimum touch target: 44×44px (Apple HIG / WCAG 2.5.5).

### Forms & Inputs

- Label is always visible — never use placeholder as the only label.
- Error messages appear below the input, in `text-red-600 text-sm`.
- Success state may be shown with a tick icon, not colour alone.
- Amount inputs: numeric keyboard on mobile (`inputMode="decimal"`), always `font-mono`.
- Address inputs: auto-trim whitespace on blur; validate format immediately.

### Address Display

Addresses are always displayed in `font-mono`. Long addresses are truncated in display but shown in full on hover (tooltip) and in confirmation dialogs.

```
Display:  0x1234...abcd    ← shortenAddress(address, 4)
Tooltip:  0x1234567890abcdef1234567890abcdef12345678
Copy:     full address copied to clipboard
```

A copy-to-clipboard button is mandatory wherever an address is displayed.

### Amounts & Balances

- Use `font-mono` for all amounts.
- Show the full precision on confirmation screens; use abbreviated format in lists.
- Always show the token symbol alongside the amount: `1.2345 XQ`.
- Fiat equivalent is shown below in a smaller, muted style: `≈ $12.34`.
- Use `BigInt` internally — never `float` for token arithmetic.

### Transaction Status Indicators

| Status | Visual |
|---|---|
| Pending | Spinner + `text-amber-600` "Pending" |
| Confirmed | Green tick + `text-green-600` "Confirmed" |
| Failed | Red X + `text-red-600` "Failed" |

---

## 4. Layout & Navigation

### Responsive breakpoints

```
Mobile:   < 768px  (md)  — single column, bottom nav
Tablet:   768px+   (md)  — sidebar may appear
Desktop:  1024px+  (lg)  — full sidebar always visible
```

Wallet core screens are designed mobile-first. The mobile layout is the source of truth; desktop adapts it.

### Navigation

- **Mobile:** Fixed bottom navigation bar (4 items max).
- **Desktop:** Fixed left sidebar with the same items.
- Active route is indicated by background highlight + brand colour icon.
- Never more than 2 levels of navigation depth.

---

## 5. Dark Mode

Dark mode is implemented via Tailwind's `class` strategy (not `media`). The `dark` class is toggled on `<html>` by `preferencesStore`.

**Rules:**
- Never use `bg-white` directly — use `bg-[hsl(var(--surface))]` or a component that uses it.
- Test every new component in both light and dark mode before marking it done.
- `dark:` variant must be applied to every colour utility that has a semantic equivalent.

---

## 6. Accessibility (WCAG 2.1 AA)

### Mandatory rules

- **Colour contrast:** All text must meet 4.5:1 (AA) against its background. Large text (18px+): 3:1 minimum.
- **Focus indicators:** Every interactive element must have a visible focus ring. Use `focus-visible:ring-2 focus-visible:ring-brand-500`.
- **Keyboard navigation:** All modals, dropdowns, and menus must be fully keyboard-navigable (Tab, Shift+Tab, Escape, Enter/Space).
- **ARIA:** Use semantic HTML first. Add ARIA only when semantic HTML is insufficient.
  - `role="dialog"` + `aria-modal="true"` on all modals
  - `aria-live="polite"` on balance update regions
  - `aria-label` on icon-only buttons
- **Skip link:** A "Skip to main content" link at the top of every page.
- **No colour-only information:** Status is always conveyed by text or icon + colour, never colour alone.

### Screen reader testing

Test with VoiceOver (macOS/iOS) and NVDA (Windows) before any screen is considered complete.

---

## 7. Motion & Animation

Wallet software should feel precise and calm — not playful. Use animation sparingly.

**Allowed animations:**
- Fade-in on page transition: `animate-fade-in` (200ms ease-in-out) — defined in Tailwind config
- Slide-up on modals: `animate-slide-up` (300ms ease-out)
- Spinner for loading states

**Prohibited:**
- Bounce, elastic, or spring animations
- Animations longer than 400ms
- Parallax or scroll-driven animation

**Always** respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This must be included in `globals.css`.

---

## 8. Copywriting Conventions

- **Error messages:** Describe what happened and what to do. Not "Error: 0x4001" — instead "Transaction failed. The network rejected the transaction. Please try again or reduce the amount."
- **Confirmation dialogs:** Lead with the consequence, not the action. Not "Delete account?" — instead "This will permanently remove the account from this device. You can restore it with your seed phrase."
- **Amounts:** Always include the unit. Never say "Send 1.5" — say "Send 1.5 XQ".
- **Addresses:** Show full address in confirmation steps, never truncated.
- **Button labels:** Use verb phrases: "Send", "Confirm", "Cancel", "Copy address". Not "OK" or "Yes".

---

## 9. Icon Usage

Icons are used to reinforce meaning — never as the sole conveyor of meaning.

- Icon library: TBD (Lucide React is the current candidate — already a peer dep of shadcn/ui).
- Icons must always have `aria-label` or an adjacent text label.
- Icon size in buttons: 16px (`size-4`) for sm/md buttons; 20px (`size-5`) for lg buttons.
- Decorative icons (not conveying information) get `aria-hidden="true"`.
