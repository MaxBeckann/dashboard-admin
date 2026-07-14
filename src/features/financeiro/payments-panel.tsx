import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  Search as SearchIcon,
} from 'lucide-react'
import { isPaymentApproved, type PaymentRow } from '@/lib/admin-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PENDING = ['pending', 'pendente', 'aguardando', 'waiting']

function csvCell(v: string) {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function exportCSV(rows: PaymentRow[]) {
  const head = ['Cliente', 'Telefone', 'Plano', 'Valor', 'Tipo', 'Status', 'Data']
  const body = rows.map((p) =>
    [
      p.userName ?? '',
      p.userPhone ?? '',
      p.planTitle ?? '',
      p.amount ?? '',
      p.paymentType ?? '',
      p.status ?? '',
      p.createdAt ?? '',
    ]
      .map((c) => csvCell(String(c)))
      .join(',')
  )
  const csv = ['﻿' + head.join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pagamentos.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Chama o cliente pra recuperar um PIX gerado e não pago. */
function recoverWhatsapp(p: PaymentRow) {
  const digits = (p.userPhone ?? '').replace(/\D/g, '')
  if (!digits) return
  const phone = digits.length <= 11 ? `55${digits}` : digits
  const msg =
    `Olá${p.userName ? ` ${p.userName}` : ''}! Vi que você gerou o pagamento do ` +
    `${p.planTitle ?? 'plano'}${p.amount ? ` (R$ ${p.amount})` : ''} mas ele ainda ` +
    `não caiu por aqui. Posso te ajudar a finalizar? 🙂`
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    '_blank',
    'noopener,noreferrer'
  )
}

function whenLabel(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy HH:mm')
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toLowerCase()
  if (isPaymentApproved(s))
    return (
      <Badge className='gap-1 bg-emerald-600 text-white hover:bg-emerald-600'>
        <CheckCircle2 className='size-3' /> Pago
      </Badge>
    )
  if (PENDING.includes(s))
    return (
      <Badge variant='outline' className='border-amber-500/40 text-amber-500'>
        Pendente
      </Badge>
    )
  return (
    <Badge variant='outline' className='capitalize text-muted-foreground'>
      {status || '—'}
    </Badge>
  )
}

type Filter = 'todos' | 'pago' | 'pendente'

export function PaymentsPanel({
  payments: all,
  isLoading,
  isError,
}: {
  payments: PaymentRow[]
  isLoading: boolean
  isError: boolean
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')

  const pendingCount = useMemo(
    () => all.filter((p) => PENDING.includes((p.status ?? '').toLowerCase())).length,
    [all]
  )

  const rows = useMemo(() => {
    let list = all
    if (filter === 'pago') list = list.filter((p) => isPaymentApproved(p.status))
    else if (filter === 'pendente')
      list = list.filter((p) => PENDING.includes((p.status ?? '').toLowerCase()))
    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter((p) =>
        [p.userName, p.planTitle, p.amount, p.paymentType, p.userId]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query))
      )
    }
    return list
  }, [all, filter, search])

  const filters: { key: Filter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'pago', label: 'Pagos' },
    { key: 'pendente', label: `Pendentes${pendingCount ? ` (${pendingCount})` : ''}` },
  ]

  return (
    <div>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <div className='relative w-full sm:w-72'>
          <SearchIcon className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar por cliente, plano, valor…'
            className='ps-8'
          />
        </div>
        <div className='flex flex-wrap gap-1'>
          {filters.map((f) => (
            <Button
              key={f.key}
              size='sm'
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            size='sm'
            variant='outline'
            className='gap-1.5'
            disabled={rows.length === 0}
            onClick={() => exportCSV(rows)}
          >
            <Download className='size-4' />
            CSV
          </Button>
        </div>
      </div>

      <div className='overflow-x-auto rounded-xl border bg-muted/50'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quando</TableHead>
              <TableHead className='text-end'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center'>
                  <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-destructive'>
                  Erro ao carregar.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <button
                      type='button'
                      disabled={!p.userId}
                      onClick={() =>
                        p.userId &&
                        navigate({
                          to: '/user-admin/$userId',
                          params: { userId: p.userId },
                        })
                      }
                      className='group max-w-[220px] truncate text-left text-sm font-medium'
                    >
                      <span className='group-hover:underline'>
                        {p.userName || p.userId || '—'}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className='text-sm'>{p.planTitle || '—'}</TableCell>
                  <TableCell className='text-sm font-semibold whitespace-nowrap'>
                    {p.amount ? `R$ ${p.amount}` : '—'}
                  </TableCell>
                  <TableCell>
                    <span className='text-xs text-muted-foreground capitalize'>
                      {p.paymentType || '—'}
                    </span>
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className='text-sm whitespace-nowrap'>
                    {whenLabel(p.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end'>
                      {PENDING.includes((p.status ?? '').toLowerCase()) && (
                        <Button
                          size='sm'
                          className='gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700'
                          disabled={!p.userPhone}
                          title='Recuperar pelo WhatsApp'
                          onClick={() => recoverWhatsapp(p)}
                        >
                          <MessageCircle className='size-4' />
                          Recuperar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && !isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                  {search ? 'Nenhum resultado.' : 'Nenhum pagamento ainda.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
