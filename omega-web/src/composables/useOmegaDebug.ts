import { downloadFile } from './useDownloadFile'

declare const OmegaDebug: any

export function useOmegaDebug() {
  const debug = (typeof OmegaDebug !== 'undefined' ? OmegaDebug : {}) as any

  return {
    downloadLog: debug.downloadLog ?? (() => {
      const blob = new Blob([localStorage['log'] || ''], { type: 'text/plain;charset=utf-8' })
      downloadFile(blob, `OmegaLog_${Date.now()}.txt`)
    }),

    reportIssue: debug.reportIssue ?? (() => {
      window.open('https://github.com/nicedream/nicedream.github.io/issues')
    }),

    resetOptions: debug.resetOptions ?? (() => {
      console.warn('resetOptions not available')
    }),
  }
}
