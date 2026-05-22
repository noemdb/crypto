'use client'

import { cn } from '@/lib/utils'

const PLATFORM_LABELS: Record<string, string> = {
  binance_p2p_ves: 'Binance P2P (VES)',
  binance_spot:    'Binance Spot',
  bybit_spot:      'Bybit Spot',
  bybit_p2p_ves:   'Bybit P2P (VES)',
}

type Props = {
  platforms: string[]
  selected: string
  onSelect: (platform: string) => void
}

export function PlatformSelector({ platforms, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {platforms.map((p) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            selected === p
              ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary font-medium'
              : 'border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/40',
          )}
        >
          {PLATFORM_LABELS[p] ?? p}
        </button>
      ))}
    </div>
  )
}
