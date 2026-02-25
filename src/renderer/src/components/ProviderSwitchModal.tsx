import { useState } from 'react'
import Button from './Button'
import LogViewer from './LogViewer'
import { useInstallLogs } from '../hooks/useIpc'

type Provider = 'anthropic' | 'google' | 'openai' | 'deepseek' | 'glm'
type Phase = 'form' | 'progress' | 'done' | 'error'

interface ModelOption {
  id: string
  name: string
  desc: string
}

const providerConfig: {
  id: Provider
  label: string
  placeholder: string
  pattern: RegExp
  models: ModelOption[]
}[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    pattern: /^sk-ant-/,
    models: [
      { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', desc: '최신 최고 성능' },
      { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: '최신 균형 (추천)' },
      { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5', desc: '고성능' },
      { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', desc: '균형' },
      { id: 'anthropic/claude-opus-4-1', name: 'Claude Opus 4.1', desc: '고성능' },
      { id: 'anthropic/claude-sonnet-4-0', name: 'Claude Sonnet 4.0', desc: '균형' },
      { id: 'anthropic/claude-opus-4-0', name: 'Claude Opus 4.0', desc: '고성능' },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', desc: '빠르고 저렴' },
      { id: 'anthropic/claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', desc: '이전 세대' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: '이전 세대' },
      { id: 'anthropic/claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', desc: '이전 세대 경량' },
      { id: 'anthropic/claude-3-opus-20240229', name: 'Claude 3 Opus', desc: '레거시' }
    ]
  },
  {
    id: 'google',
    label: 'Google',
    placeholder: 'AIza...',
    pattern: /^AIza/,
    models: [
      { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: '최신 최고 성능' },
      { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: '고성능' },
      { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: '최신 빠른 (추천)' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: '안정 고성능' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '안정 균형' },
      { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: '경량' },
      { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: '이전 세대' }
    ]
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    pattern: /^sk-(?!ant-)/,
    models: [
      { id: 'openai/gpt-5.2', name: 'GPT-5.2', desc: '최신 (추천)' },
      { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', desc: '최고 성능' },
      { id: 'openai/gpt-5.2-codex', name: 'GPT-5.2 Codex', desc: '코딩 특화' },
      { id: 'openai/gpt-5.1', name: 'GPT-5.1', desc: '범용' },
      { id: 'openai/gpt-5.1-codex', name: 'GPT-5.1 Codex', desc: '코딩 특화' },
      { id: 'openai/gpt-5', name: 'GPT-5', desc: '범용' },
      { id: 'openai/gpt-5-pro', name: 'GPT-5 Pro', desc: '고성능' },
      { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', desc: '경량' },
      { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', desc: '초경량' },
      { id: 'openai/o4-mini', name: 'o4-mini', desc: '추론 최신' },
      { id: 'openai/o3-pro', name: 'o3 Pro', desc: '추론 최고 성능' },
      { id: 'openai/o3', name: 'o3', desc: '추론' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', desc: '이전 세대' },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', desc: '이전 세대 경량' }
    ]
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    placeholder: 'sk-...',
    pattern: /^sk-/,
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', desc: '범용 최신 (추천)' },
      { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek R1', desc: '추론 특화' }
    ]
  },
  {
    id: 'glm',
    label: 'Z.AI',
    placeholder: 'API 키 입력',
    pattern: /^.{8,}$/,
    models: [
      { id: 'zai/glm-5', name: 'GLM-5', desc: '최신 최고 성능 (추천)' },
      { id: 'zai/glm-4.7', name: 'GLM-4.7', desc: '고성능' },
      { id: 'zai/glm-4.7-flash', name: 'GLM-4.7 Flash', desc: '빠른' },
      { id: 'zai/glm-4.6', name: 'GLM-4.6', desc: '텍스트' },
      { id: 'zai/glm-4.6v', name: 'GLM-4.6V', desc: '이미지 지원' },
      { id: 'zai/glm-4.5', name: 'GLM-4.5', desc: '텍스트' },
      { id: 'zai/glm-4.5-air', name: 'GLM-4.5 Air', desc: '경량' },
      { id: 'zai/glm-4.5-flash', name: 'GLM-4.5 Flash', desc: '빠른' },
      { id: 'zai/glm-4.5v', name: 'GLM-4.5V', desc: '이미지 지원' }
    ]
  }
]

interface Props {
  currentProvider?: string
  currentModel?: string
  onClose: () => void
  onSuccess: () => void
}

export default function ProviderSwitchModal({
  currentProvider,
  currentModel,
  onClose,
  onSuccess
}: Props): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('form')
  const initProvider = (currentProvider as Provider) || 'anthropic'
  const [provider, setProvider] = useState<Provider>(initProvider)
  const initConfig = providerConfig.find((p) => p.id === initProvider)!
  const initModelId =
    currentModel && initConfig.models.some((m) => m.id === currentModel)
      ? currentModel
      : initConfig.models[0].id
  const [modelId, setModelId] = useState(initModelId)
  const [apiKey, setApiKey] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const { logs, clearLogs } = useInstallLogs()

  const selected = providerConfig.find((p) => p.id === provider)!
  const apiKeyValid = selected.pattern.test(apiKey)

  const handleProviderChange = (id: Provider): void => {
    setProvider(id)
    setApiKey('')
    const cfg = providerConfig.find((p) => p.id === id)!
    setModelId(cfg.models[0].id)
  }

  const handleSwitch = async (): Promise<void> => {
    setPhase('progress')
    setErrorMsg('')
    clearLogs()
    try {
      const result = await window.electronAPI.config.switchProvider({
        provider,
        apiKey,
        modelId
      })
      if (result.success) {
        setPhase('done')
      } else {
        setErrorMsg(result.error || '전환 중 오류가 발생했습니다')
        setPhase('error')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '알 수 없는 오류')
      setPhase('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm mx-4 p-6 space-y-4 max-h-[85vh] flex flex-col">
        <h3 className="text-base font-black shrink-0">AI 모델 변경</h3>

        {phase === 'form' && (
          <div className="space-y-3 overflow-y-auto min-h-0">
            {/* Provider tabs */}
            <div className="flex flex-wrap gap-1.5">
              {providerConfig.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                    provider === p.id
                      ? 'bg-primary text-white'
                      : 'bg-white/5 text-text-muted hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Model list */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-muted">모델 선택</label>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {selected.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                      modelId === m.id
                        ? 'bg-primary/15 border border-primary/40'
                        : 'bg-white/5 border border-transparent hover:bg-white/8'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
                        modelId === m.id
                          ? 'border-primary bg-primary'
                          : 'border-text-muted/30 bg-transparent'
                      }`}
                    />
                    <div className="min-w-0 flex items-baseline gap-1.5">
                      <span className="text-xs font-bold whitespace-nowrap">{m.name}</span>
                      <span className="text-[10px] text-text-muted/60 truncate">{m.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* API key input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted">API 키</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selected.placeholder}
                className={`w-full bg-bg-input rounded-xl px-4 py-2 text-sm font-mono outline-none border transition-all duration-200 placeholder:text-text-muted/30 ${
                  apiKey && !apiKeyValid
                    ? 'border-error/50 focus:border-error'
                    : 'border-glass-border focus:border-primary focus:shadow-[0_0_0_3px_var(--color-primary-glow)]'
                }`}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={onClose}>
                취소
              </Button>
              <Button variant="primary" size="sm" onClick={handleSwitch} disabled={!apiKeyValid}>
                변경
              </Button>
            </div>
          </div>
        )}

        {phase === 'progress' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-sm text-text-muted">모델 전환 중...</p>
            </div>
            {logs.length > 0 && <LogViewer lines={logs} />}
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            <p className="text-sm text-success font-medium">모델이 성공적으로 변경되었습니다!</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onSuccess()
                onClose()
              }}
            >
              닫기
            </Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-error">{errorMsg}</p>
            {logs.length > 0 && <LogViewer lines={logs} />}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                닫기
              </Button>
              <Button variant="primary" size="sm" onClick={() => setPhase('form')}>
                다시 시도
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
