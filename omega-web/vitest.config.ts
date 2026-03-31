import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'omega-pac': resolve(__dirname, '../omega-pac/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/__mocks__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/composables/**/*.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
})
