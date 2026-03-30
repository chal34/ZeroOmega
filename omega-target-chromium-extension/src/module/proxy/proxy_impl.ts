const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import ProxyAuth = require('./proxy_auth')

const profilePacCache = new Map()

class ProxyImpl {
  log: any
  _proxyAuth: any

  constructor(log: any) {
    this.log = log
  }

  static isSupported() {
    return false
  }

  applyProfile(profile: any, meta?: any, options?: any): Promise<any> {
    return Promise.reject(new Error('not implemented'))
  }

  watchProxyChange(callback: any): any {
    return null
  }

  parseExternalProfile(details: any, options: any): any {
    return null
  }

  _profileNotFound(name: string) {
    this.log.error(
      `Profile ${name} not found! Things may go very, very wrong.`
    )
    return OmegaPac.Profiles.create({
      name: name,
      profileType: 'VirtualProfile',
      defaultProfileName: 'direct',
    })
  }

  setProxyAuth(profile: any, options: any) {
    return Promise.resolve().then(() => {
      this._proxyAuth ??= new ProxyAuth(this.log)
      this._proxyAuth.listen()
      const referenced_profiles: any[] = []
      const ref_set = OmegaPac.Profiles.allReferenceSet(profile, options, {
        profileNotFound: this._profileNotFound.bind(this),
      })
      for (const [, name] of Object.entries<any>(ref_set)) {
        const p = OmegaPac.Profiles.byName(name, options)
        if (p) {
          referenced_profiles.push(p)
        }
      }
      this._proxyAuth.setProxies(referenced_profiles)
    })
  }

  getProfilePacScript(profile: any, meta: any, options: any) {
    meta ??= profile
    const referenced_profiles: any[] = []
    const ref_set = OmegaPac.Profiles.allReferenceSet(profile, options, {
      profileNotFound: this._profileNotFound.bind(this),
    })
    for (const [, name] of Object.entries<any>(ref_set)) {
      const _profile = OmegaPac.Profiles.byName(name, options)
      if (_profile) {
        referenced_profiles.push(_profile)
      }
    }
    const allProfilesSet = new Set(Object.values(options))
    profilePacCache.forEach((value: any, cachedProfile: any) => {
      if (!allProfilesSet.has(cachedProfile)) {
        profilePacCache.delete(cachedProfile)
      }
    })
    const profilePac = profilePacCache.get(profile)
    const profilePacKey = referenced_profiles
      .map((_profile: any) => {
        let revision = _profile.revision || 1
        if (OmegaPac.Profiles.updateUrl(_profile) && _profile.sha256) {
          revision = _profile.sha256
        }
        return _profile.name + '_' + revision
      })
      .join(',')
    if (profilePac?.[profilePacKey]) {
      return profilePac[profilePacKey]
    }
    const ast = OmegaPac.PacGenerator.script(options, profile, {
      profileNotFound: this._profileNotFound.bind(this),
    })
    const compressedAst = OmegaPac.PacGenerator.compress(ast)
    const script = OmegaPac.PacGenerator.ascii(
      compressedAst.print_to_string()
    )
    let profileName = OmegaPac.PacGenerator.ascii(
      JSON.stringify(meta.name)
    )
    profileName = profileName.replace(/\*/g, '\\u002a')
    profileName = profileName.replace(/\\/g, '\\u002f')
    const prefix = `/*OmegaProfile*${profileName}*${meta.revision}*/`
    const pacScript = prefix + script
    const newPac: any = {}
    newPac[profilePacKey] = pacScript
    profilePacCache.set(profile, newPac)
    return pacScript
  }
}

export = ProxyImpl
