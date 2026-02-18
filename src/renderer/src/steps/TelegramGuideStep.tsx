import Button from '../components/Button'

const steps = [
  {
    emoji: '🔍',
    title: 'BotFather 검색',
    desc: '텔레그램 앱에서 @BotFather를 검색하세요. 파란 체크 표시가 있는 공식 봇을 선택합니다.'
  },
  {
    emoji: '⌨️',
    title: '/newbot 명령 입력',
    desc: 'BotFather 대화에서 /newbot 을 입력하면 봇 이름을 물어봅니다.'
  },
  {
    emoji: '🚀',
    title: '봇 이름 정하기',
    desc: '원하는 이름을 입력 → _bot으로 끝나는 고유 ID를 입력하세요. 예: my_ai_bot'
  },
  {
    emoji: '📋',
    title: '봇 토큰 복사',
    desc: '생성 완료! 123456:ABCDEF... 형태의 토큰을 꼭 복사해 두세요.'
  }
]

export default function TelegramGuideStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col px-8 gap-4 justify-center">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-extrabold">텔레그램 봇 만들기</h2>
        <p className="text-text-muted text-xs">AI 에이전트와 대화할 텔레그램 봇을 만들어 봅시다</p>
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-primary text-xs font-semibold hover:text-primary-light transition-colors pt-1"
        >
          BotFather 바로가기 &rarr;
        </a>
      </div>

      <div className="space-y-2.5 mt-1">
        {steps.map((s, i) => (
          <div key={i} className="glass-card p-4 flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-base">
              {s.emoji}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{s.title}</p>
              <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-text-muted hover:text-text bg-white/5 hover:bg-white/10 rounded-xl border border-glass-border transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          이전
        </button>
        <Button variant="primary" size="lg" onClick={onNext}>
          토큰 준비 완료!
        </Button>
      </div>
    </div>
  )
}
