import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Options, { ProfileNotExistError, NoOptionsError } from '../src/options'
import Storage from '../src/storage'
import type { StorageItems } from '../src/storage'
import Log from '../src/log'
import * as OmegaPac from 'omega-pac'

beforeAll(() => {
  vi.spyOn(Log, 'log').mockImplementation(() => {})
  vi.spyOn(Log, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

function createMockProxyImpl() {
  return {
    applyProfile: vi.fn().mockResolvedValue(undefined),
  }
}

function createOptions(overrides: {
  storage?: Storage
  state?: Storage
  sync?: null
  proxyImpl?: ReturnType<typeof createMockProxyImpl>
} = {}) {
  const storage = overrides.storage ?? new Storage()
  const state = overrides.state ?? new Storage()
  const proxyImpl = overrides.proxyImpl ?? createMockProxyImpl()
  const opts = new Options(storage, state, Log, null, proxyImpl)
  return { opts, storage, state, proxyImpl }
}

function buildDefaultOptions(): StorageItems {
  const opts = new Options()
  return opts.getDefaultOptions()
}

describe('Options', () => {
  describe('Error classes', () => {
    it('ProfileNotExistError should include profile name', () => {
      const err = new ProfileNotExistError('myProfile')
      expect(err.name).toBe('ProfileNotExistError')
      expect(err.profileName).toBe('myProfile')
      expect(err.message).toContain('myProfile')
      expect(err).toBeInstanceOf(Error)
    })

    it('NoOptionsError should have correct name', () => {
      const err = new NoOptionsError()
      expect(err.name).toBe('NoOptionsError')
      expect(err).toBeInstanceOf(Error)
    })

    it('should expose error classes as static properties', () => {
      expect(Options.ProfileNotExistError).toBe(ProfileNotExistError)
      expect(Options.NoOptionsError).toBe(NoOptionsError)
    })
  })

  describe('constructor', () => {
    it('should create with default storage and state', () => {
      const opts = new Options()
      expect(opts.getAll()).toEqual({})
    })

    it('should accept custom storage and state', () => {
      const storage = new Storage()
      const state = new Storage()
      const opts = new Options(storage, state)
      expect(opts.getAll()).toEqual({})
    })
  })

  describe('#getDefaultOptions', () => {
    it('should return valid default options with schemaVersion 2', () => {
      const opts = new Options()
      const defaults = opts.getDefaultOptions()
      expect(defaults['schemaVersion']).toBe(2)
      expect(defaults['+proxy']).toBeDefined()
      expect(defaults['+auto switch']).toBeDefined()
    })
  })

  describe('#getAll', () => {
    it('should return the internal options reference', () => {
      const opts = new Options()
      expect(opts.getAll()).toEqual({})
    })
  })

  describe('#toString', () => {
    it('should return <Options>', () => {
      const opts = new Options()
      expect(opts.toString()).toBe('<Options>')
    })
  })

  describe('#parseOptions', () => {
    it('should pass through a valid object', () => {
      const { opts } = createOptions()
      const input = { schemaVersion: 2, '+proxy': {} }
      expect(opts.parseOptions(input)).toEqual(input)
    })

    it('should parse JSON string', () => {
      const { opts } = createOptions()
      const obj = { schemaVersion: 2 }
      expect(opts.parseOptions(JSON.stringify(obj))).toEqual(obj)
    })

    it('should throw on invalid input', () => {
      const { opts } = createOptions()
      expect(() => opts.parseOptions(null)).toThrow('Invalid options!')
    })

    it('should throw on invalid JSON string', () => {
      const { opts } = createOptions()
      expect(() => opts.parseOptions('not-json')).toThrow()
    })
  })

  describe('#upgrade', () => {
    it('should accept schemaVersion 2 without changes', async () => {
      const { opts } = createOptions()
      const options: StorageItems = { schemaVersion: 2 }
      const [result, changes] = await opts.upgrade(options)
      expect(result).toBe(options)
      expect(changes).toEqual({})
    })

    it('should upgrade schemaVersion 1 to 2', async () => {
      const { opts } = createOptions()
      const options: StorageItems = { schemaVersion: 1 }
      const [result, changes] = await opts.upgrade(options)
      expect(result['schemaVersion']).toBe(2)
      expect(changes['schemaVersion']).toBe(2)
    })

    it('should reject invalid schemaVersion', async () => {
      const { opts } = createOptions()
      const options: StorageItems = { schemaVersion: 99 }
      await expect(opts.upgrade(options)).rejects.toThrow('Invalid schemaVersion')
    })

    it('should clear syncOptions disabled from profiles', async () => {
      const { opts } = createOptions()
      const profile = {
        name: 'test',
        profileType: 'FixedProfile',
        syncOptions: 'disabled',
        syncError: { reason: 'quotaPerItem' },
      }
      const options: StorageItems = {
        schemaVersion: 2,
        '+test': profile,
      }
      const [result] = await opts.upgrade(options)
      const p = result['+test'] as Record<string, unknown>
      expect(p['syncOptions']).toBeUndefined()
      expect(p['syncError']).toBeUndefined()
    })
  })

  describe('#profile', () => {
    it('should return a profile by name', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      const profile = opts.profile('proxy') as Record<string, unknown>
      expect(profile).toBeDefined()
      expect(profile['name']).toBe('proxy')
      expect(profile['profileType']).toBe('FixedProfile')
    })

    it('should return undefined for non-existent profile', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      expect(opts.profile('nonexistent')).toBeUndefined()
    })
  })

  describe('#applyProfile', () => {
    it('should reject when profile does not exist', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await expect(opts.applyProfile('nonexistent')).rejects.toThrow(
        ProfileNotExistError
      )
    })

    it('should apply a known profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('proxy')
      expect(proxyImpl.applyProfile).toHaveBeenCalled()
    })

    it('should set current profile name after apply', async () => {
      const { opts, storage, state, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('proxy')
      const stateItems = await state.get('currentProfileName')
      expect(stateItems['currentProfileName']).toBe('proxy')
    })

    it('should set isSystem for system profile type', async () => {
      const { opts, storage, state, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      // system profile is a builtin
      await opts.applyProfile('system')
      expect(opts.isSystem()).toBe(true)
    })

    it('should skip proxy call when proxy option is false', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      proxyImpl.applyProfile.mockClear()
      await opts.applyProfile('proxy', { proxy: false })
      expect(proxyImpl.applyProfile).not.toHaveBeenCalled()
    })
  })

  describe('#currentProfile', () => {
    it('should return null when no profile is applied', () => {
      const { opts } = createOptions()
      expect(opts.currentProfile()).toBeNull()
    })

    it('should return the current profile after apply', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('proxy')
      const current = opts.currentProfile() as Record<string, unknown>
      expect(current).toBeDefined()
      expect(current['name']).toBe('proxy')
    })
  })

  describe('#isCurrentProfileStatic', () => {
    it('should return true when no profile is set', () => {
      const { opts } = createOptions()
      expect(opts.isCurrentProfileStatic()).toBe(true)
    })
  })

  describe('#addProfile', () => {
    it('should add a new profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const newProfile = OmegaPac.Profiles.create({
        name: 'my-new-proxy',
        profileType: 'FixedProfile',
        color: '#ff0000',
      }) as Record<string, unknown>

      await opts.addProfile(newProfile)
      const stored = await storage.get('+my-new-proxy')
      expect(stored['+my-new-proxy']).toBeDefined()
      expect(
        (stored['+my-new-proxy'] as Record<string, unknown>)['name']
      ).toBe('my-new-proxy')
    })

    it('should reject if name is already taken', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const duplicate = OmegaPac.Profiles.create({
        name: 'proxy',
        profileType: 'FixedProfile',
      }) as Record<string, unknown>

      await expect(opts.addProfile(duplicate)).rejects.toThrow('already taken')
    })
  })

  describe('#renameProfile', () => {
    it('should rename a profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await opts.renameProfile('proxy', 'my-proxy')
      const stored = await storage.get(null)
      expect(stored['+my-proxy']).toBeDefined()
      expect(stored['+proxy']).toBeUndefined()
      expect(
        (stored['+my-proxy'] as Record<string, unknown>)['name']
      ).toBe('my-proxy')
    })

    it('should reject if target name is already taken', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(
        opts.renameProfile('proxy', 'auto switch')
      ).rejects.toThrow('already taken')
    })

    it('should reject if source profile does not exist', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(
        opts.renameProfile('nonexistent', 'new-name')
      ).rejects.toThrow(ProfileNotExistError)
    })

    it('should update references in other profiles', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      // auto switch references 'proxy', rename it
      await opts.renameProfile('proxy', 'renamed-proxy')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      const proxyRule = rules.find((r) => r['profileName'] === 'renamed-proxy')
      expect(proxyRule).toBeDefined()
    })
  })

  describe('#replaceRef', () => {
    it('should reject if source profile does not exist', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(opts.replaceRef('nonexistent', 'proxy')).rejects.toThrow(
        ProfileNotExistError
      )
    })

    it('should update startup profile name reference', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      defaults['-startupProfileName'] = 'proxy'
      await storage.set(defaults)
      await opts.loadOptions()

      await opts.replaceRef('proxy', 'direct')
      const all = opts.getAll()
      expect(all['-startupProfileName']).toBe('direct')
    })
  })

  describe('#setDefaultProfile', () => {
    it('should set defaultProfileName on a switch profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await opts.setDefaultProfile('auto switch', 'proxy')
      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      expect(autoSwitch['defaultProfileName']).toBe('proxy')
    })

    it('should reject if profile does not exist', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(
        opts.setDefaultProfile('nonexistent', 'proxy')
      ).rejects.toThrow(ProfileNotExistError)
    })

    it('should reject if target profile does not exist', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(
        opts.setDefaultProfile('auto switch', 'nonexistent')
      ).rejects.toThrow(ProfileNotExistError)
    })

    it('should reject if profile has no defaultProfileName', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await expect(
        opts.setDefaultProfile('proxy', 'direct')
      ).rejects.toThrow('does not have defaultProfileName')
    })
  })

  describe('#addCondition', () => {
    it('should add a condition to the current switch profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.test.com',
      }
      await opts.addCondition(condition, 'proxy')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      const matchingRule = rules.find(
        (r) =>
          (r['condition'] as Record<string, unknown>)['pattern'] ===
          '*.test.com'
      )
      expect(matchingRule).toBeDefined()
      expect(matchingRule!['profileName']).toBe('proxy')
    })

    it('should add conditions to top by default', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.first.com',
      }
      await opts.addCondition(condition, 'proxy')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      expect(
        (rules[0]['condition'] as Record<string, unknown>)['pattern']
      ).toBe('*.first.com')
    })

    it('should add conditions to bottom when configured', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      defaults['-addConditionsToBottom'] = true
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.last.com',
      }
      await opts.addCondition(condition, 'proxy')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      expect(
        (rules[rules.length - 1]['condition'] as Record<string, unknown>)[
          'pattern'
        ]
      ).toBe('*.last.com')
    })

    it('should accept an array of conditions', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const conditions = [
        { conditionType: 'HostWildcardCondition', pattern: '*.a.com' },
        { conditionType: 'HostWildcardCondition', pattern: '*.b.com' },
      ]
      await opts.addCondition(conditions, 'proxy')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      const patterns = rules.map(
        (r) => (r['condition'] as Record<string, unknown>)['pattern']
      )
      expect(patterns).toContain('*.a.com')
      expect(patterns).toContain('*.b.com')
    })

    it('should reject when target profile does not exist', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.test.com',
      }
      await expect(
        opts.addCondition(condition, 'nonexistent')
      ).rejects.toThrow(ProfileNotExistError)
    })

    it('should reject when current profile has no rules', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('proxy')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.test.com',
      }
      await expect(opts.addCondition(condition, 'direct')).rejects.toThrow(
        'Cannot add condition'
      )
    })

    it('should deduplicate conditions by tag', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      const condition = {
        conditionType: 'HostWildcardCondition',
        pattern: '*.example.com',
      }
      // This condition already exists in the default rules
      await opts.addCondition(condition, 'direct')

      const all = opts.getAll()
      const autoSwitch = all['+auto switch'] as Record<string, unknown>
      const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
      const matching = rules.filter(
        (r) =>
          (r['condition'] as Record<string, unknown>)['pattern'] ===
          '*.example.com'
      )
      expect(matching.length).toBe(1)
      expect(matching[0]['profileName']).toBe('direct')
    })
  })

  describe('#addTempRule', () => {
    it('should add a temp rule for a domain', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await opts.addTempRule('example.org', 'proxy')
      const rules = opts.getTempRules()
      expect(rules['example.org']).toBeDefined()
      expect(rules['example.org']['profileName']).toBe('proxy')
    })

    it('should toggle off an existing temp rule', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await opts.addTempRule('example.org', 'proxy')
      // Toggle off by calling with same domain and profile
      await opts.addTempRule('example.org', 'proxy')
      const rules = opts.getTempRules()
      expect(rules['example.org']).toBeUndefined()
    })

    it('should reject for non-existent profile', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await expect(
        opts.addTempRule('example.org', 'nonexistent')
      ).rejects.toThrow(ProfileNotExistError)
    })

    it('should do nothing when no current profile', async () => {
      const { opts } = createOptions()
      const result = await opts.addTempRule('example.org', 'proxy')
      expect(result).toBeUndefined()
    })

    it('should use toggle=1 to only add if not present', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await opts.addTempRule('example.org', 'proxy')
      // toggle=1 should be no-op since already present
      await opts.addTempRule('example.org', 'proxy', 1)
      const rules = opts.getTempRules()
      expect(rules['example.org']).toBeDefined()
    })

    it('should use toggle=-1 to only remove if present', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      // toggle=-1 should be no-op since not present
      await opts.addTempRule('example.org', 'proxy', -1)
      const rules = opts.getTempRules()
      expect(rules['example.org']).toBeUndefined()
    })

    it('should switch profile of existing temp rule', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await opts.addTempRule('example.org', 'proxy')
      await opts.addTempRule('example.org', 'direct')
      const rules = opts.getTempRules()
      expect(rules['example.org']['profileName']).toBe('direct')
    })
  })

  describe('#queryTempRule', () => {
    it('should return null when no temp rule exists', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      expect(opts.queryTempRule('example.org')).toBeNull()
    })

    it('should return profile name for existing temp rule', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      await opts.addTempRule('example.org', 'proxy')
      expect(opts.queryTempRule('example.org')).toBe('proxy')
    })
  })

  describe('#transformValueForSync', () => {
    it('should return undefined for -customCss', () => {
      expect(Options.transformValueForSync('body{}', '-customCss')).toBeUndefined()
    })

    it('should pass through non-profile values', () => {
      expect(Options.transformValueForSync('hello', '-someSetting')).toBe('hello')
      expect(Options.transformValueForSync(42, '-count')).toBe(42)
    })

    it('should strip download data from updatable profiles', () => {
      // Create a profile that OmegaPac.Profiles.updateUrl recognizes
      const profile = OmegaPac.Profiles.create({
        name: 'test',
        profileType: 'RuleListProfile',
      }) as Record<string, unknown>
      profile['sourceUrl'] = 'http://example.com/list'
      profile['lastUpdate'] = '2024-01-01'
      profile['ruleList'] = 'some rules'
      profile['pacScript'] = 'script'
      profile['sha256'] = 'hash'
      profile['color'] = '#ff0000'

      const result = Options.transformValueForSync(profile, '+test') as Record<string, unknown>
      expect(result['lastUpdate']).toBeUndefined()
      expect(result['ruleList']).toBeUndefined()
      expect(result['pacScript']).toBeUndefined()
      expect(result['sha256']).toBeUndefined()
      expect(result['color']).toBe('#ff0000')
      expect(result['name']).toBe('test')
    })

    it('should return profile as-is when no updateUrl', () => {
      const profile = {
        name: 'test',
        profileType: 'FixedProfile',
        color: '#ff0000',
      }
      const result = Options.transformValueForSync(profile, '+test')
      expect(result).toBe(profile)
    })
  })

  describe('#loadOptions and #init', () => {
    it('should load options from storage', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      const all = opts.getAll()
      expect(all['schemaVersion']).toBe(2)
    })

    it('should set syncOptions to unsupported when no sync', async () => {
      const { opts, storage, state } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      const stateItems = await state.get('syncOptions')
      expect(stateItems['syncOptions']).toBe('unsupported')
    })

    it('should init with provided options', async () => {
      const { opts } = createOptions()
      const defaults = buildDefaultOptions()
      await opts.initWithOptions(defaults)
      const all = opts.getAll()
      expect(all['schemaVersion']).toBe(2)
    })

    it('should fallback to init when initWithOptions gets null', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.initWithOptions(null)
      const all = opts.getAll()
      expect(all['schemaVersion']).toBe(2)
    })
  })

  describe('#reset', () => {
    it('should reset to default options', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      // Modify an option
      const all = opts.getAll()
      all['-downloadInterval'] = 9999

      await opts.reset()
      const resetAll = opts.getAll()
      expect(resetAll['-downloadInterval']).toBe(1440)
      expect(resetAll['schemaVersion']).toBe(2)
    })

    it('should reset with custom options', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const custom = buildDefaultOptions()
      custom['-downloadInterval'] = 60
      await opts.reset(custom)
      const all = opts.getAll()
      expect(all['-downloadInterval']).toBe(60)
    })
  })

  describe('#updateProfile', () => {
    it('should return empty object when no updatable profiles', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const result = await opts.updateProfile()
      expect(result).toEqual({})
    })
  })

  describe('#fetchUrl', () => {
    it('should reject with not implemented', async () => {
      const { opts } = createOptions()
      await expect(opts.fetchUrl('http://example.com')).rejects.toThrow(
        'not implemented'
      )
    })
  })

  describe('#setExternalProfile', () => {
    it('should set external profile for unknown profile', async () => {
      const { opts, storage, state, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      defaults['-revertProxyChanges'] = false
      await storage.set(defaults)
      await opts.loadOptions()

      const externalProfile = {
        name: 'External Proxy',
        profileType: 'FixedProfile',
        color: '#000000',
      }
      opts.setExternalProfile(externalProfile)
      const stateItems = await state.get('currentProfileName')
      expect(stateItems['currentProfileName']).toBe('')
    })

    it('should apply known profile when matching internal profile', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      defaults['-revertProxyChanges'] = false
      await storage.set(defaults)
      await opts.loadOptions()

      const externalProfile = { name: 'proxy', profileType: 'FixedProfile' }
      opts.setExternalProfile(externalProfile)
      // Should recognize it as internal 'proxy' profile
    })
  })

  describe('#watch', () => {
    it('should return a stop function', async () => {
      const { opts, storage } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const stop = opts.watch(() => {})
      expect(typeof stop).toBe('function')
      stop()
    })
  })

  describe('#isSystem', () => {
    it('should return false by default', () => {
      const { opts } = createOptions()
      expect(opts.isSystem()).toBe(false)
    })
  })

  describe('#printProfile', () => {
    it('should return null', () => {
      const { opts } = createOptions()
      expect(opts.printProfile({})).toBeNull()
    })
  })

  describe('#checkOptionsSyncChange', () => {
    it('should not throw when sync is null', () => {
      const { opts } = createOptions()
      expect(() => opts.checkOptionsSyncChange()).not.toThrow()
    })
  })

  describe('#_setOptions', () => {
    it('should persist changes to storage by default', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      await opts['_setOptions']({ '-downloadInterval': 60 })
      const stored = await storage.get('-downloadInterval')
      expect(stored['-downloadInterval']).toBe(60)
    })

    it('should not persist when persist is false', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      opts['_setOptions']({ '-downloadInterval': 60 }, { persist: false })
      const stored = await storage.get('-downloadInterval')
      // Storage still has original
      expect(stored['-downloadInterval']).toBe(1440)
    })

    it('should handle profile deletion', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()
      await opts.applyProfile('auto switch')

      // Delete proxy profile
      await opts['_setOptions']({ '+proxy': undefined })
      const all = opts.getAll()
      expect(all['+proxy']).toBeUndefined()
    })
  })

  describe('#patch', () => {
    it('should return undefined for null patch', () => {
      const { opts } = createOptions()
      expect(opts.patch(null as unknown as Record<string, unknown>)).toBeUndefined()
    })
  })

  describe('#_cleanUpQuickSwitchProfiles', () => {
    it('should return undefined for null input', async () => {
      const { opts } = createOptions()
      const result = opts['_cleanUpQuickSwitchProfiles'](null)
      expect(result).toBeUndefined()
    })

    it('should filter out empty names', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const result = opts['_cleanUpQuickSwitchProfiles'](['proxy', '', 'auto switch'])
      expect(result).toEqual(['proxy', 'auto switch'])
    })

    it('should filter out duplicate profiles', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const result = opts['_cleanUpQuickSwitchProfiles'](['proxy', 'proxy', 'auto switch'])
      expect(result).toEqual(['proxy', 'auto switch'])
    })

    it('should filter out non-existent profiles', async () => {
      const { opts, storage, proxyImpl } = createOptions()
      const defaults = buildDefaultOptions()
      await storage.set(defaults)
      await opts.loadOptions()

      const result = opts['_cleanUpQuickSwitchProfiles'](['proxy', 'nonexistent', 'auto switch'])
      expect(result).toEqual(['proxy', 'auto switch'])
    })
  })

  describe('#matchProfile', () => {
    it('should return external profile when no current profile', async () => {
      const { opts } = createOptions()
      const result = await opts.matchProfile({})
      expect(result.profile).toBeNull()
      expect(result.results).toEqual([])
    })
  })
})
