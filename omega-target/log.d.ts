/** @module omega-target/log */
declare const Log: {
    str(obj: unknown): string;
    log: (message?: any, ...optionalParams: any[]) => void;
    error: (message?: any, ...optionalParams: any[]) => void;
    func(name: string, args: IArguments | unknown[]): void;
    method(name: string, self: unknown, args: IArguments | unknown[]): void;
};
export default Log;
//# sourceMappingURL=log.d.ts.map