import * as esbuild from 'esbuild'
import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

const release = process.env.BUILD === 'release'

// Type-check
execSync('npx tsc --noEmit', { stdio: 'inherit' })

// Build Node.js CJS module
await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'index.js',
  external: ['omega-target', 'omega-pac', 'heap'],
  sourcemap: release ? false : 'inline',
})

// Generate type declarations
execSync('npx tsc --declaration --emitDeclarationOnly', { stdio: 'inherit' })
copyFileSync('dist-types/index.d.ts', 'index.d.ts')

// Build browser IIFE bundle (for inclusion in extension service worker)
await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'OmegaTargetChromium',
  outfile: 'omega_target_chromium_extension.min.js',
  alias: {
    'omega-pac': './browser-shims/omega-pac.js',
    'omega-target': './browser-shims/omega-target.js',
  },
  define: {
    'global': 'globalThis',
  },
  footer: { js: 'globalThis.OmegaTargetChromium = OmegaTargetChromium;' },
  minify: release,
  sourcemap: release ? false : 'inline',
})

// Build standalone browser scripts from src/coffee/*.ts
// These are imported by x-background.js as ES modules.
// They reference globals (OmegaTargetChromium, OmegaPac, chrome, etc.)
// which are set on globalThis by the IIFE builds loaded earlier.
if (!existsSync('build-scripts')) mkdirSync('build-scripts')

const coffeeScripts = ['background', 'background_preload', 'omega_debug', 'log_error']
for (const name of coffeeScripts) {
  await esbuild.build({
    entryPoints: [`src/coffee/${name}.ts`],
    bundle: false,
    platform: 'browser',
    format: 'esm',
    outfile: `build-scripts/${name}.js`,
  })
}

// Bundle omega_webext_proxy_script.js with omega-pac (for Firefox proxy sandbox)
await esbuild.build({
  entryPoints: ['src/js/omega_webext_proxy_script.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'omega_webext_proxy_script.min.js',
  alias: {
    'omega-pac': './browser-shims/omega-pac.js',
  },
  define: {
    'global': 'globalThis',
  },
  minify: release,
  sourcemap: release ? false : 'inline',
})

console.log('omega-target-chromium-extension build complete')
