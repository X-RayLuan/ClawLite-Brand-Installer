import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import { openWebChatWindow, resetWebChatWindowForTests } from '../src/main/services/webchat-window.ts'

class FakeWebContents extends EventEmitter {
  executedScripts: string[] = []

  executeJavaScript(script: string): Promise<void> {
    this.executedScripts.push(script)
    return Promise.resolve()
  }
}

class FakeBrowserWindow extends EventEmitter {
  static instances: FakeBrowserWindow[] = []
  webContents = new FakeWebContents()
  shown = false
  focused = false
  loadedUrl: string | null = null
  loadedUrls: string[] = []
  destroyed = false

  constructor(_options: unknown) {
    super()
    FakeBrowserWindow.instances.push(this)
  }

  loadURL(url: string): Promise<void> {
    this.loadedUrl = url
    this.loadedUrls.push(url)
    return Promise.resolve()
  }
  show(): void {
    this.shown = true
  }

  focus(): void {
    this.focused = true
  }

  isDestroyed(): boolean {
    return this.destroyed
  }
}

test('openWebChatWindow waits for did-finish-load before showing the window', async () => {
  FakeBrowserWindow.instances = []
  resetWebChatWindowForTests()

  const resultPromise = openWebChatWindow('http://127.0.0.1:18791/#token=test', {
    BrowserWindow: FakeBrowserWindow,
    timeoutMs: 1000,
    waitForUrlReady: async () => true
  })

  const win = FakeBrowserWindow.instances[0]
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(win.loadedUrl, 'http://127.0.0.1:18791/#token=test')
  assert.equal(win.shown, false)

  win.webContents.emit('did-finish-load')
  const result = await resultPromise

  assert.deepEqual(result, { success: true })
  assert.equal(win.shown, true)
  assert.equal(win.focused, true)
})

test('openWebChatWindow reports did-fail-load without showing a blank window', async () => {
  FakeBrowserWindow.instances = []
  resetWebChatWindowForTests()

  const resultPromise = openWebChatWindow('http://127.0.0.1:18791/#token=test', {
    BrowserWindow: FakeBrowserWindow,
    timeoutMs: 1000,
    waitForUrlReady: async () => true
  })

  const win = FakeBrowserWindow.instances[0]
  win.webContents.emit('did-fail-load', {}, -102, 'connection refused')
  const result = await resultPromise

  assert.equal(result.success, false)
  assert.match(result.error || '', /connection refused/)
  assert.equal(win.shown, false)
})

test('openWebChatWindow waits for the web chat url to become reachable before loadURL', async () => {
  FakeBrowserWindow.instances = []
  resetWebChatWindowForTests()

  let releaseReady!: () => void
  const readyPromise = new Promise<void>((resolve) => {
    releaseReady = resolve
  })
  const readinessCalls: string[] = []

  const resultPromise = openWebChatWindow('http://127.0.0.1:18791/#token=test', {
    BrowserWindow: FakeBrowserWindow,
    timeoutMs: 1000,
    waitForUrlReady: async (url) => {
      readinessCalls.push(url)
      await readyPromise
      return true
    }
  })

  const win = FakeBrowserWindow.instances[0]
  assert.equal(win.loadedUrl, null)
  assert.deepEqual(readinessCalls, ['http://127.0.0.1:18791/#token=test'])

  releaseReady()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(win.loadedUrl, 'http://127.0.0.1:18791/#token=test')

  win.webContents.emit('did-finish-load')
  const result = await resultPromise
  assert.deepEqual(result, { success: true })
})

test('openWebChatWindow seeds control ui storage before the final load when gateway auth is in the hash', async () => {
  FakeBrowserWindow.instances = []
  resetWebChatWindowForTests()

  const resultPromise = openWebChatWindow(
    'http://127.0.0.1:18791/#gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789&token=test-token',
    {
      BrowserWindow: FakeBrowserWindow,
      timeoutMs: 1000,
      waitForUrlReady: async () => true
    }
  )

  const win = FakeBrowserWindow.instances[0]
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(win.loadedUrls, ['http://127.0.0.1:18791/'])
  win.webContents.emit('did-finish-load')
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(win.webContents.executedScripts.length, 1)
  assert.match(win.webContents.executedScripts[0] || '', /localStorage\.setItem\('openclaw\.control\.token\.v1'/)
  assert.match(win.webContents.executedScripts[0] || '', /openclaw\.control\.settings\.v1/)
  assert.match(win.webContents.executedScripts[0] || '', /ws:\/\/127\.0\.0\.1:18789/)
  assert.match(win.webContents.executedScripts[0] || '', /test-token/)
  assert.deepEqual(win.loadedUrls, ['http://127.0.0.1:18791/', 'http://127.0.0.1:18791/'])

  win.webContents.emit('did-finish-load')
  const result = await resultPromise

  assert.deepEqual(result, { success: true })
  assert.equal(win.shown, true)
})
