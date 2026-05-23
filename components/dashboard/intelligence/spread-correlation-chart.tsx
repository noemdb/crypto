'use client'

import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { BCVRateData } from '@/lib/intelligence/types'

const CHART_CONFIG = {
  rateUsd:   { label: 'Tasa BCV (VES)',     color: 'hsl(var(--brand-primary, 217 91% 60%))' },
  changePct: { label: 'Variación diaria %', color: 'hsl(var(--warning, 38 92% 50%))' },
}

export function SpreadCorrelationChart({ history }: { history: BCVRateData[] }) {
  const data = history.map(r => ({
    date: r.date.slice(5),   // MM-DD
    rateUsd: r.rateUsd,
    changePct: r.changePct,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sin historial de tasa BCV. Se comenzará a registrar en los próximos scans.
      </div>
    )
  }

  return (
    <ChartContainer config={CHART_CONFIG} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="rate"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={45}
          />
          <YAxis
            yAxisId="change"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 11,
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="rateUsd"
            name="Tasa BCV"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={false}
          />
          <Bar
            yAxisId="change"
            dataKey="changePct"
            name="Variación %"
            fill="hsl(38, 92%, 50%)"
            opacity={0.6}
            radius={[2, 2, 0, 0]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
