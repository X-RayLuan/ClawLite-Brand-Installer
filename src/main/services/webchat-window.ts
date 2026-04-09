import type { BrowserWindow as ElectronBrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import http from 'node:http'
import https from 'node:https'

type BrowserWindowCtor = new (options: BrowserWindowConstructorOptions) => ElectronBrowserWindow

interface WebChatWindowDeps {
  BrowserWindow: BrowserWindowCtor
  timeoutMs?: number
  waitForUrlReady?: (url: string, timeoutMs: number) => Promise<boolean>
}

let webChatWindow: ElectronBrowserWindow | null = null

const DEFAULT_TIMEOUT_MS = 60000
const READINESS_POLL_INTERVAL_MS = 250

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

function toProbeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.toString()
}

async function defaultWaitForUrlReady(url: string, timeoutMs: number): Promise<boolean> {
  const probeUrl = toProbeUrl(url)
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const reachable = await new Promise<boolean>((resolve) => {
      const parsed = new URL(probeUrl)
      const transport = parsed.protocol === 'https:' ? https : http
      const req = transport.request(
        parsed,
        {
          method: 'GET',
          timeout: Math.min(1000, timeoutMs)
        },
        (res) => {
          res.resume()
          resolve(true)
        }
      )

      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
      req.on('error', () => resolve(false))
      req.end()
    })

    if (reachable) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, READINESS_POLL_INTERVAL_MS))
  }

  return false
}

export async function openWebChatWindow(
  url: string,
  deps: WebChatWindowDeps
): Promise<{ success: boolean; error?: string }> {
  const win = createWindow(deps.BrowserWindow)
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const waitForUrlReady = deps.waitForUrlReady ?? defaultWaitForUrlReady

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
      const isReady = await waitForUrlReady(url, timeoutMs)
      if (!isReady) {
        cleanup()
        resolve({
          success: false,
          error: 'Timed out waiting for Web Chat server to become reachable.'
        })
        return
      }

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
