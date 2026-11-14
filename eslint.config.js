import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      'emulador/**',
      'bridge/**',
      'tools/**',
      'campeonato/**',
      'kits/**',
      'states/**',
      'data/**',
    ],
  },
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  {
    // Regra de ouro 1: o núcleo não usa relógio nem Math.random
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use o gerador com semente (src/core/rng.ts).' },
        { object: 'Date', property: 'now', message: 'O núcleo não usa relógio; o tempo do jogo é em semanas implícitas.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'O núcleo não usa relógio.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['electron', 'vue', 'pinia', 'better-sqlite3', 'node:*', 'fs', 'path'] },
      ],
    },
  },
)
