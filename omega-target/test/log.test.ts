import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Log from '../src/log'

describe('Log', () => {
  describe('#str', () => {
    it('should convert simple values to string', () => {
      expect(Log.str(42)).toBe('42')
      expect(Log.str('hello')).toBe('hello')
      expect(Log.str(true)).toBe('true')
      expect(Log.str(null)).toBe('null')
      expect(Log.str(undefined)).toBe('undefined')
    })

    it('should use debugStr property if available (string)', () => {
      const obj = { debugStr: 'MyDebug' }
      expect(Log.str(obj)).toBe('MyDebug')
    })

    it('should call debugStr function if available', () => {
      const obj = { debugStr: () => 'FuncDebug' }
      expect(Log.str(obj)).toBe('FuncDebug')
    })

    it('should use Error stack or message', () => {
      const err = new Error('test error')
      const result = Log.str(err)
      expect(result).toContain('test error')
    })

    it('should JSON.stringify plain objects', () => {
      const obj = { key: 'value' }
      const result = Log.str(obj)
      expect(result).toContain('"key"')
      expect(result).toContain('"value"')
    })

    it('should redact sensitive fields', () => {
      const obj = {
        username: 'admin',
        password: 'secret',
        host: 'example.com',
        port: '8080',
        token: 'abc123',
        gistToken: 'tok',
        gistId: 'gid',
        safe: 'visible',
      }
      const result = Log.str(obj)
      expect(result).not.toContain('"admin"')
      expect(result).not.toContain('"example.com"')
      expect(result).not.toContain('"abc123"')
      expect(result).not.toContain('"tok"')
      expect(result).not.toContain('"gid"')
      // All sensitive fields are replaced with '<secret>'
      expect((result.match(/<secret>/g) || []).length).toBe(7)
      expect(result).toContain('visible')
    })

    it('should format named functions', () => {
      function myFunc() {}
      const result = Log.str(myFunc)
      expect(result).toBe('<f: myFunc>')
    })

    it('should format anonymous functions', () => {
      const result = Log.str(() => {})
      expect(result).toContain('=>')
    })
  })

  describe('#func', () => {
    let logSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      logSpy = vi.fn()
      Log.log = logSpy
    })

    afterEach(() => {
      Log.log = console.log.bind(console)
    })

    it('should log function name and args', () => {
      Log.func('testFunc', [1, 'two'])
      expect(logSpy).toHaveBeenCalledWith(
        'testFunc',
        '(',
        [1, 'two'],
        ')'
      )
    })
  })

  describe('#method', () => {
    let logSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      logSpy = vi.fn()
      Log.log = logSpy
    })

    afterEach(() => {
      Log.log = console.log.bind(console)
    })

    it('should log method with self description and args', () => {
      const self = { debugStr: 'MyObj' }
      Log.method('doStuff', self, ['arg1'])
      expect(logSpy).toHaveBeenCalledWith(
        'MyObj',
        '<<',
        'doStuff',
        ['arg1']
      )
    })
  })
})
