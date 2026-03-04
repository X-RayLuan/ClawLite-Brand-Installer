import { type CSSProperties } from 'react'

type LogoState = 'idle' | 'loading' | 'success' | 'error'

const stateStyles: Record<LogoState, CSSProperties> = {
  idle: {},
  loading: { animation: 'logo-bounce 0.8s ease-in-out infinite' },
  success: { filter: 'drop-shadow(0 0 16px rgba(52, 211, 153, 0.5))' },
  error: {
    filter: 'drop-shadow(0 0 16px rgba(251, 113, 133, 0.5))',
    animation: 'logo-shake 0.5s ease-in-out'
  }
}

export default function LobsterLogo({
  state = 'idle',
  size = 120
}: {
  state?: LogoState
  size?: number
}): React.JSX.Element {
  const fillColor = {
    idle: '#da7756',
    loading: '#da7756',
    success: '#34d399',
    error: '#fb7185'
  }[state]

  const strokeColor = {
    idle: '#e8a88e',
    loading: '#e8a88e',
    success: '#6ee7b7',
    error: '#fda4af'
  }[state]

  return (
    <>
      <style>{`
        @keyframes logo-bounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          70% { transform: translateY(-6px); }
        }
        @keyframes logo-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transition: 'filter 0.4s, transform 0.4s', ...stateStyles[state] }}
      >
        {/* Code brackets */}
        <path
          d="M22 28 L10 40 L22 52"
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
        <path
          d="M58 28 L70 40 L58 52"
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
        {/* Central sparkle */}
        <path
          d="M40 14 C42 28, 52 38, 66 40 C52 42, 42 52, 40 66 C38 52, 28 42, 14 40 C28 38, 38 28, 40 14Z"
          fill={fillColor}
          opacity="0.9"
        />
        {/* Small accent sparkle */}
        <path
          d="M60 16 C61 22, 64 25, 70 26 C64 27, 61 30, 60 36 C59 30, 56 27, 50 26 C56 25, 59 22, 60 16Z"
          fill={fillColor}
          opacity="0.4"
        />
      </svg>
    </>
  )
}
