import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { CalendarClock, Loader2, MessageCircle, ShieldCheck } from 'lucide-react'
import {
  formatPriceBR,
  listExpiring,
  parsePriceBR,
  type ExpiringSub,
} from '@/lib/admin-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Stat } from './ui'

function daysUntil(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function expiryLabel(iso: string | null) {
  const dias = daysUntil(iso)
  if (dias === null) return '—'
  const d = format(new Date(iso as string), 'dd/MM/yyyy')
  if (dias <= 0) return `hoje · ${d}`
  if (dias === 1) return `amanhã · ${d}`
  return `${dias} dias · ${d}`
}

function renewWhatsapp(s: ExpiringSub) {
  const digits = (s.userPhone ?? '').replace(/\D/g, '')
  if (!digits) return
  const phone = digits.length <= 11 ? `55${digits}` : digits
  const venc = s.expiresAt
    ? format(new Date(s.expiresAt), 'dd/MM/yyyy')
    : 'em breve'
  const msg =
    `Olá${s.userName ? ` ${s.userName}` : ''}! Sua assinatura do ` +
    `${s.planTitle ?? 'plano'} vence em ${venc}. Quer renovar e garantir o ` +
    `acesso sem interrupção? Posso te ajudar agora. 🙂`
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    '_blank',
    'noopener,noreferrer'
  )
}

export function FinanceiroRenovacoes() {
  const navigate = useNavigate()
  const [days, setDays] = useState(7)

  const q = useQuery({
    queryKey: ['expiring', days],
    queryFn: () => listExpiring(days),
  })
  const subs = useMemo(() => q.data ?? [], [q.data])

  const garantido = useMemo(
    () => subs.reduce((sum, s) => sum + parsePriceBR(s.lockedPrice), 0),
    [subs]
  )

  return (
    <div className='w-full space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='grid flex-1 grid-cols-2 gap-3 sm:max-w-md'>
          <Stat
            label='Vencem no período'
            value={`${subs.length}`}
            sub={`próximos ${days} dias`}
            tone='text-amber-500'
          />
          <Stat
            label='Preço fiel garantido'
            value={`R$ ${formatPriceBR(garantido)}`}
            sub='renovações com preço travado'
          />
        </div>
        <div className='flex gap-1'>
          {[7, 15, 30].map((d) => (
            <Button
              key={d}
              size='sm'
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
      </div>

      <div className='overflow-x-auto rounded-xl border bg-muted/50'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className='text-end'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className='py-10 text-center'>
                  <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
                </TableCell>
              </TableRow>
            )}
            {q.isError && (
              <TableRow>
                <TableCell colSpan={4} className='py-10 text-center text-destructive'>
                  Erro ao carregar.
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading &&
              subs.map((s) => {
                const dias = daysUntil(s.expiresAt) ?? 99
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <button
                        type='button'
                        onClick={() =>
                          navigate({
                            to: '/user-admin/$userId',
                            params: { userId: s.id },
                          })
                        }
                        className='group max-w-[240px] text-left'
                      >
                        <p className='truncate text-sm font-medium group-hover:underline'>
                          {s.userName || '(sem nome)'}
                        </p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {s.userPhone || '—'}
                        </p>
                      </button>
                    </TableCell>
                    <TableCell className='text-sm'>
                      <p>{s.planTitle || s.planId || '—'}</p>
                      {s.maxScreens != null && (
                        <p className='text-xs text-muted-foreground'>
                          {s.maxScreens} tela(s)
                          {s.lockedPrice ? ` · 🔒 R$ ${s.lockedPrice}` : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      <Badge
                        variant='outline'
                        className={
                          dias <= 2
                            ? 'gap-1 border-red-500/40 text-red-500'
                            : 'gap-1 border-amber-500/40 text-amber-500'
                        }
                      >
                        <CalendarClock className='size-3' />
                        {expiryLabel(s.expiresAt)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end'>
                        <Button
                          size='sm'
                          className='gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700'
                          disabled={!s.userPhone}
                          title='Lembrar de renovar pelo WhatsApp'
                          onClick={() => renewWhatsapp(s)}
                        >
                          <MessageCircle className='size-4' />
                          Renovar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            {!q.isLoading && !q.isError && subs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className='py-12 text-center text-sm text-muted-foreground'>
                  <ShieldCheck className='mx-auto mb-2 size-6 text-emerald-500' />
                  Nenhuma assinatura vencendo nos próximos {days} dias. 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
