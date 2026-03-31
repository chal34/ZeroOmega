import { vi } from 'vitest'

// Mock Chrome extension APIs globally
const chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn((_msg: any, cb?: any) => {
      if (cb) cb({ result: null })
    }),
    connect: vi.fn(() => ({
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      postMessage: vi.fn(),
    })),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    lastError: null as any,
  },
  tabs: {
    query: vi.fn((_q: any, cb: any) => cb([])),
    create: vi.fn(),
    update: vi.fn(),
    reload: vi.fn(),
    get: vi.fn(() => Promise.resolve({})),
  },
  i18n: {
    getMessage: vi.fn((key: string, _subs?: string[]) => key),
  },
  storage: {
    local: { get: vi.fn(), set: vi.fn() },
  },
}

Object.defineProperty(globalThis, 'chrome', {
  value: chrome,
  writable: true,
  configurable: true,
})
