declare class ProxyAuth {
    _requests: Record<string, any>;
    _proxies: Record<string, any[]>;
    _fallbacks: any[];
    log: any;
    listening: boolean;
    constructor(log: any);
    listen(): void;
    _keyForProxy(proxy: any): string;
    setProxies(profiles: any[]): void;
    authHandler(details: any): {
        authCredentials?: undefined;
    } | {
        authCredentials: any;
    };
    _requestDone(details: any): void;
}
export = ProxyAuth;
//# sourceMappingURL=proxy_auth.d.ts.map