# lib/

Shared library modules: third-party client instances, SDK wrappers, and singleton utilities.

Examples of what belongs here:
- `queryClient.ts` — React Query / TanStack Query client
- `logger.ts` — structured logger wrapper
- `analytics.ts` — analytics client
- `qorechain.ts` — QoreChain SDK wrapper

Keep this layer framework-agnostic where possible.
