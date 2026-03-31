<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import { useOptionsState } from '../../composables/useOptionsState'
import { downloadFile } from '../../composables/useDownloadFile'
import {
  getAttachedName,
  dispName,
  filterProfiles,
} from '../../composables/useProfiles'
import RuleRemoveConfirm from '../modals/RuleRemoveConfirm.vue'
import RuleResetConfirm from '../modals/RuleResetConfirm.vue'
import DeleteAttachedModal from '../modals/DeleteAttachedModal.vue'
import * as OmegaPac from 'omega-pac'

const props = defineProps<{
  profile: any
  options: any
}>()

const emit = defineEmits<{
  (e: 'set-export-rule-list', handler: ((name: string) => void) | null, options?: { warning?: boolean }): void
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage
const { state, showAlert, updateProfile } = useOptionsState()

const profileByName = (name: string) => OmegaPac.Profiles.byName(name, props.options)

// Rule list formats
const ruleListFormats = OmegaPac.Profiles.ruleListFormats

// Condition types
const conditionHelp = ref({ show: false })

const basicConditionTypes = [
  {
    group: 'default',
    types: ['HostWildcardCondition', 'UrlWildcardCondition', 'UrlRegexCondition', 'FalseCondition'],
  },
]

const advancedConditionTypes = [
  {
    group: 'host',
    types: ['HostWildcardCondition', 'HostRegexCondition', 'HostLevelsCondition', 'IpCondition'],
  },
  {
    group: 'url',
    types: ['UrlWildcardCondition', 'UrlRegexCondition', 'KeywordCondition'],
  },
  {
    group: 'special',
    types: ['WeekdayCondition', 'TimeCondition', 'FalseCondition'],
  },
]

function expandGroups(groups: any[]): any[] {
  const result: any[] = []
  for (const group of groups) {
    for (const type of group.types) {
      result.push({ type, group: 'condition_group_' + group.group })
    }
  }
  return result
}

const basicConditionTypesExpanded = expandGroups(basicConditionTypes)
const advancedConditionTypesExpanded = expandGroups(advancedConditionTypes)

const basicConditionTypeSet: Record<string, string> = {}
for (const type of basicConditionTypesExpanded) {
  basicConditionTypeSet[type.type] = type.type
}

const showConditionTypes = ref(0)
const hasConditionTypes = ref(0)
const hasUrlConditions = ref(false)
const isUrlConditionType: Record<string, boolean> = {
  'UrlWildcardCondition': true,
  'UrlRegexCondition': true,
}

const conditionTypes = computed(() => {
  return showConditionTypes.value === 0
    ? basicConditionTypesExpanded
    : advancedConditionTypesExpanded
})

function updateHasConditionTypes() {
  if (!props.profile?.rules) return

  hasUrlConditions.value = false
  for (const rule of props.profile.rules) {
    if (isUrlConditionType[rule.condition.conditionType]) {
      hasUrlConditions.value = true
      break
    }
  }

  if (hasConditionTypes.value !== 0) return
  for (const rule of props.profile.rules) {
    if (rule.condition.conditionType === 'TrueCondition') {
      rule.condition = { conditionType: 'HostWildcardCondition', pattern: '*' }
    }
    if (!basicConditionTypeSet[rule.condition.conditionType]) {
      hasConditionTypes.value = 1
      showConditionTypes.value = 1
      break
    }
  }
}

watch(
  () => props.options?.['-showConditionTypes'],
  (show) => {
    show = show || 0
    if (show > 0) {
      showConditionTypes.value = show
    } else {
      updateHasConditionTypes()
      showConditionTypes.value = hasConditionTypes.value
    }
  },
  { immediate: true }
)

// Rules
const loadRules = ref(false)
const editSource = ref(false)
const source = ref<{ code: string; touched?: boolean; error?: any } | null>(null)
const showNotes = ref(false)
const expandedSection = ref({ id: 0 })

// Attached profile
const attachedName = computed(() => getAttachedName(props.profile.name))
const attachedKey = computed(() => OmegaPac.Profiles.nameAsKey(attachedName.value))
const attached = computed({
  get: () => props.options?.[attachedKey.value],
  set: (val) => {
    if (props.options) props.options[attachedKey.value] = val
  },
})
const attachedOptions = ref<{ enabled: boolean; defaultProfileName: string }>({
  enabled: false,
  defaultProfileName: 'direct',
})

const attachedRuleListError = ref<any>(null)

// Modal states
const showRuleRemoveModal = ref(false)
const ruleRemoveIndex = ref(-1)
const showRuleResetModal = ref(false)
const showDeleteAttachedModal = ref(false)

// Sync attached options
watch(
  () => props.profile.defaultProfileName,
  (name) => {
    attachedOptions.value.enabled = (name === attachedName.value)
    if (!attached.value || !attachedOptions.value.enabled) {
      attachedOptions.value.defaultProfileName = name
    }
  },
  { immediate: true }
)

watch(
  () => attachedOptions.value.enabled,
  (enabled, oldValue) => {
    if (enabled === oldValue) return
    if (enabled) {
      if (props.profile.defaultProfileName !== attachedName.value) {
        props.profile.defaultProfileName = attachedName.value
      }
    } else {
      if (props.profile.defaultProfileName === attachedName.value) {
        if (attached.value) {
          props.profile.defaultProfileName = attached.value.defaultProfileName
          attachedOptions.value.defaultProfileName = attached.value.defaultProfileName
        } else {
          props.profile.defaultProfileName = 'direct'
          attachedOptions.value.defaultProfileName = 'direct'
        }
      }
    }
  }
)

watch(
  () => attached.value?.defaultProfileName,
  (name) => {
    if (name && attachedOptions.value.enabled) {
      attachedOptions.value.defaultProfileName = name
    }
  }
)

watch(
  () => attachedOptions.value.defaultProfileName,
  (name) => {
    if (attached.value && attachedOptions.value.enabled) {
      attached.value.defaultProfileName = name
    } else {
      props.profile.defaultProfileName = name
    }
  }
)

// Check for notes in rules
watch(
  () => props.profile.rules,
  (rules) => {
    if (rules && rules.some((rule: any) => !!rule.note)) {
      showNotes.value = true
    }
  },
  { deep: true, immediate: true }
)

// Set loadRules once rules are available
watch(
  () => props.profile.rules,
  (rules) => {
    if (rules && !loadRules.value && !editSource.value) {
      loadRules.value = true
    }
  },
  { immediate: true }
)

// Export handler setup
function exportRuleList() {
  let text = OmegaPac.RuleList.Switchy.compose({
    rules: props.profile.rules,
    defaultProfileName: attachedOptions.value.defaultProfileName,
  })
  const eol = '\r\n'
  let info = '\n'
  info += '; Require: ZeroOmega >= 2.3.2' + eol
  info += `; Date: ${new Date().toLocaleDateString()}` + eol
  info += `; Usage: ${tr('ruleList_usageUrl')}` + eol
  text = text.replace('\n', info)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const fileName = props.profile.name.replace(/\W+/g, '_')
  downloadFile(blob, `OmegaRules_${fileName}.sorl`)
}

function exportLegacyRuleList() {
  let wildcardRules = ''
  let regexpRules = ''
  for (const rule of props.profile.rules) {
    let i = ''
    if (rule.profileName === attachedOptions.value.defaultProfileName) {
      i = '!'
    }
    switch (rule.condition.conditionType) {
      case 'HostWildcardCondition':
        wildcardRules += i + '@*://' + rule.condition.pattern + '/*' + '\r\n'
        break
      case 'UrlWildcardCondition':
        wildcardRules += i + '@' + rule.condition.pattern + '\r\n'
        break
      case 'UrlRegexCondition':
        regexpRules += i + rule.condition.pattern + '\r\n'
        break
    }
  }
  const text = `; Summary: Proxy Switchy! Exported Rule List
; Date: ${new Date().toLocaleDateString()}
; Website: ${tr('ruleList_usageUrl')}

#BEGIN

[wildcard]
${wildcardRules}
[regexp]
${regexpRules}
#END
`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const fileName = props.profile.name.replace(/\W+/g, '_')
  downloadFile(blob, `SwitchyRules_${fileName}.ssrl`)
}

// Set export handler
watch(
  [showConditionTypes, () => props.options?.['-exportLegacyRuleList']],
  () => {
    if (props.options?.['-exportLegacyRuleList']) {
      if (showConditionTypes.value > 0) {
        emit('set-export-rule-list', exportRuleList, { warning: true })
      } else {
        emit('set-export-rule-list', exportLegacyRuleList)
      }
    } else {
      emit('set-export-rule-list', exportRuleList)
    }
  },
  { immediate: true }
)

// Rule operations
function addRule() {
  let rule: any
  if (props.profile.rules.length > 0) {
    const templ = props.profile.rules[props.profile.rules.length - 1]
    rule = JSON.parse(JSON.stringify(templ))
  } else {
    rule = {
      condition: { conditionType: 'HostWildcardCondition', pattern: '' },
      profileName: attachedOptions.value.defaultProfileName,
    }
  }
  if (rule.condition.pattern) {
    rule.condition.pattern = ''
  }
  props.profile.rules.push(rule)
}

function validateCondition(condition: any, pattern: string): boolean {
  if (condition.conditionType.indexOf('Regex') >= 0) {
    try {
      new RegExp(pattern)
    } catch (_) {
      return false
    }
  }
  return true
}

function conditionHasWarning(condition: any): boolean {
  if (condition.conditionType === 'HostWildcardCondition') {
    const pattern = condition.pattern
    return pattern.indexOf(':') >= 0 || pattern.indexOf('/') >= 0
  }
  return false
}

function removeRule(index: number) {
  if (props.options['-confirmDeletion']) {
    ruleRemoveIndex.value = index
    showRuleRemoveModal.value = true
  } else {
    props.profile.rules.splice(index, 1)
  }
}

function onRuleRemoveConfirm() {
  showRuleRemoveModal.value = false
  props.profile.rules.splice(ruleRemoveIndex.value, 1)
}

function cloneRule(index: number) {
  const rule = JSON.parse(JSON.stringify(props.profile.rules[index]))
  props.profile.rules.splice(index + 1, 0, rule)
  nextTick(() => {
    const input = document.querySelector(`.switch-rule-row:nth-child(${index + 2}) input`) as HTMLInputElement
    input?.focus()
    input?.select()
  })
}

function addNote() {
  showNotes.value = true
}

function resetRules() {
  showRuleResetModal.value = true
}

function onResetRulesConfirm() {
  showRuleResetModal.value = false
  for (const rule of props.profile.rules) {
    rule.profileName = attachedOptions.value.defaultProfileName
  }
}

function attachNew() {
  const newAttached = OmegaPac.Profiles.create({
    name: attachedName.value,
    defaultProfileName: props.profile.defaultProfileName,
    profileType: 'RuleListProfile',
    color: props.profile.color,
  })
  OmegaPac.Profiles.updateRevision(newAttached)
  props.options[attachedKey.value] = newAttached
  attachedOptions.value.enabled = true
  props.profile.defaultProfileName = attachedName.value
}

function removeAttached() {
  if (!attached.value) return
  showDeleteAttachedModal.value = true
}

function onDeleteAttachedConfirm() {
  showDeleteAttachedModal.value = false
  props.profile.defaultProfileName = attached.value.defaultProfileName
  delete props.options[attachedKey.value]
}

// Edit source
function toggleSource() {
  editSource.value = !editSource.value
  if (editSource.value) {
    const args = {
      rules: props.profile.rules,
      defaultProfileName: attachedOptions.value.defaultProfileName,
    }
    const code = OmegaPac.RuleList.Switchy.compose(args, { withResult: true })
    source.value = { code }
  } else {
    if (source.value) {
      if (!parseSource()) return
    }
    source.value = null
    loadRules.value = true
  }
}

function parseSource(): boolean {
  if (!source.value) return true
  const code = source.value.code.trim()
  const refs = OmegaPac.RuleList.Switchy.directReferenceSet({ ruleList: code })
  if (refs) {
    for (const key in refs) {
      if (refs.hasOwnProperty(key)) {
        const name = refs[key]
        if (!OmegaPac.Profiles.byKey(key, props.options)) {
          source.value.error = { reason: 'unknownProfile', message: tr('ruleList_error_unknownProfile', [name]) }
          editSource.value = true
          return false
        }
      }
    }
  }
  try {
    const rules = OmegaPac.RuleList.Switchy.parseOmega(code, null, null, { strict: true, source: false })
    source.value.error = undefined
    if (rules.length > 0) {
      attachedOptions.value.defaultProfileName = rules.pop().profileName
    }
    // Merge with existing
    const diffInst = jsondiffpatch.create({
      objectHash: (obj: any) => JSON.stringify(obj),
      textDiff: { minLength: 1 / 0 },
    })
    const oldRulesJson = JSON.parse(JSON.stringify(props.profile.rules))
    const patch = diffInst.diff(oldRulesJson, rules)
    jsondiffpatch.patch(props.profile.rules, patch)
    return true
  } catch (err: any) {
    source.value.error = err
    editSource.value = true
    return false
  }
}

function onSourceChange() {
  if (source.value) {
    source.value.touched = true
    state.optionsDirty = true
  }
}

function dispNameFn(name: any): string {
  return dispName(name, tr)
}

function allProfiles(): any[] {
  return filterProfiles(props.options, props.profile)
}

function getWeekdayList(condition: any): boolean[] {
  return OmegaPac.Conditions.getWeekdayList(condition)
}

function updateDay(condition: any, i: number, selected: boolean) {
  condition.days = condition.days || '-------'
  const char = selected ? 'SMTWtFs'[i] : '-'
  condition.days = condition.days.substr(0, i) + char + condition.days.substr(i + 1)
  delete condition.startDay
  delete condition.endDay
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// Profile icons from composable
const profileIcons: Record<string, string> = {
  RuleListProfile: 'glyphicon-list',
}

const sortableOptions = {
  handle: '.sort-bar',
  tolerance: 'pointer',
  axis: 'y',
  forceHelperSize: true,
  forcePlaceholderSize: true,
  containment: 'parent',
}
</script>

<template>
  <div>
    <!-- Condition Help Section -->
    <section v-show="conditionHelp.show" class="condition-help-section settings-group">
      <h3>
        {{ tr('options_group_conditionHelp') }}
        <button type="button" @click="conditionHelp.show = false" class="close close-condition-help">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ tr('dialog_close') }}</span>
        </button>
      </h3>
      <div
        v-for="(group, gIdx) in (showConditionTypes === 0 ? basicConditionTypes : advancedConditionTypes)"
        :key="gIdx"
        class="condition-help"
      >
        <h4 v-show="!!tr('condition_group_' + group.group)">
          <a @click="expandedSection.id = gIdx" role="button">
            <span :class="expandedSection.id === gIdx ? 'glyphicon glyphicon-chevron-down' : 'glyphicon glyphicon-chevron-right'"></span>
            {{ tr('condition_group_' + group.group) }}
          </a>
        </h4>
        <dl v-show="expandedSection.id === gIdx">
          <template v-for="type in group.types" :key="type">
            <dt>{{ tr('condition_' + type) }}</dt>
            <dd>
              <div v-html="tr('condition_help_' + type)"></div>
              <div v-if="isUrlConditionType[type]" class="text-danger">
                <span class="glyphicon glyphicon-alert"></span>
                <span v-html="tr('condition_alert_fullUrlLimitation')"></span>
              </div>
            </dd>
          </template>
        </dl>
      </div>
    </section>

    <!-- Switch Rules Section -->
    <section class="settings-group">
      <h3>
        {{ tr('options_group_switchRules') }}&nbsp;
        <button
          @click="toggleSource()"
          :class="editSource ? 'btn btn-primary active' : 'btn btn-default'"
        >
          <span class="glyphicon glyphicon-edit"></span> {{ tr('options_profileEditSource') }}
        </button>
        <a
          v-show="editSource"
          target="_blank"
          :title="tr('options_profileEditSourceHelp')"
          :href="tr('options_profileEditSourceHelpUrl')"
          class="btn btn-link btn-sm clear-padding toggle-condition-help"
        >
          <span class="glyphicon glyphicon-question-sign"></span>
        </a>
      </h3>

      <div v-show="source?.error" class="alert alert-danger width-limit">
        <span class="glyphicon glyphicon-remove"></span> {{ source?.error?.message }}
      </div>
      <div v-show="hasUrlConditions" class="alert alert-danger">
        <span class="glyphicon glyphicon-alert"></span>
        <span v-html="tr('condition_alert_fullUrlLimitation')"></span>
      </div>

      <!-- Source Edit Mode -->
      <div v-show="editSource" class="rules-source">
        <textarea
          v-if="source"
          v-model="source.code"
          rows="20"
          @input="onSourceChange()"
          class="monospace form-control width-limit"
        ></textarea>
      </div>

      <!-- Rules Table -->
      <div v-if="loadRules" v-show="!editSource" class="table-responsive switch-rules-wrapper">
        <table class="switch-rules table table-bordered table-condensed width-limit-xl">
          <thead>
            <tr>
              <th style="white-space: nowrap">{{ tr('options_sort') }}</th>
              <th class="condition-type-th">
                {{ tr('options_conditionType') }}&nbsp;
                <button
                  :title="tr('options_showConditionTypeHelp')"
                  @click="conditionHelp.show = !conditionHelp.show"
                  class="btn btn-link btn-sm clear-padding toggle-condition-help"
                >
                  <span class="glyphicon glyphicon-question-sign"></span>
                </button>
              </th>
              <th>{{ tr('options_conditionDetails') }}</th>
              <th>{{ tr('options_resultProfile') }}</th>
              <th>{{ tr('options_conditionActions') }}</th>
              <th v-if="showNotes">{{ tr('options_ruleNote') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(rule, index) in profile.rules"
              :key="index"
              class="switch-rule-row"
            >
              <td class="sort-bar"><span class="glyphicon glyphicon-sort"></span></td>
              <td :class="{ 'has-icon': isUrlConditionType[rule.condition.conditionType] }">
                <select
                  v-model="rule.condition.conditionType"
                  class="form-control"
                >
                  <optgroup
                    v-for="(group, gIdx) in (showConditionTypes === 0 ? basicConditionTypes : advancedConditionTypes)"
                    :key="gIdx"
                    :label="tr('condition_group_' + group.group)"
                  >
                    <option
                      v-for="type in group.types"
                      :key="type"
                      :value="type"
                    >{{ tr('condition_' + type) }}</option>
                  </optgroup>
                </select>
              </td>
              <td :class="{ 'has-warning': conditionHasWarning(rule.condition) }">
                <!-- FalseCondition -->
                <span v-if="rule.condition.conditionType === 'FalseCondition'">
                  <span v-show="!!rule.condition.pattern">
                    <input v-model="rule.condition.pattern" disabled :title="tr('condition_details_FalseCondition')" class="form-control">
                  </span>
                  <span v-show="!rule.condition.pattern">{{ tr('condition_details_FalseCondition') }}</span>
                </span>
                <!-- HostLevelsCondition -->
                <span v-else-if="rule.condition.conditionType === 'HostLevelsCondition'" class="host-levels-details">
                  <input type="number" min="1" max="99" v-model.number="rule.condition.minValue" required class="form-control">
                  <span>{{ tr('options_hostLevelsBetween') }}</span>
                  <input type="number" max="99" min="1" v-model.number="rule.condition.maxValue" required class="form-control">
                </span>
                <!-- TimeCondition -->
                <span v-else-if="rule.condition.conditionType === 'TimeCondition'" class="host-levels-details">
                  <input type="number" min="0" max="23" v-model.number="rule.condition.startHour" required class="form-control">
                  <span>{{ tr('options_hourBetween') }}</span>
                  <input type="number" min="0" max="23" v-model.number="rule.condition.endHour" required class="form-control">
                </span>
                <!-- WeekdayCondition -->
                <span v-else-if="rule.condition.conditionType === 'WeekdayCondition'" class="host-levels-details">
                  <label
                    v-for="(selected, di) in getWeekdayList(rule.condition)"
                    :key="di"
                    class="checkbox-inline"
                  >
                    <input
                      type="checkbox"
                      :checked="selected"
                      @change="updateDay(rule.condition, di, ($event.target as HTMLInputElement).checked)"
                    >{{ tr('options_weekDayShort_' + di) }}
                  </label>
                </span>
                <!-- Default pattern input -->
                <input
                  v-else
                  v-model="rule.condition.pattern"
                  required
                  class="form-control"
                >
              </td>
              <td class="switch-rule-row-target">
                <select
                  v-model="rule.profileName"
                  class="form-control"
                  :class="{ disabled: rule.condition.conditionType === 'NeverCondition' }"
                >
                  <option
                    v-for="p in allProfiles()"
                    :key="p.name"
                    :value="p.name"
                  >{{ dispNameFn(p.name) }}</option>
                </select>
              </td>
              <td>
                <button :title="tr('options_deleteRule')" @click="removeRule(index as number)" class="btn btn-danger btn-sm">
                  <span class="glyphicon glyphicon-trash"></span>
                </button>&nbsp;
                <button :title="tr('options_cloneRule')" @click="cloneRule(index as number)" class="btn btn-default btn-sm">
                  <span class="glyphicon glyphicon-duplicate"></span>
                </button>
                <button v-if="!showNotes" :title="tr('options_ruleNote')" @click="addNote()" class="btn btn-default btn-sm">
                  <span class="glyphicon glyphicon-comment"></span>
                </button>
              </td>
              <td v-if="showNotes">
                <input v-model="rule.note" class="form-control">
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <td style="border-right: none;"></td>
              <td style="border-left: none;" :colspan="showNotes ? 5 : 4">
                <button @click="addRule()" class="btn btn-default btn-sm">
                  <span class="glyphicon glyphicon-plus"></span>
                  <span>{{ tr('options_addCondition') }}</span>
                </button>
              </td>
            </tr>
          </tbody>
          <!-- Attached rule list row -->
          <tbody v-if="attached" class="switch-attached">
            <tr>
              <td style="border-right: none;">
                <span :class="'glyphicon ' + (profileIcons['RuleListProfile'] || 'glyphicon-list')"></span>
              </td>
              <td style="border-left: none;">
                <span class="checkbox">
                  <label>
                    <input type="checkbox" v-model="attachedOptions.enabled">
                    {{ tr('options_switchAttachedProfileInCondition') }}
                  </label>
                </span>
              </td>
              <td>
                <span v-show="attachedOptions.enabled">{{ tr('options_switchAttachedProfileInConditionDetails') }}</span>
                <span v-show="!attachedOptions.enabled">{{ tr('options_switchAttachedProfileInConditionDisabled') }}</span>
              </td>
              <td>
                <select
                  v-model="attached.matchProfileName"
                  class="form-control"
                  :class="{ disabled: !attachedOptions.enabled }"
                >
                  <option
                    v-for="p in allProfiles()"
                    :key="p.name"
                    :value="p.name"
                  >{{ dispNameFn(p.name) }}</option>
                </select>
              </td>
              <td>
                <button
                  :title="tr('options_deleteAttached')"
                  @click="removeAttached()"
                  class="btn btn-danger btn-sm"
                >
                  <span class="glyphicon glyphicon-trash"></span>
                </button>
              </td>
              <td v-if="showNotes"></td>
            </tr>
          </tbody>
          <!-- Default profile row -->
          <tbody>
            <tr class="switch-default-row">
              <td></td>
              <td colspan="2">{{ tr('options_switchDefaultProfile') }}</td>
              <td>
                <select
                  v-model="attachedOptions.defaultProfileName"
                  class="form-control"
                >
                  <option
                    v-for="p in allProfiles()"
                    :key="p.name"
                    :value="p.name"
                  >{{ dispNameFn(p.name) }}</option>
                </select>
              </td>
              <td>
                <button
                  :title="tr('options_resetRules_help')"
                  @click="resetRules()"
                  class="btn btn-info btn-sm"
                >
                  <span class="glyphicon glyphicon-chevron-up"></span>
                </button>
              </td>
              <td v-if="showNotes"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Attach Profile Section -->
    <section v-if="!attached" class="settings-group">
      <h3>{{ tr('options_group_attachProfile') }}</h3>
      <p class="help-block">{{ tr('options_attachProfileHelp') }}</p>
      <button @click="attachNew()" class="btn btn-default">
        <span class="glyphicon glyphicon-plus"></span> {{ tr('options_attachProfile') }}
      </button>
    </section>

    <!-- Rule List Config Section (when attached exists) -->
    <section v-if="attached" class="settings-group">
      <h3>{{ tr('options_group_ruleListConfig') }}</h3>
      <form @submit.prevent>
        <div class="form-group">
          <label>{{ tr('options_ruleListFormat') }}</label>
          <div
            v-for="format in ruleListFormats"
            :key="format"
            class="radio inline-form-control no-min-width"
          >
            <label>
              <input
                type="radio"
                name="formatInput"
                :value="format"
                v-model="attached.format"
              >{{ tr('ruleListFormat_' + format) }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>{{ tr('options_group_ruleListUrl') }}</label>
          <div class="input-group width-limit inline-form-control">
            <input
              type="url"
              v-model="attached.sourceUrl"
              class="form-control"
            >
            <span class="input-group-btn">
              <button type="button" @click="attached.sourceUrl = ''" :disabled="!attached.sourceUrl" class="btn btn-default">
                <span class="glyphicon glyphicon-remove"></span>
              </button>
            </span>
          </div>
        </div>
        <p class="help-block">{{ tr('options_ruleListUrlHelp') }}</p>
      </form>
      <p>
        <button
          :disabled="!attached.sourceUrl"
          @click="updateProfile(attached.name)"
          :class="attached.sourceUrl && !attached.lastUpdate ? 'btn btn-primary' : 'btn btn-default'"
        >
          <span class="glyphicon glyphicon-download-alt"></span> {{ tr('options_downloadProfileNow') }}
        </button>
      </p>
    </section>

    <!-- Rule List Text Section -->
    <section v-if="attached" class="settings-group">
      <h3>{{ tr('options_group_ruleListText') }}</h3>
      <p v-show="attached.sourceUrl && attached.lastUpdate" class="alert alert-success width-limit">
        {{ tr('options_ruleListLastUpdate', [formatDate(attached.lastUpdate)]) }}
      </p>
      <p v-show="attached.sourceUrl && !attached.lastUpdate" class="alert alert-danger width-limit">
        {{ tr('options_ruleListObsolete') }}
      </p>
      <p v-show="attachedRuleListError" class="alert alert-danger width-limit">
        <span class="glyphicon glyphicon-remove"></span> {{ attachedRuleListError?.message }}
      </p>
      <textarea
        id="attached-rulelist"
        rows="20"
        v-model="attached.ruleList"
        :disabled="!!attached.sourceUrl"
        class="monospace form-control width-limit"
      ></textarea>
    </section>

    <!-- Modals -->
    <RuleRemoveConfirm
      v-if="showRuleRemoveModal"
      :rule="profile.rules[ruleRemoveIndex]"
      :options="options"
      @confirm="onRuleRemoveConfirm"
      @cancel="showRuleRemoveModal = false"
    />
    <RuleResetConfirm
      v-if="showRuleResetModal"
      :default-profile-name="attachedOptions.defaultProfileName"
      :options="options"
      @confirm="onResetRulesConfirm"
      @cancel="showRuleResetModal = false"
    />
    <DeleteAttachedModal
      v-if="showDeleteAttachedModal"
      :attached="attached"
      :options="options"
      @confirm="onDeleteAttachedConfirm"
      @cancel="showDeleteAttachedModal = false"
    />
  </div>
</template>
