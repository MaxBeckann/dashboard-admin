import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getConversionFunnel, type ConversionFunnel } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Breakdown, Stat } from './ui'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const WINDOWS = [7, 30, 90] as const
const STAGE_COLORS = ['#3b82f6', '#22c55e', '#a855f7'] // leads · pagaram · ativos

export function FinanceiroFunil() {
  const [windowDays, setWindowDays] = useState<number>(30)
  const { data, isLoading } = useQuery({
    queryKey: ['conversion-funnel', windowDays],
    queryFn: () => getConversionFunnel(windowDays),
    refetchInterval: 60_000,
  })

  return (
    <div className='space-y-5'>
      <div>
        <p className='text-sm text-muted-foreground'>
          Do cliente que caiu no WhatsApp/QR (lead) até virar assinante ativo —
          veja onde a venda vaza.
        </p>
      </div>

      <div className='inline-flex items-center gap-1 rounded-lg border bg-card p-0.5 text-sm'>
        {WINDOWS.map((d) => (
          <button
            key={d}
            type='button'
            onClick={() => setWindowDays(d)}
            className={
              windowDays === d
                ? 'rounded-md bg-accent px-3 py-1 font-medium text-accent-foreground'
                : 'rounded-md px-3 py-1 text-muted-foreground hover:text-foreground'
            }
          >
            {d} dias
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className='flex justify-center py-10'>
          <Loader2 className='size-5 animate-spin text-muted-foreground' />
        </div>
      ) : (
        <FunnelBody data={data} />
      )}
    </div>
  )
}

function FunnelBody({ data }: { data: ConversionFunnel }) {
  const leadCount = data.stages[0]?.count ?? 0

  return (
    <>
      {/* Funil visual */}
      <div className='rounded-2xl border bg-muted/50 p-5'>
        <p className='mb-4 text-sm font-semibold'>Etapas</p>
        {leadCount === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            Sem leads no período.
          </p>
        ) : (
          <div className='space-y-3'>
            {data.stages.map((s, i) => {
              const pctOfLeads = Math.round((s.count / leadCount) * 100)
              const prev = i > 0 ? data.stages[i - 1].count : null
              const dropN = prev != null ? prev - s.count : 0
              const dropPct =
                prev != null && prev > 0 ? Math.round((dropN / prev) * 100) : 0
              return (
                <div key={s.key}>
                  {i > 0 && dropN > 0 && (
                    <p className='mb-1 ps-32 text-xs text-rose-400'>
                      ↓ perdeu {dropPct}% ({dropN})
                    </p>
                  )}
                  <div className='flex items-center gap-3'>
                    <div className='w-28 shrink-0 text-sm font-medium'>
                      {s.label}
                    </div>
                    <div className='h-9 flex-1 overflow-hidden rounded-lg bg-muted'>
                      <div
                        className='flex h-full min-w-[2.5rem] items-center rounded-lg px-3 text-sm font-bold text-white'
                        style={{
                          width: `${Math.max(8, pctOfLeads)}%`,
                          backgroundColor: STAGE_COLORS[i],
                        }}
                      >
                        {s.count}
                      </div>
                    </div>
                    <div className='w-10 shrink-0 text-end text-sm font-semibold'>
                      {pctOfLeads}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Conversões + onde perde venda */}
      <div className='grid gap-4 sm:grid-cols-3'>
        <Stat
          label='Lead → Pagou'
          value={`${data.rates.leadToPaid}%`}
          progress={data.rates.leadToPaid}
          sub='dos leads pagaram'
        />
        <Stat
          label='Pagou → Ativo'
          value={`${data.rates.paidToActive}%`}
          progress={data.rates.paidToActive}
          sub='dos que pagaram estão ativos'
        />
        <Stat
          label='Onde perde venda'
          value={
            data.biggestDropStage === 'leadToPaid'
              ? 'Lead → Pagou'
              : 'Pagou → Ativo'
          }
          tone='text-rose-400'
          sub={`Em risco: ${BRL.format(data.valorEmRisco)}`}
          footerRight={`Ticket ${BRL.format(data.ticketMedio)}`}
        />
      </div>

      {/* Por plano + motivos */}
      <div className='grid gap-4 lg:grid-cols-2'>
        <div className='rounded-2xl border bg-muted/50 p-5'>
          <p className='mb-3 text-sm font-semibold'>
            Conversão por plano (pior 1º)
          </p>
          {data.byPlan.length === 0 ? (
            <p className='text-xs text-muted-foreground'>—</p>
          ) : (
            <div className='space-y-2.5'>
              {data.byPlan.map((p) => (
                <div key={p.plan} className='flex items-center gap-2'>
                  <span className='w-32 shrink-0 truncate text-xs' title={p.plan}>
                    {p.plan}
                  </span>
                  <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                    <div
                      className={cn(
                        'h-full rounded-full',
                        p.rate < 30
                          ? 'bg-rose-500'
                          : p.rate < 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.max(3, p.rate)}%` }}
                    />
                  </div>
                  <span className='w-20 shrink-0 text-end text-xs font-semibold'>
                    {p.rate}%{' '}
                    <span className='text-muted-foreground'>
                      ({p.pagaram}/{p.leads})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Breakdown
          title='Por que não compraram (motivos)'
          rows={data.topReasons.map((r) => [r.reason, r.count])}
        />
      </div>
    </>
  )
}
