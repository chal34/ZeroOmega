import { saveAs } from 'file-saver'

export function downloadFile(blob: Blob, filename: string): void {
  const noAutoBom = true
  ;(saveAs as any)(blob, filename, noAutoBom)
}
