import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chart } from './ui'

export default function WeightTrendChart({ data }: { data: { label: string; weight: number }[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.primary} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chart.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={chart.axis}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={chart.axis}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={['auto', 'auto']}
          />
          <Tooltip {...chart.tooltip} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={chart.primary}
            strokeWidth={2}
            fill="url(#wg)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
