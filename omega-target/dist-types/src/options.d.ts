/** @module omega-target/options */
import Log from './log';
import Storage, { StorageItems } from './storage';
import type OptionsSync from './options_sync';
export declare class ProfileNotExistError extends Error {
    profileName: string;
    constructor(profileName: string);
}
export declare class NoOptionsError extends Error {
    constructor();
}
declare class Options {
    static ProfileNotExistError: typeof ProfileNotExistError;
    static NoOptionsError: typeof NoOptionsError;
    protected _options: StorageItems;
    protected _storage: Storage;
    protected _state: Storage;
    protected _currentProfileName: string | null;
    protected _revertToProfileName: string | null;
    protected _watchingProfiles: Record<string, string>;
    protected _tempProfile: Record<string, unknown> | null;
    protected _tempProfileActive: boolean;
    protected _tempProfileRules: Record<string, Record<string, unknown>>;
    protected _tempProfileRulesByProfile: Record<string, Array<Record<string, unknown>>>;
    protected _externalProfile: Record<string, unknown> | null;
    fallbackProfileName: string;
    protected _isSystem: boolean;
    debugStr: string;
    ready: Promise<unknown> | null;
    protected sync: OptionsSync | null;
    protected proxyImpl: {
        applyProfile: (profile: unknown, baseProfile: unknown, options: unknown) => Promise<void>;
    } | null;
    log: typeof Log;
    protected _syncWatchStop: (() => void) | null;
    protected _watchStop: (() => void) | null;
    protected optionsLoaded: Promise<unknown> | null;
    static transformValueForSync(value: unknown, key: string): unknown | undefined;
    constructor(storage?: Storage, state?: Storage, log?: typeof Log, sync?: OptionsSync | null, proxyImpl?: Options['proxyImpl']);
    initWithOptions(options: StorageItems | null | undefined, startupCheck?: () => boolean): Promise<unknown>;
    loadOptions({ retry }?: {
        retry?: number;
    }): Promise<unknown>;
    init(startupCheck?: () => boolean): Promise<unknown>;
    toString(): string;
    printProfile(_profile: unknown): string | null;
    upgrade(options: StorageItems | null, changes?: StorageItems): Promise<[StorageItems, StorageItems]>;
    parseOptions(options: StorageItems | string | null): StorageItems;
    reset(options?: StorageItems | string | null): Promise<unknown>;
    onFirstRun(_reason: string): void;
    getDefaultOptions(): StorageItems;
    getAll(): StorageItems;
    profile(name: string): unknown;
    patch(patch: Record<string, unknown>): Promise<unknown> | undefined;
    _setOptions: (changes: StorageItems, args?: {
        checkRevision?: boolean;
        persist?: boolean;
    }) => Promise<StorageItems> | undefined;
    protected _watch(): () => void;
    protected _cleanUpQuickSwitchProfiles(quickSwitchProfiles?: string[] | null): string[] | undefined;
    reloadQuickSwitch(): void;
    setInspect(_settings: {
        showMenu: boolean;
    }): Promise<void>;
    setMonitorWebRequests(_enabled: boolean): Promise<void>;
    watch(callback: (changes: StorageItems) => void): () => void;
    protected _profileNotFound(name: string): Record<string, unknown>;
    pacForProfile(profile: string | Record<string, unknown>, compress?: boolean): Promise<string>;
    protected _setAvailableProfiles(): void;
    applyProfile(name: string, options?: {
        proxy?: boolean;
        update?: boolean;
        system?: boolean;
        reason?: string;
    }): Promise<void>;
    currentProfile(): Record<string, unknown> | null;
    isSystem(): boolean;
    currentProfileChanged(_reason?: string): void;
    setQuickSwitch(_quickSwitch: string[] | null, _canEnable: boolean): Promise<void>;
    schedule(_name: string, _periodInMinutes: number, _callback?: () => void): Promise<void>;
    isCurrentProfileStatic(): boolean;
    updateProfile(name?: string | string[] | null, opt_bypass_cache?: boolean): Promise<Record<string, unknown>>;
    fetchUrl(_url: string, _opt_bypass_cache?: boolean, _opt_type_hints?: string): Promise<string>;
    protected _replaceRefChanges(fromName: string, toName: string, changes?: StorageItems): StorageItems;
    replaceRef(fromName: string, toName: string): Promise<unknown>;
    renameProfile(fromName: string, toName: string): Promise<unknown>;
    getTempRules(): Record<string, Record<string, unknown>>;
    addTempRule(domain: string, profileName: string, toggle?: 1 | -1 | 0 | null | undefined): Promise<void>;
    queryTempRule(domain: string): string | null;
    addCondition(condition: Record<string, unknown> | Record<string, unknown>[], profileName: string): Promise<unknown>;
    setDefaultProfile(profileName: string, defaultProfileName: string): Promise<unknown>;
    addProfile(profile: Record<string, unknown>): Promise<unknown>;
    matchProfile(request: unknown): Promise<{
        profile: unknown;
        results: unknown[];
    }>;
    setExternalProfile(profile: Record<string, unknown>, args?: {
        noRevert?: boolean;
        internal?: boolean;
    }): Promise<void> | undefined;
    setOptionsSync(enabled: boolean, args?: {
        force?: boolean;
        gistId?: string;
        gistToken?: string;
        useBuiltInSync?: boolean;
    }): Promise<unknown>;
    resetOptionsSync(args?: unknown): Promise<void>;
    checkOptionsSyncChange(): void;
}
export default Options;
//# sourceMappingURL=options.d.ts.map