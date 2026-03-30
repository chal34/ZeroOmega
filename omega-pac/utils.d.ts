export declare const Revision: {
    fromTime(time?: string | number | Date): string;
    compare(a: string | null | undefined, b: string | null | undefined): number;
};
export declare class AttachedCache {
    prop: string;
    tag: (obj: any) => any;
    constructor(optProp: any, tagFn?: any);
    get(obj: any, otherwise: any): any;
    drop(obj: any): void;
    private _getCache;
    private _setCache;
}
export declare function isIp(domain: string): boolean;
export declare function getBaseDomain(domain: string): string;
export declare function getSubdomainOf(url: string): string | null;
export declare function wildcardForDomain(domain: string): string;
export declare function wildcardForUrl(url: string): string;
//# sourceMappingURL=utils.d.ts.map