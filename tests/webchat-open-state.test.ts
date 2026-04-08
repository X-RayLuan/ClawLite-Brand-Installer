import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeWebChatOpenState,
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

test('describeWebChatOpenState keeps the timeout fallback user-facing and non-fatal', () => {
  assert.deepEqual(
    describeWebChatOpenState('gateway_slow'),
    expected('gateway_slow', 'done.webChatOpening', 'done.webChatGatewaySlow', 3)
  )
})
