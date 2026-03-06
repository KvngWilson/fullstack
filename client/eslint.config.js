import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]|^_',
          argsIgnorePattern: '^_|^Story$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/purity': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/**/*.{test,spec}.{js,jsx}',
      'src/**/__tests__/**/*.{js,jsx}',
      'e2e/**/*.{js,jsx}',
      'playwright.config.js',
      'vitest.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: [
      '.storybook/**/*.{js,jsx}',
      'scripts/**/*.{js,mjs,cjs}',
      'vite.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['e2e/**/*.{js,jsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-empty-pattern': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['src/pages/**/*.{js,jsx}', 'src/components/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/api/endpoints/*', '@/api/client', '@/api/interceptors/*'],
              message:
                'Use the centralized service layer (`@/services/api`) instead of importing API endpoint modules directly.',
            },
            {
              group: [
                '@/pages/auth/*',
                '@/pages/shop/*',
                '@/pages/account/*',
                '@/pages/cart/*',
                '@/pages/admin/*',
                '@/pages/vendor/*',
              ],
              message:
                'Import from feature or bounded-module paths (`@/features/*`, `@/admin/pages/*`, `@/vendor/pages/*`) instead of legacy `@/pages/*` domains.',
            },
            {
              group: ['@/utils/helpers'],
              message:
                'Import from focused utility modules (`@/utils/format`, `@/utils/validation`, `@/utils/object`, `@/utils/timing`, `@/utils/id`) instead of the compatibility barrel.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/utils/helpers'],
              message:
                'Import from focused utility modules (`@/utils/format`, `@/utils/validation`, `@/utils/object`, `@/utils/timing`, `@/utils/id`) instead of the compatibility barrel.',
            },
            {
              group: [
                '@/pages/auth/*',
                '@/pages/shop/*',
                '@/pages/account/*',
                '@/pages/cart/*',
                '@/pages/admin/*',
                '@/pages/vendor/*',
              ],
              message:
                'Import from feature or bounded-module paths (`@/features/*`, `@/admin/pages/*`, `@/vendor/pages/*`) instead of legacy `@/pages/*` domains.',
            },
          ],
        },
      ],
    },
  },
])
