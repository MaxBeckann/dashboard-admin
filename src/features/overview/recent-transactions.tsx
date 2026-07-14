import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CreditCard, Loader2 } from 'lucide-react'
import { isPaymentApproved, listPayments } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

function dateLabel(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  if (isToday(d)) return `Hoje, ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd 'de' MMM", { locale: ptBR })
}

export function RecentTransactions() {
  const q = useQuery({ queryKey: ['payments'], queryFn: () => listPayments() })
  const rows = (q.data ?? []).slice(0, 6)

  return (
    <div className='rounded-2xl border bg-card p-5'>
      <div className='mb-4 flex items-center justify-between gap-2'>
        <div>
          <h2 className='text-base font-semibold'>Transações recentes</h2>
          <p className='text-sm text-muted-foreground'>Últimos pagamentos no app.</p>
        </div>
        <Button asChild variant='outline' size='sm'>
          <Link to='/financeiro/pagamentos'>Ver tudo</Link>
        </Button>
      </div>

      {q.isLoading ? (
        <div className='flex justify-center py-8 text-muted-foreground'>
          <Loader2 className='size-5 animate-spin' />
        </div>
      ) : rows.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>
          Nenhuma transação ainda.
        </p>
      ) : (
        <div className='divide-y'>
          {rows.map((p) => {
            const approved = isPaymentApproved(p.status)
            return (
              <div key={p.id} className='flex items-center gap-3 py-3'>
                <div className='grid size-10 shrink-0 place-items-center rounded-xl bg-muted'>
                  <CreditCard className='size-4 text-muted-foreground' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-semibold'>
                    {p.userName || p.userId || '—'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {p.planTitle || 'Assinatura'}
                  </p>
                </div>
                <p className='hidden shrink-0 text-sm text-muted-foreground sm:block'>
                  {dateLabel(p.createdAt)}
                </p>
                <p
                  className={cn(
                    'w-28 shrink-0 text-right text-sm font-bold',
                    approved ? 'text-emerald-500' : 'text-muted-foreground'
                  )}
                >
                  {approved ? '+' : ''}
                  {p.amount ? `R$ ${p.amount}` : '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
