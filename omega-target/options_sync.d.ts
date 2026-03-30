/** @module omega-target/options_sync */
import Storage, { StorageItems } from './storage';
/** A TokenBucket wrapper supporting no-arg construction (unlimited) and promise-based removeTokens. */
declare class TokenBucket {
    private _impl;
    private _content;
    constructor(bucketSize?: number, tokensPerInterval?: number, interval?: string | number, _parentBucket?: unknown);
    get content(): number;
    removeTokens(count: number): Promise<number>;
    tryRemoveTokens(count: number): boolean;
    clear(): void;
}
declare class OptionsSync {
    static TokenBucket: typeof TokenBucket;
    private _timeout;
    _bucket: TokenBucket;
    private _waiting;
    _pending: StorageItems;
    debounce: number;
    pullThrottle: number;
    storage: Storage;
    builtInSyncStorage: Storage | null;
    state: Storage | null;
    enabled: boolean;
    readonly merge: (key: string, newVal: unknown, oldVal: unknown) => unknown;
    constructor(storage?: Storage, builtInSyncStorage?: Storage | null, state?: Storage | null, bucket?: TokenBucket);
    transformValue(v: unknown, _key?: string): unknown;
    pendingChanges(): StorageItems;
    requestPush(changes: StorageItems): void;
    private _doPush;
    private _logOperations;
    copyTo(local: Storage): Promise<void>;
    watchAndPull(local: Storage, updateProfile?: (names: string[]) => void): () => void;
    toggleBuiltInSync(useBuiltInSync?: boolean): Promise<void>;
    getBuiltInSyncConfig(): Promise<unknown>;
    updateBuiltInSyncConfigIf(newConfig: Record<string, unknown>): Promise<void>;
    checkChange(): void;
    init(args: Record<string, unknown>): Promise<unknown>;
    destroy(): void;
    flush(opts: {
        data: unknown;
    }): Promise<void>;
}
export default OptionsSync;
//# sourceMappingURL=options_sync.d.ts.map