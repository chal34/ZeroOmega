import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'

function copyDir(src: string, dest: string) {
  if (!existsSync(src)) return
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry)
    const destPath = resolve(dest, entry)
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-static-assets',
      closeBundle() {
        copyDir(resolve(__dirname, 'img'), resolve(__dirname, 'build/img'))
        copyDir(resolve(__dirname, 'lib'), resolve(__dirname, 'build/lib'))
        copyDir(resolve(__dirname, 'src/popup'), resolve(__dirname, 'build/popup'))
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Use TypeScript source directly to avoid CJS interop issues
      'omega-pac': resolve(__dirname, '../omega-pac/src/index.ts'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        // Bootstrap 3 LESS variables can be included here if needed
      },
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'options.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  publicDir: false,
})
