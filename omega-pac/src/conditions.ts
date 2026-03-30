// eslint-disable-next-line @typescript-eslint/no-require-imports
const U2 = require('uglify-js') as any;
import { Address4, Address6 } from 'ip-address';
import { shExp2RegExp, escapeSlash } from './shexp_utils';
import { AttachedCache } from './utils';

// Parse a URL string into parts compatible with the old node url.parse API.
// Uses WHATWG URL (available in Node 10+ and all modern browsers), with a
// fallback for non-standard hostnames that WHATWG rejects (e.g. "time-00:00:00").
function parseUrl(urlStr: string): { hostname: string; protocol: string; href: string } {
  try {
    const u = new URL(urlStr);
    return { hostname: u.hostname, protocol: u.protocol, href: u.href };
  } catch {
    // Fallback for URLs with invalid hostnames – extract parts manually.
    const m = urlStr.match(/^([a-z][a-z0-9+\-.]*):\/\/([^/?#]*)/i);
    const hostname = m ? m[2].split(':')[0] : '';
    const protocol = m ? m[1] + ':' : '';
    return { hostname, protocol, href: urlStr };
  }
}

const Conditions = {
  requestFromUrl(url: string | any): any {
    const urlStr: string = typeof url === 'string' ? url : ((url as {href: string}).href ?? '');
    if (typeof url === 'string') {
      url = parseUrl(url);
    }
    let host: string = url.hostname;
    // WHATWG URL normalizes IPv4-in-IPv6 addresses like [::1.2.3.4] → [::102:304],
    // which loses the dots. Extract the IPv6 literal directly from the raw URL string
    // so dot-based checks (e.g. <local> matching) work correctly, matching the
    // behavior of the legacy node url.parse.
    if (host.startsWith('[') && host.endsWith(']')) {
      const ipv6Match = urlStr.match(/^[^:]+:\/\/\[([^\]]+)\]/);
      host = ipv6Match ? ipv6Match[1] : host.slice(1, -1);
    }
    return {
      url: urlStr || (url as {href: string}).href,
      host,
      scheme: (url.protocol as string).replace(':', ''),
    };
  },

  urlWildcard2HostWildcard(pattern: string): string | undefined {
    const result = pattern.match(/^\*:\/\/((?:\w|[?*._\-])+)\/\*$/);
    return result?.[1];
  },

  tag(condition: any): any {
    return Conditions._condCache.tag(condition);
  },

  analyze(condition: any): any {
    return Conditions._condCache.get(condition, () => ({
      analyzed: Conditions._handler(condition.conditionType).analyze.call(Conditions, condition),
    }));
  },

  match(condition: any, request: any): any {
    const cache = Conditions.analyze(condition);
    return Conditions._handler(condition.conditionType).match.call(Conditions, condition, request, cache);
  },

  compile(condition: any): any {
    const cache = Conditions.analyze(condition);
    if (cache.compiled) return cache.compiled;
    const handler = Conditions._handler(condition.conditionType);
    cache.compiled = handler.compile.call(Conditions, condition, cache);
    return cache.compiled;
  },

  str(condition: any, { abbr }: { abbr?: number | string } = { abbr: -1 }): string {
    const handler = Conditions._handler(condition.conditionType);
    if (handler.abbrs[0].length === 0) {
      const endCode = condition.pattern.charCodeAt(condition.pattern.length - 1);
      if (endCode !== Conditions.colonCharCode && condition.pattern.indexOf(' ') < 0) {
        return condition.pattern;
      }
    }
    const strFn = handler.str;
    const typeStr =
      typeof abbr === 'number'
        ? handler.abbrs[(handler.abbrs.length + abbr) % handler.abbrs.length]
        : condition.conditionType;
    let result = typeStr + ':';
    const part = strFn ? strFn.call(Conditions, condition) : condition.pattern;
    if (part) result += ' ' + part;
    return result;
  },

  colonCharCode: ':'.charCodeAt(0),

  fromStr(str: string): any {
    str = str.trim();
    let i = str.indexOf(' ');
    if (i < 0) i = str.length;
    let conditionType: string;
    if (str.charCodeAt(i - 1) === Conditions.colonCharCode) {
      conditionType = str.substr(0, i - 1);
      str = str.substr(i + 1).trim();
    } else {
      conditionType = '';
    }

    conditionType = Conditions.typeFromAbbr(conditionType);
    if (!conditionType) return null;
    const condition: any = { conditionType };
    const fromStr = Conditions._handler(condition.conditionType).fromStr;
    if (fromStr) {
      return fromStr.call(Conditions, str, condition);
    } else {
      condition.pattern = str;
      return condition;
    }
  },

  _abbrs: null as Record<string, string> | null,
  typeFromAbbr(abbr: string): string {
    if (!Conditions._abbrs) {
      Conditions._abbrs = {};
      for (const [type, handler] of Object.entries(Conditions._conditionTypes)) {
        const h = handler as any;
        Conditions._abbrs[type.toUpperCase()] = type;
        for (const ab of h.abbrs) {
          Conditions._abbrs[(ab as string).toUpperCase()] = type;
        }
      }
    }
    return Conditions._abbrs[abbr.toUpperCase()];
  },

  comment(comment: string | null | undefined, node: any): any {
    if (!comment) return node;
    if (!node.start) node.start = {};
    Object.defineProperty(node.start, '_comments_dumped', {
      get: () => false,
      set: () => false,
    });
    if (!node.start.comments_before) node.start.comments_before = [];
    node.start.comments_before.push({ type: 'comment2', value: comment });
    return node;
  },

  safeRegex(expr: string): RegExp {
    try {
      return new RegExp(expr);
    } catch (_) {
      return /(?!)/;
    }
  },

  regTest(expr: any, regexp: any): any {
    if (typeof regexp === 'string') {
      regexp = Conditions.safeRegex(escapeSlash(regexp));
    }
    if (typeof expr === 'string') {
      expr = new U2.AST_SymbolRef({ name: expr });
    }
    return new U2.AST_Call({
      args: [expr],
      expression: new U2.AST_Dot({
        property: 'test',
        expression: new U2.AST_RegExp({ value: regexp }),
      }),
    });
  },

  isInt(num: any): boolean {
    return typeof num === 'number' && !isNaN(num) && parseFloat(String(num)) === parseInt(String(num), 10);
  },

  between(val: any, min: any, max: any, comment?: string): any {
    if (min === max) {
      if (typeof min === 'number') {
        min = new U2.AST_Number({ value: min });
      }
      return Conditions.comment(
        comment,
        new U2.AST_Binary({
          left: val,
          operator: '===',
          right: min,
        }),
      );
    }
    if (min > max) {
      return Conditions.comment(comment, new U2.AST_False());
    }
    if (Conditions.isInt(min) && Conditions.isInt(max) && max - min < 32) {
      comment = comment || `${min} <= value && value <= ${max}`;
      const tmpl = '0123456789abcdefghijklmnopqrstuvwxyz';
      const str =
        max < tmpl.length ? tmpl.substr(min, max - min + 1) : tmpl.substr(0, max - min + 1);
      const pos =
        min === 0
          ? val
          : new U2.AST_Binary({
              left: val,
              operator: '-',
              right: new U2.AST_Number({ value: min }),
            });
      return Conditions.comment(
        comment,
        new U2.AST_Binary({
          left: new U2.AST_Call({
            expression: new U2.AST_Dot({
              expression: new U2.AST_String({ value: str }),
              property: 'charCodeAt',
            }),
            args: [pos],
          }),
          operator: '>',
          right: new U2.AST_Number({ value: 0 }),
        }),
      );
    }
    if (typeof min === 'number') min = new U2.AST_Number({ value: min });
    if (typeof max === 'number') max = new U2.AST_Number({ value: max });
    return Conditions.comment(
      comment,
      new U2.AST_Call({
        args: [val, min, max],
        expression: new U2.AST_Function({
          argnames: [
            new U2.AST_SymbolFunarg({ name: 'value' }),
            new U2.AST_SymbolFunarg({ name: 'min' }),
            new U2.AST_SymbolFunarg({ name: 'max' }),
          ],
          body: [
            new U2.AST_Return({
              value: new U2.AST_Binary({
                left: new U2.AST_Binary({
                  left: new U2.AST_SymbolRef({ name: 'min' }),
                  operator: '<=',
                  right: new U2.AST_SymbolRef({ name: 'value' }),
                }),
                operator: '&&',
                right: new U2.AST_Binary({
                  left: new U2.AST_SymbolRef({ name: 'value' }),
                  operator: '<=',
                  right: new U2.AST_SymbolRef({ name: 'max' }),
                }),
              }),
            }),
          ],
        }),
      }),
    );
  },

  parseIp(ip: string): any {
    if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
      ip = ip.substr(1, ip.length - 2);
    }
    try {
      const addr4 = new Address4(ip);
      (addr4 as any).v4 = true;
      return addr4;
    } catch (_) {}
    try {
      const addr6 = new Address6(ip);
      return addr6;
    } catch (_) {}
    return null;
  },

  normalizeIp(addr: any): string {
    return addr.correctForm();
  },

  ipv6Max: new Address6('::/0').endAddress().canonicalForm(),

  localHosts: ['127.0.0.1', '[::1]', 'localhost'],

  getWeekdayList(condition: any): boolean[] {
    if (condition.days) {
      return Array.from({ length: 7 }, (_, i) => condition.days.charCodeAt(i) > 64);
    } else {
      return Array.from({ length: 7 }, (_, i) => condition.startDay <= i && i <= condition.endDay);
    }
  },

  _condCache: new AttachedCache(function (condition: any) {
    const tag = Conditions._handler(condition.conditionType).tag;
    const result = tag
      ? tag.call(Conditions, condition)
      : Conditions.str(condition);
    return condition.conditionType + '$' + result;
  }),

  _setProp(obj: any, prop: string, value: any): void {
    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
      Object.defineProperty(obj, prop, { writable: true });
    }
    obj[prop] = value;
  },

  _handler(conditionType: any): any {
    if (typeof conditionType !== 'string') {
      conditionType = conditionType.conditionType;
    }
    const handler = (Conditions._conditionTypes as any)[conditionType];
    if (handler == null) {
      throw new Error(`Unknown condition type: ${conditionType}`);
    }
    return handler;
  },

  _conditionTypes: {
    TrueCondition: {
      abbrs: ['True'],
      analyze: (_condition: any) => null,
      match: () => true,
      compile: (_condition: any) => new U2.AST_True(),
      str: (_condition: any) => '',
      fromStr: (_str: any, condition: any) => condition,
    },

    FalseCondition: {
      abbrs: ['False', 'Disabled'],
      analyze: (_condition: any) => null,
      match: () => false,
      compile: (_condition: any) => new U2.AST_False(),
      fromStr(str: string, condition: any) {
        if (str.length > 0) {
          condition.pattern = str;
        }
        return condition;
      },
    },

    UrlRegexCondition: {
      abbrs: ['UR', 'URegex', 'UrlR', 'UrlRegex'],
      analyze(condition: any) {
        return Conditions.safeRegex(escapeSlash(condition.pattern));
      },
      match(_condition: any, request: any, cache: any) {
        return cache.analyzed.test(request.url);
      },
      compile(_condition: any, cache: any) {
        return Conditions.regTest('url', cache.analyzed);
      },
    },

    UrlWildcardCondition: {
      abbrs: ['U', 'UW', 'Url', 'UrlW', 'UWild', 'UWildcard', 'UrlWild', 'UrlWildcard'],
      analyze(condition: any) {
        const parts = condition.pattern
          .split('|')
          .filter((p: string) => p)
          .map((pattern: string) => shExp2RegExp(pattern, { trimAsterisk: true }));
        return Conditions.safeRegex(parts.join('|'));
      },
      match(_condition: any, request: any, cache: any) {
        return cache.analyzed.test(request.url);
      },
      compile(_condition: any, cache: any) {
        return Conditions.regTest('url', cache.analyzed);
      },
    },

    HostRegexCondition: {
      abbrs: ['R', 'HR', 'Regex', 'HostR', 'HRegex', 'HostRegex'],
      analyze(condition: any) {
        return Conditions.safeRegex(escapeSlash(condition.pattern));
      },
      match(_condition: any, request: any, cache: any) {
        return cache.analyzed.test(request.host);
      },
      compile(_condition: any, cache: any) {
        return Conditions.regTest('host', cache.analyzed);
      },
    },

    HostWildcardCondition: {
      abbrs: ['', 'H', 'W', 'HW', 'Wild', 'Wildcard', 'Host', 'HostW', 'HWild', 'HWildcard', 'HostWild', 'HostWildcard'],
      analyze(condition: any) {
        const parts = condition.pattern
          .split('|')
          .filter((p: string) => p)
          .map((pattern: string) => {
            if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
              pattern = '*' + pattern;
            }
            if (pattern.indexOf('**.') === 0) {
              return shExp2RegExp(pattern.substring(1), { trimAsterisk: true });
            } else if (pattern.indexOf('*.') === 0) {
              return shExp2RegExp(pattern.substring(2), { trimAsterisk: false })
                .replace(/./, '(?:^|\\.)').replace(/\.\*\$$/, '');
            } else {
              return shExp2RegExp(pattern, { trimAsterisk: true });
            }
          });
        return Conditions.safeRegex(parts.join('|'));
      },
      match(_condition: any, request: any, cache: any) {
        return cache.analyzed.test(request.host);
      },
      compile(_condition: any, cache: any) {
        return Conditions.regTest('host', cache.analyzed);
      },
    },

    BypassCondition: {
      abbrs: ['B', 'Bypass'],
      analyze(condition: any) {
        const cache: any = {
          host: null,
          ip: null,
          scheme: null,
          url: null,
          normalizedPattern: '',
        };
        let server = condition.pattern;
        if (server === '<local>') {
          cache.host = server;
          return cache;
        }
        let parts = server.split('://');
        if (parts.length > 1) {
          cache.scheme = parts[0];
          cache.normalizedPattern = cache.scheme + '://';
          server = parts[1];
        }

        parts = server.split('/');
        if (parts.length > 1) {
          const addr = Conditions.parseIp(parts[0]);
          const prefixLen = parseInt(parts[1]);
          if (addr && !isNaN(prefixLen)) {
            cache.ip = {
              conditionType: 'IpCondition',
              ip: Conditions.normalizeIp(addr),
              prefixLength: prefixLen,
            };
            cache.normalizedPattern += cache.ip.ip + '/' + cache.ip.prefixLength;
            return cache;
          }
        }

        let serverIp = Conditions.parseIp(server);
        let matchPort: string | undefined;
        if (serverIp == null) {
          const pos = server.lastIndexOf(':');
          if (pos >= 0) {
            matchPort = server.substring(pos + 1);
            server = server.substring(0, pos);
          }
          serverIp = Conditions.parseIp(server);
        }
        if (serverIp != null) {
          server = Conditions.normalizeIp(serverIp);
          if (serverIp.v4) {
            cache.normalizedPattern += server;
          } else {
            cache.normalizedPattern += '[' + server + ']';
          }
        } else {
          if (server.charCodeAt(0) === '.'.charCodeAt(0)) {
            server = '*' + server;
          }
          cache.normalizedPattern = server;
        }

        if (matchPort) {
          cache.port = matchPort;
          cache.normalizedPattern += ':' + cache.port;
          if (serverIp != null && !serverIp.v4) {
            server = '[' + server + ']';
          }
          const serverRegex = (() => {
            const r = shExp2RegExp(server);
            return r.substring(1, r.length - 1);
          })();
          const scheme = cache.scheme ?? '[^:]+';
          cache.url = Conditions.safeRegex(
            '^' + scheme + ':\\/\\/' + serverRegex + ':' + matchPort + '\\/',
          );
        } else if (server !== '*') {
          const serverRegex = shExp2RegExp(server, { trimAsterisk: true });
          cache.host = Conditions.safeRegex(serverRegex);
        }
        return cache;
      },
      match(condition: any, request: any, cache: any) {
        cache = cache.analyzed;
        if (cache.scheme != null && cache.scheme !== request.scheme) return false;
        if (cache.ip != null && !Conditions.match(cache.ip, request)) return false;
        if (cache.host != null) {
          if (cache.host === '<local>') {
            return (
              request.host === '127.0.0.1' ||
              request.host === '::1' ||
              request.host.indexOf('.') < 0
            );
          } else {
            if (!cache.host.test(request.host)) return false;
          }
        }
        if (cache.url != null && !cache.url.test(request.url)) return false;
        return true;
      },
      str(condition: any) {
        const analyze = Conditions._handler(condition).analyze;
        const cache = analyze.call(Conditions, condition);
        if (cache.normalizedPattern) {
          return cache.normalizedPattern;
        } else {
          return condition.pattern;
        }
      },
      compile(_condition: any, cache: any) {
        cache = cache.analyzed;
        if (cache.url != null) {
          return Conditions.regTest('url', cache.url);
        }
        const conditions: any[] = [];
        if (cache.host === '<local>') {
          const hostEquals = (host: string) =>
            new U2.AST_Binary({
              left: new U2.AST_SymbolRef({ name: 'host' }),
              operator: '===',
              right: new U2.AST_String({ value: host }),
            });
          return new U2.AST_Binary({
            left: new U2.AST_Binary({
              left: hostEquals('127.0.0.1'),
              operator: '||',
              right: hostEquals('::1'),
            }),
            operator: '||',
            right: new U2.AST_Binary({
              left: new U2.AST_Call({
                expression: new U2.AST_Dot({
                  expression: new U2.AST_SymbolRef({ name: 'host' }),
                  property: 'indexOf',
                }),
                args: [new U2.AST_String({ value: '.' })],
              }),
              operator: '<',
              right: new U2.AST_Number({ value: 0 }),
            }),
          });
        }
        if (cache.scheme != null) {
          conditions.push(
            new U2.AST_Binary({
              left: new U2.AST_SymbolRef({ name: 'scheme' }),
              operator: '===',
              right: new U2.AST_String({ value: cache.scheme }),
            }),
          );
        }
        if (cache.host != null) {
          conditions.push(Conditions.regTest('host', cache.host));
        } else if (cache.ip != null) {
          conditions.push(Conditions.compile(cache.ip));
        }
        switch (conditions.length) {
          case 0:
            return new U2.AST_True();
          case 1:
            return conditions[0];
          case 2:
            return new U2.AST_Binary({
              left: conditions[0],
              operator: '&&',
              right: conditions[1],
            });
        }
      },
    },

    KeywordCondition: {
      abbrs: ['K', 'KW', 'Keyword'],
      analyze: (_condition: any) => null,
      match(_condition: any, request: any) {
        return request.scheme === 'http' && request.url.indexOf(_condition.pattern) >= 0;
      },
      compile(condition: any) {
        return new U2.AST_Binary({
          left: new U2.AST_Binary({
            left: new U2.AST_SymbolRef({ name: 'scheme' }),
            operator: '===',
            right: new U2.AST_String({ value: 'http' }),
          }),
          operator: '&&',
          right: new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_SymbolRef({ name: 'url' }),
                property: 'indexOf',
              }),
              args: [new U2.AST_String({ value: condition.pattern })],
            }),
            operator: '>=',
            right: new U2.AST_Number({ value: 0 }),
          }),
        });
      },
    },

    IpCondition: {
      abbrs: ['Ip'],
      analyze(condition: any) {
        const cache: any = { addr: null, normalized: null };
        let ip = condition.ip;
        if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
          ip = ip.substr(1, ip.length - 2);
        }
        const addrStr = ip + '/' + condition.prefixLength;
        cache.addr = Conditions.parseIp(addrStr);
        if (cache.addr == null) {
          throw new Error(`Invalid IP address ${addrStr}`);
        }
        cache.normalized = Conditions.normalizeIp(cache.addr);
        let mask: any;
        if (cache.addr.v4) {
          mask = new Address4('255.255.255.255/' + cache.addr.subnetMask);
          (mask as any).v4 = true;
        } else {
          mask = new Address6(Conditions.ipv6Max + '/' + cache.addr.subnetMask);
        }
        cache.mask = Conditions.normalizeIp(mask.startAddress());
        return cache;
      },
      match(condition: any, request: any, cache: any) {
        const addr = Conditions.parseIp(request.host);
        if (addr == null) return false;
        cache = cache.analyzed;
        if ((addr.v4 || false) !== (cache.addr.v4 || false)) return false;
        return addr.isInSubnet(cache.addr);
      },
      compile(_condition: any, cache: any) {
        cache = cache.analyzed;
        const hostLooksLikeIp = cache.addr.v4
          ? new U2.AST_Binary({
              left: new U2.AST_Sub({
                expression: new U2.AST_SymbolRef({ name: 'host' }),
                property: new U2.AST_Binary({
                  left: new U2.AST_Dot({
                    expression: new U2.AST_SymbolRef({ name: 'host' }),
                    property: 'length',
                  }),
                  operator: '-',
                  right: new U2.AST_Number({ value: 1 }),
                }),
              }),
              operator: '>=',
              right: new U2.AST_Number({ value: 0 }),
            })
          : new U2.AST_Binary({
              left: new U2.AST_Call({
                expression: new U2.AST_Dot({
                  expression: new U2.AST_SymbolRef({ name: 'host' }),
                  property: 'indexOf',
                }),
                args: [new U2.AST_String({ value: ':' })],
              }),
              operator: '>=',
              right: new U2.AST_Number({ value: 0 }),
            });
        if (cache.addr.subnetMask === 0) {
          return hostLooksLikeIp;
        }
        let hostIsInNet: any = new U2.AST_Call({
          expression: new U2.AST_SymbolRef({ name: 'isInNet' }),
          args: [
            new U2.AST_SymbolRef({ name: 'host' }),
            new U2.AST_String({ value: cache.normalized }),
            new U2.AST_String({ value: cache.mask }),
          ],
        });
        if (!cache.addr.v4) {
          const hostIsInNetEx = new U2.AST_Call({
            expression: new U2.AST_SymbolRef({ name: 'isInNetEx' }),
            args: [
              new U2.AST_SymbolRef({ name: 'host' }),
              new U2.AST_String({ value: cache.normalized + cache.addr.subnet }),
            ],
          });
          hostIsInNet = new U2.AST_Conditional({
            condition: new U2.AST_Binary({
              left: new U2.AST_UnaryPrefix({
                operator: 'typeof',
                expression: new U2.AST_SymbolRef({ name: 'isInNetEx' }),
              }),
              operator: '===',
              right: new U2.AST_String({ value: 'function' }),
            }),
            consequent: hostIsInNetEx,
            alternative: hostIsInNet,
          });
        }
        return new U2.AST_Binary({
          left: hostLooksLikeIp,
          operator: '&&',
          right: hostIsInNet,
        });
      },
      str(condition: any) {
        return condition.ip + '/' + condition.prefixLength;
      },
      fromStr(str: string, condition: any) {
        const addr = Conditions.parseIp(str);
        if (addr != null) {
          condition.ip = addr.addressMinusSuffix;
          condition.prefixLength = addr.subnetMask;
        } else {
          condition.ip = '0.0.0.0';
          condition.prefixLength = 0;
        }
        return condition;
      },
    },

    HostLevelsCondition: {
      abbrs: ['Lv', 'Level', 'Levels', 'HL', 'HLv', 'HLevel', 'HLevels', 'HostL', 'HostLv', 'HostLevel', 'HostLevels'],
      analyze(_condition: any) {
        return '.'.charCodeAt(0);
      },
      match(condition: any, request: any, cache: any) {
        const dotCharCode = cache.analyzed;
        let dotCount = 0;
        for (let i = 0; i < request.host.length; i++) {
          if (request.host.charCodeAt(i) === dotCharCode) {
            dotCount++;
            if (dotCount > condition.maxValue) return false;
          }
        }
        return dotCount >= condition.minValue;
      },
      compile(condition: any) {
        const val = new U2.AST_Dot({
          property: 'length',
          expression: new U2.AST_Call({
            args: [new U2.AST_String({ value: '.' })],
            expression: new U2.AST_Dot({
              expression: new U2.AST_SymbolRef({ name: 'host' }),
              property: 'split',
            }),
          }),
        });
        return Conditions.between(
          val,
          condition.minValue + 1,
          condition.maxValue + 1,
          `${condition.minValue} <= hostLevels <= ${condition.maxValue}`,
        );
      },
      str(condition: any) {
        return condition.minValue + '~' + condition.maxValue;
      },
      fromStr(str: string, condition: any) {
        const parts = str.split('~');
        condition.minValue = parseInt(parts[0], 10);
        condition.maxValue = parseInt(parts[1], 10);
        if (!(condition.minValue > 0)) condition.minValue = 1;
        if (!(condition.maxValue > 0)) condition.maxValue = 1;
        return condition;
      },
    },

    WeekdayCondition: {
      abbrs: ['WD', 'Week', 'Day', 'Weekday'],
      analyze: (_condition: any) => null,
      match(condition: any) {
        const day = new Date().getDay();
        if (condition.days) return condition.days.charCodeAt(day) > 64;
        return condition.startDay <= day && day <= condition.endDay;
      },
      compile(condition: any) {
        const getDay = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getDay',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({ name: 'Date' }),
            }),
          }),
        });
        if (condition.days) {
          return new U2.AST_Binary({
            left: new U2.AST_Call({
              expression: new U2.AST_Dot({
                expression: new U2.AST_String({ value: condition.days }),
                property: 'charCodeAt',
              }),
              args: [getDay],
            }),
            operator: '>',
            right: new U2.AST_Number({ value: 64 }),
          });
        } else {
          return Conditions.between(getDay, condition.startDay, condition.endDay);
        }
      },
      str(condition: any) {
        if (condition.days) return condition.days;
        return condition.startDay + '~' + condition.endDay;
      },
      fromStr(str: string, condition: any) {
        if (str.indexOf('~') < 0 && str.length === 7) {
          condition.days = str;
        } else {
          const parts = str.split('~');
          condition.startDay = parseInt(parts[0], 10);
          condition.endDay = parseInt(parts[1], 10);
          if (!(0 <= condition.startDay && condition.startDay <= 6)) condition.startDay = 0;
          if (!(0 <= condition.endDay && condition.endDay <= 6)) condition.endDay = 0;
        }
        return condition;
      },
    },

    TimeCondition: {
      abbrs: ['T', 'Time', 'Hour'],
      analyze: (_condition: any) => null,
      match(condition: any) {
        const hour = new Date().getHours();
        return condition.startHour <= hour && hour <= condition.endHour;
      },
      compile(condition: any) {
        const val = new U2.AST_Call({
          args: [],
          expression: new U2.AST_Dot({
            property: 'getHours',
            expression: new U2.AST_New({
              args: [],
              expression: new U2.AST_SymbolRef({ name: 'Date' }),
            }),
          }),
        });
        return Conditions.between(val, condition.startHour, condition.endHour);
      },
      str(condition: any) {
        return condition.startHour + '~' + condition.endHour;
      },
      fromStr(str: string, condition: any) {
        const parts = str.split('~');
        condition.startHour = parseInt(parts[0], 10);
        condition.endHour = parseInt(parts[1], 10);
        if (!(0 <= condition.startHour && condition.startHour < 24)) condition.startHour = 0;
        if (!(0 <= condition.endHour && condition.endHour < 24)) condition.endHour = 0;
        return condition;
      },
    },
  } as Record<string, any>,
};

export default Conditions;
export const {
  requestFromUrl,
  urlWildcard2HostWildcard,
  tag,
  analyze,
  match,
  compile,
  str,
  colonCharCode,
  fromStr,
  typeFromAbbr,
  comment,
  safeRegex,
  regTest,
  isInt,
  between,
  parseIp,
  normalizeIp,
  ipv6Max,
  localHosts,
  getWeekdayList,
} = Conditions;
