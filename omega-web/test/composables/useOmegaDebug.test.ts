import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/composables/useDownloadFile', () => ({
  downloadFile: vi.fn(),
}))

import { downloadFile } from '@/composables/useDownloadFile'

describe('useOmegaDebug', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(downloadFile).mockClear()
    // Ensure OmegaDebug is not defined (fallback paths)
    if ('OmegaDebug' in globalThis) {
      delete (globalThis as any).OmegaDebug
    }
  })

  it('downloadLog creates a blob from localStorage and calls downloadFile', async () => {
    localStorage['log'] = 'some log data'
    const { useOmegaDebug } = await import('@/composables/useOmegaDebug')
    const debug = useOmegaDebug()
    debug.downloadLog()
    expect(downloadFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^OmegaLog_\d+\.txt$/),
    )
  })

  it('downloadLog handles empty log', async () => {
    delete localStorage['log']
    const { useOmegaDebug } = await import('@/composables/useOmegaDebug')
    const debug = useOmegaDebug()
    debug.downloadLog()
    expect(downloadFile).toHaveBeenCalled()
  })

  it('reportIssue opens github issues page', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { useOmegaDebug } = await import('@/composables/useOmegaDebug')
    const debug = useOmegaDebug()
    debug.reportIssue()
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
    )
    openSpy.mockRestore()
  })

  it('resetOptions logs a warning when OmegaDebug is not available', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { useOmegaDebug } = await import('@/composables/useOmegaDebug')
    const debug = useOmegaDebug()
    debug.resetOptions()
    expect(warnSpy).toHaveBeenCalledWith('resetOptions not available')
    warnSpy.mockRestore()
  })

  it('uses OmegaDebug methods when available', async () => {
    const mockDownload = vi.fn()
    const mockReport = vi.fn()
    const mockReset = vi.fn()
    ;(globalThis as any).OmegaDebug = {
      downloadLog: mockDownload,
      reportIssue: mockReport,
      resetOptions: mockReset,
    }
    const { useOmegaDebug } = await import('@/composables/useOmegaDebug')
    const debug = useOmegaDebug()
    debug.downloadLog()
    debug.reportIssue()
    debug.resetOptions()
    expect(mockDownload).toHaveBeenCalled()
    expect(mockReport).toHaveBeenCalled()
    expect(mockReset).toHaveBeenCalled()
    delete (globalThis as any).OmegaDebug
  })
})
