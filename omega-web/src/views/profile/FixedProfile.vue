<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useOmegaTarget } from '../../composables/useOmegaTarget'
import FixedAuthEditModal from '../modals/FixedAuthEditModal.vue'

const props = defineProps<{
  profile: any
  options: any
}>()

const omegaTarget = useOmegaTarget()
const tr = omegaTarget.getMessage

const urlSchemes = ['', 'http', 'https', 'ftp']
const proxyProperties: Record<string, string> = {
  '': 'fallbackProxy',
  'http': 'proxyForHttp',
  'https': 'proxyForHttps',
  'ftp': 'proxyForFtp',
}

const schemeDisp: Record<string, string | null> = {
  '': null,
  'http': 'http://',
  'https': 'https://',
  'ftp': 'ftp://',
}

const defaultPort: Record<string, number> = {
  'http': 80,
  'https': 443,
  'socks4': 1080,
  'socks5': 1080,
}

const showAdvanced = ref(false)
const bypassList = ref('')
const proxyEditors = ref<Record<string, any>>({})
const showAuthModal = ref(false)
const authModalScheme = ref('')

const socks5AuthSupported = !!(window as any).browser?.proxy?.onRequest
const authSupported: Record<string, boolean> = {
  'http': true,
  'https': true,
  'socks5': socks5AuthSupported,
}

const optionsForScheme: Record<string, Array<{ label: string; value: string | undefined }>> = {}
for (const scheme of urlSchemes) {
  const defaultLabel = scheme
    ? tr('options_protocol_useDefault')
    : tr('options_protocol_direct')
  optionsForScheme[scheme] = [
    { label: defaultLabel, value: undefined },
    { label: 'HTTP', value: 'http' },
    { label: 'HTTPS', value: 'https' },
    { label: 'SOCKS4', value: 'socks4' },
    { label: 'SOCKS5', value: 'socks5' },
  ]
}

function isProxyAuthActive(scheme: string): boolean {
  return props.profile.auth?.[proxyProperties[scheme]] != null
}

function editProxyAuth(scheme: string) {
  authModalScheme.value = scheme
  showAuthModal.value = true
}

function onAuthConfirm(auth: any) {
  showAuthModal.value = false
  const prop = proxyProperties[authModalScheme.value]
  if (!auth?.username) {
    if (props.profile.auth) {
      props.profile.auth[prop] = undefined
    }
  } else {
    props.profile.auth = props.profile.auth ?? {}
    props.profile.auth[prop] = auth
  }
}

// Sync proxy editors from profile
for (const scheme of urlSchemes) {
  watch(
    () => props.profile[proxyProperties[scheme]],
    (proxy: any) => {
      if (scheme && proxy) {
        showAdvanced.value = true
      }
      proxyEditors.value[scheme] = proxy ? { ...proxy } : {}
    },
    { immediate: true, deep: true }
  )
}

// Sync proxy editor changes back to profile
watch(
  proxyEditors,
  (editors, oldEditors) => {
    if (!editors) return
    for (const scheme of urlSchemes) {
      const proxy = editors[scheme]
      if (!proxy) continue
      if (!proxy.scheme) {
        if (!scheme) {
          proxyEditors.value[scheme] = {}
        }
        delete props.profile[proxyProperties[scheme]]
        continue
      } else if (oldEditors && !oldEditors[scheme]?.scheme) {
        if (proxy.scheme === editors['']?.scheme) {
          proxy.port = proxy.port ?? editors['']?.port
        }
        proxy.port = proxy.port ?? defaultPort[proxy.scheme]
        proxy.host = proxy.host ?? editors['']?.host ?? 'example.com'
      }
      props.profile[proxyProperties[scheme]] = props.profile[proxyProperties[scheme]] ?? proxy
    }
  },
  { deep: true }
)

// Sync bypass list from profile
watch(
  () => props.profile.bypassList,
  (list: any) => {
    if (!list) return
    bypassList.value = list.map((item: any) => item.pattern).join('\n')
  },
  { immediate: true, deep: true }
)

// Sync bypass list back to profile (on blur via v-model)
watch(bypassList, (val, oldVal) => {
  if (val == null || val === oldVal) return
  props.profile.bypassList = val
    .split(/\r?\n/)
    .filter((entry: string) => entry)
    .map((entry: string) => ({
      conditionType: 'BypassCondition',
      pattern: entry,
    }))
})

const authModalProxy = computed(() => {
  const prop = proxyProperties[authModalScheme.value]
  return props.profile[prop]
})

const authModalAuth = computed(() => {
  const prop = proxyProperties[authModalScheme.value]
  return props.profile.auth?.[prop]
    ? JSON.parse(JSON.stringify(props.profile.auth[prop]))
    : { username: '', password: '' }
})

const authModalSupported = computed(() => {
  const prop = proxyProperties[authModalScheme.value]
  const proxy = props.profile[prop]
  return proxy ? authSupported[proxy.scheme] ?? false : false
})
</script>

<template>
  <div>
    <section class="settings-group settings-group-fixed-servers">
      <h3>{{ tr('options_group_proxyServers') }}</h3>
      <div class="table-responsive">
        <table class="fixed-servers table table-bordered table-striped width-limit-lg">
          <thead>
            <tr>
              <th>{{ tr('options_proxy_scheme') }}</th>
              <th>{{ tr('options_proxy_protocol') }}</th>
              <th>{{ tr('options_proxy_server') }}</th>
              <th>{{ tr('options_proxy_port') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="scheme in urlSchemes"
              :key="scheme"
              v-show="scheme === '' || showAdvanced"
            >
              <td>{{ schemeDisp[scheme] || tr('options_scheme_default') }}</td>
              <td>
                <select
                  v-model="proxyEditors[scheme].scheme"
                  class="form-control"
                >
                  <option
                    v-for="opt in optionsForScheme[scheme]"
                    :key="String(opt.value)"
                    :value="opt.value"
                  >{{ opt.label }}</option>
                </select>
              </td>
              <td v-if="proxyEditors[scheme]?.scheme">
                <input
                  type="text"
                  v-model="proxyEditors[scheme].host"
                  required
                  class="form-control"
                >
              </td>
              <td v-if="!proxyEditors[scheme]?.scheme">
                <input
                  type="text"
                  value=""
                  :placeholder="proxyEditors['']?.host"
                  disabled
                  class="form-control"
                >
              </td>
              <td v-if="proxyEditors[scheme]?.scheme">
                <input
                  type="number"
                  min="1"
                  v-model.number="proxyEditors[scheme].port"
                  required
                  class="form-control"
                >
              </td>
              <td v-if="!proxyEditors[scheme]?.scheme">
                <input
                  type="number"
                  value=""
                  :placeholder="String(proxyEditors['']?.port || '')"
                  disabled
                  class="form-control"
                >
              </td>
              <td class="proxy-actions">
                <button
                  :class="isProxyAuthActive(scheme) ? 'btn btn-xs btn-success proxy-auth-toggle' : 'btn btn-xs btn-default proxy-auth-toggle'"
                  type="button"
                  role="button"
                  @click="editProxyAuth(scheme)"
                  :title="tr('options_proxy_auth')"
                >
                  <span class="glyphicon glyphicon-lock"></span>
                </button>
              </td>
            </tr>
          </tbody>
          <tbody v-show="!showAdvanced">
            <tr class="fixed-show-advanced">
              <td colspan="7">
                <button @click="showAdvanced = true" class="btn btn-link">
                  <span class="glyphicon glyphicon-chevron-down"></span> {{ tr('options_proxy_expand') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="settings-group">
      <h3>{{ tr('options_group_bypassList') }}</h3>
      <p class="help-block">{{ tr('options_bypassListHelp') }}</p>
      <p class="help-block">
        <a href="https://developer.chrome.com/extensions/proxy#bypass_list" target="_blank">
          {{ tr('options_bypassListHelpLinkText') }}
        </a>
      </p>
      <textarea
        rows="10"
        v-model.lazy="bypassList"
        class="monospace form-control width-limit"
      ></textarea>
    </section>

    <FixedAuthEditModal
      v-if="showAuthModal"
      :auth="authModalAuth"
      :auth-supported="authModalSupported"
      :protocol-disp="authModalProxy?.scheme || ''"
      @confirm="onAuthConfirm"
      @cancel="showAuthModal = false"
    />
  </div>
</template>
