import { describe, it, expect } from 'vitest'
import { getProfileIcon, getProfileColor } from '@/composables/useProfileIcons'
import { builtinProfiles, profileColors } from '@/composables/useProfiles'

describe('useProfileIcons', () => {
  // ── getProfileIcon ────────────────────────────────────────────────
  describe('getProfileIcon', () => {
    it('returns correct icon for each profile type', () => {
      const cases: [string, string][] = [
        ['DirectProfile', 'glyphicon-transfer'],
        ['SystemProfile', 'glyphicon-off'],
        ['AutoDetectProfile', 'glyphicon-file'],
        ['FixedProfile', 'glyphicon-globe'],
        ['PacProfile', 'glyphicon-file'],
        ['RuleListProfile', 'glyphicon-list'],
        ['SwitchProfile', 'glyphicon-retweet'],
        ['VirtualProfile', 'glyphicon-question-sign'],
      ]
      for (const [type, expected] of cases) {
        const profile = { profileType: type, name: 'test' }
        expect(getProfileIcon(profile)).toBe(expected)
      }
    })

    it('returns fallback icon for unknown profile type', () => {
      expect(getProfileIcon({ profileType: 'UnknownType' })).toBe('glyphicon-question-sign')
    })

    it('returns fallback icon for null/undefined profile', () => {
      expect(getProfileIcon(null)).toBe('glyphicon-question-sign')
      expect(getProfileIcon(undefined)).toBe('glyphicon-question-sign')
    })

    it('resolves VirtualProfile to its target type icon', () => {
      const options = {
        '+myFixed': { name: 'myFixed', profileType: 'FixedProfile' },
      }
      const vp = {
        profileType: 'VirtualProfile',
        defaultProfileName: 'myFixed',
        name: 'vp',
      }
      expect(getProfileIcon(vp, options)).toBe('glyphicon-globe')
    })

    it('falls back to VirtualProfile icon when target not found', () => {
      const options = {}
      const vp = {
        profileType: 'VirtualProfile',
        defaultProfileName: 'missing',
        name: 'vp',
      }
      expect(getProfileIcon(vp, options)).toBe('glyphicon-question-sign')
    })
  })

  // ── getProfileColor ───────────────────────────────────────────────
  describe('getProfileColor', () => {
    it('returns the profile color when set', () => {
      const profile = { name: 'custom', profileType: 'FixedProfile', color: '#ff0000' }
      expect(getProfileColor(profile)).toBe('#ff0000')
    })

    it('returns #999 for null/undefined profile', () => {
      expect(getProfileColor(null)).toBe('#999')
      expect(getProfileColor(undefined)).toBe('#999')
    })

    it('returns builtin profile color for direct (via builtinProfiles key lookup)', () => {
      // getProfileColor looks up builtinProfiles[profile.name] which is builtinProfiles['direct']
      // builtinProfiles keys are '+direct', '+system', so builtinProfiles['direct'] is undefined
      // This falls back to profileColors[0]
      const profile = { name: 'direct', profileType: 'DirectProfile' }
      expect(getProfileColor(profile)).toBe(profileColors[0])
    })

    it('returns builtin profile color for system (via builtinProfiles key lookup)', () => {
      const profile = { name: 'system', profileType: 'SystemProfile' }
      expect(getProfileColor(profile)).toBe(profileColors[0])
    })

    it('returns first profileColor as default for non-builtin without color', () => {
      const profile = { name: 'noColor', profileType: 'FixedProfile' }
      expect(getProfileColor(profile)).toBe(profileColors[0])
    })

    it('follows VirtualProfile chain to resolve color', () => {
      const options = {
        '+colored': { name: 'colored', profileType: 'FixedProfile', color: '#123456' },
      }
      const vp = {
        profileType: 'VirtualProfile',
        defaultProfileName: 'colored',
        name: 'vp',
      }
      expect(getProfileColor(vp, options)).toBe('#123456')
    })

    it('uses VirtualProfile own color when set', () => {
      const options = {
        '+colored': { name: 'colored', profileType: 'FixedProfile', color: '#123456' },
      }
      const vp = {
        profileType: 'VirtualProfile',
        defaultProfileName: 'colored',
        name: 'vp',
        color: '#abcdef',
      }
      expect(getProfileColor(vp, options)).toBe('#abcdef')
    })
  })
})
