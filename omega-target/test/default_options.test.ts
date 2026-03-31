import { describe, it, expect } from 'vitest'
import defaultOptions from '../src/default_options'
import type { DefaultOptions } from '../src/default_options'

describe('defaultOptions', () => {
  it('should return a fresh object each time', () => {
    const a = defaultOptions()
    const b = defaultOptions()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('should have schemaVersion 2', () => {
    const opts = defaultOptions()
    expect(opts.schemaVersion).toBe(2)
  })

  it('should have required boolean settings', () => {
    const opts = defaultOptions()
    expect(opts['-enableQuickSwitch']).toBe(false)
    expect(opts['-refreshOnProfileChange']).toBe(true)
    expect(opts['-revertProxyChanges']).toBe(true)
    expect(opts['-confirmDeletion']).toBe(true)
    expect(opts['-showInspectMenu']).toBe(true)
    expect(opts['-addConditionsToBottom']).toBe(false)
    expect(opts['-showResultProfileOnActionBadgeText']).toBe(false)
    expect(opts['-showExternalProfile']).toBe(true)
  })

  it('should have empty startupProfileName', () => {
    const opts = defaultOptions()
    expect(opts['-startupProfileName']).toBe('')
  })

  it('should have empty quickSwitchProfiles', () => {
    const opts = defaultOptions()
    expect(opts['-quickSwitchProfiles']).toEqual([])
  })

  it('should have downloadInterval of 1440', () => {
    const opts = defaultOptions()
    expect(opts['-downloadInterval']).toBe(1440)
  })

  it('should contain a proxy FixedProfile', () => {
    const opts = defaultOptions()
    const proxy = opts['+proxy'] as Record<string, unknown>
    expect(proxy).toBeDefined()
    expect(proxy['profileType']).toBe('FixedProfile')
    expect(proxy['name']).toBe('proxy')
    expect(proxy['color']).toBe('#99ccee')
  })

  it('should contain proxy bypass list with localhost entries', () => {
    const opts = defaultOptions()
    const proxy = opts['+proxy'] as Record<string, unknown>
    const bypassList = proxy['bypassList'] as Array<Record<string, unknown>>
    expect(bypassList.length).toBe(3)
    const patterns = bypassList.map((b) => b['pattern'])
    expect(patterns).toContain('127.0.0.1')
    expect(patterns).toContain('::1')
    expect(patterns).toContain('localhost')
  })

  it('should contain a fallback proxy', () => {
    const opts = defaultOptions()
    const proxy = opts['+proxy'] as Record<string, unknown>
    const fallback = proxy['fallbackProxy'] as Record<string, unknown>
    expect(fallback['port']).toBe(8080)
    expect(fallback['scheme']).toBe('http')
    expect(fallback['host']).toBe('proxy.example.com')
  })

  it('should contain an auto switch SwitchProfile', () => {
    const opts = defaultOptions()
    const autoSwitch = opts['+auto switch'] as Record<string, unknown>
    expect(autoSwitch['profileType']).toBe('SwitchProfile')
    expect(autoSwitch['name']).toBe('auto switch')
    expect(autoSwitch['color']).toBe('#99dd99')
    expect(autoSwitch['defaultProfileName']).toBe('direct')
  })

  it('should contain auto switch rules', () => {
    const opts = defaultOptions()
    const autoSwitch = opts['+auto switch'] as Record<string, unknown>
    const rules = autoSwitch['rules'] as Array<Record<string, unknown>>
    expect(rules.length).toBe(2)
    expect((rules[0]['condition'] as Record<string, unknown>)['pattern']).toBe(
      'internal.example.com'
    )
    expect(rules[0]['profileName']).toBe('direct')
    expect((rules[1]['condition'] as Record<string, unknown>)['pattern']).toBe(
      '*.example.com'
    )
    expect(rules[1]['profileName']).toBe('proxy')
  })

  it('should not share references between calls', () => {
    const a = defaultOptions()
    const b = defaultOptions()
    ;(a['+proxy'] as Record<string, unknown>)['name'] = 'changed'
    expect((b['+proxy'] as Record<string, unknown>)['name']).toBe('proxy')
  })
})
