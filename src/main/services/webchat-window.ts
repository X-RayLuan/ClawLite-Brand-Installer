import type { BrowserWindow as ElectronBrowserWindow, BrowserWindowConstructorOptions } from 'electron'

type BrowserWindowCtor = new (options: BrowserWindowConstructorOptions) => ElectronBrowserWindow

interface WebChatWindowDeps {
  BrowserWindow: BrowserWindowCtor
  timeoutMs?: number
}

let webChatWindow: ElectronBrowserWindow | null = null

const DEFAULT_TIMEOUT_MS = 60000

export function resetWebChatWindowForTests(): void {
  webChatWindow = null
}

function createWindow(BrowserWindow: BrowserWindowCtor): ElectronBrowserWindow {
  if (webChatWindow && !webChatWindow.isDestroyed()) {
    return webChatWindow
  }

  webChatWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'OpenClaw Web Chat'
  })

  webChatWindow.on('closed', () => {
    webChatWindow = null
  })

  return webChatWindow
}

export async function openWebChatWindow(
  url: string,
  deps: WebChatWindowDeps
): Promise<{ success: boolean; error?: string }> {
  const win = createWindow(deps.BrowserWindow)
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise(async (resolve) => {
    const cleanup = (): void => {
      win.webContents.removeListener('did-finish-load', handleDidFinishLoad)
      win.webContents.removeListener('did-fail-load', handleDidFailLoad)
      clearTimeout(timeout)
    }

    const handleDidFinishLoad = (): void => {
      cleanup()
      win.show()
      win.focus()
      resolve({ success: true })
    }

    const handleDidFailLoad = (
      _event: unknown,
      _code: number,
      description: string
    ): void => {
      cleanup()
      resolve({ success: false, error: description || 'Failed to load Web Chat window.' })
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve({ success: false, error: 'Timed out waiting for Web Chat to load.' })
    }, timeoutMs)

    win.webContents.once('did-finish-load', handleDidFinishLoad)
    win.webContents.once('did-fail-load', handleDidFailLoad)

    try {
      await win.loadURL(url)
    } catch (error) {
      cleanup()
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })
}
