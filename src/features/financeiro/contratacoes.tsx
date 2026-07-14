import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  formatPriceBR,
  listSupportLeads,
  parsePriceBR,
  type SupportLead,
} from '@/lib/admin-api'
import { LeadsPanel } from './leads-panel'
import { Breakdown, Stat } from './ui'

function topCounts(
  items: SupportLead[],
  keyFn: (l: SupportLead) => string | null,
  limit = 5
): [string, number][] {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = keyFn(it) || '—'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

export function FinanceiroContratacoes() {
  const q = useQuery({
    queryKey: ['support-leads'],
    queryFn: () => listSupportLeads(),
  })
  const all = useMemo(() => q.data ?? [], [q.data])

  const m = useMemo(() => {
    const total = all.length
    const pendentes = all.filter((l) => l.status !== 'resolvido').length
    const convertidos = all.filter((l) => l.converted).length
    const conversao = total ? Math.round((convertidos / total) * 100) : 0
    const valorEmRisco = all
      .filter((l) => l.status !== 'resolvido' && !l.converted)
      .reduce((s, l) => s + parsePriceBR(l.price), 0)
    return { total, pendentes, convertidos, conversao, valorEmRisco }
  }, [all])

  const byReason = useMemo(() => topCounts(all, (l) => l.reason), [all])
  const byPlan = useMemo(
    () => topCounts(all, (l) => l.planTitle || l.planId),
    [all]
  )

  return (
    <div className='w-full space-y-4'>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Stat
          label='Pendentes'
          value={`${m.pendentes}`}
          sub='aguardando atendimento'
          tone='text-amber-500'
        />
        <Stat
          label='Valor em risco'
          value={`R$ ${formatPriceBR(m.valorEmRisco)}`}
          sub='dinheiro esperando contato'
          tone='text-amber-500'
        />
        <Stat
          label='Convertidos'
          value={`${m.convertidos}`}
          sub={`de ${m.total} leads`}
          tone='text-emerald-500'
        />
        <Stat
          label='Taxa de conversão'
          value={`${m.conversao}%`}
          progress={m.conversao}
          footerRight={`${m.convertidos}/${m.total}`}
        />
      </div>

      {all.length > 0 && (
        <div className='grid gap-3 md:grid-cols-2'>
          <Breakdown title='Principais motivos' rows={byReason} />
          <Breakdown title='Planos mais procurados' rows={byPlan} />
        </div>
      )}

      <LeadsPanel leads={all} isLoading={q.isLoading} isError={q.isError} />
    </div>
  )
}
