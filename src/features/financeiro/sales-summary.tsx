import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatPriceBR,
  getDashboardStats,
  getPlanSales,
} from '@/lib/admin-api'
import { Stat } from './ui'

type TipRow = { value: number; payload: Record<string, unknown> }
type TipProps = { active?: boolean; payload?: TipRow[] }

function MoneyTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className='rounded-lg border bg-background px-3 py-2 text-xs shadow-md'>
      <p className='font-medium'>{String(p.plan ?? '')}</p>
      <p className='font-semibold text-emerald-500'>
        R$ {formatPriceBR(payload[0].value)}
      </p>
    </div>
  )
}

export function SalesSummary() {
  const statsQ = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  })
  const salesQ = useQuery({
    queryKey: ['plan-sales', 0],
    queryFn: () => getPlanSales(0),
  })

  const m = useMemo(() => {
    const month = statsQ.data?.revenue.month ?? 0
    const lastMonth = statsQ.data?.revenue.lastMonth ?? 0
    const growth = lastMonth > 0
      ? Math.round(((month - lastMonth) / lastMonth) * 100)
      : month > 0
        ? 100
        : 0
    const sales = salesQ.data?.totals.sales ?? 0
    const revenue = salesQ.data?.totals.revenue ?? 0
    const profit = salesQ.data?.totals.profit ?? 0
    const ticket = sales > 0 ? revenue / sales : 0
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
    return { month, growth, ticket, profit, margin }
  }, [statsQ.data, salesQ.data])

  const byPlan = useMemo(() => {
    const map = statsQ.data?.revenue.byPlan ?? {}
    return Object.entries(map)
      .map(([plan, revenue]) => ({
        plan: plan.length > 22 ? `${plan.slice(0, 21)}…` : plan,
        full: plan,
        revenue: Number(revenue) || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
  }, [statsQ.data])

  return (
    <div className='space-y-3'>
      <h2 className='text-sm font-semibold text-muted-foreground'>
        Vendas &amp; Lucro
      </h2>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-3'>
        <Stat
          label='Receita do mês'
          value={`R$ ${formatPriceBR(m.month)}`}
          sub='vs mês passado'
          footerRight={`${m.growth >= 0 ? '+' : ''}${m.growth}%`}
          tone='text-emerald-500'
        />
        <Stat
          label='Ticket médio'
          value={`R$ ${formatPriceBR(m.ticket)}`}
          sub='por venda aprovada'
        />
        <Stat
          label='Lucro (margem)'
          value={`R$ ${formatPriceBR(m.profit)}`}
          sub='receita − custo das fichas'
          footerRight={`${m.margin}%`}
          tone='text-emerald-500'
        />
      </div>

      <div className='rounded-2xl border bg-muted/50 p-4'>
        <p className='mb-3 text-sm font-semibold'>Receita por plano</p>
        {byPlan.length === 0 ? (
          <div className='flex h-[180px] items-center justify-center text-sm text-muted-foreground'>
            Sem vendas ainda.
          </div>
        ) : (
          <ResponsiveContainer width='100%' height={Math.max(160, byPlan.length * 42)}>
            <BarChart
              data={byPlan}
              layout='vertical'
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <XAxis type='number' hide />
              <YAxis
                type='category'
                dataKey='plan'
                width={150}
                stroke='#888888'
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                content={<MoneyTooltip />}
              />
              <Bar dataKey='revenue' radius={[0, 4, 4, 0]} className='fill-primary' />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
