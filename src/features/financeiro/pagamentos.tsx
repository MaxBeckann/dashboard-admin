import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  formatPriceBR,
  isPaymentApproved,
  listPayments,
  parsePriceBR,
} from '@/lib/admin-api'
import { PaymentsPanel } from './payments-panel'
import { Stat } from './ui'

const PENDING = ['pending', 'pendente', 'aguardando', 'waiting']

export function FinanceiroPagamentos() {
  const q = useQuery({ queryKey: ['payments'], queryFn: () => listPayments() })
  const all = useMemo(() => q.data ?? [], [q.data])

  const m = useMemo(() => {
    const approved = all.filter((p) => isPaymentApproved(p.status))
    const recebido = approved.reduce((s, p) => s + parsePriceBR(p.amount), 0)
    const pendentes = all.filter((p) =>
      PENDING.includes((p.status ?? '').toLowerCase())
    ).length
    return { recebido, aprovados: approved.length, pendentes, total: all.length }
  }, [all])

  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Stat
          label='Recebido'
          value={`R$ ${formatPriceBR(m.recebido)}`}
          sub='pagamentos aprovados'
          tone='text-emerald-500'
        />
        <Stat label='Aprovados' value={`${m.aprovados}`} tone='text-emerald-500' />
        <Stat
          label='Pendentes'
          value={`${m.pendentes}`}
          tone='text-amber-500'
        />
        <Stat label='Total' value={`${m.total}`} sub='cobranças geradas' />
      </div>

      <PaymentsPanel
        payments={all}
        isLoading={q.isLoading}
        isError={q.isError}
      />
    </div>
  )
}
