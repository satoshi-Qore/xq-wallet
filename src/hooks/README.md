# hooks/

Custom React hooks. Each hook should:
- Have a single, clear responsibility
- Be named `use<Feature>.ts`
- Export its return type explicitly

Examples:
- `useWallet.ts` — wallet connection state
- `useBalance.ts` — token balance fetching
- `useTransaction.ts` — transaction submission and tracking
- `useLocalStorage.ts` — typed localStorage access
