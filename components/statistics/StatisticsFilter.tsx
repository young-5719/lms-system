'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  from: string
  to: string
}

const PRESETS = [
  { label: '2026 상반기', from: '2026-01-01', to: '2026-06-30' },
  { label: '2026 하반기', from: '2026-07-01', to: '2026-12-31' },
  { label: '2026 전체', from: '2026-01-01', to: '2026-12-31' },
  { label: '전체 기간', from: '2024-01-01', to: '2099-12-31' },
]

export default function StatisticsFilter({ from, to }: Props) {
  const router = useRouter()
  const [fromDate, setFromDate] = useState(from)
  const [toDate, setToDate] = useState(to)

  const apply = (f = fromDate, t = toDate) => {
    router.push(`/statistics?from=${f}&to=${t}`)
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">개강일 범위</span>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-[140px] h-8 text-sm"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-[140px] h-8 text-sm"
            />
            <Button size="sm" onClick={() => apply()}>적용</Button>
          </div>

          <div className="flex items-center gap-1.5">
            {PRESETS.map(p => (
              <Button
                key={p.label}
                size="sm"
                variant={from === p.from && to === p.to ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => {
                  setFromDate(p.from)
                  setToDate(p.to)
                  apply(p.from, p.to)
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
