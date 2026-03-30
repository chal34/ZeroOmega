export interface DefaultOptions {
    schemaVersion: number;
    '-enableQuickSwitch': boolean;
    '-refreshOnProfileChange': boolean;
    '-startupProfileName': string;
    '-quickSwitchProfiles': string[];
    '-revertProxyChanges': boolean;
    '-confirmDeletion': boolean;
    '-showInspectMenu': boolean;
    '-addConditionsToBottom': boolean;
    '-showResultProfileOnActionBadgeText': boolean;
    '-showExternalProfile': boolean;
    '-downloadInterval': number;
    '+proxy': Record<string, unknown>;
    '+auto switch': Record<string, unknown>;
    [key: string]: unknown;
}
declare const defaultOptions: () => DefaultOptions;
export default defaultOptions;
//# sourceMappingURL=default_options.d.ts.map