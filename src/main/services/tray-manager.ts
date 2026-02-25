import { Tray, Menu, nativeImage, Notification, BrowserWindow } from 'electron'
import { join } from 'path'
import { getGatewayStatus, startGateway, stopGateway } from './gateway'

let tray: Tray | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastStatus: 'running' | 'stopped' = 'stopped'

interface TrayDeps {
  getWin: () => BrowserWindow | null
  onQuit: () => void
}

let deps: TrayDeps | null = null

const createTrayIcon = (): Electron.NativeImage => {
  if (process.platform === 'darwin') {
    const templatePath = join(__dirname, '../../resources/trayIconTemplate.png')
    try {
      const img = nativeImage.createFromPath(templatePath)
      if (!img.isEmpty()) {
        img.setTemplateImage(true)
        return img
      }
    } catch {
      // fallback below
    }
  }
  // Fallback: use app icon resized
  const iconPath = join(__dirname, '../../resources/icon.png')
  const img = nativeImage.createFromPath(iconPath)
  return img.resize({ width: 16, height: 16 })
}

const buildMenu = (status: 'running' | 'stopped'): Menu =>
  Menu.buildFromTemplate([
    {
      label: 'EasyClaw 열기',
      click: () => {
        const win = deps?.getWin()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: status === 'running' ? 'Gateway 실행 중' : 'Gateway 중지됨',
      enabled: false
    },
    {
      label: 'Gateway 시작',
      enabled: status === 'stopped',
      click: async () => {
        try {
          await startGateway()
        } catch {
          /* refreshStatus에서 상태 반영 */
        }
        await refreshStatus()
      }
    },
    {
      label: 'Gateway 중지',
      enabled: status === 'running',
      click: async () => {
        await stopGateway()
        await refreshStatus()
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        deps?.onQuit()
      }
    }
  ])

const refreshStatus = async (): Promise<void> => {
  const status = await getGatewayStatus()
  updateMenu(status)

  if (status !== lastStatus) {
    lastStatus = status
    const win = deps?.getWin()
    if (win && !win.isDestroyed()) {
      win.webContents.send('gateway:status-changed', status)
    }
    const msg = status === 'running' ? 'Gateway가 실행 중입니다' : 'Gateway가 중지되었습니다'
    notify('Gateway', msg)
  }
}

const updateMenu = (status: 'running' | 'stopped'): void => {
  if (!tray) return
  tray.setContextMenu(buildMenu(status))
  tray.setToolTip(`EasyClaw - Gateway ${status === 'running' ? '실행 중' : '중지됨'}`)
}

const notify = (title: string, body: string): void => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
}

export const createTray = (trayDeps: TrayDeps): void => {
  deps = trayDeps
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('EasyClaw')
  updateMenu('stopped')

  if (process.platform === 'darwin') {
    tray.on('click', () => {
      const win = deps?.getWin()
      if (win) {
        win.show()
        win.focus()
      }
    })
  }
}

export const startPolling = (): void => {
  if (pollTimer) return
  // 즉시 1회 실행 후 10초 인터벌
  refreshStatus()
  pollTimer = setInterval(refreshStatus, 10_000)
}

export const stopPolling = (): void => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export const destroyTray = (): void => {
  stopPolling()
  if (tray) {
    tray.destroy()
    tray = null
  }
  deps = null
}

export const isGatewayRunning = (): boolean => lastStatus === 'running'
