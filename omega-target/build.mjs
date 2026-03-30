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

console.log('omega-target build complete')
