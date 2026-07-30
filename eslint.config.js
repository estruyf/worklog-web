// Lint config for the app. The reason this exists at all is the React hooks
// rules: the UI keeps long-lived `window` listeners that deliberately never
// re-subscribe, and every value they read has to be routed through a ref. Nothing
// but `exhaustive-deps` catches the one that isn't — a shortcut handler silently
// froze `view` at its mount value for exactly that reason.
//
// `no-undef` stays off for TypeScript: tsc already resolves every identifier, and
// the rule can't see DOM/Workers globals without a second source of truth.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', '.wrangler/**', 'node_modules/**', 'public/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-undef': 'off',
      // Deliberate discards (`void promise`, `_` params) are a pattern here.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Astro's ambient declarations: the triple-slash reference and the marker
    // interface are the shapes Astro itself generates.
    files: ['src/env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
);
