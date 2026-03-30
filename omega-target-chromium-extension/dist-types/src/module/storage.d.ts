declare const OmegaTarget: any;
declare class ChromeStorage extends OmegaTarget.Storage {
    areaName: string;
    storage: any;
    static parseStorageErrors(err: any): Promise<never>;
    static onChangedListenerInstalled: boolean;
    static watchers: Record<string, Record<string, any>>;
    static onChangedListener(changes: any, areaName: string): void;
    constructor(areaName: string);
    get(keys?: any): Promise<any>;
    set(items: any): Promise<any>;
    remove(keys?: any): Promise<any>;
    watch(keys: any, callback: any): () => void;
}
export = ChromeStorage;
//# sourceMappingURL=storage.d.ts.map