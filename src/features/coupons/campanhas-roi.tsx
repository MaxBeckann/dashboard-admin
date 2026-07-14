import { useQuery } from '@tanstack/react-query'
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { getCouponRoi, type CouponCampaign } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Stat } from '@/features/financeiro/ui'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** ROI por campanha (lote/batch) de cupom — receita trazida vs custo estimado. */
export function CampanhasRoi() {
  const { data, isLoading } = useQuery({
    queryKey: ['coupon-roi'],
    queryFn: getCouponRoi,
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className='flex justify-center py-10'>
        <Loader2 className='size-5 animate-spin text-muted-foreground' />
      </div>
    )
  }
  const { campaigns, totals } = data

  return (
    <div className='space-y-5'>
      <p className='text-sm text-muted-foreground'>
        Quanto cada campanha (lote de códigos) trouxe de receita vs o custo do
        brinde. Custo é <b>estimado</b> (ficha/desconto).
      </p>

      <div className='grid gap-4 sm:grid-cols-4'>
        <Stat
          label='Receita das campanhas'
          value={BRL.format(totals.receita)}
          tone='text-emerald-400'
        />
        <Stat
          label='Custo estimado'
          value={BRL.format(totals.custo)}
          tone='text-rose-400'
        />
        <Stat
          label='ROI'
          value={BRL.format(totals.roi)}
          tone={totals.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <Stat
          label='Convertidos'
          value={`${totals.convertidos}/${totals.resgatantes}`}
          sub='de quem resgatou'
        />
      </div>

      {campaigns.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>
          Nenhuma campanha com resgates ainda.
        </p>
      ) : (
        <div className='overflow-x-auto rounded-xl border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-xs text-muted-foreground'>
              <tr>
                <th className='px-3 py-2 text-start font-medium'>Campanha</th>
                <th className='px-3 py-2 text-end font-medium'>Resgates</th>
                <th className='px-3 py-2 text-end font-medium'>Convertidos</th>
                <th className='px-3 py-2 text-end font-medium'>Receita</th>
                <th className='px-3 py-2 text-end font-medium'>Custo est.</th>
                <th className='px-3 py-2 text-end font-medium'>ROI</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {campaigns.map((c) => (
                <Row key={c.batchId} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Row({ c }: { c: CouponCampaign }) {
  const good = c.roi >= 0
  return (
    <tr className='hover:bg-muted/30'>
      <td className='px-3 py-2'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              c.type === 'discount'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-violet-500/15 text-violet-400'
            )}
          >
            {c.type === 'discount' ? `${c.discountPercent}% OFF` : `${c.days}d`}
          </span>
          <div className='min-w-0'>
            <p className='truncate font-medium' title={c.label}>
              {c.label}
            </p>
            <p className='truncate text-xs text-muted-foreground'>
              {c.planTitle} · {c.couponCount} código(s)
            </p>
          </div>
        </div>
      </td>
      <td className='px-3 py-2 text-end tabular-nums'>{c.resgates}</td>
      <td className='px-3 py-2 text-end tabular-nums'>
        {c.convertidos}{' '}
        <span className='text-xs text-muted-foreground'>({c.taxa}%)</span>
      </td>
      <td className='px-3 py-2 text-end tabular-nums text-emerald-400'>
        {BRL.format(c.receita)}
      </td>
      <td className='px-3 py-2 text-end tabular-nums text-muted-foreground'>
        {BRL.format(c.custo)}
      </td>
      <td
        className={cn(
          'px-3 py-2 text-end font-semibold tabular-nums',
          good ? 'text-emerald-400' : 'text-rose-400'
        )}
      >
        <span className='inline-flex items-center gap-1'>
          {good ? (
            <TrendingUp className='size-3.5' />
          ) : (
            <TrendingDown className='size-3.5' />
          )}
          {BRL.format(c.roi)}
        </span>
      </td>
    </tr>
  )
}
