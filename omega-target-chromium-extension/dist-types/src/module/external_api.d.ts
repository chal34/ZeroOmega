declare class ExternalApi {
    options: any;
    knownExts: Record<string, number>;
    disabled: boolean;
    _previousProfileName: string | null;
    constructor(options: any);
    listen(): void;
    reenable(): void;
    checkPerm(port: any, level: number): boolean;
    onMessage(msg: any, port: any): void;
}
export = ExternalApi;
//# sourceMappingURL=external_api.d.ts.map