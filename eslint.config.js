import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  // Standard SvelteKit App.* declarations are intentionally empty until populated.
  {
    files: ['src/app.d.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  { ignores: ['.svelte-kit/', 'build/', 'node_modules/'] },
];
