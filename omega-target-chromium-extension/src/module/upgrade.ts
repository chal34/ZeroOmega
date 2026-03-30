const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac

function upgrade(oldOptions: any, i18n: any) {
  let config: any
  try {
    config = JSON.parse(oldOptions['config'])
  } catch (_) {
    config = null
  }
  if (config) {
    const options: any = {}
    options['schemaVersion'] = 2
    const boolItems: Record<string, string> = {
      '-confirmDeletion': 'confirmDeletion',
      '-refreshOnProfileChange': 'refreshTab',
      '-enableQuickSwitch': 'quickSwitch',
      '-revertProxyChanges': 'preventProxyChanges',
    }
    for (const [key, oldKey] of Object.entries(boolItems)) {
      options[key] = !!config[oldKey]
    }
    options['-downloadInterval'] =
      parseInt(config['ruleListReload']) || 15

    const auto = OmegaPac.Profiles.create({
      profileType: 'SwitchProfile',
      name: i18n.upgrade_profile_auto,
      color: '#55bb55',
      defaultProfileName: 'direct',
    })
    OmegaPac.Profiles.updateRevision(auto)
    options[OmegaPac.Profiles.nameAsKey(auto.name)] = auto

    const rulelist = OmegaPac.Profiles.create({
      profileType: 'RuleListProfile',
      name: '__ruleListOf_' + auto.name,
      color: '#dd6633',
      format: config['ruleListAutoProxy'] ? 'AutoProxy' : 'Switchy',
      defaultProfileName: 'direct',
      sourceUrl: config['ruleListUrl'] || '',
    })
    options[OmegaPac.Profiles.nameAsKey(rulelist.name)] = rulelist

    auto.defaultProfileName = rulelist.name

    const nameMap: Record<string, string> = {
      auto: auto.name,
      direct: 'direct',
    }
    let oldProfiles: any
    try {
      oldProfiles = JSON.parse(oldOptions['profiles'])
    } catch (_) {
      oldProfiles = {}
    }
    oldProfiles = oldProfiles || {}

    const colorTranslations: Record<string, string> = {
      blue: '#99ccee',
      green: '#99dd99',
      red: '#ffaa88',
      yellow: '#ffee99',
      purple: '#d497ee',
      '': '#99ccee',
    }

    let seenFixedProfile = false
    for (const [, oldProfile] of Object.entries<any>(oldProfiles)) {
      let profile: any = null
      switch (oldProfile['proxyMode']) {
        case 'auto': {
          profile = OmegaPac.Profiles.create({
            profileType: 'PacProfile',
          })
          const url = oldProfile['proxyConfigUrl']
          if (url.substr(0, 5) == 'data:') {
            let text = url.substr(url.indexOf(',') + 1)
            text = Buffer.from(text, 'base64').toString('utf8')
            profile.pacScript = text
          } else {
            profile.pacUrl = url
          }
          break
        }
        case 'manual': {
          seenFixedProfile = true
          profile = OmegaPac.Profiles.create({
            profileType: 'FixedProfile',
          })
          if (!!oldProfile['useSameProxy']) {
            profile.fallbackProxy = OmegaPac.Profiles.parseHostPort(
              oldProfile['proxyHttp'],
              'http'
            )
          } else if (oldProfile['proxySocks']) {
            const protocol =
              oldProfile['socksVersion'] == 5 ? 'socks5' : 'socks4'
            profile.fallbackProxy = OmegaPac.Profiles.parseHostPort(
              oldProfile['proxySocks'],
              protocol
            )
          } else {
            profile.proxyForHttp = OmegaPac.Profiles.parseHostPort(
              oldProfile['proxyHttp'],
              'http'
            )
            profile.proxyForHttps = OmegaPac.Profiles.parseHostPort(
              oldProfile['proxyHttps'],
              'http'
            )
            profile.proxyForFtp = OmegaPac.Profiles.parseHostPort(
              oldProfile['proxyFtp'],
              'http'
            )
          }
          if (oldProfile['proxyExceptions'] != null) {
            let haslocalPattern = false
            profile.bypassList = [] as any[]
            oldProfile['proxyExceptions']
              .split(';')
              .forEach((line: string) => {
                line = line.trim()
                if (!line) return
                if (line == '<local>') haslocalPattern = true
                profile.bypassList.push({
                  conditionType: 'BypassCondition',
                  pattern: line,
                })
              })
            if (haslocalPattern) {
              profile.bypassList = profile.bypassList.filter(
                (cond: any) =>
                  OmegaPac.Conditions.localHosts.indexOf(cond.pattern) < 0
              )
            }
          }
          break
        }
      }
      if (profile) {
        const color = oldProfile['color']
        profile.color = colorTranslations[color] ?? colorTranslations['']
        let name = oldProfile['name'] ?? oldProfile['id']
        name = name.trim()
        if (name[0] == '_') {
          name = 'p' + name
        }
        profile.name = name
        let num = 1
        while (OmegaPac.Profiles.byName(profile.name, options)) {
          profile.name = name + num
          num++
        }
        nameMap[oldProfile['id']] = profile.name
        OmegaPac.Profiles.updateRevision(profile)
        options[OmegaPac.Profiles.nameAsKey(profile.name)] = profile
      }
    }

    if (!seenFixedProfile) {
      const exampleFixedProfileName = 'Example Profile'
      options[OmegaPac.Profiles.nameAsKey(exampleFixedProfileName)] = {
        bypassList: [
          {
            pattern: '127.0.0.1',
            conditionType: 'BypassCondition',
          },
          {
            pattern: '::1',
            conditionType: 'BypassCondition',
          },
          {
            pattern: 'localhost',
            conditionType: 'BypassCondition',
          },
        ],
        profileType: 'FixedProfile',
        name: exampleFixedProfileName,
        color: '#99ccee',
        fallbackProxy: {
          port: 8080,
          scheme: 'http',
          host: 'proxy.example.com',
        },
      }
    }

    const startupId = config['startupProfileId']
    options['-startupProfileName'] = nameMap[startupId] || ''

    let quickSwitch: any
    try {
      quickSwitch = JSON.parse(oldOptions['quickSwitchProfiles'])
    } catch (_) {
      quickSwitch = null
    }
    options['-quickSwitchProfiles'] =
      quickSwitch == null ? [] : quickSwitch.map((p: string) => nameMap[p])

    if (config['ruleListProfileId']) {
      rulelist.matchProfileName =
        nameMap[config['ruleListProfileId']] || 'direct'
    }

    let defaultRule: any
    try {
      defaultRule = JSON.parse(oldOptions['defaultRule'])
    } catch (_) {
      defaultRule = null
    }
    if (defaultRule) {
      rulelist.defaultProfileName =
        nameMap[defaultRule.profileId] || 'direct'
      if (!config.ruleListEnabled) {
        auto.defaultProfileName = rulelist.defaultProfileName
      }
    }
    OmegaPac.Profiles.updateRevision(rulelist)

    let rules: any
    try {
      rules = JSON.parse(oldOptions['rules'])
    } catch (_) {
      rules = null
    }
    if (rules) {
      const conditionFromRule = (rule: any) => {
        switch (rule['patternType']) {
          case 'wildcard': {
            const pattern = rule['urlPattern']
            return OmegaPac.RuleList['Switchy'].conditionFromLegacyWildcard(
              pattern
            )
          }
          default:
            return {
              conditionType: 'UrlRegexCondition',
              pattern: rule['urlPattern'],
            }
        }
      }
      auto.rules = Object.entries<any>(rules).map(([, rule]) => ({
        profileName: nameMap[rule['profileId']] || 'direct',
        condition: conditionFromRule(rule),
        note: rule.name,
      }))
    }
    return options
  }
  return
}

export = upgrade
