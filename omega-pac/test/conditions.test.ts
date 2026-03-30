import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Conditions from '../src/conditions'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const U2 = require('uglify-js') as any

describe('Conditions', () => {
  const testCond = (condition: any, request: any, should_match?: any): any => {
    const o_request = request
    const expectedMatch = !!should_match
    if (typeof request === 'string') {
      request = Conditions.requestFromUrl(request)
    }

    const matchResult = Conditions.match(condition, request)
    const condExpr = Conditions.compile(condition)
    const testFunc = new U2.AST_Function({
      argnames: [
        new U2.AST_SymbolFunarg({ name: 'url' }),
        new U2.AST_SymbolFunarg({ name: 'host' }),
        new U2.AST_SymbolFunarg({ name: 'scheme' }),
      ],
      body: [new U2.AST_Return({ value: condExpr })],
    })
    const evalFunc = eval('(' + testFunc.print_to_string() + ')')
    const compileResult = evalFunc(request.url, request.host, request.scheme)

    const friendlyError = (compiled?: string) => {
      const printCond = JSON.stringify(condition)
      const printCompiled = compiled ? 'COMPILED ' : ''
      const printMatch = expectedMatch ? 'to match' : 'not to match'
      const msg = `expect ${printCompiled}condition ${printCond} ${printMatch} request ${o_request}`
      throw new Error(msg)
    }

    if (!!matchResult !== expectedMatch) {
      friendlyError()
    }
    if (!!compileResult !== expectedMatch) {
      friendlyError('compiled')
    }

    return matchResult
  }

  describe('TrueCondition', () => {
    it('should always return true', () => {
      testCond({ conditionType: 'TrueCondition' }, {}, 'match')
    })
  })

  describe('FalseCondition', () => {
    it('should always return false', () => {
      testCond({ conditionType: 'FalseCondition' }, {}, false)
    })
  })

  describe('UrlRegexCondition', () => {
    const cond = { conditionType: 'UrlRegexCondition', pattern: 'example\\.com' }
    it('should match requests based on regex pattern', () => {
      testCond(cond, 'http://www.example.com/', 'match')
    })
    it('should not match requests not matching the pattern', () => {
      testCond(cond, 'http://www.example.net/', false)
    })
    it('should support regex meta chars', () => {
      const con = { conditionType: 'UrlRegexCondition', pattern: 'exam.*\\.com' }
      testCond(con, 'http://www.example.com/', 'match')
    })
    it('should fallback to not match if pattern is invalid', () => {
      const con = { conditionType: 'UrlRegexCondition', pattern: ')Invalid(' }
      testCond(con, 'http://www.example.com/', false)
    })
  })

  describe('UrlWildcardCondition', () => {
    const cond = { conditionType: 'UrlWildcardCondition', pattern: '*example.com*' }
    it('should match requests based on wildcard pattern', () => {
      testCond(cond, 'http://www.example.com/', 'match')
    })
    it('should not match requests not matching the pattern', () => {
      testCond(cond, 'http://www.example.net/', false)
    })
    it('should support wildcard question marks', () => {
      const c = { conditionType: 'UrlWildcardCondition', pattern: '*exam???.com*' }
      testCond(c, 'http://www.example.com/', 'match')
    })
    it('should not support regex meta chars', () => {
      const c = { conditionType: 'UrlWildcardCondition', pattern: '.*example.com.*' }
      testCond(c, 'http://example.com/', false)
    })
    it('should support multiple patterns in one condition', () => {
      const c = {
        conditionType: 'UrlWildcardCondition',
        pattern: '*.example.com/*|*.example.net/*',
      }
      testCond(c, 'http://a.example.com/abc', 'match')
      testCond(c, 'http://b.example.net/def', 'match')
      testCond(c, 'http://c.example.org/ghi', false)
    })
  })

  describe('HostRegexCondition', () => {
    const cond = { conditionType: 'HostRegexCondition', pattern: '.*\\.example\\.com' }
    it('should match requests based on regex pattern', () => {
      testCond(cond, 'http://www.example.com/', 'match')
    })
    it('should not match requests not matching the pattern', () => {
      testCond(cond, 'http://example.com/', false)
    })
    it('should not match URL parts other than the host', () => {
      expect(testCond(cond, 'http://example.net/www.example.com')).toBe(false)
    })
  })

  describe('HostWildcardCondition', () => {
    const cond = { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }
    it('should match requests based on wildcard pattern', () => {
      testCond(cond, 'http://www.example.com/', 'match')
    })
    it('should also match hostname without the optional level', () => {
      testCond(cond, 'http://example.com/', 'match')
    })
    it('should process patterns like *.*example.com correctly', () => {
      const con = { conditionType: 'HostWildcardCondition', pattern: '*.*example.com' }
      testCond(con, 'http://example.com/', 'match')
      testCond(con, 'http://www.example.com/', 'match')
      testCond(con, 'http://www.some-example.com/', 'match')
      testCond(con, 'http://xample.com/', false)
    })
    it('should allow override of the magical behavior', () => {
      const con = { conditionType: 'HostWildcardCondition', pattern: '**.example.com' }
      testCond(con, 'http://www.example.com/', 'match')
      testCond(con, 'http://example.com/', false)
    })
    it('should not match URL parts other than the host', () => {
      expect(testCond(cond, 'http://example.net/www.example.com')).toBe(false)
    })
    it('should support multiple patterns in one condition', () => {
      const c = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.example.com|*.example.net',
      }
      testCond(c, 'http://a.example.com/abc', 'match')
      testCond(c, 'http://example.net/def', 'match')
      testCond(c, 'http://c.example.org/ghi', false)
    })
  })

  describe('BypassCondition', () => {
    it('should correctly support patterns containing hosts', () => {
      const cond: any = { conditionType: 'BypassCondition', pattern: '.example.com' }
      testCond(cond, 'http://www.example.com/', 'match')
      testCond(cond, 'http://example.com/', false)
      cond.pattern = '*.example.com'
      testCond(cond, 'http://www.example.com/', 'match')
      testCond(cond, 'http://example.com/', false)
      cond.pattern = 'example.com'
      testCond(cond, 'http://example.com/', 'match')
      testCond(cond, 'http://www.example.com/', false)
      cond.pattern = '*example.com'
      testCond(cond, 'http://example.com/', 'match')
      testCond(cond, 'http://www.example.com/', 'match')
      testCond(cond, 'http://anotherexample.com/', 'match')
    })
    it('should match the scheme specified in the pattern', () => {
      const cond = { conditionType: 'BypassCondition', pattern: 'http://example.com' }
      testCond(cond, 'http://example.com/', 'match')
      testCond(cond, 'https://example.com/', false)
    })
    it('should match the port specified in the pattern', () => {
      const cond = { conditionType: 'BypassCondition', pattern: 'http://example.com:8080' }
      testCond(cond, 'http://example.com:8080/', 'match')
      testCond(cond, 'http://example.com:888/', false)
    })
    it('should correctly support patterns using IPv4 literals', () => {
      const cond = { conditionType: 'BypassCondition', pattern: 'http://127.0.0.1:8080' }
      testCond(cond, 'http://127.0.0.1:8080/', 'match')
      testCond(cond, 'http://127.0.0.2:8080/', false)
    })
    it('should correctly support IPv6 canonicalization', () => {
      const cond = { conditionType: 'BypassCondition', pattern: 'http://[0:0::1]:8080' }
      Conditions.analyze(cond)
      testCond(cond, 'http://[::1]:8080/', 'match')
      testCond(cond, 'http://[1::1]:8080/', false)
    })
    it('should correctly support IPv6 canonicalization 2', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '[::1]' }
      Conditions.analyze(cond)
      testCond(cond, 'http://[::1]:8080/', 'match')
      testCond(cond, 'http://[1::1]:8080/', false)
    })
    it('should parse IPv4 CIDR notation', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '192.168.0.0/16' }
      const result = Conditions.analyze(cond).analyzed
      expect(result.ip).toBeTruthy()
      expect(result.ip).toEqual({
        conditionType: 'IpCondition',
        ip: '192.168.0.0',
        prefixLength: 16,
      })
    })
    it('should parse IPv6 CIDR notation', () => {
      const cond = { conditionType: 'BypassCondition', pattern: 'fefe:13::abc/33' }
      const result = Conditions.analyze(cond).analyzed
      expect(result.ip).toBeTruthy()
      expect(result.ip).toEqual({
        conditionType: 'IpCondition',
        ip: 'fefe:13::abc',
        prefixLength: 33,
      })
    })
    it('should parse IPv6 CIDR notation with zero prefixLength', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '::/0' }
      const result = Conditions.analyze(cond).analyzed
      expect(result.ip).toBeTruthy()
      expect(result.ip).toEqual({
        conditionType: 'IpCondition',
        ip: '::',
        prefixLength: 0,
      })
    })
    it('should match 127.0.0.1 when <local> is used', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '<local>' }
      testCond(cond, 'http://127.0.0.1:8080/', 'match')
    })
    it('should match [::1] when <local> is used', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '<local>' }
      testCond(cond, 'http://[::1]:8080/', 'match')
    })
    it('should match any host without dots when <local> is used', () => {
      const cond = { conditionType: 'BypassCondition', pattern: '<local>' }
      testCond(cond, 'http://localhost:8080/', 'match')
      testCond(cond, 'http://intranet:8080/', 'match')
      testCond(cond, 'http://foobar/', 'match')
      testCond(cond, 'http://example.com/', false)
      testCond(cond, 'http://[::ffff:eeee]/', 'match')
      testCond(cond, 'http://[::1.2.3.4]/', false)
    })
  })

  describe('IpCondition', () => {
    it('should support IPv4 subnet', () => {
      const cond = { conditionType: 'IpCondition', ip: '192.168.1.1', prefixLength: 16 }
      const request = Conditions.requestFromUrl('http://192.168.4.4/')
      expect(Conditions.match(cond, request)).toBe(true)
      const compiled = Conditions.compile(cond).print_to_string()
      expect(compiled).toContain('isInNet(host,"192.168.1.1","255.255.0.0")')
    })
    it('should support IPv6 subnet', () => {
      const cond = { conditionType: 'IpCondition', ip: 'fefe:13::abc', prefixLength: 33 }
      const request = Conditions.requestFromUrl('http://[fefe:13::def]/')
      expect(Conditions.match(cond, request)).toBe(true)
      const compiled = Conditions.compile(cond).print_to_string()
      expect(compiled).toContain('isInNet(host,"fefe:13::abc","ffff:ffff:8000::")')
      expect(compiled).toContain('isInNetEx(host,"fefe:13::abc/33")')
    })
    it('should support IPv6 subnet with zero prefixLength', () => {
      const cond = { conditionType: 'IpCondition', ip: '::', prefixLength: 0 }
      const request = Conditions.requestFromUrl('http://[fefe:13::def]/')
      expect(Conditions.match(cond, request)).toBe(true)
      const compiled = Conditions.compile(cond).print_to_string()
      expect(compiled.indexOf('indexOf(')).toBeGreaterThan(0)
    })
    it('should not match domain name to IP subnet', () => {
      const cond = { conditionType: 'IpCondition', ip: '::', prefixLength: 0 }
      const request = Conditions.requestFromUrl('http://www.example.com/')
      expect(Conditions.match(cond, request)).toBe(false)
    })
    it('should not pass domain name to isInNet function', () => {
      const ipToCompiledFunc = (ip: string, prefixLen: number) => {
        const cond = { conditionType: 'IpCondition', ip, prefixLength: prefixLen }
        const dummyIsInNet = new U2.AST_Function({
          argnames: [],
          body: [new U2.AST_Return({ value: new U2.AST_True() })],
        })
        const testFunc = new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({ name: 'url' }),
            new U2.AST_SymbolFunarg({ name: 'host' }),
            new U2.AST_SymbolFunarg({ name: 'scheme' }),
          ],
          body: [
            new U2.AST_Var({
              definitions: [
                new U2.AST_VarDef({
                  name: new U2.AST_SymbolVar({ name: 'isInNet' }),
                  value: dummyIsInNet,
                }),
              ],
            }),
            new U2.AST_Return({ value: Conditions.compile(cond) }),
          ],
        })
        return eval('(' + testFunc.print_to_string() + ')')
      }

      let compiledFunc = ipToCompiledFunc('0.0.0.0', 0)
      expect(compiledFunc(null, 'www.example.com')).toBe(false)
      expect(compiledFunc(null, '127.0.0.1')).toBe(true)

      compiledFunc = ipToCompiledFunc('0.0.0.0', 1)
      expect(compiledFunc(null, 'www.example.com')).toBe(false)
      expect(compiledFunc(null, '127.0.0.1')).toBe(true)

      compiledFunc = ipToCompiledFunc('::', 0)
      expect(compiledFunc(null, 'www.example.com')).toBe(false)
      expect(compiledFunc(null, '::1')).toBe(true)

      compiledFunc = ipToCompiledFunc('::', 1)
      expect(compiledFunc(null, 'www.example.com')).toBe(false)
      expect(compiledFunc(null, '::1')).toBe(true)
    })
  })

  describe('KeywordCondition', () => {
    const cond = { conditionType: 'KeywordCondition', pattern: 'example.com' }
    it('should match requests based on substring', () => {
      testCond(cond, 'http://www.example.com/', 'match')
      testCond(cond, 'http://www.example.net/', false)
    })
    it('should not match HTTPS requests', () => {
      testCond(cond, 'https://example.com/', false)
      testCond(cond, 'https://example.net/', false)
    })
  })

  describe('WeekdayCondition', () => {
    beforeAll(() => {
      vi.useFakeTimers()
    })
    afterAll(() => {
      vi.useRealTimers()
    })

    const testCondDay = (cond: any, day: number, match: any) => {
      const date = day > 0 ? day : 7
      vi.setSystemTime(new Date(`2016-02-0${date}T00:00:00Z`).getTime())
      testCond(cond, `http://weekday-${day}/`, match)
    }

    it('should match requests based on date range', () => {
      const cond = { conditionType: 'WeekdayCondition', startDay: 3, endDay: 5 }
      testCondDay(cond, 0, false)
      testCondDay(cond, 1, false)
      testCondDay(cond, 2, false)
      testCondDay(cond, 3, 'match')
      testCondDay(cond, 4, 'match')
      testCondDay(cond, 5, 'match')
      testCondDay(cond, 6, false)
    })
    it('should match the day if startDay == endDay', () => {
      const cond = { conditionType: 'WeekdayCondition', startDay: 3, endDay: 3 }
      testCondDay(cond, 0, false)
      testCondDay(cond, 1, false)
      testCondDay(cond, 2, false)
      testCondDay(cond, 3, 'match')
      testCondDay(cond, 4, false)
      testCondDay(cond, 5, false)
      testCondDay(cond, 6, false)
    })
    it('should not match anything if startDay > endDay', () => {
      const cond = { conditionType: 'WeekdayCondition', startDay: 4, endDay: 3 }
      testCondDay(cond, 0, false)
      testCondDay(cond, 1, false)
      testCondDay(cond, 2, false)
      testCondDay(cond, 3, false)
      testCondDay(cond, 4, false)
      testCondDay(cond, 5, false)
      testCondDay(cond, 6, false)
    })
    it('should match according to .days', () => {
      let cond: any = { conditionType: 'WeekdayCondition', days: 'SMTWtFs' }
      testCondDay(cond, 0, 'match')
      testCondDay(cond, 1, 'match')
      testCondDay(cond, 2, 'match')
      testCondDay(cond, 3, 'match')
      testCondDay(cond, 4, 'match')
      testCondDay(cond, 5, 'match')
      testCondDay(cond, 6, 'match')

      cond = { conditionType: 'WeekdayCondition', days: 'S-TW-F-' }
      testCondDay(cond, 0, 'match')
      testCondDay(cond, 1, false)
      testCondDay(cond, 2, 'match')
      testCondDay(cond, 3, 'match')
      testCondDay(cond, 4, false)
      testCondDay(cond, 5, 'match')
      testCondDay(cond, 6, false)
    })
    it('should prefer .days to .startDay and .endDay', () => {
      const cond = {
        conditionType: 'WeekdayCondition',
        days: '--TW---',
        startDay: 0,
        endDay: 0,
      }
      testCondDay(cond, 0, false)
      testCondDay(cond, 1, false)
      testCondDay(cond, 2, 'match')
      testCondDay(cond, 3, 'match')
      testCondDay(cond, 4, false)
      testCondDay(cond, 5, false)
      testCondDay(cond, 6, false)
    })
  })

  describe('TimeCondition', () => {
    beforeAll(() => {
      vi.useFakeTimers()
    })
    afterAll(() => {
      vi.useRealTimers()
    })

    const testCondTime = (cond: any, time: string, match: any) => {
      vi.setSystemTime(new Date(`01 Feb 2016 ${time}`).getTime())
      testCond(cond, `http://time-${time}/`, match)
    }

    it('should match requests based on hour range', () => {
      const cond = { conditionType: 'TimeCondition', startHour: 7, endHour: 9 }
      testCondTime(cond, '00:00:00', false)
      testCondTime(cond, '06:00:00', false)
      testCondTime(cond, '07:00:00', 'match')
      testCondTime(cond, '08:00:00', 'match')
      testCondTime(cond, '09:00:00', 'match')
      testCondTime(cond, '09:59:59', 'match')
      testCondTime(cond, '10:00:00', false)
      testCondTime(cond, '19:00:00', false)
      testCondTime(cond, '23:00:00', false)
    })
    it('should match the hour if startHour == endHour', () => {
      const cond = { conditionType: 'TimeCondition', startHour: 7, endHour: 7 }
      testCondTime(cond, '00:00:00', false)
      testCondTime(cond, '06:00:00', false)
      testCondTime(cond, '07:00:00', 'match')
      testCondTime(cond, '07:00:01', 'match')
      testCondTime(cond, '07:59:59', 'match')
      testCondTime(cond, '08:00:00', false)
      testCondTime(cond, '19:00:00', false)
    })
    it('should not match anything if startHour > endHour', () => {
      const cond = { conditionType: 'TimeCondition', startHour: 7, endHour: 6 }
      testCondTime(cond, '00:00:00', false)
      testCondTime(cond, '06:00:00', false)
      testCondTime(cond, '06:59:59', false)
      testCondTime(cond, '07:00:00', false)
      testCondTime(cond, '08:00:00', false)
      testCondTime(cond, '09:00:00', false)
      testCondTime(cond, '10:00:00', false)
      testCondTime(cond, '19:00:00', false)
      testCondTime(cond, '23:00:00', false)
    })
  })

  describe('#typeFromAbbr', () => {
    it('should get condition types by abbrs', () => {
      expect(Conditions.typeFromAbbr('True')).toBe('TrueCondition')
      expect(Conditions.typeFromAbbr('HR')).toBe('HostRegexCondition')
    })
  })

  describe('#str and #fromStr', () => {
    it('should encode & decode TrueCondition correctly', () => {
      const condition = { conditionType: 'TrueCondition' }
      const result = Conditions.str(condition)
      expect(result).toBe('True:')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode conditions with pattern correctly', () => {
      const condition = { conditionType: 'UrlWildcardCondition', pattern: '*://*.example.com/*' }
      const result = Conditions.str(condition)
      expect(result).toBe('UrlWildcard: ' + condition.pattern)
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode False while preserving pattern', () => {
      const condition = { conditionType: 'FalseCondition', pattern: 'a b c' }
      const result = Conditions.str(condition)
      expect(result).toBe('Disabled: a b c')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode FalseCondition without any pattern', () => {
      const condition = { conditionType: 'FalseCondition' }
      const result = Conditions.str(condition)
      expect(result).toBe('Disabled:')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode HostWildcardCondition using shorthand syntax', () => {
      const condition = { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }
      const result = Conditions.str(condition)
      expect(result).toBe(condition.pattern)
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode HostWildcardCondition ending with colon', () => {
      const condition = { conditionType: 'HostWildcardCondition', pattern: 'bogus:' }
      const result = Conditions.str(condition)
      expect(result).toBe('HostWildcard: ' + condition.pattern)
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode BypassCondition correctly', () => {
      const condition = { conditionType: 'BypassCondition', pattern: '127.0.0.1/16' }
      const result = Conditions.str(condition)
      expect(result).toBe('Bypass: 127.0.0.1/16')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should add brackets for IPv6 hosts in BypassCondition', () => {
      const condition = { conditionType: 'BypassCondition', pattern: '::1' }
      const result = Conditions.str(condition)
      expect(result).toBe('Bypass: [::1]')
      const cond = Conditions.fromStr(result)
      expect(cond.conditionType).toBe('BypassCondition')
      expect(cond.pattern).toBe('[::1]')
    })
    it('should add brackets for IPv6 hosts with scheme in BypassCondition', () => {
      const condition = { conditionType: 'BypassCondition', pattern: 'http://::1' }
      const result = Conditions.str(condition)
      expect(result).toBe('Bypass: http://[::1]')
      const cond = Conditions.fromStr(result)
      expect(cond.conditionType).toBe('BypassCondition')
      expect(cond.pattern).toBe('http://[::1]')
    })
    it('should encode & decode IpCondition correctly', () => {
      const condition = { conditionType: 'IpCondition', ip: '127.0.0.1', prefixLength: 16 }
      const result = Conditions.str(condition)
      expect(result).toBe('Ip: 127.0.0.1/16')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should provide sensible fallbacks for invalid IpCondition', () => {
      let cond = Conditions.fromStr('Ip: foo/-233')
      expect(cond).toEqual({ conditionType: 'IpCondition', ip: '0.0.0.0', prefixLength: 0 })

      cond = Conditions.fromStr('Ip: nonsense stuff')
      expect(cond).toEqual({ conditionType: 'IpCondition', ip: '0.0.0.0', prefixLength: 0 })
    })
    it('should assume full match for IpCondition without prefixLength', () => {
      let cond = Conditions.fromStr('Ip: 127.0.0.1')
      expect(cond).toEqual({ conditionType: 'IpCondition', ip: '127.0.0.1', prefixLength: 32 })

      cond = Conditions.fromStr('Ip: ::1')
      expect(cond).toEqual({ conditionType: 'IpCondition', ip: '::1', prefixLength: 128 })
    })
    it('should provide sensible fallbacks for invalid IpCondition (2)', () => {
      const cond = Conditions.fromStr('Ip: 0.0.0.0/-233')
      expect(cond).toEqual({ conditionType: 'IpCondition', ip: '0.0.0.0', prefixLength: 0 })
    })
    it('should encode & decode HostLevelsCondition correctly', () => {
      const condition = { conditionType: 'HostLevelsCondition', minValue: 4, maxValue: 7 }
      const result = Conditions.str(condition)
      expect(result).toBe('HostLevels: 4~7')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should provide sensible fallbacks for HostLevels out of range', () => {
      let cond = Conditions.fromStr('HostLevels: A~-1')
      expect(cond).toEqual({ conditionType: 'HostLevelsCondition', minValue: 1, maxValue: 1 })

      cond = Conditions.fromStr('HostLevels: nonsense')
      expect(cond).toEqual({ conditionType: 'HostLevelsCondition', minValue: 1, maxValue: 1 })
    })
    it('should encode & decode WeekdayCondition correctly', () => {
      const condition = { conditionType: 'WeekdayCondition', startDay: 3, endDay: 6 }
      const result = Conditions.str(condition)
      expect(result).toBe('Weekday: 3~6')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should provide sensible fallbacks for Weekday out of range', () => {
      let cond = Conditions.fromStr('Weekday: -1~100')
      expect(cond).toEqual({ conditionType: 'WeekdayCondition', startDay: 0, endDay: 0 })

      cond = Conditions.fromStr('Weekday: nonsense')
      expect(cond).toEqual({ conditionType: 'WeekdayCondition', startDay: 0, endDay: 0 })
    })
    it('should encode & decode WeekdayCondition with days', () => {
      let condition: any = { conditionType: 'WeekdayCondition', days: 'SMTWtFs' }
      let result = Conditions.str(condition)
      expect(result).toBe('Weekday: SMTWtFs')
      let cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)

      condition = { conditionType: 'WeekdayCondition', days: 'SM-W-Fs' }
      result = Conditions.str(condition)
      expect(result).toBe('Weekday: SM-W-Fs')
      cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should encode & decode TimeCondition correctly', () => {
      const condition = { conditionType: 'TimeCondition', startHour: 7, endHour: 23 }
      const result = Conditions.str(condition)
      expect(result).toBe('Hour: 7~23')
      const cond = Conditions.fromStr(result)
      expect(cond).toEqual(condition)
    })
    it('should provide sensible fallbacks for Hour out of range', () => {
      let cond = Conditions.fromStr('Hour: -1~100')
      expect(cond).toEqual({ conditionType: 'TimeCondition', startHour: 0, endHour: 0 })

      cond = Conditions.fromStr('Hour: nonsense')
      expect(cond).toEqual({ conditionType: 'TimeCondition', startHour: 0, endHour: 0 })
    })
    it('should parse conditions with extra spaces correctly', () => {
      expect(Conditions.fromStr('url:    *abcde*   ')).toEqual({
        conditionType: 'UrlWildcardCondition',
        pattern: '*abcde*',
      })
    })
    it('should parse abbreviated condition types correctly', () => {
      expect(Conditions.fromStr('url: *://*.example.com/*')).toEqual({
        conditionType: 'UrlWildcardCondition',
        pattern: '*://*.example.com/*',
      })
    })
    it('should parse escaped HostWildcardCondition starting with colon', () => {
      expect(Conditions.fromStr(': :bogus:')).toEqual({
        conditionType: 'HostWildcardCondition',
        pattern: ':bogus:',
      })
    })
  })
})
