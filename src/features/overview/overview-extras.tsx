import { useQuery } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getDashboardStats } from '@/lib/admin-api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TopWatchedCard } from '@/features/audiencia/top-watched'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function OverviewExtras() {
  const { data: s } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  })

  if (!s) return null

  return (
    <div className='space-y-4 md:space-y-6'>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut
              active={s.users.active}
              expired={s.users.expired}
              noSub={s.users.noSub}
              banned={s.users.banned}
            />
          </CardContent>
        </Card>

        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>🔥 Mais assistidos</CardTitle>
            <p className='text-xs text-muted-foreground'>
              Top 10 (séries agrupadas). Clique num item pra ver quem assistiu.
            </p>
          </CardHeader>
          <CardContent>
            {s.topWatched.length === 0 ? (
              <p className='py-6 text-center text-sm text-muted-foreground'>
                Ainda sem histórico suficiente.
              </p>
            ) : (
              <div className='grid grid-flow-col auto-cols-[minmax(72px,1fr)] gap-2 overflow-x-auto pb-1'>
                {s.topWatched.map((w, i) => (
                  <TopWatchedCard key={w.key} item={w} rank={i + 1} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Receita por plano</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueByPlan byPlan={s.revenue.byPlan} total={s.revenue.total} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatusDonut({
  active,
  expired,
  noSub,
  banned,
}: {
  active: number
  expired: number
  noSub: number
  banned: number
}) {
  const data = [
    { name: 'Ativas', value: active, color: '#10b981' },
    { name: 'Expiradas', value: expired, color: '#f43f5e' },
    { name: 'Sem assinatura', value: noSub, color: '#64748b' },
  ].filter((d) => d.value > 0)

  const total = active + expired + noSub
  if (total === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        Sem dados.
      </p>
    )
  }

  return (
    <div className='flex flex-col items-center gap-3'>
      <ResponsiveContainer width='100%' height={160}>
        <PieChart>
          <Pie
            data={data}
            dataKey='value'
            nameKey='name'
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            stroke='none'
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              fontSize: 12,
              color: '#fafafa',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className='grid w-full gap-1.5 text-sm'>
        {data.map((d) => (
          <div key={d.name} className='flex items-center justify-between'>
            <span className='flex items-center gap-2 text-muted-foreground'>
              <span
                className='size-2.5 rounded-full'
                style={{ background: d.color }}
              />
              {d.name}
            </span>
            <span className='font-medium'>{d.value}</span>
          </div>
        ))}
        {banned > 0 && (
          <div className='mt-1 flex items-center justify-between border-t pt-1.5 text-sm'>
            <span className='flex items-center gap-2 text-rose-500'>
              <Ban className='size-3.5' /> Banidos
            </span>
            <span className='font-medium'>{banned}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function RevenueByPlan({
  byPlan,
  total,
}: {
  byPlan: Record<string, number>
  total: number
}) {
  const rows = Object.entries(byPlan)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  if (rows.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        Sem receita registrada ainda.
      </p>
    )
  }

  const max = rows[0][1] || 1
  return (
    <div className='space-y-3'>
      <div className='flex items-baseline justify-between'>
        <span className='text-xs text-muted-foreground'>Total</span>
        <span className='text-lg font-bold'>{BRL.format(total)}</span>
      </div>
      {rows.map(([plan, value]) => (
        <div key={plan} className='space-y-1'>
          <div className='flex items-center justify-between text-sm'>
            <span className='truncate' title={plan}>
              {plan}
            </span>
            <span className='shrink-0 font-medium'>{BRL.format(value)}</span>
          </div>
          <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-emerald-500'
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
