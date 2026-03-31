import { builtinProfiles, profileColors, getVirtualTarget } from './useProfiles'

const defaultProfileIcon: Record<string, string> = {
  DirectProfile: 'glyphicon-transfer',
  SystemProfile: 'glyphicon-off',
  AutoDetectProfile: 'glyphicon-file',
  FixedProfile: 'glyphicon-globe',
  PacProfile: 'glyphicon-file',
  RuleListProfile: 'glyphicon-list',
  SwitchProfile: 'glyphicon-retweet',
  VirtualProfile: 'glyphicon-question-sign',
}

export function getProfileIcon(profile: any, options?: any): string {
  if (!profile) return 'glyphicon-question-sign'

  let type = profile.profileType
  if (options) {
    const target = getVirtualTarget(profile, options)
    if (target) {
      type = target.profileType ?? type
    }
  }
  return defaultProfileIcon[type] || 'glyphicon-question-sign'
}

export function getProfileColor(profile: any, options?: any): string {
  if (!profile) return '#999'

  // Follow virtual profile chain to resolve color
  let current: any = profile
  while (current) {
    if (current.color) return current.color
    current = getVirtualTarget(current, options)
  }

  const builtin = builtinProfiles[profile.name]
  if (builtin?.color) return builtin.color

  return profileColors[0] || '#999'
}
