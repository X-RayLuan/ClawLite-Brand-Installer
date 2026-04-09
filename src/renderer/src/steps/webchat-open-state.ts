export type WebChatOpenStage =
  | 'preparing_session'
  | 'checking_gateway'
  | 'opening'
  | 'gateway_slow'

export function getWebChatReadinessPlan(): {
  delayMs: number
  preOpenDelayMs: number
} {
  return {
    delayMs: 500,
    preOpenDelayMs: 5000
  }
}

export function shouldOpenWebChatForGatewayStatus(status: 'running' | 'stopped'): boolean {
  return status === 'running'
}

export function describeWebChatOpenState(stage: WebChatOpenStage): {
  stage: WebChatOpenStage
  summaryKey: string
  detailKey: string
  progressStep: number
  progressTotal: number
} {
  switch (stage) {
    case 'preparing_session':
      return {
        stage,
        summaryKey: 'done.webChatPreparing',
        detailKey: 'done.webChatPreparingSession',
        progressStep: 1,
        progressTotal: 3
      }
    case 'checking_gateway':
      return {
        stage,
        summaryKey: 'done.webChatPreparing',
        detailKey: 'done.webChatCheckingGateway',
        progressStep: 2,
        progressTotal: 3
      }
    case 'gateway_slow':
      return {
        stage,
        summaryKey: 'done.webChatPreparing',
        detailKey: 'done.webChatGatewaySlow',
        progressStep: 2,
        progressTotal: 3
      }
    case 'opening':
      return {
        stage,
        summaryKey: 'done.webChatOpening',
        detailKey: 'done.webChatOpeningBrowser',
        progressStep: 3,
        progressTotal: 3
      }
  }
}
