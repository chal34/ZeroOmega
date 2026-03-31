/**
 * Assembly script for ZeroOmega Chrome extension.
 *
 * Copies build outputs from all packages into a single directory
 * that can be loaded as an unpacked Chrome extension.
 *
 * Usage: node omega-build/assemble.mjs
 */
import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'
import { convertPoFile } from './po2crx.mjs'

const require = createRequire(import.meta.url)

const ROOT = path.resolve(import.meta.dirname, '..')
const BUILD = path.resolve(ROOT, 'omega-target-chromium-extension/build')
const CHROMEXT = path.resolve(ROOT, 'omega-target-chromium-extension')
const OMEGA_WEB = path.resolve(ROOT, 'omega-web')
const OMEGA_PAC = path.resolve(ROOT, 'omega-pac')
const OMEGA_TARGET = path.resolve(ROOT, 'omega-target')
const OMEGA_LOCALES = path.resolve(ROOT, 'omega-locales')
const OMEGA_BUILD = path.resolve(ROOT, 'omega-build')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    if (entry === '.DS_Store') continue
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// ---------------------------------------------------------------------------
// 1. Clean build directory
// ---------------------------------------------------------------------------
console.log('Cleaning build directory...')
if (fs.existsSync(BUILD)) {
  fs.rmSync(BUILD, { recursive: true })
}
ensureDir(BUILD)

// ---------------------------------------------------------------------------
// 2. Copy omega-web build output (options.html, popup.html, js/, css/, etc.)
// ---------------------------------------------------------------------------
console.log('Copying omega-web build...')
const webBuild = path.join(OMEGA_WEB, 'build')
if (fs.existsSync(webBuild)) {
  copyDir(webBuild, BUILD)
}

// ---------------------------------------------------------------------------
// 3. Copy overlay files (manifest.json, x-background.js, polyfills, etc.)
//    These overwrite any omega-web files with the same name.
// ---------------------------------------------------------------------------
console.log('Copying overlay files...')
const overlay = path.join(CHROMEXT, 'overlay')
const overlayFiles = [
  'manifest.json',
  'x-background.js',
  'localstorage-polyfill.js',
  'log.js',
  'popup-iframe.html',
  'popup-iframe.js',
]
for (const f of overlayFiles) {
  const src = path.join(overlay, f)
  if (fs.existsSync(src)) {
    copyFile(src, path.join(BUILD, f))
  }
}

// ---------------------------------------------------------------------------
// 4. Bundle indexedDB.js (overlay file with fake-indexeddb deps)
// ---------------------------------------------------------------------------
console.log('Bundling indexedDB.js...')

// esbuild plugin to resolve zero-dependencies/fake-indexeddb imports to npm package
const fakeIDBPlugin = {
  name: 'fake-indexeddb-resolver',
  setup(build) {
    build.onResolve({ filter: /fake-indexeddb/ }, (args) => {
      if (!args.path.includes('zero-dependencies')) return null
      const basename = path.basename(args.path, '.js')
      let packagePath
      if (basename === 'fakeIndexedDB') {
        packagePath = 'fake-indexeddb'
      } else {
        packagePath = `fake-indexeddb/lib/${basename}`
      }
      try {
        const resolved = require.resolve(packagePath)
        return { path: resolved }
      } catch (e) {
        console.warn(`Could not resolve ${packagePath}: ${e.message}`)
        return null
      }
    })
  },
}

await esbuild.build({
  entryPoints: [path.join(overlay, 'indexedDB.js')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: path.join(BUILD, 'indexedDB.js'),
  plugins: [fakeIDBPlugin],
  define: {
    'global': 'globalThis',
  },
})

// ---------------------------------------------------------------------------
// 5. Copy built JS artifacts to js/
// ---------------------------------------------------------------------------
console.log('Copying built JS files...')
ensureDir(path.join(BUILD, 'js'))

// omega-pac IIFE
copyFile(
  path.join(OMEGA_PAC, 'omega_pac.min.js'),
  path.join(BUILD, 'js/omega_pac.min.js')
)

// omega-target IIFE
copyFile(
  path.join(OMEGA_TARGET, 'omega_target.min.js'),
  path.join(BUILD, 'js/omega_target.min.js')
)

// omega-target-chromium-extension IIFE
copyFile(
  path.join(CHROMEXT, 'omega_target_chromium_extension.min.js'),
  path.join(BUILD, 'js/omega_target_chromium_extension.min.js')
)

// Coffee scripts (compiled TS → ESM)
for (const name of ['background', 'background_preload', 'omega_debug', 'log_error']) {
  copyFile(
    path.join(CHROMEXT, `build-scripts/${name}.js`),
    path.join(BUILD, `js/${name}.js`)
  )
}

// Plain JS files from src/js/
copyFile(
  path.join(CHROMEXT, 'src/js/omega_target_popup.js'),
  path.join(BUILD, 'js/omega_target_popup.js')
)

// Bundled proxy script (for Firefox)
const proxyScriptSrc = path.join(CHROMEXT, 'omega_webext_proxy_script.min.js')
if (fs.existsSync(proxyScriptSrc)) {
  copyFile(proxyScriptSrc, path.join(BUILD, 'js/omega_webext_proxy_script.min.js'))
}

// ---------------------------------------------------------------------------
// 6. Build vendored dependencies
// ---------------------------------------------------------------------------
console.log('Building vendored dependencies...')

async function buildVendorIIFE(entry, outfile, globalName) {
  await esbuild.build({
    stdin: { contents: entry, resolveDir: OMEGA_BUILD, loader: 'js' },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: globalName,
    outfile: outfile,
    footer: { js: `globalThis.${globalName} = ${globalName};` },
    define: {
      'global': 'globalThis',
      'process.env.NODE_ENV': '"production"',
    },
    minify: true,
  })
}

// compare-versions
await buildVendorIIFE(
  `module.exports = require('compare-versions');`,
  path.join(BUILD, 'lib/zero-dependencies/compare-versions/compare-versions.js'),
  'compareVersions'
)

// idb-keyval
await buildVendorIIFE(
  `module.exports = require('idb-keyval');`,
  path.join(BUILD, 'lib/zero-dependencies/idb-keyval/idb-keyval.js'),
  'idbKeyval'
)

// moment with locales
await buildVendorIIFE(
  `module.exports = require('moment/min/moment-with-locales');`,
  path.join(BUILD, 'lib/zero-dependencies/moment/moment-with-locales.js'),
  'moment'
)

// csso (CSS optimizer)
await buildVendorIIFE(
  `module.exports = require('csso');`,
  path.join(BUILD, 'lib/zero-dependencies/csso/csso.js'),
  'csso'
)

// iframeResizer (for popup-iframe.html <script> tag)
// Copy prebuilt UMD file from the iframe-resizer package
const iframeResizerSrc = path.dirname(require.resolve('iframe-resizer/js/iframeResizer.min.js'))
const iframeResizerDest = path.join(BUILD, 'lib/zero-dependencies/iframeResizer')
ensureDir(iframeResizerDest)
copyFile(
  path.join(iframeResizerSrc, 'iframeResizer.min.js'),
  path.join(iframeResizerDest, 'iframeResizer.min.js')
)
// Also copy contentWindow script (needed by iframe child page)
const cwSrc = path.join(iframeResizerSrc, 'iframeResizer.contentWindow.min.js')
if (fs.existsSync(cwSrc)) {
  copyFile(cwSrc, path.join(iframeResizerDest, 'iframeResizer.contentWindow.min.js'))
}

// scriptjs (for popup-iframe.html <script> tag)
const scriptjsSrc = require.resolve('scriptjs/dist/script.min.js')
ensureDir(path.join(BUILD, 'lib/script.js'))
copyFile(scriptjsSrc, path.join(BUILD, 'lib/script.js/script.min.js'))

// ---------------------------------------------------------------------------
// 7. Copy static assets
// ---------------------------------------------------------------------------
console.log('Copying static assets...')

// img/icons/ from omega-web (if not already copied by omega-web build)
const imgSrc = path.join(OMEGA_WEB, 'img')
if (fs.existsSync(imgSrc)) {
  copyDir(imgSrc, path.join(BUILD, 'img'))
}

// lib/themes/ from omega-web
const themesSrc = path.join(OMEGA_WEB, 'lib/themes')
if (fs.existsSync(themesSrc)) {
  copyDir(themesSrc, path.join(BUILD, 'lib/themes'))
}

// popup/ directory (from omega-web build or source)
const popupBuild = path.join(OMEGA_WEB, 'build/popup')
if (fs.existsSync(popupBuild)) {
  copyDir(popupBuild, path.join(BUILD, 'popup'))
}

// Copy root-level metadata
for (const f of ['COPYING', 'AUTHORS']) {
  const src = path.join(ROOT, f)
  if (fs.existsSync(src)) {
    copyFile(src, path.join(BUILD, f))
  }
}

// ---------------------------------------------------------------------------
// 8. Convert locale .po files to Chrome _locales/*/messages.json
// ---------------------------------------------------------------------------
console.log('Converting locales...')

// Map locale directory names to Chrome locale codes
const localeMapping = {
  'en_US': 'en',
}

if (fs.existsSync(OMEGA_LOCALES)) {
  for (const localeDir of fs.readdirSync(OMEGA_LOCALES)) {
    if (localeDir.startsWith('.')) continue
    const poDir = path.join(OMEGA_LOCALES, localeDir, 'LC_MESSAGES')
    const poFile = path.join(poDir, 'omega-web.po')
    if (!fs.existsSync(poFile)) continue

    const chromeLocale = localeMapping[localeDir] || localeDir
    const outDir = path.join(BUILD, '_locales', chromeLocale)
    ensureDir(outDir)

    try {
      const messages = convertPoFile(poFile)
      fs.writeFileSync(
        path.join(outDir, 'messages.json'),
        JSON.stringify(messages, null, 2) + '\n'
      )
    } catch (e) {
      console.warn(`Warning: Failed to convert ${localeDir}: ${e.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log(`\nAssembly complete! Extension at:\n  ${BUILD}`)
console.log('Load as unpacked extension in chrome://extensions/')
