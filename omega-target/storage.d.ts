export type StorageItems = Record<string, unknown>;
export interface StorageOperations {
    set: StorageItems;
    remove: string[];
}
export interface OperationsForChangesOptions {
    base?: StorageItems;
    merge?: (key: string, newVal: unknown, oldVal: unknown) => unknown;
}
export interface StorageChangesOptions extends OperationsForChangesOptions {
    changes: StorageItems;
}
declare class Storage {
    protected _items?: StorageItems;
    static RateLimitExceededError: {
        new (): {
            name: string;
            message: string;
            stack?: string;
        };
        captureStackTrace(targetObject: object, constructorOpt?: Function): void;
        prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
        stackTraceLimit: number;
    };
    static QuotaExceededError: {
        new (): {
            perItem?: boolean;
            name: string;
            message: string;
            stack?: string;
        };
        captureStackTrace(targetObject: object, constructorOpt?: Function): void;
        prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
        stackTraceLimit: number;
    };
    static StorageUnavailableError: {
        new (): {
            name: string;
            message: string;
            stack?: string;
        };
        captureStackTrace(targetObject: object, constructorOpt?: Function): void;
        prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
        stackTraceLimit: number;
    };
    static operationsForChanges(changes: StorageItems, { base, merge }?: OperationsForChangesOptions): StorageOperations;
    get(keys?: string | string[] | StorageItems | null): Promise<StorageItems>;
    set(items: StorageItems): Promise<StorageItems>;
    remove(keys?: string | string[] | null): Promise<void>;
    watch(keys: string | string[] | null, callback: (changes: StorageItems) => void): () => void;
    apply(operations: StorageOperations | StorageChangesOptions): Promise<StorageOperations>;
}
export default Storage;
//# sourceMappingURL=storage.d.ts.map