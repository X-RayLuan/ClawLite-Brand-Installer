import { type CSSProperties } from 'react'

type LogoState = 'idle' | 'loading' | 'success' | 'error'

const stateStyles: Record<LogoState, CSSProperties> = {
  idle: {},
  loading: { animation: 'logo-pulse 0.9s ease-in-out infinite' },
  success: { filter: 'drop-shadow(0 0 14px rgba(52, 211, 153, 0.45))' },
  error: {
    filter: 'drop-shadow(0 0 14px rgba(251, 113, 133, 0.45))',
    animation: 'logo-shake 0.45s ease-in-out'
  }
}

export default function LobsterLogo({
  state = 'idle',
  size = 120
}: {
  state?: LogoState
  size?: number
}): React.JSX.Element {
  const gradStart = { idle: '#60a5fa', loading: '#60a5fa', success: '#34d399', error: '#fb7185' }[
    state
  ]
  const gradEnd = { idle: '#7c3aed', loading: '#7c3aed', success: '#059669', error: '#e11d48' }[
    state
  ]

  return (
    <>
      <style>{`
        @keyframes logo-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes logo-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transition: 'filter 0.4s, transform 0.4s', ...stateStyles[state] }}
      >
        <defs>
          <linearGradient id="cl" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradStart} />
            <stop offset="100%" stopColor={gradEnd} />
          </linearGradient>
        </defs>

        <rect x="12" y="12" width="96" height="96" rx="26" fill="url(#cl)" />
        <rect x="20" y="20" width="80" height="80" rx="20" fill="rgba(2,6,23,0.22)" />

        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontSize="38"
          fontWeight="800"
          fill="white"
          style={{ letterSpacing: '1px' }}
        >
          CL
        </text>
      </svg>
    </>
  )
}
