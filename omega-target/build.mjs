import * as esbuild from 'esbuild'
import { execSync } from 'child_process'
import { copyFileSync } from 'fs'

const release = process.env.BUILD === 'release'

// Type-check first
execSync('npx tsc --noEmit', { stdio: 'inherit' })

// Build Node.js CJS bundle
await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'index.js',
  external: ['jsondiffpatch', 'limiter', 'omega-pac'],
  sourcemap: release ? false : 'inline',
})

// Generate type declarations (emitted to dist-types/, then copy root declaration)
execSync('npx tsc --declaration --emitDeclarationOnly', { stdio: 'inherit' })
copyFileSync('dist-types/index.d.ts', 'index.d.ts')

// Build browser IIFE bundle (for inclusion in extension service worker)
await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'OmegaTarget',
  outfile: 'omega_target.min.js',
  alias: {
    'omega-pac': './browser-shims/omega-pac.js',
  },
  define: {
    'global': 'globalThis',
  },
  footer: { js: 'globalThis.OmegaTarget = OmegaTarget;' },
  minify: release,
  sourcemap: release ? false : 'inline',
})

console.log('omega-target build complete')
