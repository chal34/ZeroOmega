declare const regExpMetaChars: Record<number, boolean>;
declare function escapeSlash(pattern: string): string;
declare function shExp2RegExp(pattern: string, options?: {
    trimAsterisk?: boolean;
}): string;
declare const ShexpUtils: {
    regExpMetaChars: Record<number, boolean>;
    escapeSlash: typeof escapeSlash;
    shExp2RegExp: typeof shExp2RegExp;
};
export default ShexpUtils;
export { regExpMetaChars, escapeSlash, shExp2RegExp };
//# sourceMappingURL=shexp_utils.d.ts.map