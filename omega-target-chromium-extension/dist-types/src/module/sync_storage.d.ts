declare const OmegaTarget: any;
declare class ChromeSyncStorage extends OmegaTarget.Storage {
    areaName: string;
    syncStore: any;
    storage: any;
    static parseStorageErrors(err: any): Promise<never>;
    static watchers: Record<string, Record<string, any>>;
    static onChangedListener(changes: any, areaName: string, opts?: any): void;
    constructor(areaName: string, _state: any);
    get(keys?: any): Promise<any>;
    set(items: any): Promise<any>;
    remove(keys?: any): Promise<any>;
    destroy(): void;
    flush({ data }: {
        data: any;
    }): Promise<any>;
    init(args: any): Promise<unknown>;
    checkChange(opts?: any): void;
    watch(keys: any, callback: any): () => void;
}
export = ChromeSyncStorage;
//# sourceMappingURL=sync_storage.d.ts.map