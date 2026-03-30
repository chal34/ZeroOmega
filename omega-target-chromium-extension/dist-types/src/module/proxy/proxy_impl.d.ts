declare class ProxyImpl {
    log: any;
    _proxyAuth: any;
    constructor(log: any);
    static isSupported(): boolean;
    applyProfile(profile: any, meta?: any, options?: any): Promise<any>;
    watchProxyChange(callback: any): any;
    parseExternalProfile(details: any, options: any): any;
    _profileNotFound(name: string): any;
    setProxyAuth(profile: any, options: any): Promise<void>;
    getProfilePacScript(profile: any, meta: any, options: any): any;
}
export = ProxyImpl;
//# sourceMappingURL=proxy_impl.d.ts.map