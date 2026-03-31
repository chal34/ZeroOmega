import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Step 1: TypeScript type-check
console.log('Type-checking...');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  console.error('TypeScript type-check failed');
  process.exit(1);
}

// Step 2: Build individual coffee→ts files (src/coffee/) to build/js/
const coffeeFiles = fs.readdirSync(path.join(__dirname, 'src/coffee'))
  .filter(f => f.endsWith('.ts'))
  .map(f => `src/coffee/${f}`);

console.log('Building individual JS files...');
await build({
  entryPoints: coffeeFiles,
  outdir: 'build/js',
  bundle: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  // Flatten output: src/coffee/foo.ts → build/js/foo.js
  outbase: 'src/coffee',
});

// Step 3: Bundle all src/omega/ files into build/js/omega.js
const omegaFiles = [];
function collectTsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(full);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      omegaFiles.push(full);
    }
  }
}
collectTsFiles(path.join(__dirname, 'src/omega'));

// Create a barrel file that imports all omega modules in correct order
// app.coffee must come first (defines the module), then everything else
const omegaRelFiles = omegaFiles.map(f => path.relative(path.join(__dirname, 'src'), f));
const appFile = omegaRelFiles.find(f => f.endsWith('app.ts'));
const otherFiles = omegaRelFiles.filter(f => !f.endsWith('app.ts'));
const sortedFiles = [appFile, ...otherFiles.sort()];

const barrelContent = sortedFiles
  .map(f => `import './${f.replace(/\.ts$/, '')}';`)
  .join('\n') + '\n';

fs.writeFileSync(path.join(__dirname, 'src/_omega_bundle.ts'), barrelContent);

console.log('Building omega.js bundle...');
await build({
  entryPoints: ['src/_omega_bundle.ts'],
  outfile: 'build/js/omega.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  external: ['angular', 'OmegaPac', 'jsondiffpatch', 'jQuery'],
});

// Clean up barrel file
fs.unlinkSync(path.join(__dirname, 'src/_omega_bundle.ts'));

// Step 4: Copy HTML templates
console.log('Copying templates...');

function copyHtmlFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    }
  }
}

copyHtmlFiles(path.join(__dirname, 'src'), path.join(__dirname, 'build'));
copyHtmlFiles(path.join(__dirname, 'src/partials'), path.join(__dirname, 'build/partials'));

// Step 5: Compile LESS to CSS
console.log('Compiling styles...');
const less = await import('less');
const autoprefixer = await import('autoprefixer');
const postcss = await import('postcss');

async function compileLess(srcFile, destFile) {
  const input = fs.readFileSync(srcFile, 'utf8');
  const result = await less.default.render(input, {
    filename: srcFile,
    paths: [path.dirname(srcFile)],
  });
  // Autoprefix
  const prefixed = await postcss.default([autoprefixer.default]).process(result.css, {
    from: srcFile,
    to: destFile,
  });
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, prefixed.css);
}

await compileLess(
  path.join(__dirname, 'src/less/options.less'),
  path.join(__dirname, 'build/css/options.css')
);
await compileLess(
  path.join(__dirname, 'src/less/popup.less'),
  path.join(__dirname, 'build/css/popup.css')
);

// Step 6: Copy assets
console.log('Copying assets...');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy omega_pac.min.js from omega-pac
const pacMinSrc = path.join(__dirname, '../omega-pac/omega_pac.min.js');
if (fs.existsSync(pacMinSrc)) {
  fs.mkdirSync(path.join(__dirname, 'build/js'), { recursive: true });
  fs.copyFileSync(pacMinSrc, path.join(__dirname, 'build/js/omega_pac.min.js'));
}

// Copy lib/ (themes etc.)
copyDir(path.join(__dirname, 'lib'), path.join(__dirname, 'build/lib'));

// Copy img/
copyDir(path.join(__dirname, 'img'), path.join(__dirname, 'build/img'));

// Copy src/popup/ (pre-built popup files)
copyDir(path.join(__dirname, 'src/popup'), path.join(__dirname, 'build/popup'));

// Step 7: Copy bower/npm libraries to build/lib/
// These libraries are loaded via script tags in options.html
console.log('Copying library dependencies...');

const libMappings = [
  // Angular
  { src: 'node_modules/angular/angular.min.js', dest: 'build/lib/angular/angular.min.js' },
  { src: 'node_modules/angular-animate/angular-animate.min.js', dest: 'build/lib/angular-animate/angular-animate.min.js' },
  { src: 'node_modules/angular-sanitize/angular-sanitize.min.js', dest: 'build/lib/angular-sanitize/angular-sanitize.min.js' },
  { src: 'node_modules/angular-i18n', dest: 'build/lib/angular-i18n', dir: true },
  // Angular loader
  { src: 'node_modules/angular/angular.min.js', dest: 'build/lib/angular-loader/angular-loader.min.js' },
  // UI libraries
  { src: 'node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js', dest: 'build/lib/angular-bootstrap/ui-bootstrap-tpls.min.js' },
  { src: 'node_modules/@uirouter/angularjs/release/angular-ui-router.min.js', dest: 'build/lib/angular-ui-router/angular-ui-router.min.js' },
  // Bootstrap CSS
  { src: 'node_modules/bootstrap/dist/css/bootstrap.min.css', dest: 'build/lib/bootstrap/css/bootstrap.min.css' },
  // scriptjs
  { src: 'node_modules/scriptjs/dist/script.min.js', dest: 'build/lib/script.js/script.min.js' },
  // FileSaver
  { src: 'node_modules/file-saver/dist/FileSaver.min.js', dest: 'build/lib/FileSaver/FileSaver.min.js' },
  // ngProgress
  { src: 'node_modules/nprogress/nprogress.js', dest: 'build/lib/ngprogress/ngProgress.min.js' },
];

for (const mapping of libMappings) {
  const srcPath = path.join(__dirname, mapping.src);
  const destPath = path.join(__dirname, mapping.dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  Warning: ${mapping.src} not found, skipping`);
    continue;
  }
  if (mapping.dir) {
    copyDir(srcPath, destPath);
  } else {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

// Step 8: ng-annotate the omega.js bundle for Angular DI safety
console.log('Running ng-annotate...');
try {
  const ngAnnotate = await import('ng-annotate-patched');
  const omegaJs = fs.readFileSync(path.join(__dirname, 'build/js/omega.js'), 'utf8');
  const annotated = ngAnnotate.default(omegaJs, { add: true, single_quotes: true });
  if (annotated.errors) {
    console.warn('ng-annotate warnings:', annotated.errors);
  }
  fs.writeFileSync(path.join(__dirname, 'build/js/omega.js'), annotated.src);
} catch (e) {
  console.warn('ng-annotate skipped (package not available):', e.message);
}

console.log('omega-web build complete');
