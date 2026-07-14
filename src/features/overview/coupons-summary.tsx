import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Ticket,
  Users,
} from 'lucide-react'
import {
  listCoupons,
  recentRedemptions,
  type RecentRedemption,
} from '@/lib/admin-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function isExpired(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now()
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return format(new Date(iso), 'dd/MM/yy')
}

/** Resumo de cupons no Início: 4 KPIs (estilo dos cards do topo) + tabela
 * dos últimos resgates (avatar + nome + código). */
export function CouponsSummary() {
  const { data: coupons } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => listCoupons(),
    refetchInterval: 15_000,
  })
  const { data: recent } = useQuery({
    queryKey: ['recent-redemptions'],
    queryFn: () => recentRedemptions(8),
    refetchInterval: 15_000,
  })

  if (!coupons) return null

  const total = coupons.length
  const active = coupons.filter(
    (c) => c.active && !c.exhausted && !isExpired(c.expiresAt)
  ).length
  const redeemed = coupons.reduce((sum, c) => sum + (c.uses || 0), 0)
  const daysGiven = coupons.reduce(
    (sum, c) => sum + (c.uses || 0) * (c.days || 0),
    0
  )
  const exhausted = coupons.filter((c) => c.exhausted).length

  // Capacidade = quantas pessoas podem resgatar no total (soma dos limites).
  // Se algum código for ilimitado, a capacidade vira ∞.
  const anyUnlimited = coupons.some((c) => (c.maxUses || 0) === 0)
  const finiteCapacity = coupons.reduce(
    (sum, c) => sum + (c.maxUses > 0 ? c.maxUses : 0),
    0
  )
  const capacityDisplay = anyUnlimited ? '∞' : String(finiteCapacity)
  const remainingDisplay = anyUnlimited
    ? '∞'
    : String(Math.max(finiteCapacity - redeemed, 0))

  const lastRedeemAt = recent && recent.length > 0 ? recent[0].redeemedAt : null
  const avgDays = redeemed > 0 ? Math.round(daysGiven / redeemed) : 0

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-semibold'>
          <Ticket className='size-5' /> Cupons
        </h2>
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='text-muted-foreground'
        >
          <Link to='/coupons'>
            Gerenciar <ArrowRight className='size-4' />
          </Link>
        </Button>
      </div>

      {/* KPIs — mesmo visual dos cards do topo */}
      <div className='grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card'>
        <StatCard
          description='Códigos'
          value={String(total)}
          badge={
            <Badge variant='outline' className='gap-1'>
              <Ticket className='size-3' />
              {total}
            </Badge>
          }
          footer='gerados no total'
          desc={`${active} ativos · ${exhausted} esgotados`}
        />
        <StatCard
          description='Vagas'
          value={capacityDisplay}
          badge={
            <Badge
              variant='outline'
              className='gap-1 border-emerald-500/40 text-emerald-500'
            >
              <CircleCheck className='size-3' />
              {remainingDisplay} livres
            </Badge>
          }
          footer='pessoas podem resgatar'
          desc={
            anyUnlimited
              ? 'algum código é ilimitado'
              : 'capacidade total dos códigos'
          }
        />
        <StatCard
          description='Resgates'
          value={String(redeemed)}
          badge={
            <Badge variant='outline' className='gap-1'>
              <Users className='size-3' />
              {redeemed}
            </Badge>
          }
          footer='ativações no total'
          desc={
            anyUnlimited
              ? lastRedeemAt
                ? `último ${timeAgo(lastRedeemAt)}`
                : 'nenhum ainda'
              : `de ${finiteCapacity} vagas`
          }
        />
        <StatCard
          description='Dias distribuídos'
          value={String(daysGiven)}
          badge={
            <Badge variant='outline' className='gap-1'>
              <CalendarClock className='size-3' />d
            </Badge>
          }
          footer='de acesso concedido'
          desc={avgDays > 0 ? `~${avgDays}d por resgate` : '—'}
        />
      </div>

      {/* Últimos resgates — tabela no mesmo estilo da de Usuários */}
      <div>
        <h3 className='mb-2 text-sm font-semibold'>Últimos resgates</h3>
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Ganhou</TableHead>
                <TableHead className='text-end'>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent &&
                recent.map((r) => (
                  <RedemptionRow key={`${r.code}-${r.userId}`} r={r} />
                ))}
              {recent && recent.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='text-muted-foreground py-10 text-center'
                  >
                    Ninguém resgatou um código ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function RedemptionRow({ r }: { r: RecentRedemption }) {
  return (
    <TableRow>
      <TableCell>
        <div className='flex items-center gap-3'>
          <Avatar className='size-8'>
            <AvatarImage
              src={r.avatarUrl || '/default-avatar.jpg'}
              alt={r.name || ''}
            />
            <AvatarFallback>
              {getDisplayNameInitials(r.name || r.email || '?')}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>
              {r.name || '(sem nome)'}
            </p>
            <p className='text-muted-foreground truncate text-xs'>
              {r.email || r.userId}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className='font-mono text-sm'>{r.code}</TableCell>
      <TableCell className='text-sm'>
        {r.days != null ? `+${r.days}d` : '—'}
      </TableCell>
      <TableCell className='text-muted-foreground text-end text-sm'>
        {timeAgo(r.redeemedAt)}
      </TableCell>
    </TableRow>
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
