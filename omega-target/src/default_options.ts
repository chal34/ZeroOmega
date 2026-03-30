export interface DefaultOptions {
  schemaVersion: number
  '-enableQuickSwitch': boolean
  '-refreshOnProfileChange': boolean
  '-startupProfileName': string
  '-quickSwitchProfiles': string[]
  '-revertProxyChanges': boolean
  '-confirmDeletion': boolean
  '-showInspectMenu': boolean
  '-addConditionsToBottom': boolean
  '-showResultProfileOnActionBadgeText': boolean
  '-showExternalProfile': boolean
  '-downloadInterval': number
  '+proxy': Record<string, unknown>
  '+auto switch': Record<string, unknown>
  [key: string]: unknown
}

const defaultOptions = (): DefaultOptions => ({
  schemaVersion: 2,
  '-enableQuickSwitch': false,
  '-refreshOnProfileChange': true,
  '-startupProfileName': '',
  '-quickSwitchProfiles': [],
  '-revertProxyChanges': true,
  '-confirmDeletion': true,
  '-showInspectMenu': true,
  '-addConditionsToBottom': false,
  '-showResultProfileOnActionBadgeText': false,
  '-showExternalProfile': true,
  '-downloadInterval': 1440,
  '+proxy': {
    bypassList: [
      { pattern: '127.0.0.1', conditionType: 'BypassCondition' },
      { pattern: '::1', conditionType: 'BypassCondition' },
      { pattern: 'localhost', conditionType: 'BypassCondition' },
    ],
    profileType: 'FixedProfile',
    name: 'proxy',
    color: '#99ccee',
    fallbackProxy: {
      port: 8080,
      scheme: 'http',
      host: 'proxy.example.com',
    },
  },
  '+auto switch': {
    profileType: 'SwitchProfile',
    rules: [
      {
        condition: {
          pattern: 'internal.example.com',
          conditionType: 'HostWildcardCondition',
        },
        profileName: 'direct',
      },
      {
        condition: {
          pattern: '*.example.com',
          conditionType: 'HostWildcardCondition',
        },
        profileName: 'proxy',
      },
    ],
    name: 'auto switch',
    color: '#99dd99',
    defaultProfileName: 'direct',
  },
})

export default defaultOptions
