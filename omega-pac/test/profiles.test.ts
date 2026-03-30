import { describe, it, expect } from 'vitest'
import Profiles from '../src/profiles'
import Conditions from '../src/conditions'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const U2 = require('uglify-js') as any

describe('Profiles', () => {
  const ruleListResult = (profileName: string, source: string) => ({
    profileName,
    source,
  })

  const testProfile = (profile: any, request: any, expected: any, expectedCompiled?: any) => {
    const o_request = request
    if (typeof request === 'string') {
      request = Conditions.requestFromUrl(request)
    }
    if (expectedCompiled === undefined) {
      expectedCompiled = Array.isArray(expected)
        ? expected[0]
        : expected
          ? Profiles.nameAsKey(expected.profileName)
          : undefined
    }

    const compiled = Profiles.compile(profile)
    let compileResult = eval('(' + compiled.print_to_string() + ')')
    if (typeof compileResult === 'function') {
      compileResult = compileResult(request.url, request.host, request.scheme)
    }

    if (expected != null) {
      const matchResult = Profiles.match(profile, request)
      try {
        if (expected.source !== undefined) {
          expect(matchResult.profileName).toBe(expected.profileName)
          expect(matchResult.source).toBe(expected.source)
        } else {
          expect(matchResult).toEqual(expected)
        }
      } catch (_) {
        const printResult = JSON.stringify(matchResult)
        const msg = `expect profile to return ${JSON.stringify(expected)} instead of ${printResult} for request ${o_request}`
        throw new Error(msg)
      }
    }

    if (compileResult !== expectedCompiled) {
      const msg = `expect COMPILED profile to return ${expectedCompiled} instead of ${compileResult} for request ${o_request}`
      throw new Error(msg)
    }

    return expected
  }

  describe('#pacResult', () => {
    it('should return DIRECT for no proxy', () => {
      expect(Profiles.pacResult()).toBe('DIRECT')
    })
    it('should return a valid PAC result for a proxy', () => {
      const proxy = { scheme: 'http', host: '127.0.0.1', port: 8888 }
      expect(Profiles.pacResult(proxy)).toBe('PROXY 127.0.0.1:8888')
    })
    it('should return SOCKS5 result for SOCKS5 proxy', () => {
      const proxy = { scheme: 'socks5', host: '127.0.0.1', port: 8888 }
      expect(Profiles.pacResult(proxy)).toBe('SOCKS5 127.0.0.1:8888')
    })
  })

  describe('#byName', () => {
    it('should get profiles from builtin profiles', () => {
      const profile = Profiles.byName('direct')
      expect(typeof profile).toBe('object')
      expect(profile.profileType).toBe('DirectProfile')
    })
    it('should get profiles from given options', () => {
      const profile = {}
      const result = Profiles.byName('profile', { '+profile': profile })
      expect(result).toBe(profile)
    })
  })

  describe('#allReferenceSet', () => {
    const profile = Profiles.create('test', 'VirtualProfile')
    profile.defaultProfileName = 'bogus'
    it('should throw if referenced profile does not exist', () => {
      const getAllReferenceSet = () => Profiles.allReferenceSet(profile, {})
      expect(getAllReferenceSet).toThrow(Error)
    })
    it('should process a dumb profile for each missing profile if requested', () => {
      profile.defaultProfileName = 'bogus'
      const refs = Profiles.allReferenceSet(profile, {}, { profileNotFound: 'dumb' })
      expect(refs['+bogus']).toBe('bogus')
    })
  })

  describe('SystemProfile', () => {
    it('should be builtin with the name "system"', () => {
      const profile = Profiles.byName('system')
      expect(typeof profile).toBe('object')
      expect(profile.profileType).toBe('SystemProfile')
    })
    it('should not match request to profiles', () => {
      const profile = Profiles.byName('system')
      expect(Profiles.match(profile, {})).toBeUndefined()
    })
    it('should throw when trying to compile', () => {
      const profile = Profiles.byName('system')
      expect(() => Profiles.compile(profile)).toThrow()
    })
  })

  describe('DirectProfile', () => {
    it('should be builtin with the name "direct"', () => {
      const profile = Profiles.byName('direct')
      expect(typeof profile).toBe('object')
      expect(profile.profileType).toBe('DirectProfile')
    })
    it('should return "DIRECT" when compiled', () => {
      const profile = Profiles.byName('direct')
      testProfile(profile, {}, null, 'DIRECT')
    })
  })

  describe('FixedProfile', () => {
    const profile = {
      profileType: 'FixedProfile',
      bypassList: [{ conditionType: 'BypassCondition', pattern: '<local>' }],
      proxyForHttp: { scheme: 'socks4', host: '127.0.0.1', port: 1234 },
      proxyForHttps: { scheme: 'http', host: '127.0.0.1', port: 2345 },
      fallbackProxy: { scheme: 'socks4', host: '127.0.0.1', port: 3456 },
      auth: {
        proxyForHttps: { username: 'test', password: 'cheesecake' },
      },
    }
    it('should use protocol-specific proxies if suitable', () => {
      testProfile(profile, 'https://www.example.com/', [
        'PROXY 127.0.0.1:2345',
        'https',
        profile.proxyForHttps,
        (profile as any).auth.proxyForHttps,
      ])
    })
    it('should use fallback proxies for other protocols', () => {
      testProfile(profile, 'ftp://www.example.com/', [
        'SOCKS 127.0.0.1:3456',
        '',
        profile.fallbackProxy,
        undefined,
      ])
    })
    it('should not return authentication if not provided for protocol', () => {
      testProfile(profile, 'http://www.example.com/', [
        'SOCKS 127.0.0.1:1234',
        'http',
        profile.proxyForHttp,
        undefined,
      ])
    })
    it('should not use any proxy for requests matching the bypassList', () => {
      testProfile(profile, 'ftp://localhost/', [
        'DIRECT',
        profile.bypassList[0],
        { scheme: 'direct' },
        undefined,
      ])
    })
  })

  describe('PacProfile', () => {
    const profile = Profiles.create('test', 'PacProfile')
    profile.pacScript = `function FindProxyForURL(url, host) {
  return "PROXY " + host + ":8080";
}`
    it('should return the result of the pac script', () => {
      testProfile(profile, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080')
    })
    it('should not fail for PAC with trailing comments', () => {
      let p = Profiles.create('test', 'PacProfile')
      p.pacScript = profile.pacScript + '\n// This is a trailing line comment.'
      testProfile(p, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080')

      p = Profiles.create('test', 'PacProfile')
      p.pacScript = profile.pacScript + '\n/* This is a multiline comment which is not properly closed.'
      testProfile(p, 'ftp://www.example.com:9999/abc', null, 'PROXY www.example.com:8080')
    })
    it('should return includable for non-file pacUrl', () => {
      expect(Profiles.isIncludable(profile)).toBe(true)
    })
    it('should return not includable for file: pacUrl', () => {
      const p = Profiles.create('test', 'PacProfile')
      p.pacUrl = 'file:///proxy.pac'
      expect(Profiles.isIncludable(p)).toBe(false)
    })
  })

  describe('SwitchProfile', () => {
    const profile = Profiles.create('test', 'SwitchProfile')
    profile.rules = [
      {
        condition: { conditionType: 'HostWildcardCondition', pattern: 'company.abc.example.com' },
        profileName: 'company',
      },
      {
        condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' },
        profileName: 'example',
      },
      {
        condition: { conditionType: 'HostWildcardCondition', pattern: '*.abc.example.com' },
        profileName: 'abc',
      },
    ]
    profile.defaultProfileName = 'default'

    it('should match requests based on rules', () => {
      testProfile(profile, 'http://company.abc.example.com:998/abc', profile.rules[0])
    })
    it('should respect the order of rules', () => {
      testProfile(profile, 'http://abc.example.com:9999/abc', profile.rules[1])
      testProfile(profile, 'http://www.example.com:9999/abc', profile.rules[1])
    })
    it('should return defaultProfileName when no rules match', () => {
      testProfile(profile, 'http://www.example.org:9999/abc', ['+default', null])
    })
    it('should calulate directly referenced profiles correctly', () => {
      const set = Profiles.directReferenceSet(profile)
      expect(set).toEqual({
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc',
        '+default': 'default',
      })
    })
    it('should clear the reference cache on profile revision change', () => {
      profile.revision = 'a'
      Profiles.directReferenceSet(profile)
      profile.defaultProfileName = 'abc'
      profile.revision = 'b'
      const newSet = Profiles.directReferenceSet(profile)
      expect(newSet).toEqual({
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc',
      })
    })
    it('should clear the reference cache if explicitly requested', () => {
      profile.revision = 'a'
      Profiles.directReferenceSet(profile)
      profile.defaultProfileName = 'abc'
      Profiles.dropCache(profile)
      const newSet = Profiles.directReferenceSet(profile)
      expect(newSet).toEqual({
        '+company': 'company',
        '+example': 'example',
        '+abc': 'abc',
      })
    })
  })

  describe('VirtualProfile', () => {
    const profile = Profiles.create('test', 'VirtualProfile')
    profile.defaultProfileName = 'default'
    it('should always return defaultProfileName', () => {
      testProfile(profile, 'http://www.example.com/abc', ['+default', null])
    })
  })

  describe('RulelistProfile', () => {
    const profile = Profiles.create('test', 'AutoProxyRuleListProfile')
    profile.defaultProfileName = 'default'
    profile.matchProfileName = 'example'
    profile.ruleList = 'example.com'
    profile.revision = 'a'

    it('should calulate directly referenced profiles correctly', () => {
      const set = Profiles.directReferenceSet(profile)
      expect(set).toEqual({ '+example': 'example', '+default': 'default' })
    })
    it('should calulate referenced profiles for rule list with results', () => {
      const set = Profiles.directReferenceSet({
        profileType: 'RuleListProfile',
        format: 'Switchy',
        matchProfileName: 'ignored',
        defaultProfileName: 'alsoIgnored',
        ruleList: '[SwitchyOmega Conditions]\n@with result\n!*.example.org\n*.example.com +ABC\n* +DEF\n',
      })
      expect(set).toEqual({ '+ABC': 'ABC', '+DEF': 'DEF' })
    })
    it('should match requests based on the rule list', () => {
      testProfile(profile, 'http://localhost/example.com', ruleListResult('example', 'example.com'))
      testProfile(profile, 'http://localhost/example.org', ['+default', null])
    })
    it('should update rule list on update', () => {
      Profiles.update(profile, 'example.org')
      profile.revision = 'b'
      testProfile(profile, 'http://localhost/example.com', ['+default', null])
      testProfile(profile, 'http://localhost/example.org', ruleListResult('example', 'example.org'))
    })
    it('should not fail when ruleList is not provided', () => {
      const p = {
        profileType: 'RuleListProfile',
        format: 'Switchy',
        matchProfileName: 'match',
        defaultProfileName: 'default',
      }
      expect(typeof Profiles.directReferenceSet(p)).toBe('object')
      testProfile(p, 'http://localhost/example.com', ['+default', null])
    })
    it('should switch to AutoProxy format on update if detected', () => {
      const p = Profiles.create('test2', 'RuleListProfile')
      p.format = 'Switchy'
      p.defaultProfileName = 'default'
      p.matchProfileName = 'example'

      expect(p.format).toBe('Switchy')
      Profiles.update(p, '[AutoProxy]\nexample.org')
      expect(p.format).toBe('AutoProxy')

      testProfile(p, 'http://localhost/example.com', ['+default', null])
      testProfile(p, 'http://localhost/example.org', ruleListResult('example', 'example.org'))
    })
  })
})
