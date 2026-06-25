import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    // Run in Node.js — all @scure/* libraries work in Node 18+
    // and globalThis.crypto is available (Node 19+ built-in; Node 18+ via --experimental-global-webcrypto flag, but
    // Node.js 20+ ships it unconditionally. This project requires Node 18+ via Next.js 15.)
    environment: 'node',

    // Explicit vitest imports in each test file (no globals injection)
    // This avoids adding "vitest/globals" to tsconfig types and keeps
    // files clearly self-contained.
    globals: false,

    // Match all test files under src/
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

    // Exclude next.js internals
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      // Single '@' alias covers all '@/*' subpaths via prefix matching.
      // '@/domain/errors' → '<root>/src/domain/errors'
      // '@/core/crypto' → '<root>/src/core/crypto'
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
