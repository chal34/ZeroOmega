declare class Inspect {
    _enabled: boolean;
    onInspect: any;
    propForMenuItem: Record<string, string>;
    constructor(onInspect: any);
    enable(): void;
    disable(): void;
    inspect(info: any, tab: any): void;
}
export = Inspect;
//# sourceMappingURL=inspect.d.ts.map