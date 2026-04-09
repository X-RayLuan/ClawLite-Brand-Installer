import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import { openWebChatWindow, resetWebChatWindowForTests } from '../src/main/services/webchat-window.ts'

class FakeWebContents extends EventEmitter {}

class FakeBrowserWindow extends EventEmitter {
  static instances: FakeBrowserWindow[] = []
  webContents = new FakeWebContents()
  shown = false
  focused = false
  loadedUrl: string | null = null
  destroyed = false

  constructor(_options: unknown) {
    super()
    FakeBrowserWindow.instances.push(this)
  }

  loadURL(url: string): Promise<void> {
    this.loadedUrl = url
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

  const resultPromise = openWebChatWindow('http://127.0.0.1:18789/#token=test', {
    BrowserWindow: FakeBrowserWindow,
    timeoutMs: 1000
  })

  const win = FakeBrowserWindow.instances[0]
  assert.equal(win.loadedUrl, 'http://127.0.0.1:18789/#token=test')
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

  const resultPromise = openWebChatWindow('http://127.0.0.1:18789/#token=test', {
    BrowserWindow: FakeBrowserWindow,
    timeoutMs: 1000
  })

  const win = FakeBrowserWindow.instances[0]
  win.webContents.emit('did-fail-load', {}, -102, 'connection refused')
  const result = await resultPromise

  assert.equal(result.success, false)
  assert.match(result.error || '', /connection refused/)
  assert.equal(win.shown, false)
})
