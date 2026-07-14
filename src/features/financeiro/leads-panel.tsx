import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RotateCcw,
  Search as SearchIcon,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteSupportLead,
  formatPriceBR,
  parsePriceBR,
  updateSupportLead,
  type SupportLead,
} from '@/lib/admin-api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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

function whenLabel(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy HH:mm')
}

/** Reconstrói o valor "de tabela" (antes do cupom) a partir do total + %. */
function originalPrice(price: string | null, discountPct: string | null) {
  const p = parsePriceBR(price)
  const d = Number(discountPct)
  if (!p || !Number.isFinite(d) || d <= 0 || d >= 100) return null
  return formatPriceBR(p / (1 - d / 100))
}

function openClientWhatsapp(lead: SupportLead) {
  const digits = (lead.userPhone ?? '').replace(/\D/g, '')
  if (!digits) return
  const phone = digits.length <= 11 ? `55${digits}` : digits
  const parts = [
    `Olá${lead.userName ? ` ${lead.userName}` : ''}! Vi que você tentou`,
    `contratar o ${lead.planTitle ?? 'plano'}${
      lead.price ? ` (R$ ${lead.price})` : ''
    } no app.`,
    'Posso te ajudar a finalizar? 🙂',
  ]
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(parts.join(' '))}`,
    '_blank',
    'noopener,noreferrer'
  )
}

type Filter = 'todos' | 'aberto' | 'resolvido'
type Sort = 'recent' | 'value'

export function LeadsPanel({
  leads: all,
  isLoading,
  isError,
}: {
  leads: SupportLead[]
  isLoading: boolean
  isError: boolean
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('aberto')
  const [sort, setSort] = useState<Sort>('recent')
  const [search, setSearch] = useState('')

  const pendingCount = useMemo(
    () => all.filter((l) => l.status !== 'resolvido').length,
    [all]
  )

  const leads = useMemo(() => {
    let list = all
    if (filter === 'resolvido')
      list = list.filter((l) => l.status === 'resolvido')
    else if (filter === 'aberto')
      list = list.filter((l) => l.status !== 'resolvido')
    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter((l) =>
        [l.userName, l.planTitle, l.planId, l.reason, l.userEmail, l.userPhone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query))
      )
    }
    if (sort === 'value')
      list = [...list].sort(
        (a, b) => parsePriceBR(b.price) - parsePriceBR(a.price)
      )
    return list
  }, [all, filter, search, sort])

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'aberto' | 'resolvido' }) =>
      updateSupportLead(id, status),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['support-leads'] })
      toast.success(
        v.status === 'resolvido' ? 'Marcado como resolvido.' : 'Reaberto.'
      )
    },
    onError: () => toast.error('Não foi possível atualizar.'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSupportLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-leads'] })
      toast.success('Contratação excluída.')
    },
    onError: () => toast.error('Não foi possível excluir.'),
  })

  const filters: { key: Filter; label: string }[] = [
    { key: 'aberto', label: `Pendentes${pendingCount ? ` (${pendingCount})` : ''}` },
    { key: 'resolvido', label: 'Resolvidos' },
    { key: 'todos', label: 'Todos' },
  ]

  return (
    <div>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <div className='relative w-full sm:w-72'>
          <SearchIcon className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar por nome, plano, motivo…'
            className='ps-8'
          />
        </div>
        <div className='flex flex-wrap gap-1'>
          <Button
            size='sm'
            variant={sort === 'value' ? 'default' : 'outline'}
            onClick={() => setSort((s) => (s === 'value' ? 'recent' : 'value'))}
          >
            {sort === 'value' ? 'Maior valor' : 'Mais recentes'}
          </Button>
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
        </div>
      </div>

      <div className='overflow-x-auto rounded-xl border bg-muted/50'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Valor / Cupom</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-end'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center'>
                  <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center text-destructive'>
                  Erro ao carregar.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              leads.map((lead) => {
                const resolved = lead.status === 'resolvido'
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <button
                        type='button'
                        disabled={!lead.accountId}
                        onClick={() =>
                          lead.accountId &&
                          navigate({
                            to: '/user-admin/$userId',
                            params: { userId: lead.accountId },
                          })
                        }
                        className='group min-w-0 max-w-[220px] text-left'
                      >
                        <p className='truncate text-sm font-medium group-hover:underline'>
                          {lead.userName || '(sem nome)'}
                        </p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {[lead.userPhone, lead.userEmail]
                            .filter(Boolean)
                            .join(' · ') || lead.accountId || '—'}
                        </p>
                      </button>
                    </TableCell>
                    <TableCell className='text-sm'>
                      <p>{lead.planTitle || lead.planId || '—'}</p>
                      <p className='text-xs text-muted-foreground'>
                        {[
                          lead.maxScreens ? `${lead.maxScreens} tela(s)` : null,
                          whenLabel(lead.createdAt),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </TableCell>
                    <TableCell>
                      {!lead.price ? (
                        <p className='text-sm font-semibold'>—</p>
                      ) : originalPrice(lead.price, lead.discountPercent) ? (
                        <div className='flex items-baseline gap-1.5'>
                          <span className='text-xs text-muted-foreground line-through'>
                            R$ {originalPrice(lead.price, lead.discountPercent)}
                          </span>
                          <span className='text-sm font-semibold text-emerald-500'>
                            R$ {lead.price}
                          </span>
                        </div>
                      ) : (
                        <p className='text-sm font-semibold'>R$ {lead.price}</p>
                      )}
                      {lead.couponCode ? (
                        <Badge variant='secondary' className='mt-0.5 gap-1 text-[10px]'>
                          🎟 {lead.couponCode}
                          {lead.discountPercent ? ` -${lead.discountPercent}%` : ''}
                        </Badge>
                      ) : (
                        <span className='text-xs text-muted-foreground'>sem cupom</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p
                        className='w-[240px] text-xs break-words whitespace-normal text-muted-foreground'
                        title={lead.reason ?? ''}
                      >
                        {lead.reason || '—'}
                      </p>
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      <div className='flex flex-col items-start gap-1'>
                        {resolved ? (
                          <Badge className='gap-1 bg-emerald-600 text-white hover:bg-emerald-600'>
                            <CheckCircle2 className='size-3' /> Resolvido
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='border-amber-500/40 text-amber-500'>
                            Pendente
                          </Badge>
                        )}
                        {lead.converted && (
                          <Badge className='gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15'>
                            <BadgeCheck className='size-3' /> Converteu
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          size='sm'
                          className='gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700'
                          disabled={!lead.userPhone}
                          onClick={() => openClientWhatsapp(lead)}
                        >
                          <MessageCircle className='size-4' />
                          WhatsApp
                        </Button>
                        <Button
                          size='icon'
                          variant='outline'
                          title={resolved ? 'Reabrir' : 'Marcar como resolvido'}
                          disabled={statusMut.isPending}
                          onClick={() =>
                            statusMut.mutate({
                              id: lead.id,
                              status: resolved ? 'aberto' : 'resolvido',
                            })
                          }
                        >
                          {resolved ? (
                            <RotateCcw className='size-4' />
                          ) : (
                            <CheckCircle2 className='size-4' />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size='icon'
                              variant='outline'
                              title='Excluir'
                              className='text-destructive'
                            >
                              <Trash2 className='size-4' />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir contratação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove o registro de {lead.userName || 'este cliente'}.
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className='bg-destructive text-white hover:bg-destructive/90'
                                onClick={() => deleteMut.mutate(lead.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            {!isLoading && !isError && leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                  {search
                    ? 'Nenhum resultado para a busca.'
                    : filter === 'aberto'
                      ? 'Nenhuma contratação pendente. 🎉'
                      : 'Nada por aqui.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
