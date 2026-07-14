import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatPriceBR,
  isPaymentApproved,
  listPayments,
  listSupportLeads,
  parsePriceBR,
} from '@/lib/admin-api'
import { SalesSummary } from './sales-summary'
import { Stat } from './ui'

const PENDING = ['pending', 'pendente', 'aguardando', 'waiting']

type TipRow = { value: number; payload: Record<string, unknown> }
type TipProps = { active?: boolean; payload?: TipRow[]; label?: string }

function MoneyTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className='rounded-lg border bg-background px-3 py-2 text-xs shadow-md'>
      <p className='font-medium'>{label}</p>
      <p className='font-semibold text-emerald-500'>
        R$ {formatPriceBR(payload[0].value)}
      </p>
    </div>
  )
}

function StatusTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className='rounded-lg border bg-background px-3 py-2 text-xs shadow-md'>
      <p className='font-medium'>{String(p.name ?? '')}</p>
      <p className='font-semibold'>{payload[0].value} contratação(ões)</p>
    </div>
  )
}

export function FinanceiroOverview() {
  const paymentsQ = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
  })
  const leadsQ = useQuery({
    queryKey: ['support-leads'],
    queryFn: () => listSupportLeads(),
  })
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data])
  const leads = useMemo(() => leadsQ.data ?? [], [leadsQ.data])

  const kpi = useMemo(() => {
    const recebido = payments
      .filter((p) => isPaymentApproved(p.status))
      .reduce((s, p) => s + parsePriceBR(p.amount), 0)
    const emRisco = leads
      .filter((l) => l.status !== 'resolvido' && !l.converted)
      .reduce((s, l) => s + parsePriceBR(l.price), 0)
    const totalLeads = leads.length
    const convertidos = leads.filter((l) => l.converted).length
    const conversao = totalLeads
      ? Math.round((convertidos / totalLeads) * 100)
      : 0
    return { recebido, emRisco, conversao, convertidos, totalLeads }
  }, [payments, leads])

  const revenueSeries = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      days.push({
        key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        label: format(d, 'dd/MM'),
        total: 0,
      })
    }
    const idx = new Map(days.map((x, i) => [x.key, i]))
    for (const p of payments) {
      if (!isPaymentApproved(p.status) || !p.createdAt) continue
      const d = new Date(p.createdAt)
      if (isNaN(d.getTime())) continue
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
      if (i !== undefined) days[i].total += parsePriceBR(p.amount)
    }
    return days
  }, [payments])

  // Situação das contratações (categorias mutuamente exclusivas).
  const statusSeries = useMemo(() => {
    let pend = 0
    let conv = 0
    let resolv = 0
    for (const l of leads) {
      if (l.converted) conv++
      else if (l.status === 'resolvido') resolv++
      else pend++
    }
    return [
      { name: 'Pendentes', value: pend, color: '#f59e0b' },
      { name: 'Convertidas', value: conv, color: '#10b981' },
      { name: 'Resolvidas', value: resolv, color: '#3b82f6' },
    ].filter((s) => s.value > 0)
  }, [leads])

  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Stat
          label='Recebido'
          value={`R$ ${formatPriceBR(kpi.recebido)}`}
          sub='pagamentos aprovados'
          tone='text-emerald-500'
        />
        <Stat
          label='Valor em risco'
          value={`R$ ${formatPriceBR(kpi.emRisco)}`}
          sub='contratações pendentes'
          tone='text-amber-500'
        />
        <Stat
          label='Convertidos'
          value={`${kpi.convertidos}`}
          sub='compraram após o lead'
          tone='text-emerald-500'
        />
        <Stat
          label='Taxa de conversão'
          value={`${kpi.conversao}%`}
          progress={kpi.conversao}
          footerRight={`${kpi.convertidos}/${kpi.totalLeads}`}
        />
      </div>

      <div className='grid gap-3 lg:grid-cols-2'>
        <div className='rounded-xl border bg-muted/50 p-4'>
          <p className='mb-3 text-sm font-semibold'>Receita — últimos 14 dias</p>
          <ResponsiveContainer width='100%' height={220}>
            <BarChart
              data={revenueSeries}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke='currentColor'
                strokeOpacity={0.12}
                className='text-muted-foreground'
              />
              <XAxis
                dataKey='label'
                stroke='#888888'
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                stroke='#888888'
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v) => `R$${v}`}
              />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                content={<MoneyTooltip />}
              />
              <Bar dataKey='total' radius={[4, 4, 0, 0]} className='fill-primary' />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className='rounded-xl border bg-muted/50 p-4'>
          <p className='mb-3 text-sm font-semibold'>Situação das contratações</p>
          {statusSeries.length === 0 ? (
            <div className='flex h-[220px] items-center justify-center text-sm text-muted-foreground'>
              Sem contratações ainda.
            </div>
          ) : (
            <>
              <div className='relative'>
                <ResponsiveContainer width='100%' height={200}>
                  <PieChart>
                    <Pie
                      data={statusSeries}
                      dataKey='value'
                      nameKey='name'
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusSeries.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                  <span className='text-2xl font-bold'>{leads.length}</span>
                  <span className='text-xs text-muted-foreground'>
                    contratações
                  </span>
                </div>
              </div>
              <div className='mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1'>
                {statusSeries.map((s) => (
                  <span
                    key={s.name}
                    className='flex items-center gap-1.5 text-xs text-muted-foreground'
                  >
                    <span
                      className='size-2.5 rounded-full'
                      style={{ background: s.color }}
                    />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <SalesSummary />
    </div>
  )
}
