import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActivationBootstrapInput,
  ActivationConfigInjectionInput,
  ActivationFlowSnapshot,
  ActivationProvisionInput,
  ActivationPurchaseInput,
  ActivationResaleInput,
  ActivationValidationInput
} from '../shared/activation/types'

const electronAPI = {
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  env: {
    check: (): Promise<{
      os: 'macos' | 'windows' | 'linux'
      nodeInstalled: boolean
      nodeVersion: string | null
      nodeVersionOk: boolean
      openclawInstalled: boolean
      openclawVersion: string | null
      openclawLatestVersion: string | null
      wslState?:
        | 'not_available'
        | 'not_installed'
        | 'needs_reboot'
        | 'no_distro'
        | 'not_initialized'
        | 'ready'
    }> => ipcRenderer.invoke('env:check')
  },
  activation: {
    bootstrap: (input: ActivationBootstrapInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:bootstrap', input),
    getState: (): Promise<ActivationFlowSnapshot | null> =>
      ipcRenderer.invoke('activation:get-state'),
    startPurchase: (input: ActivationPurchaseInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:start-purchase', input),
    confirmPurchase: (): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:confirm-purchase'),
    provision: (input: ActivationProvisionInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:provision', input),
    injectConfig: (input: ActivationConfigInjectionInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:inject-config', input),
    validate: (input: ActivationValidationInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:validate', input),
    submitResale: (input: ActivationResaleInput): Promise<ActivationFlowSnapshot> =>
      ipcRenderer.invoke('activation:submit-resale', input),
    useOwnKey: (): Promise<ActivationFlowSnapshot> => ipcRenderer.invoke('activation:use-own-key'),
    restoreConfig: (targetConfigPath: string): Promise<{ restored: boolean; message: string }> =>
      ipcRenderer.invoke('activation:restore-config', targetConfigPath),
    injectManualKey: (input: {
      provider: 'clawrouter' | 'ezrouter'
      apiKey: string
      targetConfigPath: string
    }): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('activation:inject-manual-key', input),
    readInstallEmail: (): Promise<string | null> =>
      ipcRenderer.invoke('activation:read-install-email')
  },
  install: {
    node: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('install:node'),
    openclaw: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('install:openclaw'),
    onProgress: (cb: (msg: string) => void): (() => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('install:progress', handler)
      return () => ipcRenderer.removeListener('install:progress', handler)
    },
    onError: (cb: (msg: string) => void): (() => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('install:error', handler)
      return () => ipcRenderer.removeListener('install:error', handler)
    }
  },
  onboard: {
    run: (config: {
      provider: 'anthropic' | 'google' | 'openai' | 'minimax' | 'glm'
      apiKey?: string
      authMethod?: 'api-key' | 'oauth'
      telegramBotToken?: string
      modelId?: string
    }): Promise<{ success: boolean; error?: string; botUsername?: string }> =>
      ipcRenderer.invoke('onboard:run', config)
  },
  oauth: {
    loginCodex: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('oauth:openai-codex')
  },
  reboot: (): void => ipcRenderer.send('system:reboot'),
  gateway: {
    start: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('gateway:start'),
    stop: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('gateway:stop'),
    restart: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('gateway:restart'),
    status: (): Promise<'running' | 'stopped'> => ipcRenderer.invoke('gateway:status'),
    resetMainSession: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('gateway:reset-main-session'),
    prepareMainSession: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('gateway:prepare-main-session', modelId),
    onLog: (cb: (msg: string) => void): (() => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('gateway:log', handler)
      return () => ipcRenderer.removeListener('gateway:log', handler)
    },
    onStatusChanged: (cb: (status: 'running' | 'stopped') => void): (() => void) => {
      const handler = (_: unknown, s: 'running' | 'stopped'): void => cb(s)
      ipcRenderer.on('gateway:status-changed', handler)
      return () => ipcRenderer.removeListener('gateway:status-changed', handler)
    }
  },
  webchat: {
    open: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('webchat:open', url)
  },
  troubleshoot: {
    checkPort: (): Promise<{ inUse: boolean; pid?: string }> =>
      ipcRenderer.invoke('troubleshoot:check-port'),
    doctorFix: (): Promise<{ success: boolean }> => ipcRenderer.invoke('troubleshoot:doctor-fix')
  },
  wsl: {
    check: (): Promise<
      'not_available' | 'not_installed' | 'needs_reboot' | 'no_distro' | 'not_initialized' | 'ready'
    > => ipcRenderer.invoke('wsl:check'),
    install: (): Promise<{ success: boolean; needsReboot?: boolean; error?: string }> =>
      ipcRenderer.invoke('wsl:install')
  },
  wizard: {
    saveState: (state: {
      step: string
      wslInstalled: boolean
      timestamp: number
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('wizard:save-state', state),
    loadState: (): Promise<{
      step: string
      wslInstalled: boolean
      timestamp: number
    } | null> => ipcRenderer.invoke('wizard:load-state'),
    clearState: (): Promise<{ success: boolean }> => ipcRenderer.invoke('wizard:clear-state')
  },
  newsletter: {
    subscribe: (email: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('newsletter:subscribe', email)
  },
  update: {
    check: (): Promise<{ success: boolean }> => ipcRenderer.invoke('update:check'),
    download: (): Promise<{ success: boolean }> => ipcRenderer.invoke('update:download'),
    install: (): Promise<{ success: boolean }> => ipcRenderer.invoke('update:install'),
    onAvailable: (cb: (info: { version: string }) => void): (() => void) => {
      const handler = (_: unknown, info: { version: string }): void => cb(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onProgress: (cb: (percent: number) => void): (() => void) => {
      const handler = (_: unknown, p: number): void => cb(p)
      ipcRenderer.on('update:progress', handler)
      return () => ipcRenderer.removeListener('update:progress', handler)
    },
    onDownloaded: (cb: () => void): (() => void) => {
      const handler = (): void => cb()
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
    onError: (cb: (msg: string) => void): (() => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('update:error', handler)
      return () => ipcRenderer.removeListener('update:error', handler)
    }
  },
  config: {
    read: (): Promise<{
      success: boolean
      config: {
        provider?: string
        model?: string
        hasTelegram?: boolean
        gatewayToken?: string
      } | null
      error?: string
    }> => ipcRenderer.invoke('config:read'),
    switchProvider: (config: {
      provider: 'anthropic' | 'google' | 'openai' | 'minimax' | 'glm'
      apiKey?: string
      authMethod?: 'api-key' | 'oauth'
      modelId?: string
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('config:switch-provider', config),
    setTelegramToken: (token: string): Promise<{ success: boolean; error?: string; botUsername?: string }> =>
      ipcRenderer.invoke('config:set-telegram-token', token)
  },
  openclaw: {
    checkUpdate: (): Promise<{ currentVersion: string | null; latestVersion: string | null }> =>
      ipcRenderer.invoke('openclaw:check-update')
  },
  autoLaunch: {
    get: (): Promise<{ enabled: boolean }> => ipcRenderer.invoke('autolaunch:get'),
    set: (enabled: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('autolaunch:set', enabled)
  },
  system: {
    openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('system:open-external', url)
  },
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version')
  },
  uninstall: {
    openclaw: (opts: { removeConfig: boolean }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('uninstall:openclaw', opts),
    onProgress: (cb: (msg: string) => void): (() => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('uninstall:progress', handler)
      return () => ipcRenderer.removeListener('uninstall:progress', handler)
    }
  },
  backup: {
    export: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:export'),
    import: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('backup:import')
  },
  i18n: {
    getLocale: (): Promise<string> => ipcRenderer.invoke('i18n:get-locale'),
    setLanguage: (lng: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('i18n:set-language', lng)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
