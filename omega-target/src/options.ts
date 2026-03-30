/** @module omega-target/options */
import Log from './log'
import Storage, { StorageItems } from './storage'
import * as OmegaPac from 'omega-pac'
import { patch as jsonPatch } from 'jsondiffpatch'
import type { Delta } from 'jsondiffpatch'
import defaultOptions from './default_options'
import type OptionsSync from './options_sync'

declare const csso: { minify: (css: string) => { css: string } }

const generateSHA256 = (text: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    crypto.subtle
      .digest('SHA-256', data)
      .then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        resolve(hashHex)
      })
      .catch((e) => {
        console.log('eee', e)
        reject(e)
      })
  })
}

const PROFILETEMPPACKEY = '__tempZeroRuleListPac'
const transformValueKeys = ['lastUpdate', 'ruleList', 'pacScript', 'sha256']

const generateProfileTempPac = (profile: Record<string, unknown>): string => {
  const tempProfile = OmegaPac.Profiles.create(
    PROFILETEMPPACKEY,
    profile['profileType'] as string
  ) as Record<string, unknown>
  tempProfile['defaultProfileName'] = profile['defaultProfileName']
  tempProfile['format'] = profile['format']
  tempProfile['matchProfileName'] = profile['matchProfileName']
  tempProfile['ruleList'] = profile['ruleList']
  tempProfile['isTempPacProfile'] = true
  const options: Record<string, unknown> = {}
  const nameKey = OmegaPac.Profiles.nameAsKey(tempProfile as { name: string })
  options[nameKey] = tempProfile
  const profileNotFound = () => 'ignore'

  const ast = OmegaPac.PacGenerator.script(
    options,
    tempProfile['name'] as string,
    { profileNotFound }
  )
  let pac = ast.print_to_string({ beautify: true, comments: true })
  pac = OmegaPac.PacGenerator.ascii(pac)
  return pac
}

export class ProfileNotExistError extends Error {
  profileName: string
  constructor(profileName: string) {
    super(`Profile ${profileName} does not exist!`)
    this.profileName = profileName
    this.name = 'ProfileNotExistError'
  }
}

export class NoOptionsError extends Error {
  constructor() {
    super()
    this.name = 'NoOptionsError'
  }
}

class Options {
  static ProfileNotExistError = ProfileNotExistError
  static NoOptionsError = NoOptionsError

  protected _options: StorageItems = {}
  protected _storage: Storage
  protected _state: Storage
  protected _currentProfileName: string | null = null
  protected _revertToProfileName: string | null = null
  protected _watchingProfiles: Record<string, string> = {}
  protected _tempProfile: Record<string, unknown> | null = null
  protected _tempProfileActive = false
  protected _tempProfileRules: Record<string, Record<string, unknown>> = {}
  protected _tempProfileRulesByProfile: Record<
    string,
    Array<Record<string, unknown>>
  > = {}
  protected _externalProfile: Record<string, unknown> | null = null
  fallbackProfileName = 'system'
  protected _isSystem = false
  debugStr = 'Options'
  ready: Promise<unknown> | null = null
  protected sync: OptionsSync | null
  protected proxyImpl: {
    applyProfile: (
      profile: unknown,
      baseProfile: unknown,
      options: unknown
    ) => Promise<void>
  } | null
  log: typeof Log
  protected _syncWatchStop: (() => void) | null = null
  protected _watchStop: (() => void) | null = null
  protected optionsLoaded: Promise<unknown> | null = null

  static transformValueForSync(
    value: unknown,
    key: string
  ): unknown | undefined {
    if (key === '-customCss') {
      return undefined
    }
    if (key[0] === '+') {
      const profile = value as Record<string, unknown>
      if (OmegaPac.Profiles.updateUrl(profile)) {
        const result: Record<string, unknown> = {}
        for (const k of Object.keys(profile)) {
          if (transformValueKeys.indexOf(k) >= 0) continue
          result[k] = profile[k]
        }
        return result
      }
    }
    return value
  }

  constructor(
    storage?: Storage,
    state?: Storage,
    log?: typeof Log,
    sync?: OptionsSync | null,
    proxyImpl?: Options['proxyImpl']
  ) {
    this._options = {}
    this._tempProfileRules = {}
    this._tempProfileRulesByProfile = {}
    this._storage = storage || new Storage()
    this._state = state || new Storage()
    this.log = log || Log
    this.sync = sync || null
    this.proxyImpl = proxyImpl || null
  }

  initWithOptions(
    options: StorageItems | null | undefined,
    startupCheck?: () => boolean
  ): Promise<unknown> {
    if (!options) {
      return this.init(startupCheck)
    } else {
      this.ready = this._storage
        .remove()
        .then(() => this._storage.set(options))
        .then(() => this.init(startupCheck))
      return this.ready
    }
  }

  loadOptions({ retry = 3 }: { retry?: number } = {}): Promise<unknown> {
    this._syncWatchStop?.()
    this._syncWatchStop = null
    this._watchStop?.()
    this._watchStop = null

    let loadRaw: Promise<StorageItems | null>
    if (!this.sync) {
      loadRaw = this._state
        .set({ syncOptions: 'unsupported' })
        .then(() => this._storage.get(null))
    } else {
      loadRaw = this._state
        .get({ syncOptions: '', gistId: '', gistToken: '' })
        .then(({ syncOptions, gistId, gistToken }) => {
          if (!gistId) {
            if (syncOptions !== 'disabled') syncOptions = 'pristine'
            this._state.set({ syncOptions })
          }
          this.sync!.enabled = syncOptions === 'sync'
          if (!this.sync!.enabled) {
            return this._storage.get(null)
          } else {
            ;(
              this.sync! as unknown as {
                init: (args: unknown) => Promise<unknown>
              }
            )
              .init({ gistId, gistToken })
              .catch((e: unknown) => {
                console.log('sync init fail::', e)
              })
            this._syncWatchStop = this.sync!.watchAndPull(
              this._storage,
              this.updateProfile.bind(this)
            )
            return this.sync!
              .copyTo(this._storage)
              .catch((e: unknown) => {
                if (e instanceof Storage.StorageUnavailableError) {
                  console.error(
                    'Warning: Sync storage is not available in this ' +
                      'browser! Disabling options sync.'
                  )
                  this._syncWatchStop?.()
                  this._syncWatchStop = null
                  this.sync = null
                  this._state.set({ syncOptions: 'unsupported' })
                  return
                }
                throw e
              })
              .then(() => this._storage.get(null))
          }
        })
    }

    this.optionsLoaded = loadRaw
      .then((options) => this.upgrade(options!))
      .then(([options, changes]) =>
        this._storage
          .apply({ changes })
          .then(() => options)
      )
      .then((options) => {
        this._options = options
        this._watchStop = this._watch()
        this._state.get({ syncOptions: '' }).then(({ syncOptions }) => {
          if (syncOptions) return
          this._state.set({ syncOptions: 'conflict' })
          ;(
            this.sync?.storage as unknown as {
              get: (key: string) => Promise<StorageItems>
            }
          )
            ?.get('schemaVersion')
            .then(({ schemaVersion }) => {
              if (!schemaVersion)
                this._state.set({ syncOptions: 'pristine' })
            })
        })
        return options
      })
      .catch((e) => {
        if (retry <= 0) return Promise.reject(e)

        const getFallbackOptions: Promise<StorageItems | null> =
          Promise.resolve().then(() => {
            if (e instanceof NoOptionsError) {
              this._state.get({ firstRun: 'new', 'web.switchGuide': 'showOnFirstUse' }).then(
                (items) => this._state.set(items)
              )
              if (!this.sync) return null
              return (this.sync as unknown as { getBuiltInSyncConfig: () => Promise<unknown> })
                .getBuiltInSyncConfig()
                .then((builtInSyncConfig) => {
                  return this._state
                    .get({ syncOptions: '', lastGistCommit: '' })
                    .then((syncConfig) => {
                      let { syncOptions } = syncConfig
                      if (builtInSyncConfig) {
                        this._state.set({ firstRun: '', 'web.switchGuide': '' })
                        const bc = builtInSyncConfig as Record<string, unknown>
                        const { gistId, gistToken, lastGistCommit } = bc
                        if (syncConfig['lastGistCommit'] !== lastGistCommit) {
                          if (
                            syncOptions === 'pristine' ||
                            syncOptions === 'conflict'
                          ) {
                            this._state
                              .set({ syncOptions: 'conflict' })
                              .then(() =>
                                (
                                  this as unknown as {
                                    setOptionsSync: (
                                      e: boolean,
                                      args: unknown
                                    ) => Promise<void>
                                  }
                                ).setOptionsSync(true, {
                                  gistId,
                                  gistToken,
                                  useBuiltInSync: true,
                                  force: true,
                                })
                              )
                            return null
                          }
                        }
                      }
                      if (syncOptions === 'conflict') return null
                      return (
                        this.sync!.storage as unknown as {
                          get: (key: unknown) => Promise<StorageItems>
                        }
                      )
                        .get(null)
                        .then((opts) => {
                          if (!opts['schemaVersion']) {
                            this._state.set({ syncOptions: 'pristine' })
                            return null
                          } else {
                            this._state.set({ syncOptions: 'sync' })
                            this.sync!.enabled = true
                            this.log.log('Options#loadOptions::fromSync', opts)
                            return opts
                          }
                        })
                        .catch(() => null)
                    })
                })
            } else {
              this.log.error((e as Error).stack)
              this._state.remove(['syncOptions'])
              return null
            }
          })

        return getFallbackOptions.then((opts) => {
          const options = opts ?? this.parseOptions(this.getDefaultOptions())
          if (this.sync) {
            const prevEnabled = this.sync.enabled
            this.sync.enabled = false
            return this._storage
              .remove()
              .then(() => this._storage.set(options as StorageItems))
              .then(() => {
                this.sync!.enabled = prevEnabled
                return this.loadOptions({ retry: retry - 1 })
              })
          }
          return this._storage
            .remove()
            .then(() => this._storage.set(options as StorageItems))
            .then(() => this.loadOptions({ retry: retry - 1 }))
        })
      })

    return this.optionsLoaded!
  }

  init(startupCheck: () => boolean = () => true): Promise<unknown> {
    this.ready = this.loadOptions()
      .then(() => {
        if (
          startupCheck() &&
          this._options['-startupProfileName']
        ) {
          console.log(
            'apply browser restart startup profile',
            this._options['-startupProfileName']
          )
          return this.applyProfile(
            this._options['-startupProfileName'] as string
          )
        } else {
          return this._state
            .get({
              currentProfileName: this.fallbackProfileName,
              isSystemProfile: false,
            })
            .then((st) => {
              console.log('apply init startup profile', st)
              if (st['isSystemProfile']) {
                return this.applyProfile('system')
              } else {
                return this.applyProfile(
                  (st['currentProfileName'] as string) || this.fallbackProfileName
                )
              }
            })
        }
      })
      .catch((err) => {
        if (!(err instanceof ProfileNotExistError)) {
          this.log.error(err)
        }
        return this.applyProfile(this.fallbackProfileName)
      })
      .catch((err) => {
        this.log.error(err)
      })
      .then(() => this.getAll())

    this.ready.then(() => {
      this._state.get({ firstRun: '' }).then(({ firstRun }) => {
        if (firstRun) this.onFirstRun(firstRun as string)
      })
      if ((this._options['-downloadInterval'] as number) > 0) {
        this.updateProfile()
      }
    })

    return this.ready
  }

  toString(): string {
    return '<Options>'
  }

  printProfile(_profile: unknown): string | null {
    return null
  }

  upgrade(
    options: StorageItems | null,
    changes: StorageItems = {}
  ): Promise<[StorageItems, StorageItems]> {
    const version = options?.['schemaVersion'] as number | undefined
    if (version === 1) {
      let autoDetectUsed = false
      OmegaPac.Profiles.each(
        options!,
        (key: string, profile: Record<string, unknown>) => {
          if (!autoDetectUsed) {
            const refs = OmegaPac.Profiles.directReferenceSet(profile)
            if (refs['+auto_detect']) {
              autoDetectUsed = true
            }
          }
        }
      )
      if (autoDetectUsed) {
        options!['+auto_detect'] = OmegaPac.Profiles.create({
          name: 'auto_detect',
          profileType: 'PacProfile',
          pacUrl: 'http://wpad/wpad.dat',
          color: '#00cccc',
        })
      }
      changes['schemaVersion'] = options!['schemaVersion'] = 2
    }
    OmegaPac.Profiles.each(
      options!,
      (_key: string, profile: Record<string, unknown>) => {
        if (profile['syncOptions'] === 'disabled') {
          delete profile['syncOptions']
          delete profile['syncError']
        }
      }
    )
    const v = options?.['schemaVersion'] as number
    if (v === 2) {
      return Promise.resolve([options!, changes])
    } else {
      return Promise.reject(new Error(`Invalid schemaVersion ${v}!`))
    }
  }

  parseOptions(options: StorageItems | string | null): StorageItems {
    if (typeof options === 'string') {
      if (options[0] !== '{') {
        try {
          const { Buffer } = require('buffer') as { Buffer: typeof globalThis.Buffer }
          options = Buffer.from(options, 'base64').toString('utf8')
        } catch (_) {
          options = null
        }
      }
      options = (() => {
        try {
          return JSON.parse(options as string)
        } catch (_) {
          return null
        }
      })()
    }
    if (!options) {
      throw new Error('Invalid options!')
    }
    return options as StorageItems
  }

  reset(options?: StorageItems | string | null): Promise<unknown> {
    this.log.method('Options#reset', this, arguments)
    const src = options ?? this.getDefaultOptions()
    const _options = this.parseOptions(src)
    return this.upgrade(_options).then(([opt]) => {
      if (this.sync) this.sync.enabled = false
      this._state.remove(['syncOptions'])
      this._watchStop?.()
      this._watchStop = null
      return this._storage
        .remove()
        .then(() => this._storage.set(opt))
        .then(() => this.init())
        .then(() => {
          if (_options['-startupProfileName']) {
            return this.applyProfile(_options['-startupProfileName'] as string)
          }
        })
    })
  }

  onFirstRun(_reason: string): void {}

  getDefaultOptions(): StorageItems {
    return defaultOptions()
  }

  getAll(): StorageItems {
    return this._options
  }

  profile(name: string): unknown {
    return OmegaPac.Profiles.byName(name, this._options)
  }

  patch(patch: Record<string, unknown>): Promise<unknown> | undefined {
    if (!patch) return
    this.log.method('Options#patch', this, arguments)
    this._options = jsonPatch(this._options as unknown, patch as unknown as Delta) as StorageItems
    const changes: StorageItems = {}
    for (const key of Object.keys(patch)) {
      const delta = patch[key] as unknown[]
      if (
        Array.isArray(delta) &&
        delta.length === 3 &&
        delta[1] === 0 &&
        delta[2] === 0
      ) {
        changes[key] = undefined
      } else {
        changes[key] = this._options[key]
      }
    }
    return this._setOptions(changes)
  }

  _setOptions = (
    changes: StorageItems,
    args?: { checkRevision?: boolean; persist?: boolean }
  ): Promise<StorageItems> | undefined => {
    const removed: string[] = []
    const checkRev = args?.checkRevision ?? false
    let profilesChanged = false
    let currentProfileAffected: false | 'removed' | 'changed' = false

    for (const key of Object.keys(changes)) {
      const value = changes[key]
      if (typeof value === 'undefined') {
        delete this._options[key]
        removed.push(key)
        if (key[0] === '+') {
          profilesChanged = true
          if (key === '+' + this._currentProfileName) {
            currentProfileAffected = 'removed'
          }
        }
      } else {
        if (key[0] === '+') {
          if (checkRev && this._options[key]) {
            const result = OmegaPac.Revision.compare(
              (this._options[key] as Record<string, unknown>)['revision'] as string,
              (value as Record<string, unknown>)['revision'] as string
            )
            if (result >= 0) continue
          }
          profilesChanged = true
          if (
            (value as Record<string, unknown>)['profileType'] === 'RuleListProfile'
          ) {
            ;(value as Record<string, unknown>)['pacScript'] =
              generateProfileTempPac(value as Record<string, unknown>)
          }
        }
        if (key === '-builtinProfiles') {
          currentProfileAffected = 'changed'
        }
        this._options[key] = value
      }
      if (!currentProfileAffected && this._watchingProfiles[key]) {
        currentProfileAffected = 'changed'
      }
    }

    switch (currentProfileAffected) {
      case 'removed':
        this.applyProfile(this.fallbackProfileName)
        break
      case 'changed':
        this.applyProfile(this._currentProfileName!, { update: false })
        break
      default:
        if (profilesChanged) this._setAvailableProfiles()
    }

    if (args?.persist ?? true) {
      if (this.sync?.enabled) this.sync.requestPush(changes)
      for (const key of removed) {
        delete changes[key]
      }
      return this._storage.set(changes).then(() => {
        this._storage.remove(removed)
        return this._options
      })
    }
  }

  protected _watch(): () => void {
    const handler = (changes?: StorageItems) => {
      if (changes) {
        this._setOptions(changes, { checkRevision: true, persist: false })
      } else {
        changes = this._options
      }

      const refresh = changes['-refreshOnProfileChange']
      if (refresh != null) {
        this._state.set({ refreshOnProfileChange: refresh })
      }

      const customCss = changes['-customCss']
      if (customCss != null) {
        this._state.set({
          customCss: csso.minify(customCss as string).css,
        })
      }

      if (Object.prototype.hasOwnProperty.call(changes, '-showExternalProfile')) {
        let showExternal = changes['-showExternalProfile']
        if (showExternal == null) {
          showExternal = true
          this._setOptions({ '-showExternalProfile': true }, { persist: true })
        }
        this._state.set({ showExternalProfile: showExternal })
      }

      const quickSwitchProfiles = changes['-quickSwitchProfiles']
      const cleanedQS = this._cleanUpQuickSwitchProfiles(
        quickSwitchProfiles as string[] | null | undefined
      )
      if (changes['-enableQuickSwitch'] != null || cleanedQS != null) {
        this.reloadQuickSwitch()
      }

      if (changes['-downloadInterval'] != null) {
        this.schedule(
          'updateProfile',
          this._options['-downloadInterval'] as number
        )
      }

      if (changes['-showInspectMenu'] != null || changes === this._options) {
        let showMenu = this._options['-showInspectMenu']
        if (showMenu == null) {
          showMenu = true
          this._setOptions({ '-showInspectMenu': true }, { persist: true })
        }
        this.setInspect({ showMenu: showMenu as boolean })
      }

      if (
        changes['-monitorWebRequests'] != null ||
        changes === this._options
      ) {
        let monitorWebRequests = this._options['-monitorWebRequests']
        if (monitorWebRequests == null) {
          monitorWebRequests = true
          this._setOptions(
            { '-monitorWebRequests': true },
            { persist: true }
          )
        }
        this.setMonitorWebRequests(monitorWebRequests as boolean)
      }
    }

    handler()
    return this._storage.watch(null, handler)
  }

  protected _cleanUpQuickSwitchProfiles(
    quickSwitchProfiles?: string[] | null
  ): string[] | undefined {
    if (quickSwitchProfiles == null) return undefined
    const seen: Record<string, boolean> = {}
    const valid = quickSwitchProfiles.filter((name) => {
      if (!name) return false
      const key = OmegaPac.Profiles.nameAsKey({ name })
      if (seen[key]) return false
      if (!OmegaPac.Profiles.byName(name, this._options)) return false
      seen[key] = true
      return true
    })
    if (valid.length !== quickSwitchProfiles.length) {
      this._setOptions({ '-quickSwitchProfiles': valid }, { persist: true })
    }
    return valid
  }

  reloadQuickSwitch(): void {
    let profiles = this._options['-quickSwitchProfiles'] as string[]
    if (profiles.length < 2) profiles = null!
    if (this._options['-enableQuickSwitch']) {
      this.setQuickSwitch(profiles, !!profiles)
    } else {
      this.setQuickSwitch(null, !!profiles)
    }
  }

  setInspect(_settings: { showMenu: boolean }): Promise<void> {
    return Promise.resolve()
  }

  setMonitorWebRequests(_enabled: boolean): Promise<void> {
    return Promise.resolve()
  }

  watch(callback: (changes: StorageItems) => void): () => void {
    return this._storage.watch(null, callback)
  }

  protected _profileNotFound(name: string): Record<string, unknown> {
    this.log.error(
      `Profile ${name} not found! Things may go very, very wrong.`
    )
    return OmegaPac.Profiles.create({
      name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct',
    }) as Record<string, unknown>
  }

  pacForProfile(
    profile: string | Record<string, unknown>,
    compress = false
  ): Promise<string> {
    let ast = OmegaPac.PacGenerator.script(this._options, profile, {
      profileNotFound: this._profileNotFound.bind(this),
    })
    if (compress) {
      ast = OmegaPac.PacGenerator.compress(ast)
    }
    return Promise.resolve(
      OmegaPac.PacGenerator.ascii(ast.print_to_string())
    )
  }

  protected _setAvailableProfiles(): void {
    const profile = this._currentProfileName
      ? this.currentProfile()
      : null
    const profiles: Record<string, unknown> = {}
    const currentIncludable =
      profile &&
      OmegaPac.Profiles.isIncludable(profile as Record<string, unknown>)
    let allReferenceSet: Record<string, unknown> | null = null
    let results: string[] | null = null
    if (
      !profile ||
      !OmegaPac.Profiles.isInclusive(profile as Record<string, unknown>)
    ) {
      results = []
    }
    OmegaPac.Profiles.each(
      this._options,
      (key: string, p: Record<string, unknown>) => {
        profiles[key] = {
          name: p['name'],
          profileType: p['profileType'],
          color: p['color'],
          desc: this.printProfile(p),
          builtin: p['builtin'] ? true : undefined,
        }
        if (p['profileType'] === 'VirtualProfile') {
          ;(profiles[key] as Record<string, unknown>)['defaultProfileName'] =
            p['defaultProfileName']
          if (allReferenceSet == null) {
            allReferenceSet = profile
              ? OmegaPac.Profiles.allReferenceSet(
                  profile as Record<string, unknown>,
                  this._options,
                  {
                    profileNotFound: this._profileNotFound.bind(this),
                  }
                )
              : {}
          }
          if (allReferenceSet![key]) {
            ;(profiles[key] as Record<string, unknown>)[
              'validResultProfiles'
            ] = OmegaPac.Profiles.validResultProfilesFor(p, this._options).map(
              (r: Record<string, unknown>) => r['name']
            )
          }
        }
        if (
          currentIncludable &&
          OmegaPac.Profiles.isIncludable(p)
        ) {
          results?.push(p['name'] as string)
        }
      }
    )
    if (
      profile &&
      OmegaPac.Profiles.isInclusive(profile as Record<string, unknown>)
    ) {
      const r = OmegaPac.Profiles.validResultProfilesFor(
        profile as Record<string, unknown>,
        this._options
      )
      results = (r as Record<string, unknown>[]).map((p) => p['name'] as string)
    }
    this._state.set({
      availableProfiles: profiles,
      validResultProfiles: results,
    })
  }

  applyProfile(
    name: string,
    options?: {
      proxy?: boolean
      update?: boolean
      system?: boolean
      reason?: string
    }
  ): Promise<void> {
    this.log.method('Options#applyProfile', this, arguments)
    const profile = OmegaPac.Profiles.byName(name, this._options)
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(name))
    }

    this._currentProfileName = (profile as Record<string, unknown>)[
      'name'
    ] as string
    this._isSystem =
      options?.system ||
      (profile as Record<string, unknown>)['profileType'] === 'SystemProfile'

    this._watchingProfiles = OmegaPac.Profiles.allReferenceSet(
      profile as Record<string, unknown>,
      this._options,
      { profileNotFound: this._profileNotFound.bind(this) }
    ) as Record<string, string>

    this._state.set({
      currentProfileName: this._currentProfileName,
      isSystemProfile: this._isSystem,
      currentProfileCanAddRule:
        (profile as Record<string, unknown>)['rules'] != null &&
        (profile as Record<string, unknown>)['profileType'] !== 'VirtualProfile',
    })
    this._setAvailableProfiles()

    this.currentProfileChanged(options?.reason)

    if (options != null && options.proxy === false) {
      return Promise.resolve()
    }

    this._tempProfileActive = false
    let applyProxy: Promise<void>

    if (
      this._tempProfile != null &&
      OmegaPac.Profiles.isIncludable(profile as Record<string, unknown>)
    ) {
      this._tempProfileActive = true
      if (this._tempProfile['defaultProfileName'] !== (profile as Record<string, unknown>)['name']) {
        this._tempProfile['defaultProfileName'] = (profile as Record<string, unknown>)[
          'name'
        ]
        this._tempProfile['color'] = (profile as Record<string, unknown>)['color']
        OmegaPac.Profiles.updateRevision(this._tempProfile)
      }

      const removedKeys: string[] = []
      let removedRules: Set<Record<string, unknown>> | null = null
      for (const key of Object.keys(this._tempProfileRulesByProfile)) {
        if (!OmegaPac.Profiles.byKey(key, this._options)) {
          removedKeys.push(key)
          if (!removedRules) removedRules = new Set()
          for (const rule of this._tempProfileRulesByProfile[key]) {
            ;(rule as Record<string, unknown>)['profileName'] = null
            removedRules.add(rule)
          }
        }
      }
      if (removedKeys.length > 0) {
        ;(this._tempProfile['rules'] as Record<string, unknown>[]) = (
          this._tempProfile['rules'] as Record<string, unknown>[]
        ).filter((rule) => !removedRules!.has(rule))
        for (const key of removedKeys) {
          delete this._tempProfileRulesByProfile[key]
        }
        OmegaPac.Profiles.updateRevision(this._tempProfile)
      }

      this._watchingProfiles = OmegaPac.Profiles.allReferenceSet(
        this._tempProfile,
        this._options,
        { profileNotFound: this._profileNotFound.bind(this) }
      ) as Record<string, string>

      applyProxy = this.proxyImpl!.applyProfile(
        this._tempProfile,
        profile,
        this._options
      )
    } else {
      applyProxy = this.proxyImpl!.applyProfile(
        profile,
        profile,
        this._options
      )
    }

    if (options != null && options.update === false) {
      return applyProxy
    }

    return applyProxy.then(() => {
      if (!(this._options['-downloadInterval'] as number > 0)) return
      if (this._currentProfileName !== (profile as Record<string, unknown>)['name']) return
      const updateProfiles: string[] = Object.values(this._watchingProfiles)
      if (updateProfiles.length > 0) {
        this.updateProfile(updateProfiles)
      }
    })
  }

  currentProfile(): Record<string, unknown> | null {
    if (this._currentProfileName) {
      return OmegaPac.Profiles.byName(this._currentProfileName, this._options) as Record<string, unknown>
    }
    return this._externalProfile
  }

  isSystem(): boolean {
    return this._isSystem
  }

  currentProfileChanged(_reason?: string): void {}

  setQuickSwitch(
    _quickSwitch: string[] | null,
    _canEnable: boolean
  ): Promise<void> {
    return Promise.resolve()
  }

  schedule(
    _name: string,
    _periodInMinutes: number,
    _callback?: () => void
  ): Promise<void> {
    return Promise.resolve()
  }

  isCurrentProfileStatic(): boolean {
    if (!this._currentProfileName) return true
    if (this._tempProfileActive) return false
    const currentProfile = this.currentProfile()
    if (
      currentProfile &&
      OmegaPac.Profiles.isInclusive(currentProfile)
    )
      return false
    return true
  }

  updateProfile(
    name?: string | string[] | null,
    opt_bypass_cache?: boolean
  ): Promise<Record<string, unknown>> {
    const results: Record<string, Promise<unknown>> = {}
    OmegaPac.Profiles.each(
      this._options,
      (key: string, profile: Record<string, unknown>) => {
        if (name != null) {
          if (Array.isArray(name)) {
            if (!name.includes(profile['name'] as string)) return
          } else {
            if (profile['name'] !== name) return
          }
        }
        const url = OmegaPac.Profiles.updateUrl(profile)
        if (url) {
          const typeHints = OmegaPac.Profiles.updateContentTypeHints(profile)
          const fetchResult = this.fetchUrl(
            url as string,
            opt_bypass_cache,
            typeHints as string
          )
          results[key] = fetchResult
            .then((data) => {
              if (!data) return profile
              return generateSHA256(data).then((dataSHA256) => {
                const p = OmegaPac.Profiles.byKey(key, this._options) as Record<
                  string,
                  unknown
                >
                p['lastUpdate'] = new Date().toISOString()
                if (OmegaPac.Profiles.update(p, data) || !p['sha256']) {
                  p['sha256'] = dataSHA256
                  OmegaPac.Profiles.dropCache(p)
                  const changes: StorageItems = {}
                  changes[key] = p
                  return this._setOptions(changes)!.then(() => p)
                }
                return p
              })
            })
            .catch((reason: unknown) => {
              return reason instanceof Error ? reason : new Error(String(reason))
            })
        }
      }
    )
    return Promise.all(
      Object.entries(results).map(([k, v]) =>
        v.then((val) => [k, val] as [string, unknown])
      )
    ).then((entries) => Object.fromEntries(entries))
  }

  fetchUrl(
    _url: string,
    _opt_bypass_cache?: boolean,
    _opt_type_hints?: string
  ): Promise<string> {
    return Promise.reject(new Error('not implemented'))
  }

  protected _replaceRefChanges(
    fromName: string,
    toName: string,
    changes: StorageItems = {}
  ): StorageItems {
    OmegaPac.Profiles.each(
      this._options,
      (key: string, p: Record<string, unknown>) => {
        if (p['name'] === fromName || p['name'] === toName) return
        if (OmegaPac.Profiles.replaceRef(p, fromName, toName)) {
          OmegaPac.Profiles.updateRevision(p)
          changes[OmegaPac.Profiles.nameAsKey(p as { name: string })] = p
        }
      }
    )
    if (this._options['-startupProfileName'] === fromName) {
      changes['-startupProfileName'] = toName
    }
    const quickSwitch = this._options['-quickSwitchProfiles'] as string[]
    if (!quickSwitch.includes(toName)) {
      for (let i = 0; i < quickSwitch.length; i++) {
        if (quickSwitch[i] === fromName) {
          quickSwitch[i] = toName
          changes['-quickSwitchProfiles'] = quickSwitch
        }
      }
    }
    return changes
  }

  replaceRef(fromName: string, toName: string): Promise<unknown> {
    this.log.method('Options#replaceRef', this, arguments)
    const profile = OmegaPac.Profiles.byName(fromName, this._options)
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName))
    }

    const changes = this._replaceRefChanges(fromName, toName)
    for (const key of Object.keys(changes)) {
      this._options[key] = changes[key]
    }

    const fromKey = OmegaPac.Profiles.nameAsKey({ name: fromName })
    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName
      }
      this.applyProfile(this._currentProfileName!)
    }

    return this._setOptions(changes) ?? Promise.resolve()
  }

  renameProfile(fromName: string, toName: string): Promise<unknown> {
    this.log.method('Options#renameProfile', this, arguments)
    if (OmegaPac.Profiles.byName(toName, this._options)) {
      return Promise.reject(
        new Error(`Target name ${toName} already taken!`)
      )
    }
    const profile = OmegaPac.Profiles.byName(
      fromName,
      this._options
    ) as Record<string, unknown>
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(fromName))
    }

    profile['name'] = toName
    const changes: StorageItems = {}
    changes[OmegaPac.Profiles.nameAsKey(profile as { name: string })] = profile

    this._replaceRefChanges(fromName, toName, changes)
    for (const key of Object.keys(changes)) {
      this._options[key] = changes[key]
    }

    const fromKey = OmegaPac.Profiles.nameAsKey({ name: fromName })
    changes[fromKey] = undefined
    delete this._options[fromKey]

    if (this._watchingProfiles[fromKey]) {
      if (this._currentProfileName === fromName) {
        this._currentProfileName = toName
      }
      this.applyProfile(this._currentProfileName!)
    }

    return this._setOptions(changes) ?? Promise.resolve()
  }

  getTempRules(): Record<string, Record<string, unknown>> {
    return this._tempProfileRules
  }

  addTempRule(
    domain: string,
    profileName: string,
    toggle?: 1 | -1 | 0 | null | undefined
  ): Promise<void> {
    this.log.method('Options#addTempRule', this, arguments)
    if (!this._currentProfileName) return Promise.resolve()
    const profile = OmegaPac.Profiles.byName(profileName, this._options)
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(profileName))
    }
    if (!this._tempProfile) {
      this._tempProfile = OmegaPac.Profiles.create(
        '',
        'SwitchProfile'
      ) as Record<string, unknown>
      const currentProfile = this.currentProfile()!
      this._tempProfile['color'] = currentProfile['color']
      this._tempProfile['defaultProfileName'] = currentProfile['name']
    }

    let changed = 0
    let rule = this._tempProfileRules[domain]
    if (toggle) {
      if (rule && toggle === 1) return Promise.resolve()
      if (!rule && toggle === -1) return Promise.resolve()
    }

    if (rule && rule['profileName']) {
      if (rule['profileName'] !== profileName) {
        const key = OmegaPac.Profiles.nameAsKey({
          name: rule['profileName'] as string,
        })
        const list = this._tempProfileRulesByProfile[key]
        list.splice(list.indexOf(rule), 1)
        rule['profileName'] = profileName
        changed = 1
      } else {
        ;(this._tempProfile['rules'] as Record<string, unknown>[]).splice(
          (this._tempProfile['rules'] as Record<string, unknown>[]).indexOf(rule),
          1
        )
        delete this._tempProfileRules[domain]
        changed = -1
      }
    } else {
      rule = {
        condition: {
          conditionType: 'HostWildcardCondition',
          pattern: '*.' + domain,
        },
        profileName,
        isTempRule: true,
      }
      ;(this._tempProfile['rules'] as Record<string, unknown>[]).push(rule)
      this._tempProfileRules[domain] = rule
      changed = 1
    }

    const key = OmegaPac.Profiles.nameAsKey({ name: profileName })
    let rulesByProfile = this._tempProfileRulesByProfile[key]
    if (!rulesByProfile) {
      rulesByProfile = this._tempProfileRulesByProfile[key] = []
    }
    if (changed === 1) {
      rulesByProfile.push(rule)
    } else {
      rulesByProfile.splice(rulesByProfile.indexOf(rule), 1)
    }

    if (changed) {
      OmegaPac.Profiles.updateRevision(this._tempProfile)
      return (this.applyProfile(this._currentProfileName!) ?? Promise.resolve())
    }
    return Promise.resolve()
  }

  queryTempRule(domain: string): string | null {
    const rule = this._tempProfileRules[domain]
    if (rule) {
      if (rule['profileName']) {
        return rule['profileName'] as string
      } else {
        delete this._tempProfileRules[domain]
      }
    }
    return null
  }

  addCondition(
    condition: Record<string, unknown> | Record<string, unknown>[],
    profileName: string
  ): Promise<unknown> {
    this.log.method('Options#addCondition', this, arguments)
    if (!this._currentProfileName) return Promise.resolve()
    const profile = OmegaPac.Profiles.byName(
      this._currentProfileName,
      this._options
    ) as Record<string, unknown>
    if (!(profile?.['rules'] != null)) {
      return Promise.reject(
        new Error(
          `Cannot add condition to Profile ${profile?.['name']} (${profile?.['profileType']})`
        )
      )
    }
    const target = OmegaPac.Profiles.byName(profileName, this._options)
    if (!target) {
      return Promise.reject(new ProfileNotExistError(profileName))
    }
    const conditions = Array.isArray(condition) ? condition : [condition]

    for (const cond of conditions) {
      const tag = OmegaPac.Conditions.tag(cond)
      const rules = profile['rules'] as Record<string, unknown>[]
      for (let i = 0; i < rules.length; i++) {
        if (OmegaPac.Conditions.tag(rules[i]['condition'] as Record<string, unknown>) === tag) {
          rules.splice(i, 1)
          break
        }
      }
      if (this._options['-addConditionsToBottom']) {
        rules.push({ condition: cond, profileName })
      } else {
        rules.unshift({ condition: cond, profileName })
      }
    }

    OmegaPac.Profiles.updateRevision(profile)
    const changes: StorageItems = {}
    changes[OmegaPac.Profiles.nameAsKey(profile as { name: string })] = profile
    return this._setOptions(changes) ?? Promise.resolve()
  }

  setDefaultProfile(
    profileName: string,
    defaultProfileName: string
  ): Promise<unknown> {
    this.log.method('Options#setDefaultProfile', this, arguments)
    const profile = OmegaPac.Profiles.byName(
      profileName,
      this._options
    ) as Record<string, unknown>
    if (!profile) {
      return Promise.reject(new ProfileNotExistError(profileName))
    } else if (profile['defaultProfileName'] == null) {
      return Promise.reject(
        new Error(
          `Profile ${profile['name']} (${profile['profileType']}) does not have defaultProfileName!`
        )
      )
    }
    const target = OmegaPac.Profiles.byName(defaultProfileName, this._options)
    if (!target) {
      return Promise.reject(new ProfileNotExistError(defaultProfileName))
    }

    profile['defaultProfileName'] = defaultProfileName
    OmegaPac.Profiles.updateRevision(profile)
    const changes: StorageItems = {}
    changes[OmegaPac.Profiles.nameAsKey(profile as { name: string })] = profile
    return this._setOptions(changes) ?? Promise.resolve()
  }

  addProfile(profile: Record<string, unknown>): Promise<unknown> {
    this.log.method('Options#addProfile', this, arguments)
    if (OmegaPac.Profiles.byName(profile['name'] as string, this._options)) {
      return Promise.reject(
        new Error(`Target name ${profile['name']} already taken!`)
      )
    }
    const changes: StorageItems = {}
    changes[OmegaPac.Profiles.nameAsKey(profile as { name: string })] = profile
    return this._setOptions(changes) ?? Promise.resolve()
  }

  matchProfile(
    request: unknown
  ): Promise<{ profile: unknown; results: unknown[] }> {
    if (!this._currentProfileName) {
      return Promise.resolve({ profile: this._externalProfile, results: [] })
    }
    const results: unknown[] = []
    let profile: Record<string, unknown> | null = this._tempProfileActive
      ? this._tempProfile
      : (OmegaPac.Profiles.byName(
          this._currentProfileName,
          this._options
        ) as Record<string, unknown>)
    let lastProfile: Record<string, unknown> | null = null
    while (profile) {
      lastProfile = profile
      const result = OmegaPac.Profiles.match(profile, request)
      if (result == null) break
      results.push(result)
      let next: string | null = null
      if (Array.isArray(result)) {
        next = result[0] as string
      } else if ((result as Record<string, unknown>)?.['profileName']) {
        next = OmegaPac.Profiles.nameAsKey({
          name: (result as Record<string, unknown>)['profileName'] as string,
        })
      } else {
        break
      }
      profile = OmegaPac.Profiles.byKey(next, this._options) as Record<
        string,
        unknown
      >
    }
    return Promise.resolve({ profile: lastProfile, results })
  }

  setExternalProfile(
    profile: Record<string, unknown>,
    args?: { noRevert?: boolean; internal?: boolean }
  ): Promise<void> | undefined {
    if (this._options['-revertProxyChanges'] && !this._isSystem) {
      if (
        profile['name'] !== this._currentProfileName &&
        this._currentProfileName
      ) {
        if (!args?.noRevert) {
          this.applyProfile(this._revertToProfileName!)
          this._revertToProfileName = null
          return
        } else {
          this._revertToProfileName ??= this._currentProfileName
        }
      }
    }
    const p = OmegaPac.Profiles.byName(profile['name'] as string, this._options)
    if (p) {
      if (args?.internal) {
        return this.applyProfile((p as Record<string, unknown>)['name'] as string, {
          proxy: false,
        })
      } else {
        return this.applyProfile((p as Record<string, unknown>)['name'] as string, {
          proxy: false,
          system: this._isSystem,
          reason: 'external',
        })
      }
    } else {
      this._currentProfileName = null
      this._externalProfile = profile
      profile['color'] ??= '#49afcd'
      this._state.set({
        currentProfileName: '',
        externalProfile: profile,
        validResultProfiles: [],
        currentProfileCanAddRule: false,
      })
      this.currentProfileChanged('external')
    }
  }

  setOptionsSync(
    enabled: boolean,
    args: {
      force?: boolean
      gistId?: string
      gistToken?: string
      useBuiltInSync?: boolean
    } = {}
  ): Promise<unknown> {
    return this._state
      .get({ syncOptions: '', lastGistCommit: '' })
      .then(({ syncOptions, lastGistCommit: _lc }) => {
        if (!enabled) {
          if (syncOptions === 'sync') {
            this._state.set({ syncOptions: 'disabled' })
          }
          this.sync!.enabled = false
          this._syncWatchStop?.()
          this._syncWatchStop = null
          this.sync!.destroy()
          return
        }
        if (syncOptions === 'conflict') {
          if (!args.force) {
            return Promise.reject(
              new Error(
                'Syncing not enabled due to conflict. Retry with force to overwrite local options and enable syncing.'
              )
            )
          }
        }
        if (syncOptions === 'sync') return
        const { gistId, gistToken } = args
        return (
          this.sync! as unknown as {
            init: (args: unknown) => Promise<{
              options: StorageItems | null
              lastGistCommit: string
            }>
          }
        )
          .init({ gistId, gistToken, withRemoteData: true })
          .then(
            ({
              options: remoteOptions,
              lastGistCommit: _remoteLastGistCommit,
            }) => {
              return this._state
                .set({ syncOptions: 'sync', gistId, gistToken })
                .then((): Promise<unknown> | void => {
                  if (syncOptions === 'conflict') {
                    this.sync!.enabled = false
                    this._watchStop?.()
                    this._watchStop = null
                    return this._storage
                      .remove()
                      .then(() => {
                        if (remoteOptions) {
                          console.log('flush data')
                          return this.sync!.flush({ data: remoteOptions })
                        }
                      })
                      .then(() => {
                        this.sync!.enabled = true
                        return this.init().then(() => {
                          if (remoteOptions) {
                            if (remoteOptions['-startupProfileName']) {
                              console.log('apply startup')
                              return this.applyProfile(
                                remoteOptions['-startupProfileName'] as string
                              )
                            }
                          }
                          if (args.useBuiltInSync) {
                            this.sync!.toggleBuiltInSync(true)
                          } else {
                            this.sync!.toggleBuiltInSync(false)
                          }
                        })
                      })
                      .then(() => this.updateProfile())
                  } else {
                    if (remoteOptions?.['schemaVersion']) {
                      return this.sync!.flush({ data: remoteOptions }).then(
                        () => {
                          this.sync!.enabled = false
                          this._state.set({ syncOptions: 'conflict' })
                        }
                      )
                    } else {
                      this.sync!.enabled = true
                      this._syncWatchStop?.()
                      this.sync!.requestPush(this._options)
                      this._syncWatchStop = this.sync!.watchAndPull(
                        this._storage,
                        this.updateProfile.bind(this)
                      )
                      if (args.useBuiltInSync) {
                        this.sync!.toggleBuiltInSync(true)
                      } else {
                        this.sync!.toggleBuiltInSync(false)
                      }
                    }
                  }
                })
            }
          )
      })
  }

  resetOptionsSync(args?: unknown): Promise<void> {
    this.log.method('Options#resetOptionsSync', this, arguments)
    if (!this.sync) {
      return Promise.reject(new Error('Options syncing is unsupported.'))
    }
    this.sync.enabled = false
    this._syncWatchStop?.()
    this._syncWatchStop = null
    return this._state
      .set({ syncOptions: 'conflict' })
      .then(() =>
        (
          this.sync! as unknown as { init: (args: unknown) => Promise<void> }
        ).init(args)
      )
      .then(() =>
        (this.sync!.storage as unknown as { remove: () => Promise<void> }).remove()
      )
      .then(() => this._state.set({ syncOptions: 'pristine' }))
      .then(() => undefined)
  }

  checkOptionsSyncChange(): void {
    if (this.sync && this.sync.enabled) {
      this.sync.checkChange()
    }
  }
}

export default Options
