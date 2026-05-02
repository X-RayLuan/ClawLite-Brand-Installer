import { useTranslation } from 'react-i18next'

interface Props {
  onCancel: () => void
}

export default function PendingTopupStep({ onCancel }: Props): React.JSX.Element {
  const { t } = useTranslation('steps')

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'spin 2s linear infinite' }}
        >
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeDasharray="30 60"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-black tracking-tight">{t('activation.pendingTopup.title')}</h3>
        <p className="text-text-muted text-xs mt-0.5">{t('activation.pendingTopup.subtitle')}</p>
      </div>

      <p className="text-center text-xs text-text-muted/60 px-2">
        {t('activation.pendingTopup.hint')}
      </p>

      <p className="text-center text-xs text-text-muted/40">
        {t('activation.pendingTopup.checking')}
      </p>

      <button
        onClick={onCancel}
        className="text-xs text-text-muted/60 hover:text-text-muted transition-colors cursor-pointer"
      >
        {t('activation.pendingTopup.cancel')}
      </button>
    </div>
  )
}
