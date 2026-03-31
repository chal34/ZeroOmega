import * as OmegaPac from 'omega-pac'
const { Profiles } = OmegaPac

export const builtinProfiles = Profiles.builtinProfiles

export const profileColors = [
  '#9ce', '#9d9', '#fa8', '#fe9', '#d497ee', '#47b', '#5b5', '#d63', '#ca0',
]

export const profileColorPalette: string[][] = (() => {
  const colors = [...profileColors]
  const palette: string[][] = []
  while (colors.length) {
    palette.push(colors.splice(0, 3))
  }
  return palette
})()

const attachedPrefix = '__ruleListOf_'
const charCodeUnderscore = '_'.charCodeAt(0)
const charCodePlus = '+'.charCodeAt(0)

export function getAttachedName(name: string): string {
  return attachedPrefix + name
}

export function getParentName(name: string): string | undefined {
  if (name.indexOf(attachedPrefix) === 0) {
    return name.substr(attachedPrefix.length)
  }
  return undefined
}

export function isProfileNameHidden(name: string): boolean {
  return name.charCodeAt(0) === charCodeUnderscore
}

export function isProfileNameReserved(name: string): boolean {
  return (
    name.charCodeAt(0) === charCodeUnderscore &&
    name.charCodeAt(1) === charCodeUnderscore
  )
}

/**
 * Profile ordering comparator. Replaces Angular's profileOrder constant.
 * Sorts by profile type weight first, then alphabetically by name.
 */
const orderForType: Record<string, number> = {
  FixedProfile: -2000,
  PacProfile: -1000,
  VirtualProfile: 1000,
  SwitchProfile: 2000,
  RuleListProfile: 3000,
}

export function profileOrder(a: any, b: any): number {
  const diff = (orderForType[a.profileType] | 0) - (orderForType[b.profileType] | 0)
  if (diff !== 0) return diff
  if (a.name === b.name) return 0
  return a.name < b.name ? -1 : 1
}

/**
 * Filter profiles from options. Replaces Angular's 'profiles' filter.
 */
export function filterProfiles(options: any, filter?: string | any): any[] {
  const builtinProfileList: any[] = []
  for (const key in builtinProfiles) {
    builtinProfileList.push(builtinProfiles[key])
  }

  let result: any[] = []
  for (const name in options) {
    if (name.charCodeAt(0) === charCodePlus) {
      result.push(options[name])
    }
  }

  if (
    typeof filter === 'object' ||
    (typeof filter === 'string' && filter.charCodeAt(0) === charCodePlus)
  ) {
    if (typeof filter === 'string') {
      filter = filter.substr(1)
    }
    result = Profiles.validResultProfilesFor(filter, options)
  }

  if (filter === 'all') {
    result = result.filter((p: any) => !isProfileNameHidden(p.name))
    result = result.concat(builtinProfileList)
  } else {
    result = result.filter((p: any) => !isProfileNameReserved(p.name))
  }

  if (filter === 'sorted') {
    result.sort(profileOrder)
  }

  return result
}

/**
 * Returns the display name for a profile using i18n.
 */
export function dispName(name: any, getMessage: (key: string) => string): string {
  if (typeof name === 'object') {
    name = name.name
  }
  return getMessage('profile_' + name) || name
}

/**
 * Get the virtual target profile for switch profiles.
 */
export function getVirtualTarget(profile: any, options: any): any {
  if (profile?.profileType === 'VirtualProfile') {
    return options?.['+' + profile.defaultProfileName]
  }
  return undefined
}
