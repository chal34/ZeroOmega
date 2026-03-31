/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Chrome extension types
declare const chrome: any

// Browser extension types (Firefox)
declare const browser: any

// OmegaPac is loaded as external in browser build
declare const OmegaPac: any

// OmegaDebug from extension
declare const OmegaDebug: any

// jsondiffpatch (loaded globally in some contexts)
declare const jsondiffpatch: any

// FileSaver
declare function saveAs(blob: Blob, filename: string, disableAutoBOM?: boolean): void
