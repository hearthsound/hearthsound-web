/**
 * ESLint flat configuration: JavaScript and TypeScript recommended rules, the
 * Svelte rules for components, and the compatibility layer that disables the
 * stylistic rules Prettier owns.
 */
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/',
      'build/',
      'dist/',
      '.svelte-kit/',
      'test-results/',
      'playwright-report/'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/navigation.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      // Every link and every navigation takes its address from `routeHref`
      // (`src/lib/navigation.ts`), which is the one module that calls
      // `resolve`: this client's route table is too large a union for
      // `resolve`'s generic to infer through, so the call is made once there
      // and the rule cannot follow the helper into the views.
      'svelte/no-navigation-without-resolve': 'off'
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  ...svelte.configs.prettier
];
