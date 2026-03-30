import Storage, { StorageItems } from './storage';
declare class BrowserStorage extends Storage {
    private storage;
    private prefix;
    private proto;
    constructor(storage: Storage, prefix?: string);
    get(keys?: string | string[] | StorageItems | null): Promise<StorageItems>;
    set(items: StorageItems): Promise<StorageItems>;
    remove(keys?: string | string[] | null): Promise<void>;
}
export default BrowserStorage;
//# sourceMappingURL=browser_storage.d.ts.map