import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWebChatOpenState,
  getWebChatReadinessPlan,
  shouldOpenWebChatForGatewayStatus,
  type WebChatOpenStage
} from '../src/renderer/src/steps/webchat-open-state.ts'

const expected = (
  stage: WebChatOpenStage,
  summaryKey: string,
  detailKey: string,
  progressStep: number
) => ({
  stage,
  summaryKey,
  detailKey,
  progressStep,
  progressTotal: 3
})

test('describeWebChatOpenState reports the session preparation stage first', () => {
  assert.deepEqual(
    describeWebChatOpenState('preparing_session'),
    expected('preparing_session', 'done.webChatPreparing', 'done.webChatPreparingSession', 1)
  )
})

test('describeWebChatOpenState reports the gateway check stage second', () => {
  assert.deepEqual(
    describeWebChatOpenState('checking_gateway'),
    expected('checking_gateway', 'done.webChatPreparing', 'done.webChatCheckingGateway', 2)
  )
})

test('describeWebChatOpenState reports the launch handoff stage last', () => {
  assert.deepEqual(
    describeWebChatOpenState('opening'),
    expected('opening', 'done.webChatOpening', 'done.webChatOpeningBrowser', 3)
  )
})

test('describeWebChatOpenState keeps slow gateway startup in the loading state', () => {
  assert.deepEqual(
    describeWebChatOpenState('gateway_slow'),
    expected('gateway_slow', 'done.webChatPreparing', 'done.webChatGatewaySlow', 2)
  )
})

test('getWebChatReadinessPlan keeps the installer loading while Windows gateway startup completes', () => {
  assert.deepEqual(getWebChatReadinessPlan(), {
    attempts: 120,
    delayMs: 500
  })
})

test('shouldOpenWebChatForGatewayStatus only opens after the main process reports running', () => {
  assert.equal(shouldOpenWebChatForGatewayStatus('stopped'), false)
  assert.equal(shouldOpenWebChatForGatewayStatus('running'), true)
})
