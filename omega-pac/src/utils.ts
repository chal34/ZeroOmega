import { getDomain, getSubdomain } from 'tldts';

export const Revision = {
  fromTime(time?: string | number | Date): string {
    const t = time ? new Date(time as any) : new Date();
    return t.getTime().toString(16);
  },
  compare(a: string | null | undefined, b: string | null | undefined): number {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.length > b.length) return 1;
    if (a.length < b.length) return -1;
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  },
};

export class AttachedCache {
  prop: string;
  tag: (obj: any) => any;

  constructor(optProp: any, tagFn?: any) {
    this.tag = tagFn as any;
    this.prop = optProp;
    if (typeof this.tag === 'undefined') {
      this.tag = optProp;
      this.prop = '_cache';
    }
  }

  get(obj: any, otherwise: any): any {
    const tag = this.tag(obj);
    const cache = this._getCache(obj);
    if (cache != null && cache.tag === tag) {
      return cache.value;
    }
    const value = typeof otherwise === 'function' ? otherwise() : otherwise;
    this._setCache(obj, { tag, value });
    return value;
  }

  drop(obj: any): void {
    if (obj[this.prop] != null) {
      obj[this.prop] = undefined;
    }
  }

  private _getCache(obj: any): any {
    return obj[this.prop];
  }

  private _setCache(obj: any, value: any): void {
    if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
      Object.defineProperty(obj, this.prop, { writable: true });
    }
    obj[this.prop] = value;
  }
}

export function isIp(domain: string): boolean {
  if (domain.indexOf(':') > 0) return true; // IPv6
  const lastCharCode = domain.charCodeAt(domain.length - 1);
  if (48 <= lastCharCode && lastCharCode <= 57) return true; // ends with digit
  return false;
}

export function getBaseDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return getDomain(domain) ?? domain;
}

export function getSubdomainOf(url: string): string | null {
  return getSubdomain(url) || null;
}

export function wildcardForDomain(domain: string): string {
  if (isIp(domain)) return domain;
  return '*.' + getBaseDomain(domain);
}

export function wildcardForUrl(url: string): string {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    const m = url.match(/^[a-z][a-z0-9+\-.]*:\/\/([^/?#:]*)/i);
    domain = m ? m[1] : '';
  }
  if (isIp(domain)) return domain;
  return '*.' + domain;
}
