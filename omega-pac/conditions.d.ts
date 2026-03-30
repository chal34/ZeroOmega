import { AttachedCache } from './utils';
declare const Conditions: {
    requestFromUrl(url: string | any): any;
    urlWildcard2HostWildcard(pattern: string): string | undefined;
    tag(condition: any): any;
    analyze(condition: any): any;
    match(condition: any, request: any): any;
    compile(condition: any): any;
    str(condition: any, { abbr }?: {
        abbr?: number | string;
    }): string;
    colonCharCode: number;
    fromStr(str: string): any;
    _abbrs: Record<string, string> | null;
    typeFromAbbr(abbr: string): string;
    comment(comment: string | null | undefined, node: any): any;
    safeRegex(expr: string): RegExp;
    regTest(expr: any, regexp: any): any;
    isInt(num: any): boolean;
    between(val: any, min: any, max: any, comment?: string): any;
    parseIp(ip: string): any;
    normalizeIp(addr: any): string;
    ipv6Max: string;
    localHosts: string[];
    getWeekdayList(condition: any): boolean[];
    _condCache: AttachedCache;
    _setProp(obj: any, prop: string, value: any): void;
    _handler(conditionType: any): any;
    _conditionTypes: Record<string, any>;
};
export default Conditions;
export declare const requestFromUrl: (url: string | any) => any, urlWildcard2HostWildcard: (pattern: string) => string | undefined, tag: (condition: any) => any, analyze: (condition: any) => any, match: (condition: any, request: any) => any, compile: (condition: any) => any, str: (condition: any, { abbr }?: {
    abbr?: number | string;
}) => string, colonCharCode: number, fromStr: (str: string) => any, typeFromAbbr: (abbr: string) => string, comment: (comment: string | null | undefined, node: any) => any, safeRegex: (expr: string) => RegExp, regTest: (expr: any, regexp: any) => any, isInt: (num: any) => boolean, between: (val: any, min: any, max: any, comment?: string) => any, parseIp: (ip: string) => any, normalizeIp: (addr: any) => string, ipv6Max: string, localHosts: string[], getWeekdayList: (condition: any) => boolean[];
//# sourceMappingURL=conditions.d.ts.map