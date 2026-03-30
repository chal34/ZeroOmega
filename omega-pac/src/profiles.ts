// eslint-disable-next-line @typescript-eslint/no-require-imports
const U2 = require('uglify-js') as any;
import Conditions from './conditions';
import RuleList from './rule_list';
import { AttachedCache, Revision } from './utils';

class AST_Raw extends (U2.AST_SymbolRef as any) {
  constructor(raw: string) {
    super({ name: raw });
    (this as any).aborts = () => false;
  }
}

function checkNeedFixForSocks5(proxy: any = {}): boolean {
  if (proxy.scheme === 'socks5') {
    if ((globalThis as any).FORCEFIXEXPORTSCRIPTFORSOCKS) {
      return true;
    }
    return false;
  }
  return false;
}

function decorateCustomBuiltinProfiles(profile: any, options: any = {}): void {
  if (!profile) return;
  const key = Profiles.nameAsKey(profile);
  if (Profiles.builtinProfiles[key]) {
    const customBuiltinProfiles = Object.assign(
      {},
      Profiles.builtinProfiles,
      options['-builtinProfiles'],
    );
    profile.color = customBuiltinProfiles[key].color;
  }
}

const Profiles = {
  builtinProfiles: {
    '+direct': {
      name: 'direct',
      profileType: 'DirectProfile',
      color: '#aaaaaa',
      builtin: true,
    },
    '+system': {
      name: 'system',
      profileType: 'SystemProfile',
      color: '#000000',
      builtin: true,
    },
  } as Record<string, any>,

  schemes: [
    { scheme: 'http', prop: 'proxyForHttp' },
    { scheme: 'https', prop: 'proxyForHttps' },
    { scheme: 'ftp', prop: 'proxyForFtp' },
    { scheme: '', prop: 'fallbackProxy' },
  ],

  pacProtocols: {
    http: 'PROXY',
    https: 'HTTPS',
    socks4: 'SOCKS',
    socks5: 'SOCKS5',
  } as Record<string, string>,

  formatByType: {
    SwitchyRuleListProfile: 'Switchy',
    AutoProxyRuleListProfile: 'AutoProxy',
  } as Record<string, string>,

  ruleListFormats: ['Switchy', 'AutoProxy'],

  parseHostPort(str: string, scheme: string): any {
    const sep = str.lastIndexOf(':');
    if (sep < 0) return undefined;
    const port = parseInt(str.substr(sep + 1)) || 80;
    const host = str.substr(0, sep);
    if (!host) return undefined;
    return { scheme, host, port };
  },

  pacResult(proxy?: any): string {
    if (proxy) {
      if (checkNeedFixForSocks5(proxy)) {
        return `SOCKS5 ${proxy.host}:${proxy.port}; SOCKS ${proxy.host}:${proxy.port}`;
      } else {
        return `${Profiles.pacProtocols[proxy.scheme]} ${proxy.host}:${proxy.port}`;
      }
    } else {
      return 'DIRECT';
    }
  },

  isFileUrl(url: string): boolean {
    return !!(url?.substr(0, 5).toUpperCase() === 'FILE:');
  },

  nameAsKey(profileName: any): string {
    if (typeof profileName !== 'string') {
      profileName = profileName.name;
    }
    return '+' + profileName;
  },

  byName(profileName: any, options?: any): any {
    let profile = profileName;
    if (typeof profileName === 'string') {
      const key = Profiles.nameAsKey(profileName);
      profile = Profiles.builtinProfiles[key] ?? options?.[key];
      decorateCustomBuiltinProfiles(profile, options);
    }
    return profile;
  },

  byKey(key: any, options?: any): any {
    let profile = key;
    if (typeof key === 'string') {
      profile = Profiles.builtinProfiles[key] ?? options?.[key];
      decorateCustomBuiltinProfiles(profile, options);
    }
    return profile;
  },

  each(options: any, callback: (key: string, profile: any) => void): void {
    const charCodePlus = '+'.charCodeAt(0);
    for (const key of Object.keys(options)) {
      if (key.charCodeAt(0) === charCodePlus) {
        callback(key, options[key]);
      }
    }
    for (const key of Object.keys(Profiles.builtinProfiles)) {
      if (key.charCodeAt(0) === charCodePlus) {
        decorateCustomBuiltinProfiles(Profiles.builtinProfiles[key], options);
        callback(key, Profiles.builtinProfiles[key]);
      }
    }
  },

  profileResult(profileName: any): any {
    let key = Profiles.nameAsKey(profileName);
    if (key === '+direct') {
      key = Profiles.pacResult();
    }
    return new U2.AST_String({ value: key });
  },

  isIncludable(profile: any): boolean {
    let includable = Profiles._handler(profile).includable;
    if (typeof includable === 'function') {
      includable = includable.call(Profiles, profile);
    }
    return !!includable;
  },

  isInclusive(profile: any): boolean {
    return !!Profiles._handler(profile).inclusive;
  },

  updateUrl(profile: any): any {
    return Profiles._handler(profile).updateUrl?.call(Profiles, profile);
  },

  updateContentTypeHints(profile: any): any {
    return Profiles._handler(profile).updateContentTypeHints?.call(Profiles, profile);
  },

  update(profile: any, data: any): any {
    return Profiles._handler(profile).update.call(Profiles, profile, data);
  },

  tag(profile: any): any {
    return Profiles._profileCache.tag(profile);
  },

  create(profile: any, opt_profileType?: string): any {
    if (typeof profile === 'string') {
      profile = {
        name: profile,
        profileType: opt_profileType,
      };
    } else if (opt_profileType) {
      profile.profileType = opt_profileType;
    }
    const create = Profiles._handler(profile).create;
    if (!create) return profile;
    create.call(Profiles, profile);
    return profile;
  },

  updateRevision(profile: any, revision?: string): void {
    revision = revision ?? Revision.fromTime();
    profile.revision = revision;
  },

  replaceRef(profile: any, fromName: string, toName: string): boolean {
    if (!Profiles.isInclusive(profile)) return false;
    const handler = Profiles._handler(profile);
    return handler.replaceRef.call(Profiles, profile, fromName, toName);
  },

  analyze(profile: any): any {
    const cache = Profiles._profileCache.get(profile, {});
    if (!Object.prototype.hasOwnProperty.call(cache, 'analyzed')) {
      const analyze = Profiles._handler(profile).analyze;
      const result = analyze?.call(Profiles, profile);
      cache.analyzed = result;
    }
    return cache;
  },

  dropCache(profile: any): void {
    Profiles._profileCache.drop(profile);
  },

  directReferenceSet(profile: any): any {
    if (!Profiles.isInclusive(profile)) return {};
    const cache = Profiles._profileCache.get(profile, {});
    if (cache.directReferenceSet) return cache.directReferenceSet;
    const handler = Profiles._handler(profile);
    cache.directReferenceSet = handler.directReferenceSet.call(Profiles, profile);
    return cache.directReferenceSet;
  },

  profileNotFound(name: string, action?: any): any {
    if (action == null) {
      throw new Error(`Profile ${name} does not exist!`);
    }
    if (typeof action === 'function') {
      action = action(name);
    }
    if (typeof action === 'object' && action.profileType) {
      return action;
    }
    switch (action) {
      case 'ignore':
        return null;
      case 'dumb':
        return Profiles.create({
          name,
          profileType: 'VirtualProfile',
          defaultProfileName: 'direct',
        });
    }
    throw action;
  },

  allReferenceSet(profile: any, options: any, opt_args?: any): any {
    const o_profile = profile;
    profile = Profiles.byName(profile, options);
    if (profile == null) {
      profile = Profiles.profileNotFound?.(o_profile, opt_args?.profileNotFound);
    }
    if (!opt_args) opt_args = {};
    const has_out = opt_args.out != null;
    const result = (opt_args.out = opt_args.out ?? {});
    if (profile) {
      result[Profiles.nameAsKey(profile.name)] = profile.name;
      for (const [key, name] of Object.entries(Profiles.directReferenceSet(profile))) {
        Profiles.allReferenceSet(name, options, opt_args);
      }
    }
    if (!has_out) delete opt_args.out;
    return result;
  },

  referencedBySet(profile: any, options: any, opt_args?: any): any {
    const profileKey = Profiles.nameAsKey(profile);
    if (!opt_args) opt_args = {};
    const has_out = opt_args.out != null;
    const result = (opt_args.out = opt_args.out ?? {});
    Profiles.each(options, (key, prof) => {
      if (Profiles.directReferenceSet(prof)[profileKey]) {
        result[key] = prof.name;
        Profiles.referencedBySet(prof, options, opt_args);
      }
    });
    if (!has_out) delete opt_args.out;
    return result;
  },

  validResultProfilesFor(profile: any, options: any): any[] {
    profile = Profiles.byName(profile, options);
    if (!Profiles.isInclusive(profile)) return [];
    const profileKey = Profiles.nameAsKey(profile);
    const ref = Profiles.referencedBySet(profile, options);
    ref[profileKey] = profileKey;
    const result: any[] = [];
    Profiles.each(options, (key, prof) => {
      if (!ref[key] && Profiles.isIncludable(prof)) {
        result.push(prof);
      }
    });
    return result;
  },

  match(profile: any, request: any, opt_profileType?: string): any {
    opt_profileType = opt_profileType ?? profile.profileType;
    const cache = Profiles.analyze(profile);
    const matchFn = Profiles._handler(opt_profileType).match;
    return matchFn?.call(Profiles, profile, request, cache);
  },

  compile(profile: any, opt_profileType?: string): any {
    opt_profileType = opt_profileType ?? profile.profileType;
    const cache = Profiles.analyze(profile);
    if (cache.compiled) return cache.compiled;
    const handler = Profiles._handler(opt_profileType);
    cache.compiled = handler.compile.call(Profiles, profile, cache);
    return cache.compiled;
  },

  _profileCache: new AttachedCache((profile: any) => profile.revision),

  _handler(profileType: any): any {
    if (typeof profileType !== 'string') {
      profileType = profileType.profileType;
    }
    let handler = profileType;
    while (typeof handler === 'string') {
      handler = (Profiles._profileTypes as any)[handler];
    }
    if (handler == null) {
      throw new Error(`Unknown profile type: ${profileType}`);
    }
    return handler;
  },

  _profileTypes: {
    SystemProfile: {
      compile(_profile: any) {
        throw new Error('SystemProfile cannot be used in PAC scripts');
      },
    },

    DirectProfile: {
      includable: true,
      compile(_profile: any) {
        return new U2.AST_String({ value: Profiles.pacResult() });
      },
    },

    FixedProfile: {
      includable: true,
      create(profile: any) {
        if (profile.bypassList == null) {
          profile.bypassList = [
            { conditionType: 'BypassCondition', pattern: '127.0.0.1' },
            { conditionType: 'BypassCondition', pattern: '[::1]' },
            { conditionType: 'BypassCondition', pattern: 'localhost' },
          ];
        }
      },
      match(profile: any, request: any) {
        if (profile.bypassList) {
          for (const cond of profile.bypassList) {
            if (Conditions.match(cond, request)) {
              return [Profiles.pacResult(), cond, { scheme: 'direct' }, undefined];
            }
          }
        }
        for (const s of Profiles.schemes) {
          if (s.scheme === request.scheme && profile[s.prop]) {
            return [
              Profiles.pacResult(profile[s.prop]),
              s.scheme,
              profile[s.prop],
              profile.auth?.[s.prop] ?? profile.auth?.['all'],
            ];
          }
        }
        return [
          Profiles.pacResult(profile.fallbackProxy),
          '',
          profile.fallbackProxy,
          profile.auth?.fallbackProxy ?? profile.auth?.['all'],
        ];
      },
      compile(profile: any) {
        if (
          (!profile.bypassList || !profile.fallbackProxy) &&
          !profile.proxyForHttp &&
          !profile.proxyForHttps &&
          !profile.proxyForFtp
        ) {
          return new U2.AST_String({ value: Profiles.pacResult(profile.fallbackProxy) });
        }
        const body: any[] = [new U2.AST_Directive({ value: 'use strict' })];
        if (profile.bypassList && profile.bypassList.length) {
          let conditions: any = null;
          for (const cond of profile.bypassList) {
            const condition = Conditions.compile(cond);
            if (conditions != null) {
              conditions = new U2.AST_Binary({
                left: conditions,
                operator: '||',
                right: condition,
              });
            } else {
              conditions = condition;
            }
          }
          body.push(
            new U2.AST_If({
              condition: conditions,
              body: new U2.AST_Return({
                value: new U2.AST_String({ value: Profiles.pacResult() }),
              }),
            }),
          );
        }
        if (!profile.proxyForHttp && !profile.proxyForHttps && !profile.proxyForFtp) {
          body.push(
            new U2.AST_Return({
              value: new U2.AST_String({ value: Profiles.pacResult(profile.fallbackProxy) }),
            }),
          );
        } else {
          body.push(
            new U2.AST_Switch({
              expression: new U2.AST_SymbolRef({ name: 'scheme' }),
              body: Profiles.schemes
                .filter((s) => !s.scheme || profile[s.prop])
                .map((s) => {
                  const ret = [
                    new U2.AST_Return({
                      value: new U2.AST_String({
                        value: Profiles.pacResult(profile[s.prop]),
                      }),
                    }),
                  ];
                  if (s.scheme) {
                    return new U2.AST_Case({
                      expression: new U2.AST_String({ value: s.scheme }),
                      body: ret,
                    });
                  } else {
                    return new U2.AST_Default({ body: ret });
                  }
                }),
            }),
          );
        }
        return new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({ name: 'url' }),
            new U2.AST_SymbolFunarg({ name: 'host' }),
            new U2.AST_SymbolFunarg({ name: 'scheme' }),
          ],
          body,
        });
      },
    },

    PacProfile: {
      includable(profile: any) {
        return !Profiles.isFileUrl(profile.pacUrl);
      },
      create(profile: any) {
        if (profile.pacScript == null) {
          profile.pacScript =
            'function FindProxyForURL(url, host) {\n  return "DIRECT";\n}';
        }
      },
      compile(profile: any) {
        return new U2.AST_Call({
          args: [new U2.AST_This()],
          expression: new U2.AST_Dot({
            property: 'call',
            expression: new U2.AST_Function({
              argnames: [],
              body: [
                new AST_Raw(';\n' + profile.pacScript + '\n\n/* End of PAC */;'),
                new U2.AST_Return({
                  value: new U2.AST_SymbolRef({ name: 'FindProxyForURL' }),
                }),
              ],
            }),
          }),
        });
      },
      updateUrl(profile: any) {
        if (Profiles.isFileUrl(profile.pacUrl)) {
          return undefined;
        } else {
          return profile.pacUrl;
        }
      },
      updateContentTypeHints() {
        return [
          '!text/html',
          '!application/xhtml+xml',
          'application/x-ns-proxy-autoconfig',
          'application/x-javascript-config',
        ];
      },
      update(profile: any, data: any) {
        if (profile.pacScript === data) return false;
        profile.pacScript = data;
        return true;
      },
    },

    AutoDetectProfile: 'PacProfile',

    SwitchProfile: {
      includable: true,
      inclusive: true,
      create(profile: any) {
        if (profile.defaultProfileName == null) profile.defaultProfileName = 'direct';
        if (profile.rules == null) profile.rules = [];
      },
      directReferenceSet(profile: any) {
        const refs: any = {};
        refs[Profiles.nameAsKey(profile.defaultProfileName)] = profile.defaultProfileName;
        for (const rule of profile.rules) {
          refs[Profiles.nameAsKey(rule.profileName)] = rule.profileName;
        }
        return refs;
      },
      analyze(profile: any) {
        return profile.rules;
      },
      replaceRef(profile: any, fromName: string, toName: string) {
        let changed = false;
        if (profile.defaultProfileName === fromName) {
          profile.defaultProfileName = toName;
          changed = true;
        }
        for (const rule of profile.rules) {
          if (rule.profileName === fromName) {
            rule.profileName = toName;
            changed = true;
          }
        }
        return changed;
      },
      match(profile: any, request: any, cache: any) {
        for (const rule of cache.analyzed) {
          if (Conditions.match(rule.condition, request)) {
            return rule;
          }
        }
        return [Profiles.nameAsKey(profile.defaultProfileName), null];
      },
      compile(profile: any, cache: any) {
        const rules = cache.analyzed;
        if (rules.length === 0) {
          return Profiles.profileResult(profile.defaultProfileName);
        }
        const body: any[] = [new U2.AST_Directive({ value: 'use strict' })];
        for (const rule of rules) {
          body.push(
            new U2.AST_If({
              condition: Conditions.compile(rule.condition),
              body: new U2.AST_Return({
                value: Profiles.profileResult(rule.profileName),
              }),
            }),
          );
        }
        body.push(
          new U2.AST_Return({ value: Profiles.profileResult(profile.defaultProfileName) }),
        );
        return new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({ name: 'url' }),
            new U2.AST_SymbolFunarg({ name: 'host' }),
            new U2.AST_SymbolFunarg({ name: 'scheme' }),
          ],
          body,
        });
      },
    },

    VirtualProfile: 'SwitchProfile',

    RuleListProfile: {
      includable: true,
      inclusive: true,
      create(profile: any) {
        if (profile.profileType == null) profile.profileType = 'RuleListProfile';
        if (profile.format == null)
          profile.format = Profiles.formatByType[profile.profileType] ?? 'Switchy';
        if (profile.defaultProfileName == null) profile.defaultProfileName = 'direct';
        if (profile.matchProfileName == null) profile.matchProfileName = 'direct';
        if (profile.ruleList == null) profile.ruleList = '';
      },
      directReferenceSet(profile: any) {
        if (profile.ruleList != null) {
          const refs = RuleList[profile.format]?.directReferenceSet?.(profile);
          if (refs) return refs;
        }
        const refs: any = {};
        for (const name of [profile.matchProfileName, profile.defaultProfileName]) {
          refs[Profiles.nameAsKey(name)] = name;
        }
        return refs;
      },
      replaceRef(profile: any, fromName: string, toName: string) {
        let changed = false;
        if (profile.defaultProfileName === fromName) {
          profile.defaultProfileName = toName;
          changed = true;
        }
        if (profile.matchProfileName === fromName) {
          profile.matchProfileName = toName;
          changed = true;
        }
        return changed;
      },
      analyze(profile: any) {
        const format = profile.format ?? Profiles.formatByType[profile.profileType];
        const formatHandler = RuleList[format];
        if (!formatHandler) {
          throw new Error(`Unsupported rule list format ${format}!`);
        }
        let ruleList = profile.ruleList?.trim() || '';
        if (formatHandler.preprocess) {
          ruleList = formatHandler.preprocess(ruleList);
        }
        return formatHandler.parse(
          ruleList,
          profile.matchProfileName,
          profile.defaultProfileName,
        );
      },
      match(profile: any, request: any) {
        return Profiles.match(profile, request, 'SwitchProfile');
      },
      compile(profile: any) {
        if (profile.isTempPacProfile) {
          return Profiles.compile(profile, 'SwitchProfile');
        } else {
          if (profile.pacScript) {
            return Profiles.compile(profile, 'PacProfile');
          } else {
            return Profiles.compile(profile, 'SwitchProfile');
          }
        }
      },
      updateUrl(profile: any) {
        return profile.sourceUrl;
      },
      updateContentTypeHints() {
        return ['!text/html', '!application/xhtml+xml', 'text/plain', '*'];
      },
      update(profile: any, data: any) {
        data = data.trim();
        const original = profile.format ?? Profiles.formatByType[profile.profileType];
        profile.profileType = 'RuleListProfile';
        let format: string | null = original;
        if (format != null && RuleList[format]?.detect?.(data) === false) {
          format = null;
        }
        for (const formatName of Object.keys(RuleList)) {
          const result = RuleList[formatName].detect?.(data);
          if (result === true || (result !== false && format == null)) {
            profile.format = format = formatName;
          }
        }
        if (format == null) format = original;
        const formatHandler = RuleList[format!];
        if (formatHandler.preprocess) {
          data = formatHandler.preprocess(data);
        }
        if (profile.ruleList === data) return false;
        profile.pacScript = '';
        profile.ruleList = data;
        return true;
      },
    },

    SwitchyRuleListProfile: 'RuleListProfile',
    AutoProxyRuleListProfile: 'RuleListProfile',
  } as Record<string, any>,
};

export default Profiles;
