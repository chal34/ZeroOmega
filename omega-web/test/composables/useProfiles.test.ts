import { describe, it, expect, vi } from 'vitest'
import {
  builtinProfiles,
  profileColors,
  profileColorPalette,
  getAttachedName,
  getParentName,
  isProfileNameHidden,
  isProfileNameReserved,
  profileOrder,
  filterProfiles,
  dispName,
  getVirtualTarget,
} from '@/composables/useProfiles'

describe('useProfiles', () => {
  // ── builtinProfiles ────────────────────────────────────────────────
  describe('builtinProfiles', () => {
    it('contains +direct and +system profiles', () => {
      expect(builtinProfiles['+direct']).toBeDefined()
      expect(builtinProfiles['+system']).toBeDefined()
    })

    it('+direct has profileType DirectProfile', () => {
      expect(builtinProfiles['+direct'].profileType).toBe('DirectProfile')
      expect(builtinProfiles['+direct'].name).toBe('direct')
      expect(builtinProfiles['+direct'].builtin).toBe(true)
    })

    it('+system has profileType SystemProfile', () => {
      expect(builtinProfiles['+system'].profileType).toBe('SystemProfile')
      expect(builtinProfiles['+system'].name).toBe('system')
      expect(builtinProfiles['+system'].builtin).toBe(true)
    })
  })

  // ── profileColors ─────────────────────────────────────────────────
  describe('profileColors', () => {
    it('is an array of 9 color strings', () => {
      expect(profileColors).toHaveLength(9)
      profileColors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]+$/i))
    })
  })

  // ── profileColorPalette ───────────────────────────────────────────
  describe('profileColorPalette', () => {
    it('groups colors into rows of 3', () => {
      expect(profileColorPalette).toHaveLength(3)
      profileColorPalette.forEach((row) => expect(row).toHaveLength(3))
    })

    it('contains every color from profileColors', () => {
      const flat = profileColorPalette.flat()
      expect(flat).toEqual(profileColors)
    })
  })

  // ── getAttachedName / getParentName ───────────────────────────────
  describe('getAttachedName', () => {
    it('prefixes name with __ruleListOf_', () => {
      expect(getAttachedName('myProfile')).toBe('__ruleListOf_myProfile')
    })
  })

  describe('getParentName', () => {
    it('extracts parent name from attached name', () => {
      expect(getParentName('__ruleListOf_myProfile')).toBe('myProfile')
    })

    it('returns undefined for non-attached names', () => {
      expect(getParentName('myProfile')).toBeUndefined()
    })

    it('round-trips with getAttachedName', () => {
      const name = 'someProfile'
      expect(getParentName(getAttachedName(name))).toBe(name)
    })
  })

  // ── isProfileNameHidden / isProfileNameReserved ───────────────────
  describe('isProfileNameHidden', () => {
    it('returns true for names starting with _', () => {
      expect(isProfileNameHidden('_hidden')).toBe(true)
    })

    it('returns false for normal names', () => {
      expect(isProfileNameHidden('visible')).toBe(false)
    })

    it('returns true for reserved names (also start with _)', () => {
      expect(isProfileNameHidden('__reserved')).toBe(true)
    })
  })

  describe('isProfileNameReserved', () => {
    it('returns true for names starting with __', () => {
      expect(isProfileNameReserved('__reserved')).toBe(true)
    })

    it('returns false for single _ prefix', () => {
      expect(isProfileNameReserved('_hidden')).toBe(false)
    })

    it('returns false for normal names', () => {
      expect(isProfileNameReserved('normal')).toBe(false)
    })
  })

  // ── profileOrder ──────────────────────────────────────────────────
  describe('profileOrder', () => {
    it('sorts FixedProfile before PacProfile', () => {
      const a = { profileType: 'FixedProfile', name: 'a' }
      const b = { profileType: 'PacProfile', name: 'b' }
      expect(profileOrder(a, b)).toBeLessThan(0)
    })

    it('sorts PacProfile before VirtualProfile', () => {
      const a = { profileType: 'PacProfile', name: 'a' }
      const b = { profileType: 'VirtualProfile', name: 'b' }
      expect(profileOrder(a, b)).toBeLessThan(0)
    })

    it('sorts VirtualProfile before SwitchProfile', () => {
      const a = { profileType: 'VirtualProfile', name: 'a' }
      const b = { profileType: 'SwitchProfile', name: 'b' }
      expect(profileOrder(a, b)).toBeLessThan(0)
    })

    it('sorts SwitchProfile before RuleListProfile', () => {
      const a = { profileType: 'SwitchProfile', name: 'a' }
      const b = { profileType: 'RuleListProfile', name: 'b' }
      expect(profileOrder(a, b)).toBeLessThan(0)
    })

    it('sorts alphabetically within the same type', () => {
      const a = { profileType: 'FixedProfile', name: 'alpha' }
      const b = { profileType: 'FixedProfile', name: 'beta' }
      expect(profileOrder(a, b)).toBeLessThan(0)
      expect(profileOrder(b, a)).toBeGreaterThan(0)
    })

    it('returns 0 for identical profiles', () => {
      const a = { profileType: 'FixedProfile', name: 'same' }
      const b = { profileType: 'FixedProfile', name: 'same' }
      expect(profileOrder(a, b)).toBe(0)
    })

    it('treats unknown types as weight 0 (between Pac and Virtual)', () => {
      const unknown = { profileType: 'UnknownType', name: 'z' }
      const fixed = { profileType: 'FixedProfile', name: 'a' }
      const virtual = { profileType: 'VirtualProfile', name: 'a' }
      expect(profileOrder(fixed, unknown)).toBeLessThan(0)
      expect(profileOrder(unknown, virtual)).toBeLessThan(0)
    })
  })

  // ── filterProfiles ────────────────────────────────────────────────
  describe('filterProfiles', () => {
    const options: Record<string, any> = {
      '+myFixed': { name: 'myFixed', profileType: 'FixedProfile' },
      '+myPac': { name: 'myPac', profileType: 'PacProfile' },
      '+__reserved': { name: '__reserved', profileType: 'FixedProfile' },
      '+_hidden': { name: '_hidden', profileType: 'FixedProfile' },
      someOther: { ignored: true },
    }

    it('without filter: returns non-reserved profiles (keys starting with +)', () => {
      const result = filterProfiles(options)
      const names = result.map((p: any) => p.name)
      expect(names).toContain('myFixed')
      expect(names).toContain('myPac')
      expect(names).toContain('_hidden')
      expect(names).not.toContain('__reserved')
    })

    it('filter "all": includes builtin profiles, excludes hidden', () => {
      const result = filterProfiles(options, 'all')
      const names = result.map((p: any) => p.name)
      expect(names).toContain('myFixed')
      expect(names).toContain('direct')
      expect(names).toContain('system')
      expect(names).not.toContain('_hidden')
      expect(names).not.toContain('__reserved')
    })

    it('filter "sorted": returns profiles sorted by profileOrder', () => {
      const result = filterProfiles(options, 'sorted')
      const types = result.map((p: any) => p.profileType)
      const fixedIdx = types.indexOf('FixedProfile')
      const pacIdx = types.indexOf('PacProfile')
      if (fixedIdx >= 0 && pacIdx >= 0) {
        expect(fixedIdx).toBeLessThan(pacIdx)
      }
    })
  })

  // ── dispName ──────────────────────────────────────────────────────
  describe('dispName', () => {
    it('returns translated name when getMessage returns a value', () => {
      const getMessage = vi.fn((key: string) => {
        if (key === 'profile_myProxy') return 'My Proxy'
        return ''
      })
      expect(dispName('myProxy', getMessage)).toBe('My Proxy')
      expect(getMessage).toHaveBeenCalledWith('profile_myProxy')
    })

    it('falls back to raw name when getMessage returns empty', () => {
      const getMessage = vi.fn(() => '')
      expect(dispName('unknown', getMessage)).toBe('unknown')
    })

    it('accepts a profile object with .name', () => {
      const getMessage = vi.fn(() => '')
      const profile = { name: 'test', profileType: 'FixedProfile' }
      expect(dispName(profile, getMessage)).toBe('test')
      expect(getMessage).toHaveBeenCalledWith('profile_test')
    })
  })

  // ── getVirtualTarget ──────────────────────────────────────────────
  describe('getVirtualTarget', () => {
    const options = {
      '+real': { name: 'real', profileType: 'FixedProfile' },
    }

    it('returns the target profile for VirtualProfile', () => {
      const vp = { profileType: 'VirtualProfile', defaultProfileName: 'real' }
      expect(getVirtualTarget(vp, options)).toBe(options['+real'])
    })

    it('returns undefined for non-VirtualProfile', () => {
      const fp = { profileType: 'FixedProfile', name: 'real' }
      expect(getVirtualTarget(fp, options)).toBeUndefined()
    })

    it('returns undefined when target does not exist', () => {
      const vp = { profileType: 'VirtualProfile', defaultProfileName: 'missing' }
      expect(getVirtualTarget(vp, options)).toBeUndefined()
    })

    it('handles null/undefined profile gracefully', () => {
      expect(getVirtualTarget(null, options)).toBeUndefined()
      expect(getVirtualTarget(undefined, options)).toBeUndefined()
    })
  })
})
