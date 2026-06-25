import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'prettier', // Must be last — disables formatting rules that conflict with Prettier
  ),
  {
    rules: {
      // Enforce explicit return types on functions for clarity in a wallet codebase
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Disallow console.log in production code — use a logger utility instead
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Prefer const over let where possible
      'prefer-const': 'error',
      // No unused variables (already caught by TS, but keep for JS files)
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default eslintConfig
