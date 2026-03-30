/** @module omega-target/options_sync */
import Storage, { StorageItems } from './storage'
import Log from './log'
import * as OmegaPac from 'omega-pac'
import { create as createDiff } from 'jsondiffpatch'
import { TokenBucket as LimiterTokenBucket } from 'limiter'

const BUILTINSYNCKEY = 'zeroOmegaSync'

/** A TokenBucket wrapper supporting no-arg construction (unlimited) and promise-based removeTokens. */
class TokenBucket {
  private _impl: LimiterTokenBucket | null = null
  private _content: number

  constructor(
    bucketSize?: number,
    tokensPerInterval?: number,
    interval?: string | number,
    _parentBucket?: unknown
  ) {
    if (
      bucketSize !== undefined &&
      tokensPerInterval !== undefined &&
      interval !== undefined
    ) {
      this._impl = new LimiterTokenBucket({
        bucketSize,
        tokensPerInterval,
        interval: interval as 'second' | 'minute' | 'hour' | 'day' | number,
      })
      // Pre-fill bucket to capacity (like limiter v1 behavior)
      ;(this._impl as unknown as { content: number }).content = bucketSize
      this._content = bucketSize
    } else {
      this._content = Infinity
    }
  }

  get content(): number {
    if (this._impl) {
      return (this._impl as unknown as { content: number }).content
    }
    return this._content
  }

  removeTokens(count: number): Promise<number> {
    if (this._impl) {
      return this._impl.removeTokens(count)
    }
    return Promise.resolve(count)
  }

  tryRemoveTokens(count: number): boolean {
    if (this._impl) {
      return this._impl.tryRemoveTokens(count)
    }
    return true
  }

  clear(): void {
    if (this._impl) {
      this.tryRemoveTokens(this.content)
    }
  }
}

class OptionsSync {
  static TokenBucket = TokenBucket

  private _timeout: ReturnType<typeof setTimeout> | null = null
  _bucket: TokenBucket
  private _waiting = false
  _pending: StorageItems = {}

  debounce = 1000
  pullThrottle = 1000

  storage: Storage
  builtInSyncStorage: Storage | null
  state: Storage | null
  enabled = true

  readonly merge: (key: string, newVal: unknown, oldVal: unknown) => unknown

  constructor(
    storage?: Storage,
    builtInSyncStorage?: Storage | null,
    state?: Storage | null,
    bucket?: TokenBucket
  ) {
    this.storage = storage || new Storage()
    this.builtInSyncStorage = builtInSyncStorage || null
    this.state = state || null
    this._pending = {}

    this._bucket =
      bucket ||
      new TokenBucket(10, 10, 'minute')

    if (!this._bucket.clear) {
      const b = this._bucket
      ;(b as unknown as { clear: () => void }).clear = () => {
        b.tryRemoveTokens(b.content)
      }
    }

    const diff = createDiff({
      objectHash: (obj: unknown) => JSON.stringify(obj),
      textDiff: { minLength: Infinity },
    })

    this.merge = (key: string, newVal: unknown, oldVal: unknown): unknown => {
      if (newVal === oldVal) return oldVal
      const nv = newVal as Record<string, unknown> | null | undefined
      const ov = oldVal as Record<string, unknown> | null | undefined
      // If either side has sync disabled, prefer local (oldVal)
      if (nv?.syncOptions === 'disabled' || ov?.syncOptions === 'disabled') {
        return oldVal
      }
      if (ov?.revision != null && nv?.revision != null) {
        const result = OmegaPac.Revision.compare(
          ov.revision as string,
          nv.revision as string
        )
        if (result >= 0) return oldVal
      }
      if (!diff.diff(oldVal, newVal)) return oldVal
      return newVal
    }
  }

  transformValue(v: unknown, _key?: string): unknown {
    return v
  }

  pendingChanges(): StorageItems {
    return this._pending
  }

  requestPush(changes: StorageItems): void {
    if (this._timeout != null) clearTimeout(this._timeout)
    for (const key of Object.keys(changes)) {
      let value = changes[key]
      if (typeof value !== 'undefined') {
        value = this.transformValue(value, key)
        if (typeof value === 'undefined') continue
      }
      this._pending[key] = value
    }
    if (!this.enabled) return
    this._timeout = setTimeout(() => this._doPush(), this.debounce)
  }

  private _doPush(): void {
    this._timeout = null
    if (this._waiting) return
    this._waiting = true
    this._bucket.removeTokens(1).then(() => {
      this.storage.get(null).then((base) => {
        const changes = this._pending
        this._pending = {}
        this._waiting = false
        return Storage.operationsForChanges(changes, {
          base,
          merge: this.merge,
        })
      }).then(({ set, remove }) => {
        const doSet: Promise<number> =
          Object.keys(set).length === 0
            ? Promise.resolve(0)
            : (Log.log('OptionsSync::set', set),
              this.storage.set(set).then(() => 1))

        return doSet.then((cost) => {
          const currentSet = set
          if (remove.length > 0) {
            if (this._bucket.tryRemoveTokens(cost)) {
              Log.log('OptionsSync::remove', remove)
              return this.storage.remove(remove)
            } else {
              return Promise.reject('bucket')
            }
          }
        }).catch((e) => {
          for (const key of Object.keys(set)) {
            if (!(key in this._pending)) {
              this._pending[key] = set[key]
            }
          }
          for (const key of remove) {
            if (!(key in this._pending)) {
              this._pending[key] = undefined
            }
          }

          if (e === 'bucket') {
            this._doPush()
          } else if (e instanceof Storage.RateLimitExceededError) {
            Log.log('OptionsSync::rateLimitExceeded')
            this._bucket.clear()
            this.requestPush({})
          } else if (e instanceof Storage.QuotaExceededError) {
            let valuesAffected = 0
            for (const key of Object.keys(set)) {
              const value = set[key] as Record<string, unknown>
              if (
                key[0] === '+' &&
                value.syncOptions !== 'disabled'
              ) {
                value.syncOptions = 'disabled'
                value.syncError = { reason: 'quotaPerItem' }
                valuesAffected++
              }
            }
            if (valuesAffected > 0) {
              this.requestPush({})
            } else {
              this._pending = {}
            }
          } else {
            return Promise.reject(e)
          }
        })
      })
    })
  }

  private _logOperations(
    text: string,
    operations: { set: StorageItems; remove: string[] }
  ): void {
    if (Object.keys(operations.set).length) {
      Log.log(text + '::set', operations.set)
    }
    if (operations.remove.length) {
      Log.log(text + '::remove', operations.remove)
    }
  }

  copyTo(local: Storage): Promise<void> {
    return Promise.all([local.get(null), this.storage.get(null)]).then(
      ([base, changes]) => {
        return local
          .apply({ changes, base, merge: this.merge })
          .then((operations) => {
            this._logOperations('OptionsSync::copyTo', operations)
          })
      }
    )
  }

  watchAndPull(
    local: Storage,
    updateProfile?: (names: string[]) => void
  ): () => void {
    let pullScheduled: ReturnType<typeof setTimeout> | null = null
    let pull: StorageItems = {}

    const doPull = () => {
      local.get(null).then((base) => {
        const changes = pull
        pull = {}
        pullScheduled = null
        return Storage.operationsForChanges(changes, {
          base,
          merge: this.merge,
        })
      }).then((operations) => {
        this._logOperations('OptionsSync::pull', operations)
        return local.apply(operations).then(() => {
          const updateProfileNames: string[] = []
          Object.values(operations.set).forEach((profile) => {
            if (
              typeof profile === 'object' &&
              profile !== null &&
              OmegaPac.Profiles.updateUrl(profile as Record<string, unknown>)
            ) {
              updateProfileNames.push(
                (profile as Record<string, unknown>).name as string
              )
            }
          })
          updateProfile?.(updateProfileNames)
        })
      })
    }

    return this.storage.watch(
      null,
      (changes: StorageItems, opts?: { immediately?: boolean }) => {
        for (const key of Object.keys(changes)) {
          pull[key] = changes[key]
        }
        if (pullScheduled != null) return
        if (opts?.immediately) {
          doPull()
        } else {
          pullScheduled = setTimeout(doPull, this.pullThrottle)
        }
      }
    )
  }

  toggleBuiltInSync(useBuiltInSync?: boolean): Promise<void> {
    return this.getBuiltInSyncConfig().then((builtInSyncConfig) => {
      return this.state!.get({
        gistId: '',
        gistToken: '',
        lastGistCommit: '',
      }).then((syncConfig) => {
        if (useBuiltInSync === undefined) {
          useBuiltInSync = !builtInSyncConfig
        }
        if (useBuiltInSync === true) {
          const obj: StorageItems = {}
          obj[BUILTINSYNCKEY] = syncConfig
          return this.builtInSyncStorage!.set(obj).then(() => undefined)
        } else {
          return this.builtInSyncStorage!.remove(BUILTINSYNCKEY)
        }
      })
    })
  }

  getBuiltInSyncConfig(): Promise<unknown> {
    return this.builtInSyncStorage!.get(BUILTINSYNCKEY).then((obj) => {
      return obj[BUILTINSYNCKEY]
    })
  }

  updateBuiltInSyncConfigIf(newConfig: Record<string, unknown>): Promise<void> {
    return this.getBuiltInSyncConfig().then((builtInSyncConfig) => {
      if (builtInSyncConfig) {
        const merged = Object.assign(
          {},
          builtInSyncConfig as Record<string, unknown>,
          newConfig
        )
        const obj: StorageItems = {}
        obj[BUILTINSYNCKEY] = merged
        return this.builtInSyncStorage!.set(obj).then(() => undefined)
      }
    })
  }

  checkChange(): void {
    ;(this.storage as unknown as { checkChange: (opts: unknown) => void }).checkChange?.({
      immediately: true,
      force: true,
    })
  }

  init(args: Record<string, unknown>): Promise<unknown> {
    args['optionsSync'] = this
    args['state'] = this.state
    return (
      this.storage as unknown as { init: (args: unknown) => Promise<unknown> }
    ).init(args)
  }

  destroy(): void {
    ;(this.storage as unknown as { destroy: () => void }).destroy?.()
  }

  flush(opts: { data: unknown }): Promise<void> {
    return (
      this.storage as unknown as { flush: (opts: unknown) => Promise<void> }
    ).flush?.(opts)
  }
}

export default OptionsSync
