import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Globe,
  History,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  bulkSetDns,
  getDnsHistory,
  getDnsOverview,
  getDnsUsers,
  saveKnownDns,
  testDns,
  type AuditEntry,
  type DnsOverview,
  type DnsScope,
  type DnsTestResult,
  type DnsUsage,
  type DnsUser,
  type KnownDns,
} from '@/lib/admin-api'
import { waUrl } from '@/features/user-admin/user-actions'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Stat } from '@/features/financeiro/ui'

const ALL = '__all__'

const MSG_PRESETS: { label: string; text: string }[] = [
  { label: 'Sem mensagem', text: '' },
  {
    label: 'Padrão',
    text: 'Oi {NOME}! Atualizamos o servidor da sua lista pra melhorar a estabilidade. Se algo não carregar, feche e abra o app. 💚',
  },
  {
    label: 'Curta',
    text: 'Atualizamos o servidor da sua lista. Se precisar, feche e abra o app. 👍',
  },
  {
    label: 'Manutenção',
    text: 'Olá {NOME}! Fizemos uma manutenção no servidor e já normalizou. Reabra o app se algo travar.',
  },
]
const PLACEHOLDERS = ['{NOME}', '{DNS_NOVO}', '{DNS_ANTIGO}']

/** Cores por grupo — planos (verde/seguro) vs só-app (âmbar/atenção). */
function tone(scope: DnsScope) {
  return scope === 'plan'
    ? { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500' }
    : { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-500', chip: 'bg-amber-500/15 text-amber-500' }
}

function copy(text: string, label = 'Copiado!') {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error('Não foi possível copiar.')
  )
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

/** Botão "Testar" com selo (🟢 no ar / 🔴 fora) — health-check server-side. */
function DnsTestButton({ dns }: { dns: string }) {
  const [result, setResult] = useState<DnsTestResult | null>(null)
  const mut = useMutation({
    mutationFn: () => testDns(dns.trim()),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao testar.'),
  })
  const disabled = dns.trim().length < 4 || mut.isPending
  return (
    <div className='flex items-center gap-2'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={disabled}
        onClick={() => {
          setResult(null)
          mut.mutate(undefined, { onSuccess: (r) => setResult(r) })
        }}
      >
        {mut.isPending ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <ShieldCheck className='size-4' />
        )}
        Testar
      </Button>
      {result && !mut.isPending && (
        <span
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            result.ok ? 'text-emerald-500' : 'text-rose-500'
          )}
          title={result.message}
        >
          {result.ok ? (
            <CheckCircle2 className='size-4' />
          ) : (
            <XCircle className='size-4' />
          )}
          {result.ok ? 'no ar' : 'fora'}
        </span>
      )}
    </div>
  )
}

export function Dns() {
  const qc = useQueryClient()
  const [includeInactive, setIncludeInactive] = useState(false)
  const overviewQuery = useQuery({
    queryKey: ['dns-overview', includeInactive],
    queryFn: () => getDnsOverview(includeInactive),
    refetchInterval: 20_000,
  })
  const data = overviewQuery.data
  const refresh = () => qc.invalidateQueries({ queryKey: ['dns-overview'] })
  const [tab, setTab] = useState<DnsScope>('plan')

  const TABS: [DnsScope, string][] = [
    ['plan', '🟢 Nossa lista (planos)'],
    ['app', '🟡 Lista própria (só-app)'],
  ]

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
        <div className='mb-6 flex items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Globe className='size-6' /> DNS
            </h1>
            <p className='text-muted-foreground'>
              Servidor da lista dos clientes. Troque o DNS em massa quando um
              mirror cair — e veja quem usa cada servidor.
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <label className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(v) => setIncludeInactive(v === true)}
              />
              incluir vencidas/inativas
            </label>
            <Button
              variant='outline'
              size='sm'
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
            >
              <RefreshCw
                className={cn('size-4', overviewQuery.isFetching && 'animate-spin')}
              />
              Atualizar
            </Button>
          </div>
        </div>

        <div className='space-y-6 rounded-2xl border bg-card p-4 sm:p-5'>
          {/* KPIs coloridos */}
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            <Stat
              label='Usuários de plano'
              value={data ? String(data.totals.planUsers) : '—'}
              tone='text-emerald-500'
              sub='nossas listas'
            />
            <Stat
              label='Usuários só-app'
              value={data ? String(data.totals.appUsers) : '—'}
              tone='text-amber-500'
              sub='lista própria'
            />
            <Stat
              label='DNS distintos'
              value={
                data
                  ? String(data.totals.distinctPlanDns + data.totals.distinctAppDns)
                  : '—'
              }
              sub='em uso'
            />
            <Stat
              label='DNS conhecidos'
              value={data ? String(data.known.length) : '—'}
              sub='lista curada'
            />
          </div>

          {/* Abas plano / só-app */}
          <nav className='inline-flex items-center gap-1 rounded-xl border bg-card p-1'>
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type='button'
                onClick={() => setTab(k)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  tab === k
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <DnsGroup scope={tab} data={data} onDone={refresh} />

          {/* DNS conhecidos (compartilhado) */}
          <KnownDnsEditor known={data?.known ?? []} onSaved={refresh} />

          {/* Histórico de trocas */}
          <DnsHistory />
        </div>
      </Main>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function DnsGroup({
  scope,
  data,
  onDone,
}: {
  scope: DnsScope
  data?: DnsOverview
  onDone: () => void
}) {
  const isPlan = scope === 'plan'
  const t = tone(scope)
  const list = isPlan ? data?.planDns ?? [] : data?.appDns ?? []

  return (
    <div className='space-y-4'>
      {/* Banner explicativo por grupo */}
      {isPlan ? (
        <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', t.border, t.bg, t.text)}>
          <ShieldCheck className='mt-0.5 size-4 shrink-0' />
          <p>
            Listas que <strong>nós geramos</strong>. Trocar o DNS aqui é seguro —
            o app pega o novo na próxima abertura.
          </p>
        </div>
      ) : (
        <div className='flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-500'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0' />
          <p>
            Estas são listas <strong>próprias</strong> dos clientes (eles mesmos
            digitaram). Trocar aqui pode <strong>quebrar o acesso deles</strong> —
            só faça se tiver certeza. Exige escolher o DNS de origem.
          </p>
        </div>
      )}

      <BulkSwapCard scope={scope} data={data} onDone={onDone} />

      {/* Distribuição com drill-down */}
      <div>
        <p className='mb-2 flex items-center gap-2 text-sm font-semibold'>
          <span className={cn('inline-block size-2 rounded-full', isPlan ? 'bg-emerald-500' : 'bg-amber-500')} />
          Em uso — {isPlan ? 'Planos (mais usados)' : 'Só-app (mais usados)'}
        </p>
        {list.length === 0 ? (
          <p className='rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground'>
            Nenhum DNS neste grupo.
          </p>
        ) : (
          <div className='space-y-2'>
            {list.map((dns) => (
              <DnsRow key={dns.url} dns={dns} scope={scope} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function DnsRow({ dns, scope }: { dns: DnsUsage; scope: DnsScope }) {
  const [open, setOpen] = useState(false)
  return (
    <div className='flex items-center gap-3 rounded-lg bg-muted/50 p-3'>
      <DnsAvatarStack avatars={dns.avatars ?? []} count={dns.count} />
      <div className='min-w-0 flex-1'>
        <p className='truncate font-mono text-sm' title={dns.url}>
          {dns.url}
        </p>
        <p className='text-xs text-muted-foreground'>{dns.count} usuário(s)</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant='outline' size='sm'>
            <Users className='size-4' /> Ver usuários
          </Button>
        </DialogTrigger>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='truncate font-mono text-sm'>
              {dns.url}
            </DialogTitle>
            <DialogDescription>
              {dns.count} usuário(s) neste DNS
            </DialogDescription>
          </DialogHeader>
          {open && <DnsUserList url={dns.url} scope={scope} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DnsAvatarStack({ avatars, count }: { avatars: string[]; count: number }) {
  const shown = avatars.slice(0, 3)
  const extra = count - shown.length
  return (
    <div className='flex -space-x-2'>
      {shown.map((a, i) => (
        <Avatar key={i} className='size-7 ring-2 ring-background'>
          <AvatarImage src={a} />
          <AvatarFallback className='text-[10px]'>·</AvatarFallback>
        </Avatar>
      ))}
      {shown.length === 0 && (
        <Avatar className='size-7 ring-2 ring-background'>
          <AvatarFallback className='text-[10px]'>
            <Users className='size-3' />
          </AvatarFallback>
        </Avatar>
      )}
      {extra > 0 && (
        <div className='flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background'>
          +{extra}
        </div>
      )}
    </div>
  )
}

function SearchBox({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className='relative'>
      <Search className='absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        className='pl-8'
        placeholder='Buscar pessoas…'
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function DnsUserRow({ u }: { u: DnsUser }) {
  return (
    <div className='flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2'>
      <Avatar className='size-8'>
        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.profileName} />}
        <AvatarFallback className='text-xs'>
          {getDisplayNameInitials(u.accountName || u.profileName || '?')}
        </AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>
          {u.accountName || u.accountEmail || 'Usuário'}
        </p>
        <p className='truncate text-xs text-muted-foreground'>
          {[
            u.profileName ? `Perfil: ${u.profileName}` : '',
            u.accountEmail || '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {u.username && (
          <button
            type='button'
            title={`Copiar usuário: ${u.username}`}
            onClick={() => copy(u.username, 'Usuário copiado!')}
            className='flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground'
          >
            <Copy className='size-3' /> user
          </button>
        )}
        {u.password && (
          <button
            type='button'
            title='Copiar senha'
            onClick={() => copy(u.password, 'Senha copiada!')}
            className='flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground'
          >
            <Copy className='size-3' /> senha
          </button>
        )}
        {waUrl(u.phone) && (
          <button
            type='button'
            title='Falar no WhatsApp'
            onClick={() => window.open(waUrl(u.phone)!, '_blank')}
            className='rounded p-1 text-emerald-500 hover:text-emerald-400'
          >
            <MessageCircle className='size-4' />
          </button>
        )}
      </div>
    </div>
  )
}

function exportDnsCsv(url: string, users: DnsUser[]) {
  const header = ['nome', 'email', 'perfil', 'usuario', 'senha', 'telefone']
  const esc = (c: unknown) => `"${String(c ?? '').replace(/"/g, '""')}"`
  const csv = [
    header,
    ...users.map((u) => [
      u.accountName,
      u.accountEmail,
      u.profileName,
      u.username,
      u.password,
      u.phone ?? '',
    ]),
  ]
    .map((r) => r.map(esc).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dns-${url.replace(/[^a-z0-9]/gi, '_')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function DnsUserList({ url, scope }: { url: string; scope: DnsScope }) {
  const q = useQuery({
    queryKey: ['dns-users', url, scope],
    queryFn: () => getDnsUsers(url, scope),
    staleTime: 30_000,
  })
  const [search, setSearch] = useState('')
  const users = q.data?.users ?? []
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return users
    return users.filter((u) =>
      `${u.accountName} ${u.accountEmail} ${u.profileName}`
        .toLowerCase()
        .includes(s)
    )
  }, [users, search])

  if (q.isLoading) {
    return (
      <div className='py-8 text-center'>
        <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
      </div>
    )
  }
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='flex-1'>
          <SearchBox value={search} onChange={setSearch} />
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={users.length === 0}
          onClick={() => exportDnsCsv(url, users)}
        >
          <Download className='size-4' /> CSV
        </Button>
      </div>
      {q.data?.capped && (
        <p className='text-xs text-amber-500'>
          Mostrando os primeiros {users.length} (há mais).
        </p>
      )}
      <div className='max-h-80 space-y-1.5 overflow-y-auto'>
        {filtered.length === 0 ? (
          <p className='py-4 text-center text-sm text-muted-foreground'>
            Nenhum usuário.
          </p>
        ) : (
          filtered.map((u) => <DnsUserRow key={`${u.userId}|${u.profileName}`} u={u} />)
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function BulkSwapCard({
  scope,
  data,
  onDone,
}: {
  scope: DnsScope
  data?: DnsOverview
  onDone: () => void
}) {
  const isPlan = scope === 'plan'
  const t = tone(scope)
  const dnsList = isPlan ? data?.planDns ?? [] : data?.appDns ?? []
  const knownActive = (data?.known ?? []).filter((k) => k.active)

  const [fromUrl, setFromUrl] = useState<string>(isPlan ? ALL : '')
  const [toUrl, setToUrl] = useState('')
  const [notify, setNotify] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const impact = useMemo(() => {
    if (!data) return 0
    if (fromUrl === ALL) return data.totals.planUsers
    return dnsList.find((d) => d.url === fromUrl)?.count ?? 0
  }, [data, fromUrl, dnsList])

  const mut = useMutation({
    mutationFn: () =>
      bulkSetDns({
        scope,
        fromUrl: fromUrl === ALL ? undefined : fromUrl,
        toUrl: toUrl.trim(),
        notify,
        notifyBody: notify && msg.trim() ? msg.trim() : undefined,
      }),
    onSuccess: (r) => {
      toast.success(
        `DNS trocado em ${r.changed} usuário(s)` +
          (r.notified ? `, ${r.notified} avisado(s)` : '') +
          (r.failed ? ` (${r.failed} falha(s))` : '') +
          '.'
      )
      setConfirmOpen(false)
      setConfirmText('')
      setToUrl('')
      onDone()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao trocar DNS.'),
  })

  const target = toUrl.trim()
  const hasValidFrom = isPlan || !!fromUrl // só-app exige DNS de origem
  const canApply = target.length > 3 && impact > 0 && hasValidFrom
  const fromLabel = fromUrl === ALL ? 'todos os planos' : fromUrl || '(escolha)'
  const confirmWord = 'TROCAR'

  return (
    <div className={cn('rounded-2xl border p-5', t.border, t.bg)}>
      <p className={cn('flex items-center gap-2 text-sm font-semibold', t.text)}>
        <ArrowRight className='size-4' /> Trocar DNS em massa —{' '}
        {isPlan ? 'planos' : 'lista própria'}
      </p>

      <div className='mt-4 grid gap-4 sm:grid-cols-2'>
        {/* Origem */}
        <div>
          <Label className='text-xs'>Trocar de</Label>
          <Select value={fromUrl} onValueChange={setFromUrl}>
            <SelectTrigger className='mt-1'>
              <SelectValue placeholder='Escolha o DNS de origem' />
            </SelectTrigger>
            <SelectContent>
              {isPlan && <SelectItem value={ALL}>Todos os planos</SelectItem>}
              {dnsList.map((d) => (
                <SelectItem key={d.url} value={d.url}>
                  {d.url} ({d.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destino */}
        <div>
          <Label className='text-xs'>Para (novo DNS)</Label>
          <Input
            className='mt-1'
            placeholder='http://novodns.sbs'
            value={toUrl}
            onChange={(e) => setToUrl(e.target.value)}
          />
          {knownActive.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {knownActive.map((k) => (
                <button
                  key={k.url}
                  type='button'
                  onClick={() => setToUrl(k.url)}
                  className='rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                  title={k.note || k.url}
                >
                  {k.label || k.url}
                </button>
              ))}
            </div>
          )}
          {toUrl.trim().length > 3 && (
            <div className='mt-2'>
              <DnsTestButton dns={toUrl} />
            </div>
          )}
        </div>
      </div>

      {/* Aviso + mensagem */}
      <div className='mt-4'>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
          Avisar os usuários afetados
        </label>
        {notify && <MessageComposer value={msg} onChange={setMsg} />}
      </div>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <span className='text-sm text-muted-foreground'>
          afeta <strong className='text-foreground'>{impact}</strong> usuário(s)
        </span>
        <Button
          disabled={!canApply}
          variant={isPlan ? 'default' : 'destructive'}
          onClick={() => setConfirmOpen(true)}
        >
          Trocar DNS
        </Button>
      </div>

      {/* Confirmação com prévia dos afetados */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle
                className={cn('size-5', isPlan ? 'text-amber-500' : 'text-rose-500')}
              />
              Confirmar troca de DNS
            </DialogTitle>
            <DialogDescription asChild>
              <div className='space-y-1 text-sm'>
                <p>
                  Trocar <strong className='text-foreground'>{impact}</strong>{' '}
                  usuário(s) de <strong>{fromLabel}</strong> para:
                </p>
                <p className='rounded-md bg-muted px-3 py-2 font-mono text-xs break-all'>
                  {target}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {!isPlan && (
            <div className='flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500'>
              <AlertTriangle className='mt-0.5 size-4 shrink-0' />
              <span>
                Estes clientes usam <strong>lista própria</strong>. Se o novo DNS
                não for do painel deles, o acesso quebra.
              </span>
            </div>
          )}

          {/* Prévia de QUEM será afetado */}
          {fromUrl !== ALL && fromUrl && (
            <div className='rounded-lg border bg-muted/30 p-2'>
              <p className='mb-1 px-1 text-xs font-medium text-muted-foreground'>
                Usuários afetados
              </p>
              <DnsUserList url={fromUrl} scope={scope} />
            </div>
          )}

          {notify && (
            <p className='text-xs text-muted-foreground'>
              Os afetados receberão um aviso no app.
            </p>
          )}
          <p className='text-xs text-muted-foreground'>
            Digite <strong>{confirmWord}</strong> para confirmar.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            autoFocus
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              disabled={confirmText.trim() !== confirmWord || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending && <Loader2 className='size-4 animate-spin' />}
              Trocar {impact} usuário(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageComposer({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className='mt-2 grid gap-2'>
      <Select
        value={MSG_PRESETS.find((m) => m.text === value)?.label ?? 'custom'}
        onValueChange={(label) => {
          const p = MSG_PRESETS.find((m) => m.label === label)
          if (p) onChange(p.text)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder='Escolher um modelo…' />
        </SelectTrigger>
        <SelectContent>
          {MSG_PRESETS.map((m) => (
            <SelectItem key={m.label} value={m.label}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={value}
        placeholder='Oi {NOME}! Atualizamos o servidor…'
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className='flex flex-wrap gap-1'>
        {PLACEHOLDERS.map((ph) => (
          <button
            key={ph}
            type='button'
            onClick={() => onChange(`${value}${ph}`)}
            className='rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground'
            title={`Inserir ${ph}`}
          >
            {ph}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function KnownDnsEditor({
  known,
  onSaved,
}: {
  known: KnownDns[]
  onSaved: () => void
}) {
  const [rows, setRows] = useState<KnownDns[]>(known)
  useEffect(() => {
    setRows(known)
  }, [known])

  const mut = useMutation({
    mutationFn: () => saveKnownDns(rows.filter((r) => r.url.trim())),
    onSuccess: () => {
      toast.success('DNS conhecidos salvos.')
      onSaved()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const setRow = (i: number, patch: Partial<KnownDns>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRow = () =>
    setRows((rs) => [...rs, { url: '', label: '', note: '', active: true }])
  const delRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i))

  return (
    <div className='rounded-2xl border bg-muted/40 p-5'>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-sm font-semibold'>DNS conhecidos</p>
        <Button variant='outline' size='sm' onClick={addRow}>
          <Plus className='size-4' /> Adicionar
        </Button>
      </div>
      <p className='mb-3 text-xs text-muted-foreground'>
        Lista curada de mirrors válidos — aparecem como atalho na troca.
      </p>

      {rows.length === 0 ? (
        <p className='text-xs text-muted-foreground'>Nenhum DNS cadastrado.</p>
      ) : (
        <div className='space-y-2'>
          {rows.map((r, i) => (
            <div key={i} className='flex flex-wrap items-center gap-2'>
              <Input
                className='w-56'
                placeholder='http://dns.sbs'
                value={r.url}
                onChange={(e) => setRow(i, { url: e.target.value })}
              />
              <Input
                className='w-40'
                placeholder='Apelido'
                value={r.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
              />
              <Input
                className='min-w-32 flex-1'
                placeholder='Obs (opcional)'
                value={r.note ?? ''}
                onChange={(e) => setRow(i, { note: e.target.value })}
              />
              <label className='flex items-center gap-1.5 text-xs'>
                <Checkbox
                  checked={r.active}
                  onCheckedChange={(v) => setRow(i, { active: v === true })}
                />
                ativo
              </label>
              {r.url.trim().length > 3 && <DnsTestButton dns={r.url} />}
              <Button
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-rose-500'
                onClick={() => delRow(i)}
              >
                <Trash2 className='size-4' />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className='mt-4 flex justify-end'>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className='size-4 animate-spin' />}
          Salvar DNS conhecidos
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function DnsHistory() {
  const q = useQuery({
    queryKey: ['dns-history'],
    queryFn: () => getDnsHistory(30),
  })
  const items = q.data?.items ?? []
  return (
    <div className='rounded-2xl border bg-muted/40 p-5'>
      <p className='mb-3 flex items-center gap-2 text-sm font-semibold'>
        <History className='size-4' /> Histórico de trocas
      </p>
      {q.isLoading ? (
        <Loader2 className='size-4 animate-spin text-muted-foreground' />
      ) : items.length === 0 ? (
        <p className='text-xs text-muted-foreground'>
          Nenhuma troca registrada ainda.
        </p>
      ) : (
        <div className='space-y-2'>
          {items.map((e) => (
            <DnsHistoryRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function DnsHistoryRow({ e }: { e: AuditEntry }) {
  const d = (e.details ?? {}) as Record<string, unknown>
  let desc: string
  if (e.action === 'admin_bulk_set_dns') {
    desc =
      `Troca em massa (${d.scope === 'app' ? 'só-app' : 'planos'}): ` +
      `${d.fromUrl ?? 'todos'} → ${d.toUrl ?? '?'} · ${d.changed ?? 0} usuário(s)` +
      (d.notified ? `, ${d.notified} avisado(s)` : '')
  } else if (e.action === 'admin_set_user_dns') {
    desc =
      `1 usuário${e.targetName ? ` (${e.targetName})` : ''} → ${d.toUrl ?? '?'}`
  } else if (e.action === 'admin_dns_save_known') {
    desc = `Lista de DNS conhecidos salva (${d.count ?? 0})`
  } else {
    desc = e.action
  }
  return (
    <div className='flex items-start justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm'>
      <div className='min-w-0'>
        <p className='truncate'>{desc}</p>
        <p className='text-xs text-muted-foreground'>
          por {e.adminName || e.adminId || '—'}
        </p>
      </div>
      <span className='shrink-0 text-xs text-muted-foreground'>
        {fmtDateTime(e.createdAt)}
      </span>
    </div>
  )
}
