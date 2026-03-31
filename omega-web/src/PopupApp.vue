<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useOmegaTarget } from './composables/useOmegaTarget'
import {
  profileOrder,
  dispName as dispNameFn,
  getVirtualTarget,
} from './composables/useProfiles'
import { getProfileIcon, getProfileColor } from './composables/useProfileIcons'
import ProfileInline from './components/ProfileInline.vue'
import ProfileIcon from './components/ProfileIcon.vue'

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

function dispNameFilter(name: any): string {
  if (typeof name === 'object') name = name.name
  return tr('profile_' + name) || name
}

// Reactive state
const customCss = ref('')
const proxyNotControllable = ref<string | null>(null)
const availableProfiles = ref<any>(null)
const currentProfileName = ref('')
const currentProfile = ref<any>(null)
const isSystemProfile = ref(false)
const externalProfile = ref<any>(null)
const builtinProfiles = ref<any[]>([])
const customProfiles = ref<any[]>([])
const validResultProfiles = ref<any[]>([])
const currentProfileCanAddRule = ref(false)
const currentDomain = ref('')
const subdomain = ref('')
const currentTempRuleProfile = ref('')
const showConditionForm = ref(false)
const showRequestInfo = ref(false)
const requestInfo = ref<any>(null)
const requestInfoProvided = ref<boolean | null>(null)

const tempRuleMenuOpen = ref(false)
const nameExternalOpen = ref(false)
const externalProfileName = ref('')
const showShortcutHelp = ref(false)

const domainsForCondition = reactive<Record<string, boolean>>({})
const profileForDomains = ref('direct')

let refreshOnProfileChange = false
let preselectedProfileNameForCondition = 'direct'
let subdomainLevel = 0
let summaryDetail = false

// Rule condition form
const rule = reactive({
  condition: {
    conditionType: 'HostWildcardCondition',
    pattern: '',
  },
  profileName: 'direct',
})

let conditionSuggestion: Record<string, string> = {}

// Close popup
function closePopup() {
  window.top?.close()
}

function openManage() {
  omegaTarget.openManage()
  window.top?.close()
}

const refresh = () => {
  if (refreshOnProfileChange) {
    omegaTarget.refreshActivePage().then(() => {
      window.top?.close()
    })
  } else {
    window.top?.close()
  }
}

function isActive(profileName: string): boolean {
  if (isSystemProfile.value) {
    return profileName === 'system'
  }
  return currentProfileName.value === profileName
}

function isEffective(profileName: string): boolean {
  return isSystemProfile.value && currentProfileName.value === profileName
}

function getIcon(profile: any, normal?: boolean): string | undefined {
  if (!profile) return undefined
  if (!normal && isEffective(profile.name)) {
    return 'glyphicon-ok'
  }
  return undefined
}

function getProfileTitle(profile: any): string {
  let desc = ''
  let p = profile
  while (p) {
    desc = p.desc
    p = getVirtualTarget(p, availableProfiles.value)
  }
  return desc || profile?.name || ''
}

function openOptions(hash?: string) {
  return omegaTarget.openOptions(hash).then(() => {
    window.top?.close()
  })
}

function openConditionHelp() {
  const pname = encodeURIComponent(currentProfileName.value)
  openOptions(`#!/profile/${pname}?help=condition`)
}

function applyProfile(profile: any) {
  const next = () => {
    if (profile.profileType === 'SwitchProfile') {
      return omegaTarget.state('web.switchGuide').then((switchGuide: any) => {
        if (switchGuide === 'showOnFirstUse') {
          return openOptions(`#!/profile/${profile.name}`)
        }
      })
    }
    return undefined
  }

  let apply: any
  if (!refreshOnProfileChange) {
    omegaTarget.applyProfileNoReply(profile.name)
    apply = next()
  } else {
    apply = omegaTarget.applyProfile(profile.name).then(() => {
      return omegaTarget.refreshActivePage()
    }).then(next)
  }

  if (apply) {
    apply.then(() => { window.top?.close() })
  } else {
    window.top?.close()
  }
}

function addTempRule(domain: string, profileName: string) {
  tempRuleMenuOpen.value = false
  omegaTarget.addTempRule(domain, profileName).then(() => {
    omegaTarget.state('lastProfileNameForCondition', profileName)
    refresh()
  })
}

function setDefaultProfile(profileName: string, defaultProfileName: string) {
  omegaTarget.setDefaultProfile(profileName, defaultProfileName).then(() => {
    refresh()
  })
}

function addCondition(condition: any, profileName: string) {
  omegaTarget.addCondition(condition, profileName).then(() => {
    omegaTarget.state('lastProfileNameForCondition', profileName)
    refresh()
  })
}

function addConditionForDomains(domains: Record<string, boolean>, profileName: string) {
  const conditions: any[] = []
  for (const domain in domains) {
    if (domains.hasOwnProperty(domain) && domains[domain]) {
      conditions.push({
        conditionType: 'HostWildcardCondition',
        pattern: domain,
      })
    }
  }
  omegaTarget.addCondition(conditions, profileName).then(() => {
    omegaTarget.state('lastProfileNameForCondition', profileName)
    refresh()
  })
}

function addTempConditionForDomains(domains: Record<string, boolean>, profileName: string) {
  const promises: Promise<any>[] = []
  for (const domain in domains) {
    if (domains.hasOwnProperty(domain) && domains[domain]) {
      promises.push(omegaTarget.addTempRule(domain.substring(2), profileName, true as any))
    }
  }
  Promise.all(promises).then(() => {
    omegaTarget.state('lastProfileNameForCondition', profileName)
    refresh()
  })
}

function saveExternal() {
  nameExternalOpen.value = false
  const profile = externalProfile.value
  const name = profile?.name
  if (name) {
    omegaTarget.addProfile(profile).then(() => {
      omegaTarget.applyProfile(name).then(() => {
        refresh()
      })
    })
  }
}

function returnToMenu() {
  if (location.hash.indexOf('!') >= 0) {
    location.href = 'popup/index.html'
    return
  }
  showConditionForm.value = false
  showRequestInfo.value = false
}

function generateConditionSuggestion(): Record<string, string> {
  let cd = currentDomain.value
  const sd = subdomain.value
  let currentDomainEscaped = cd.replace(/\./g, '\\.')
  let domainLooksLikeIp = false

  if (cd.indexOf(':') >= 0) {
    domainLooksLikeIp = true
    if (cd[0] !== '[') {
      cd = '[' + cd + ']'
      currentDomainEscaped = cd.replace(/\./g, '\\.')
        .replace(/\[/g, '\\[').replace(/\]/g, '\\]')
    }
  } else if (cd[cd.length - 1] >= '0') {
    domainLooksLikeIp = true
  }

  if (domainLooksLikeIp) {
    return {
      HostWildcardCondition: cd,
      HostRegexCondition: '^' + currentDomainEscaped + '$',
      UrlWildcardCondition: '*://' + cd + '/*',
      UrlRegexCondition: '://' + currentDomainEscaped + '(:\\d+)?/',
      KeywordCondition: cd,
    }
  } else {
    let domain = cd
    if (sd) {
      let subdomains = sd.split('.')
      subdomainLevel = subdomainLevel % (subdomains.length + 1)
      if (subdomainLevel > 0) {
        subdomains = subdomains.splice(subdomainLevel - 1)
        subdomains.push(cd)
        domain = subdomains.join('.')
        currentDomainEscaped = domain.replace(/\./g, '\\.')
      }
    }
    return {
      HostWildcardCondition: '*.' + domain,
      HostRegexCondition: '(^|\\\\.)' + currentDomainEscaped + '$',
      UrlWildcardCondition: '*://*.' + domain + '/*',
      UrlRegexCondition: '://([^/.]+\\.)*' + currentDomainEscaped + '(:\\d+)?/',
      KeywordCondition: domain,
    }
  }
}

function prepareConditionForm() {
  conditionSuggestion = generateConditionSuggestion()
  rule.condition.conditionType = 'HostWildcardCondition'
  rule.condition.pattern = conditionSuggestion['HostWildcardCondition']
  rule.profileName = preselectedProfileNameForCondition
  showConditionForm.value = true
}

// Update condition pattern when type changes
watch(() => rule.condition.conditionType, (type) => {
  if (conditionSuggestion[type]) {
    rule.condition.pattern = conditionSuggestion[type]
  }
})

function toggleSubDomainLevel() {
  if (window.location.hash === '#!addRule') {
    subdomainLevel++
    conditionSuggestion = generateConditionSuggestion()
    rule.condition.pattern = conditionSuggestion[rule.condition.conditionType]
  }
}

function generateDomainInfos(info: any): any[] {
  const domains: any[] = []
  let summary = info.summary
  if (!summaryDetail) {
    summary = {}
    for (const domain in info.summary) {
      if (info.summary.hasOwnProperty(domain)) {
        const domainInfo = info.summary[domain]
        let summaryItem = summary[domainInfo.baseDomain]
        if (!summaryItem) {
          summaryItem = {
            errorCount: domainInfo.errorCount,
            domain: domainInfo.baseDomain,
            baseDomain: domainInfo.baseDomain,
          }
          summary[domainInfo.baseDomain] = summaryItem
        } else {
          summaryItem.errorCount += domainInfo.errorCount
        }
      }
    }
  }
  for (const domain in summary) {
    if (summary.hasOwnProperty(domain)) {
      const domainInfo = summary[domain]
      domainInfo.domain = domain
      domains.push(domainInfo)
    }
  }
  domains.sort((a: any, b: any) => b.errorCount - a.errorCount)
  return domains
}

function toggleSummaryDetail(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  // Reset
  for (const k in domainsForCondition) {
    delete domainsForCondition[k]
  }
  requestInfoProvided.value = null
  summaryDetail = !summaryDetail
  const info = requestInfo.value
  info.domains = generateDomainInfos(info)
  requestInfo.value = info
  requestInfoProvided.value = requestInfoProvided.value ?? (info?.domains.length > 0)
  for (const domain of info.domains) {
    domainsForCondition[domain.domain] = domainsForCondition[domain.domain] ?? true
  }
}

function inspectNetworkTraffic(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  const sp = new URLSearchParams(document.location.search)
  const activeTabId = sp.get('activeTabId')
  const url = chrome.runtime.getURL('popup/network/index.html?tabId=') + activeTabId
  chrome.tabs.create({ url })
}

function onConditionFormSubmit() {
  addCondition(rule.condition, rule.profileName)
}

function onRequestInfoFormSubmit() {
  addConditionForDomains(domainsForCondition, profileForDomains.value)
}

// Keyboard shortcuts
const shortcutHandlers: Record<number, any> = {}

function moveUp(activeIndex: number, items: Element[]) {
  const i = activeIndex - 1
  if (i >= 0) {
    (items[i] as HTMLElement)?.focus()
  }
}

function moveDown(activeIndex: number, items: Element[]) {
  if (activeIndex + 1 < items.length) {
    (items[activeIndex + 1] as HTMLElement)?.focus()
  }
}

// Build shortcut key map
shortcutHandlers[38] = moveUp       // Up
shortcutHandlers[40] = moveDown     // Down
shortcutHandlers[74] = moveDown     // j
shortcutHandlers[75] = moveUp       // k
shortcutHandlers[48] = '+direct'    // 0
shortcutHandlers[83] = '+system'    // s
shortcutHandlers[191] = 'help'      // /
shortcutHandlers[63] = 'help'       // ?
shortcutHandlers[69] = 'external'   // e
shortcutHandlers[65] = 'addRule'    // a
shortcutHandlers[43] = 'addRule'    // +
shortcutHandlers[61] = 'addRule'    // =
shortcutHandlers[84] = 'tempRule'   // t
shortcutHandlers[79] = 'option'     // o
shortcutHandlers[82] = 'requestInfo' // r

for (let i = 1; i <= 9; i++) {
  shortcutHandlers[48 + i] = i
}

function onKeyDown(e: KeyboardEvent) {
  const handler = shortcutHandlers[e.keyCode]
  if (!handler) return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  if (typeof handler === 'string') {
    if (handler === 'help') {
      showShortcutHelp.value = !showShortcutHelp.value
    } else {
      const el = document.querySelector(`a[data-shortcut='${handler}']`) as HTMLElement
      el?.click()
    }
  } else if (typeof handler === 'number') {
    const items = document.querySelectorAll('.custom-profile:not([style*="display: none"]) > a')
    const el = items[handler - 1] as HTMLElement
    el?.click()
  } else if (typeof handler === 'function') {
    const items = Array.from(
      document.querySelectorAll('.popup-menu-nav > li:not([style*="display: none"]) > a')
    )
    let idx = items.indexOf((e.target as HTMLElement).closest('a')!)
    if (idx === -1) {
      const activeEl = document.querySelector('.popup-menu-nav > li.active > a')
      idx = activeEl ? items.indexOf(activeEl) : -1
    }
    handler(idx, items)
  }

  e.preventDefault()
  return false
}

// Shortcut key labels for help display
const shortcutLabels: Record<string, string> = {
  '+direct': '0',
  '+system': 'S',
  external: 'E',
  addRule: 'A',
  tempRule: 'T',
  option: 'O',
  requestInfo: 'R',
}

function getShortcutLabel(shortcut: string): string {
  return shortcutLabels[shortcut] || ''
}

function getCustomProfileShortcut(index: number): string {
  return index <= 8 ? String(index + 1) : ''
}

// Profile name validation for external profile
function isExternalNameValid(): boolean {
  if (!externalProfile.value?.name) return false
  if (availableProfiles.value?.['+' + externalProfile.value.name]) return false
  if (externalProfile.value.name[0] === '_') return false
  return true
}

// Initialize state
onMounted(() => {
  document.addEventListener('keydown', onKeyDown)

  omegaTarget.state('customCss').then((css: any) => {
    customCss.value = css ?? ''
  })

  // Check URL hash for initial state
  if (window.location.hash === '#!requestInfo') {
    showRequestInfo.value = true
  } else if (window.location.hash === '#!external') {
    nameExternalOpen.value = true
  }

  // Load main state
  omegaTarget.state([
    'availableProfiles', 'currentProfileName', 'isSystemProfile',
    'validResultProfiles', 'refreshOnProfileChange', 'externalProfile',
    'proxyNotControllable', 'lastProfileNameForCondition',
  ]).then(([ap, cpn, isp, vrp, rflag, ep, pnc, lpnfc]: any[]) => {
    proxyNotControllable.value = pnc
    if (pnc) return

    availableProfiles.value = ap
    currentProfile.value = ap['+' + cpn]
    currentProfileName.value = cpn
    isSystemProfile.value = isp
    externalProfile.value = ep
    if (ep) {
      externalProfileName.value = ep.name || ''
    }
    refreshOnProfileChange = rflag

    const charCodeUnderscore = '_'.charCodeAt(0)
    const profilesByNames = (names: string[]) => {
      const profiles: any[] = []
      for (const name of names) {
        const shown = name.charCodeAt(0) !== charCodeUnderscore ||
          name.charCodeAt(1) !== charCodeUnderscore
        if (shown) {
          profiles.push(ap['+' + name])
        }
      }
      return profiles
    }

    validResultProfiles.value = profilesByNames(vrp)

    if (lpnfc) {
      for (const profile of validResultProfiles.value) {
        if (profile.name === lpnfc) {
          preselectedProfileNameForCondition = lpnfc
        }
      }
    }

    const bp: any[] = []
    const cp: any[] = []
    for (const key in ap) {
      if (ap.hasOwnProperty(key)) {
        const profile = ap[key]
        if (profile.builtin) {
          bp.push(profile)
        } else if (profile.name && profile.name.charCodeAt(0) !== charCodeUnderscore) {
          cp.push(profile)
        }
        if (profile.validResultProfiles) {
          profile.validResultProfiles = profilesByNames(profile.validResultProfiles)
        }
      }
    }

    cp.sort(profileOrder)
    builtinProfiles.value = bp
    customProfiles.value = cp
  })

  // Request info callback
  omegaTarget.setRequestInfoCallback((info: any) => {
    info.domains = generateDomainInfos(info)
    requestInfo.value = info
    requestInfoProvided.value = requestInfoProvided.value ?? (info?.domains.length > 0)
    for (const domain of info.domains) {
      domainsForCondition[domain.domain] = domainsForCondition[domain.domain] ?? true
    }
    profileForDomains.value = profileForDomains.value || preselectedProfileNameForCondition
  })

  // Load page info
  Promise.all([
    omegaTarget.state('currentProfileCanAddRule'),
    omegaTarget.getActivePageInfo(),
  ]).then(([canAddRule, info]: any[]) => {
    currentProfileCanAddRule.value = canAddRule
    if (info) {
      currentTempRuleProfile.value = info.tempRuleProfileName || ''
      if (currentTempRuleProfile.value) {
        preselectedProfileNameForCondition = currentTempRuleProfile.value
      }
      currentDomain.value = info.domain || ''
      subdomain.value = info.subdomain || ''
      if (window.location.hash === '#!addRule') {
        prepareConditionForm()
      }
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <style class="om-style">{{ customCss }}</style>

  <!-- Main profile menu -->
  <ul
    v-show="!showConditionForm && !proxyNotControllable && !showRequestInfo"
    class="popup-menu-nav nav nav-pills nav-stacked"
  >
    <!-- Builtin profiles -->
    <li
      v-for="(profile, index) in builtinProfiles"
      :key="'builtin-' + profile.name"
      :class="{
        active: isActive(profile.name),
        'bg-info': isEffective(profile.name),
      }"
      class="profile"
    >
      <a
        href="#"
        role="button"
        :tabindex="100 + index"
        :title="getProfileTitle(profile)"
        :data-shortcut="'+' + profile.name"
        @click.prevent="applyProfile(profile)"
      >
        <ProfileInline
          :profile="profile"
          :icon="getIcon(profile)"
          :options="availableProfiles"
          :disp-name="dispNameFilter"
        />
        <span
          v-if="showShortcutHelp && getShortcutLabel('+' + profile.name)"
          class="shortcut-help"
        >{{ getShortcutLabel('+' + profile.name) }}</span>
      </a>
    </li>

    <!-- External profile -->
    <li
      v-show="requestInfoProvided == null && !!externalProfile"
      :class="{
        active: isActive(''),
        'bg-info': isEffective(''),
      }"
      class="profile external-profile"
    >
      <a
        href="#"
        role="button"
        :title="getProfileTitle(externalProfile)"
        data-shortcut="external"
        @click.prevent="nameExternalOpen = true"
      >
        <form @submit.prevent="isExternalNameValid() && saveExternal()">
          <ProfileIcon
            :profile="externalProfile"
            :icon="getIcon(externalProfile, true)"
            :options="availableProfiles"
          />
          <span v-show="!nameExternalOpen">{{ tr('popup_externalProfile') }}</span>
          <input
            v-show="nameExternalOpen"
            v-model="externalProfile.name"
            :placeholder="tr('popup_externalProfileName')"
            autofocus
            class="form-control"
            @blur="isExternalNameValid() && saveExternal()"
          >
        </form>
        <span
          v-if="showShortcutHelp"
          class="shortcut-help"
        >E</span>
      </a>
    </li>

    <!-- Request info warning -->
    <li
      v-show="!!requestInfoProvided"
      class="request-info bg-warning"
    >
      <a
        href="#"
        role="button"
        data-shortcut="requestInfo"
        @click.prevent="showRequestInfo = true"
      >
        <span class="glyphicon glyphicon-warning-sign text-warning"></span>
        {{ tr('popup_requestErrorCount', [String(requestInfo?.errorCount || 0)]) }}
        <span
          v-if="showShortcutHelp"
          class="shortcut-help"
        >R</span>
      </a>
    </li>

    <li class="divider"></li>

    <!-- Custom profiles -->
    <li
      v-for="(profile, index) in customProfiles"
      :key="'custom-' + profile.name"
      :class="{
        active: isActive(profile.name),
        'bg-info': isEffective(profile.name),
      }"
      class="profile custom-profile"
    >
      <!-- Simple profile (no valid result profiles) -->
      <a
        v-if="!profile.validResultProfiles"
        href="#"
        role="button"
        :title="getProfileTitle(profile)"
        @click.prevent="applyProfile(profile)"
      >
        <ProfileInline
          :profile="profile"
          :icon="getIcon(profile)"
          :options="availableProfiles"
          :disp-name="dispNameFilter"
        />
        <span
          v-if="showShortcutHelp && getCustomProfileShortcut(index)"
          class="shortcut-help"
        >{{ getCustomProfileShortcut(index) }}</span>
      </a>

      <!-- Profile with default edit (has valid result profiles) -->
      <template v-else>
        <a
          href="#"
          role="button"
          :title="getProfileTitle(profile)"
          class="profile-with-default-edit"
          @click.prevent="applyProfile(profile)"
        >
          <ProfileInline
            :profile="profile"
            :icon="getIcon(profile)"
            :options="availableProfiles"
            :disp-name="dispNameFilter"
          />
          [{{ profile.defaultProfileName }}]
          <button
            role="button"
            href="#"
            class="dropdown-toggle btn btn-default"
            @click.stop.prevent="profile._dropdownOpen = !profile._dropdownOpen"
          >
            <span class="glyphicon glyphicon-chevron-down"></span>
          </button>
          <span
            v-if="showShortcutHelp && getCustomProfileShortcut(index)"
            class="shortcut-help"
          >{{ getCustomProfileShortcut(index) }}</span>
        </a>
        <ul v-if="profile._dropdownOpen" class="dropdown-menu">
          <li
            v-for="p in profile.validResultProfiles"
            :key="p.name"
            :class="{ active: p.name === profile.defaultProfileName }"
          >
            <a
              href="#"
              role="button"
              :title="getProfileTitle(p)"
              @click.prevent="setDefaultProfile(profile.name, p.name); profile._dropdownOpen = false"
            >
              <ProfileInline
                :profile="p"
                :options="availableProfiles"
                :disp-name="dispNameFilter"
              />
            </a>
          </li>
        </ul>
      </template>
    </li>

    <!-- Divider before actions -->
    <li
      v-show="!!currentDomain && validResultProfiles.length"
      class="divider"
    ></li>

    <!-- Add condition -->
    <li v-show="!!currentProfileCanAddRule && !!currentDomain">
      <a
        href="#"
        role="button"
        data-shortcut="addRule"
        @click.prevent="prepareConditionForm()"
      >
        <span class="glyphicon glyphicon-plus"></span>
        <span>{{ tr('popup_addCondition') }}</span>
        <span
          v-if="showShortcutHelp"
          class="shortcut-help"
        >A</span>
      </a>
    </li>

    <!-- Temp rule -->
    <li
      v-show="!!currentDomain && validResultProfiles.length"
    >
      <a
        href="#"
        role="button"
        data-shortcut="tempRule"
        class="dropdown-toggle"
        @click.prevent="tempRuleMenuOpen = !tempRuleMenuOpen"
      >
        <span class="glyphicon glyphicon-filter"></span>
        <span class="current-domain">{{ currentDomain }}</span>
        <span class="caret"></span>
        <span
          v-if="showShortcutHelp"
          class="shortcut-help"
        >T</span>
      </a>
      <ul v-show="tempRuleMenuOpen" class="dropdown-menu">
        <li
          v-for="profile in validResultProfiles"
          :key="profile.name"
          :class="{ active: profile.name === currentTempRuleProfile }"
          v-show="!!currentTempRuleProfile || validResultProfiles.length === 1 || profile.name !== currentProfileName"
        >
          <a
            href="#"
            role="button"
            :title="getProfileTitle(profile)"
            @click.prevent="addTempRule(currentDomain, profile.name)"
          >
            <ProfileInline
              :profile="profile"
              :options="availableProfiles"
              :disp-name="dispNameFilter"
            />
          </a>
        </li>
      </ul>
    </li>

    <li class="divider"></li>

    <!-- Options link -->
    <li>
      <a
        href="#"
        role="button"
        data-shortcut="option"
        @click.prevent="openOptions()"
      >
        <span class="glyphicon glyphicon-wrench"></span>
        <span>{{ tr('popup_showOptions') }}</span>
        <span
          v-if="showShortcutHelp"
          class="shortcut-help"
        >O</span>
      </a>
    </li>
  </ul>

  <!-- Condition form -->
  <form
    v-show="showConditionForm"
    class="condition-form"
    @submit.prevent="onConditionFormSubmit"
  >
    <fieldset>
      <legend>
        {{ tr('popup_addConditionTo') }}
        <span class="profile-inline">
          <ProfileInline
            :profile="currentProfile"
            :options="availableProfiles"
            :disp-name="dispNameFilter"
          />
        </span>
      </legend>

      <div class="form-group">
        <label>
          {{ tr('options_conditionType') }}
          <button
            type="button"
            class="btn btn-link btn-sm clear-padding"
            @click="openConditionHelp()"
          >
            {{ tr('options_showConditionTypeHelp') }}
            <span class="glyphicon glyphicon-new-window"></span>
          </button>
        </label>
        <select v-model="rule.condition.conditionType" class="form-control">
          <option value="HostWildcardCondition">{{ tr('condition_HostWildcardCondition') }}</option>
          <option value="HostRegexCondition">{{ tr('condition_HostRegexCondition') }}</option>
          <option value="UrlWildcardCondition">{{ tr('condition_UrlWildcardCondition') }}</option>
          <option value="UrlRegexCondition">{{ tr('condition_UrlRegexCondition') }}</option>
          <option value="KeywordCondition">{{ tr('condition_KeywordCondition') }}</option>
        </select>
      </div>

      <div class="form-group">
        <label>{{ tr('options_conditionDetails') }}</label>
        <span class="input-group">
          <input
            v-model="rule.condition.pattern"
            type="text"
            required
            autofocus
            class="form-control condition-details"
          >
          <span class="input-group-btn">
            <button
              type="button"
              class="btn btn-default"
              @click="toggleSubDomainLevel()"
            >
              <i class="glyphicon glyphicon-transfer"></i>
            </button>
          </span>
        </span>
      </div>

      <div class="form-group">
        <label>{{ tr('options_resultProfile') }}</label>
        <select v-model="rule.profileName" class="form-control">
          <option
            v-for="p in validResultProfiles"
            :key="p.name"
            :value="p.name"
          >{{ dispNameFilter(p) }}</option>
        </select>
      </div>

      <div class="condition-controls">
        <button
          type="button"
          class="btn btn-default"
          @click="returnToMenu()"
        >{{ tr('dialog_cancel') }}</button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!rule.condition.pattern"
        >{{ tr('popup_addCondition') }}</button>
      </div>
    </fieldset>
  </form>

  <!-- Proxy not controllable -->
  <div
    v-show="proxyNotControllable"
    class="proxy-not-controllable"
  >
    <p class="text-danger">{{ tr('popup_proxyNotControllable_' + proxyNotControllable) }}</p>
    <p class="help-block">
      {{ tr('popup_proxyNotControllableDetails_' + proxyNotControllable) || tr('popup_proxyNotControllableDetails') }}
    </p>
    <p class="proxy-not-controllable-controls">
      <button class="btn btn-default" @click="closePopup()">{{ tr('dialog_cancel') }}</button>
      <button class="btn btn-primary" @click="openManage()">{{ tr('popup_proxyNotControllableManage') }}</button>
    </p>
  </div>

  <!-- Request info details -->
  <form
    v-show="showRequestInfo"
    class="request-info-details"
    @submit.prevent="onRequestInfoFormSubmit"
  >
    <fieldset>
      <legend v-show="!!currentProfileCanAddRule">
        {{ tr('popup_addConditionTo') }}
        <span class="profile-inline">
          <ProfileInline
            :profile="currentProfile"
            :options="availableProfiles"
            :disp-name="dispNameFilter"
          />
        </span>
      </legend>
      <legend v-show="!currentProfileCanAddRule">
        {{ tr('popup_requestErrorHeading') }}
      </legend>

      <div class="text-warning">{{ tr('popup_requestErrorWarning') }}</div>
      <p class="help-block">{{ tr('popup_requestErrorWarningHelp') }}</p>
      <p v-show="!!currentProfileCanAddRule" class="help-block">
        {{ tr('popup_requestErrorAddCondition') }}
      </p>

      <div>
        <button
          class="btn btn-default btn-xs btn-link"
          @click="toggleSummaryDetail($event)"
        >
          <i class="glyphicon glyphicon-transfer"></i>
        </button>
        <button
          class="btn btn-default btn-xs btn-link"
          @click="inspectNetworkTraffic($event)"
        >
          <i class="glyphicon glyphicon-dashboard"></i>
        </button>
      </div>

      <div
        v-for="(domain, index) in (requestInfo?.domains || [])"
        :key="domain.domain"
        class="checkbox"
      >
        <label>
          <input
            v-model="domainsForCondition[domain.domain]"
            type="checkbox"
            :autofocus="index === 0"
          >
          <span class="label label-warning">{{ domain.errorCount }}</span>
          {{ domain.domain }}
        </label>
      </div>

      <div v-show="!!currentProfileCanAddRule" class="form-group">
        <label>{{ tr('options_resultProfileForSelectedDomains') }}</label>
        <select v-model="profileForDomains" class="form-control">
          <option
            v-for="p in validResultProfiles"
            :key="p.name"
            :value="p.name"
          >{{ dispNameFilter(p) }}</option>
        </select>
      </div>

      <p v-show="!currentProfileCanAddRule" class="help-block">
        {{ tr('popup_requestErrorCannotAddCondition') }}
      </p>

      <div class="condition-controls">
        <button
          type="button"
          class="btn btn-default"
          @click="returnToMenu()"
        >{{ tr('dialog_cancel') }}</button>
        <button
          v-show="!!currentProfileCanAddRule"
          type="button"
          class="btn btn-default"
          @click="addTempConditionForDomains(domainsForCondition, profileForDomains)"
        >Add temp condition</button>
        <button
          v-show="!!currentProfileCanAddRule"
          type="submit"
          class="btn btn-primary"
        >{{ tr('popup_addCondition') }}</button>
        <button
          v-show="!currentProfileCanAddRule"
          type="button"
          class="btn btn-default pull-right"
          @click="openOptions('#!/general')"
        >{{ tr('popup_configureMonitorWebRequests') }}</button>
      </div>
    </fieldset>
  </form>
</template>
