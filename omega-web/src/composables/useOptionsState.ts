import { reactive, computed, nextTick } from 'vue'
import { useOmegaTarget } from './useOmegaTarget'
import { filterProfiles } from './useProfiles'

export interface AlertState {
  type: string
  message?: string
  i18n?: string
}

const state = reactive({
  options: null as any,
  optionsOld: null as any,
  optionsDirty: false,
  isExperimental: false,
  customCss: '',
  syncOptions: null as any,
  updatingProfile: {} as Record<string, boolean>,
  alertShown: false,
  alertShownAt: 0,
  alert: null as AlertState | null,
  pacProfilesUnsupported: false,
})

let initialized = false
let alertTimeout: ReturnType<typeof setTimeout> | null = null
let hideAlertTimeout: ReturnType<typeof setTimeout> | null = null
let firstRunCallbacks: Array<() => void> = []

export function useOptionsState() {
  const omegaTarget = useOmegaTarget()
  const tr = omegaTarget.getMessage

  function init() {
    if (initialized) return
    initialized = true

    if ((window as any).browser?.proxy?.register || (window as any).browser?.proxy?.registerProxyScript) {
      state.isExperimental = true
      state.pacProfilesUnsupported = true
    }

    omegaTarget.state('customCss').then((customCss: any) => {
      state.customCss = customCss ?? ''
    })

    omegaTarget.addOptionsChangeCallback((newOptions: any) => {
      state.options = JSON.parse(JSON.stringify(newOptions))
      state.optionsOld = JSON.parse(JSON.stringify(newOptions))

      omegaTarget.state('syncOptions').then((syncOptions: any) => {
        state.syncOptions = syncOptions
      })

      nextTick(() => {
        state.optionsDirty = false
        for (const cb of firstRunCallbacks) {
          cb()
        }
        firstRunCallbacks = []
      })
    })

    omegaTarget.refresh()
  }

  const sortedProfiles = computed(() => {
    if (!state.options) return []
    return filterProfiles(state.options, 'sorted')
  })

  function showAlert(alert: AlertState) {
    if (alertTimeout) clearTimeout(alertTimeout)
    state.alert = alert
    state.alertShown = true
    state.alertShownAt = Date.now()
    alertTimeout = setTimeout(() => hideAlert(), 3000)
  }

  function hideAlert() {
    if (Date.now() - state.alertShownAt >= 1000) {
      state.alertShown = false
    }
  }

  function profileByName(name: string): any {
    return OmegaPac.Profiles.byName(name, state.options)
  }

  function applyOptions(): void {
    if (!state.optionsDirty) return
    const diff = jsondiffpatch.create({
      objectHash: (obj: any) => JSON.stringify(obj),
      textDiff: { minLength: 1 / 0 },
    })
    const plainOptions = JSON.parse(JSON.stringify(state.options))
    const patch = diff.diff(state.optionsOld, plainOptions)
    omegaTarget.optionsPatch(patch).then(() => {
      showAlert({ type: 'success', i18n: 'options_saveSuccess' })
    })
  }

  function resetOptions(options?: any): Promise<void> {
    return omegaTarget.resetOptions(options).then(() => {
      showAlert({ type: 'success', i18n: 'options_resetSuccess' })
    }).catch((err: any) => {
      showAlert({ type: 'error', message: String(err) })
      return Promise.reject(err)
    })
  }

  function revertOptions(): void {
    if (state.optionsDirty) {
      window.location.reload()
    }
  }

  function updateProfile(name: string | null): Promise<void> {
    if (name != null) {
      state.updatingProfile[name] = true
    } else {
      OmegaPac.Profiles.each(state.options, (key: any, profile: any) => {
        if (!profile.builtin) {
          state.updatingProfile[profile.name] = true
        }
      })
    }

    return omegaTarget.updateProfile(name as any, 'bypass_cache' as any).then((results: any) => {
      let success = 0
      let error = 0
      for (const profileName in results) {
        if (results.hasOwnProperty(profileName)) {
          if (results[profileName] instanceof Error) {
            error++
          } else {
            success++
          }
        }
      }
      if (error === 0) {
        showAlert({ type: 'success', i18n: 'options_profileDownloadSuccess' })
      } else {
        if (error === 1 && name) {
          const singleErr = results[OmegaPac.Profiles.nameAsKey(name)]
          if (singleErr) throw singleErr
        }
        throw results
      }
    }).catch((err: any) => {
      const message = tr('options_profileDownloadError_' + err.name,
        [err.statusCode ?? err.original?.statusCode ?? ''])
      if (message) {
        showAlert({ type: 'error', message })
      } else {
        showAlert({ type: 'error', i18n: 'options_profileDownloadError' })
      }
    }).finally(() => {
      if (name != null) {
        state.updatingProfile[name] = false
      } else {
        state.updatingProfile = {}
      }
    })
  }

  function exportScript(event: MouseEvent, name?: string): void {
    (window as any).FORCEFIXEXPORTSCRIPTFORSOCKS = !!event.shiftKey
    const getProfileName = name
      ? Promise.resolve(name)
      : omegaTarget.state('currentProfileName')

    getProfileName.then((profileName: string) => {
      if (!profileName) return
      const profile = profileByName(profileName)
      if (['DirectProfile', 'SystemProfile'].indexOf(profile.profileType) >= 0) return
      let missingProfile: string | null = null
      const profileNotFound = (name: string) => {
        missingProfile = name
        return 'dumb'
      }
      const ast = OmegaPac.PacGenerator.script(state.options, profileName, {
        profileNotFound,
      })
      let pac = ast.print_to_string({ beautify: true, comments: true })
      pac = OmegaPac.PacGenerator.ascii(pac)
      const blob = new Blob([pac], { type: 'text/plain;charset=utf-8' })
      const fileName = profileName.replace(/\W+/g, '_')
      import('./useDownloadFile').then(({ downloadFile: dlFile }) => {
        dlFile(blob, `OmegaProfile_${fileName}.pac`)
      })
      if (missingProfile) {
        setTimeout(() => {
          showAlert({
            type: 'error',
            message: tr('options_profileNotFound', [missingProfile!]),
          })
        })
      }
    })
  }

  function onFirstRun(callback: () => void): void {
    firstRunCallbacks.push(callback)
  }

  return {
    state,
    init,
    sortedProfiles,
    showAlert,
    hideAlert,
    profileByName,
    applyOptions,
    resetOptions,
    revertOptions,
    updateProfile,
    exportScript,
    onFirstRun,
  }
}
