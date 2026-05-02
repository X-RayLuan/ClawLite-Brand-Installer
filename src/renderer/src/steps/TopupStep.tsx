import { useTranslation } from 'react-i18next'

interface Props {
  onBack: () => void
  onSelectAmount: (amount: 5 | 10 | 20) => void
}

export default function TopupStep({ onBack, onSelectAmount }: Props): React.JSX.Element {
  const { t } = useTranslation('steps')

  const amounts: Array<{ amount: 5 | 10 | 20; label: string }> = [
    { amount: 5, label: t('activation.topup.amount5') },
    { amount: 10, label: t('activation.topup.amount10') },
    { amount: 20, label: t('activation.topup.amount20') }
  ]

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
            stroke="var(--color-success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-black tracking-tight">{t('activation.topup.title')}</h3>
        <p className="text-text-muted text-xs mt-0.5">{t('activation.topup.subtitle')}</p>
      </div>

      <div className="w-full flex flex-col gap-2">
        {amounts.map(({ amount, label }) => (
          <button
            key={amount}
            onClick={() => onSelectAmount(amount)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-success/10 to-success/5 border border-success/30 hover:border-success/60 hover:from-success/20 hover:to-success/10 transition-all duration-200 cursor-pointer group"
          >
            <span className="text-sm font-black">{label}</span>
            <span className="text-xs text-text-muted/60 group-hover:text-primary">
              {t('activation.topup.credits')}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="text-xs text-text-muted/60 hover:text-text-muted transition-colors cursor-pointer"
      >
        {t('activation.topup.back')}
      </button>
    </div>
  )
}
