import { describe, it, expect, vi } from 'vitest'

// Mock file-saver before importing the composable
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

import { downloadFile } from '@/composables/useDownloadFile'
import { saveAs } from 'file-saver'

describe('useDownloadFile', () => {
  it('calls saveAs with blob, filename, and noAutoBom=true', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' })
    downloadFile(blob, 'test.txt')
    expect(saveAs).toHaveBeenCalledWith(blob, 'test.txt', true)
  })

  it('passes different file types correctly', () => {
    const blob = new Blob(['pac script'], { type: 'text/plain;charset=utf-8' })
    downloadFile(blob, 'OmegaProfile_myProxy.pac')
    expect(saveAs).toHaveBeenCalledWith(blob, 'OmegaProfile_myProxy.pac', true)
  })
})
