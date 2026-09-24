import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '../lib/format'

interface Props {
  data: { day: number; total: number }[]
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function DailyChart({ data }: Props) {
  if (!data.some((d) => d.total > 0)) return <p className="empty">Nenhuma despesa neste mês.</p>

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            cursor={{ fill: 'var(--hover)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <span>Dia {label}</span>
                  <strong>{formatMoney(Number(payload[0].value))}</strong>
                </div>
              ) : null
            }
          />
          <Bar dataKey="total" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
