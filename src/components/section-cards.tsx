import { useQuery } from '@tanstack/react-query'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { CalendarClock, Play, Radio } from 'lucide-react'
import { getDashboardStats } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePresenceMap } from '@/features/presence/use-account-presence'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function trend(cur: number, prev: number) {
  if (prev <= 0) return { pct: cur > 0 ? 100 : 0, up: cur >= 0 }
  const pct = ((cur - prev) / prev) * 100
  return { pct, up: pct >= 0 }
}
const fmtPct = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`

export function SectionCards() {
  const { data: s } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  })
  const presenceMap = usePresenceMap()
  const online = [...presenceMap.values()].filter((p) => p.online).length
  const watching = [...presenceMap.values()].filter(
    (p) => p.online && p.watching
  ).length

  const revT = trend(s?.revenue.month ?? 0, s?.revenue.lastMonth ?? 0)
  const prev7 = s ? s.signups.slice(-14, -7).reduce((a, x) => a + x.count, 0) : 0
  const usersT = trend(s?.newUsers7d ?? 0, prev7)

  return (
    <div className='grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card'>
      <StatCard
        description='Receita este mês'
        value={BRL.format(s?.revenue.month ?? 0)}
        badge={<TrendBadge up={revT.up} pct={revT.pct} />}
        footer={
          <>
            {revT.up ? 'Subindo este mês' : 'Caindo este mês'}
            {revT.up ? (
              <IconTrendingUp className='size-4' />
            ) : (
              <IconTrendingDown className='size-4' />
            )}
          </>
        }
        desc={`Mês passado: ${BRL.format(s?.revenue.lastMonth ?? 0)}`}
      />
      <StatCard
        description='Novos usuários (7 dias)'
        value={String(s?.newUsers7d ?? 0)}
        badge={<TrendBadge up={usersT.up} pct={usersT.pct} />}
        footer={
          <>
            {usersT.up ? 'Em crescimento' : 'Desacelerando'}
            {usersT.up ? (
              <IconTrendingUp className='size-4' />
            ) : (
              <IconTrendingDown className='size-4' />
            )}
          </>
        }
        desc={`Semana anterior: ${prev7}`}
      />
      <StatCard
        description='Assinaturas ativas'
        value={String(s?.users.active ?? 0)}
        badge={
          <Badge variant='outline' className='gap-1'>
            <CalendarClock className='size-3' />
            {s?.users.expiringSoon ?? 0}
          </Badge>
        }
        footer={<>{s?.users.expiringSoon ?? 0} vencem em 7 dias</>}
        desc={`${s?.users.expired ?? 0} expiradas · ${s?.users.total ?? 0} no total`}
      />
      <StatCard
        description='Online agora'
        value={String(online)}
        badge={
          <Badge
            variant='outline'
            className='gap-1 border-emerald-500/40 text-emerald-500'
          >
            <Radio className='size-3' />
            ao vivo
          </Badge>
        }
        footer={
          <>
            {watching} assistindo agora <Play className='size-4' />
          </>
        }
        desc='Atualiza em tempo real'
      />
    </div>
  )
}

function TrendBadge({ up, pct }: { up: boolean; pct: number }) {
  return (
    <Badge
      variant='outline'
      className={cn('gap-1', up ? 'text-emerald-500' : 'text-rose-500')}
    >
      {up ? <IconTrendingUp /> : <IconTrendingDown />}
      {fmtPct(pct)}
    </Badge>
  )
}

function StatCard({
  description,
  value,
  badge,
  footer,
  desc,
}: {
  description: string
  value: string
  badge: React.ReactNode
  footer: React.ReactNode
  desc: string
}) {
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
          {value}
        </CardTitle>
        <CardAction>{badge}</CardAction>
      </CardHeader>
      <CardFooter className='flex-col items-start gap-1.5 text-sm'>
        <div className='line-clamp-1 flex gap-2 font-medium'>{footer}</div>
        <div className='text-muted-foreground'>{desc}</div>
      </CardFooter>
    </Card>
  )
}
