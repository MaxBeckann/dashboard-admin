import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2, RefreshCw, ScrollText } from 'lucide-react'
import { getAuditLog, type AuditEntry } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const ACTION_META: Record<string, { label: string; color: string }> = {
  ban_user: { label: 'Baniu usuário', color: 'bg-rose-500/15 text-rose-400' },
  unban_user: {
    label: 'Desbaniu usuário',
    color: 'bg-emerald-500/15 text-emerald-400',
  },
  set_subscription: {
    label: 'Alterou assinatura',
    color: 'bg-blue-500/15 text-blue-400',
  },
  create_coupons: {
    label: 'Gerou cupons',
    color: 'bg-violet-500/15 text-violet-400',
  },
  delete_coupons: { label: 'Excluiu cupom', color: 'bg-rose-500/15 text-rose-400' },
  update_coupon: { label: 'Editou cupom', color: 'bg-amber-500/15 text-amber-400' },
  delete_message: {
    label: 'Excluiu mensagem',
    color: 'bg-zinc-500/15 text-zinc-300',
  },
  set_admin: { label: 'Alterou admin', color: 'bg-violet-500/15 text-violet-400' },
  reset_password: {
    label: 'Redefiniu senha',
    color: 'bg-amber-500/15 text-amber-400',
  },
  delete_user: { label: 'Excluiu usuário', color: 'bg-rose-500/15 text-rose-400' },
}

const FILTERS = [
  { key: '', label: 'Tudo' },
  { key: 'ban_user', label: 'Banimentos' },
  { key: 'set_subscription', label: 'Assinaturas' },
  { key: 'create_coupons', label: 'Cupons' },
]

const USER_TARGET = new Set([
  'ban_user',
  'unban_user',
  'set_subscription',
  'set_admin',
  'reset_password',
])

export function Auditoria() {
  const [action, setAction] = useState('')
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-log', action],
    queryFn: () => getAuditLog({ action: action || undefined }),
    refetchInterval: 60_000,
  })
  const items = data?.items ?? []

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <ScrollText className='size-6' /> Auditoria
            </h1>
            <p className='text-muted-foreground'>
              Quem fez o quê e quando — banimentos, planos, cupons e exclusões.
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={isFetching ? 'size-4 animate-spin' : 'size-4'}
            />
            Atualizar
          </Button>
        </div>

        <nav className='mb-4 inline-flex items-center gap-1 rounded-xl border bg-card p-1'>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type='button'
              onClick={() => setAction(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                action === f.key
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className='rounded-2xl border bg-card p-2 sm:p-3'>
          {isLoading ? (
            <div className='flex justify-center py-10'>
              <Loader2 className='size-5 animate-spin text-muted-foreground' />
            </div>
          ) : items.length === 0 ? (
            <p className='py-10 text-center text-muted-foreground'>
              Nenhuma ação registrada ainda.
            </p>
          ) : (
            <div className='divide-y'>
              {items.map((e) => (
                <AuditRow key={e.id} e={e} />
              ))}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}

function AuditRow({ e }: { e: AuditEntry }) {
  const meta = ACTION_META[e.action] ?? {
    label: e.action,
    color: 'bg-muted text-muted-foreground',
  }
  const target = e.targetName || e.targetId
  return (
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2.5 text-sm'>
      <span
        className={cn('rounded-md px-2 py-0.5 text-xs font-medium', meta.color)}
      >
        {meta.label}
      </span>
      <span className='font-medium'>{e.adminName || 'Admin'}</span>
      {target && (
        <>
          <span className='text-muted-foreground'>→</span>
          {USER_TARGET.has(e.action) && e.targetId ? (
            <Link
              to='/user-admin/$userId'
              params={{ userId: e.targetId }}
              className='font-medium underline-offset-2 hover:underline'
            >
              {target}
            </Link>
          ) : (
            <span className='font-medium'>{target}</span>
          )}
        </>
      )}
      <span className='text-muted-foreground'>{describeDetails(e)}</span>
      <span className='ms-auto shrink-0 text-xs text-muted-foreground'>
        {fmtDateTime(e.createdAt)}
      </span>
    </div>
  )
}

function describeDetails(e: AuditEntry): string {
  const d = e.details || {}
  const s = (k: string) => (d[k] != null ? String(d[k]) : '')
  switch (e.action) {
    case 'set_subscription':
      return `· ${s('plan') || 'plano'}${d.days ? ` (${s('days')}d)` : ''}`
    case 'create_coupons':
      return `· ${s('count')} cupom(s)`
    case 'delete_coupons':
      return `· ${s('deleted')} código(s)`
    case 'ban_user':
      return `· até ${s('banUntil')}`
    case 'set_admin':
      return d.isAdmin ? '· promoveu' : '· rebaixou'
    case 'update_coupon':
      return Array.isArray(d.fields) ? `· ${(d.fields as string[]).length} campo(s)` : ''
    case 'delete_message':
      return d.broadcast ? `· broadcast (${s('deleted')})` : ''
    default:
      return ''
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
