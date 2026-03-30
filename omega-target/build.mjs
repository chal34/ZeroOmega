import * as esbuild from 'esbuild'
import { execSync } from 'child_process'

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

// Generate type declarations into root (outDir overrides tsconfig)
execSync('npx tsc --declaration --emitDeclarationOnly --outDir . --rootDir src', {
  stdio: 'inherit',
})

console.log('omega-target build complete')
