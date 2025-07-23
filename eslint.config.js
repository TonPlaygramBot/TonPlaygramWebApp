import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: import.meta.url
})

export default [
  {
    ignores: [
      'webapp/**',
      'bot/**',
      'examples/**',
      'scripts/**',
      'test/**',
      'ft/**'
    ]
  },
  ...compat.config({
    env: {
      browser: true,
      node: true,
      es2021: true
    },
    extends: ['standard', 'plugin:react/recommended'],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    plugins: ['react'],
    rules: {}
  })
]
