import * as esbuild from 'esbuild'
import { execSync } from 'child_process'

const release = process.env.BUILD === 'release'

// Type-check first
execSync('npx tsc --noEmit', { stdio: 'inherit' })

// Build Node.js CJS bundle (for use as dependency by other packages)
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'index.js',
  external: ['uglify-js', 'ip-address', 'tldts'],
  sourcemap: release ? false : 'inline',
})

// Generate type declarations
execSync('npx tsc --declaration --emitDeclarationOnly --outDir .', {
  stdio: 'inherit'
})

// Build browser IIFE bundle (for inclusion in extension service worker)
// uglify-js is redirected to the local pre-built browser bundle.
// Buffer is available globally in the extension service worker context.
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'OmegaPac',
  outfile: 'omega_pac.min.js',
  alias: {
    'uglify-js': './uglifyjs-shim.js',
    'uglify-js-real': './uglifyjs.js',
  },
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': release ? '"production"' : '"development"',
  },
  // Buffer is global in service workers via Node-compat; mark it external so
  // the bundle doesn't try to resolve the 'buffer' npm package.
  inject: [],
  minify: release,
  sourcemap: release ? false : 'inline',
})

console.log('omega-pac build complete')
