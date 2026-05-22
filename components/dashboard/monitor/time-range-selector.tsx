'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimeRangeKey } from '@/lib/price-monitor/constants'
import { TIME_RANGES } from '@/lib/price-monitor/constants'

type Props = {
  value: TimeRangeKey
  onChange: (key: TimeRangeKey) => void
}

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 flex-wrap">
      {(Object.keys(TIME_RANGES) as TimeRangeKey[]).map((key) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? 'default' : 'outline'}
          className={cn('h-7 px-2.5 text-xs', value === key && 'shadow-sm')}
          onClick={() => onChange(key)}
        >
          {TIME_RANGES[key].label}
        </Button>
      ))}
    </div>
  )
}
