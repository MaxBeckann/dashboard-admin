import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Ban,
  Coins,
  Copy,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Tv,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getIptvStats,
  getIptvSettings,
  iptvConsumption,
  iptvConversion,
  iptvDisable,
  iptvPendingProvisions,
  iptvProvision,
  iptvRetryProvision,
  listIptvLines,
  listUsers,
  reconcileSubscriptions,
  setIptvSettings,
  type IptvLine,
} from '@/lib/admin-api'
import { TELAS, buildPlanCode, planTitleFor, planLabel } from '@/lib/plans'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

function copy(text: string, label = 'Copiado!') {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error('Não foi possível copiar.')
  )
}
function isExpired(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now()
}
function lineStatus(l: IptvLine): { label: string; cls: string } {
  if (l.status === 'disabled')
    return { label: 'desativada', cls: 'border-rose-500/40 text-rose-500' }
  if (isExpired(l.expiresAt))
    return {
      label: 'vencida',
      cls: 'border-muted-foreground/40 text-muted-foreground',
    }
  return { label: 'ativa', cls: 'border-emerald-500/40 text-emerald-500' }
}

type Tab = 'lines' | 'consumption' | 'conversion' | 'settings'

export function Iptv() {
  const [tab, setTab] = useState<Tab>('lines')

  const statsQuery = useQuery({
    queryKey: ['iptv-stats'],
    queryFn: getIptvStats,
    refetchInterval: 20_000,
  })
  const s = statsQuery.data
  const threshold = s?.settings?.alertThreshold ?? 5
  const credits = s?.credits ?? null
  const creditBadge =
    credits === null
      ? { cls: 'text-muted-foreground', txt: '—' }
      : credits <= 0
        ? { cls: 'border-rose-500/40 text-rose-500', txt: 'sem ficha' }
        : credits <= threshold
          ? { cls: 'border-amber-500/40 text-amber-500', txt: 'baixo' }
          : { cls: 'border-emerald-500/40 text-emerald-500', txt: 'ok' }

  const TABS: [Tab, string][] = [
    ['lines', 'Linhas'],
    ['consumption', 'Consumo'],
    ['conversion', 'Conversão'],
    ['settings', 'Configurações'],
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
        <div className='mb-6'>
          <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
            <Tv className='size-6' /> IPTV
          </h1>
          <p className='text-muted-foreground'>
            Estoque de fichas, linhas geradas, consumo e conversão.
          </p>
        </div>

        <div className='rounded-2xl border bg-card p-4 sm:p-5'>
        {s && !s.panelOk && (
          <div className='mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500'>
            <AlertTriangle className='size-4 shrink-0' />
            <div>
              Não foi possível falar com o painel.
              {s.panelError && (
                <span className='ms-1 font-mono text-xs opacity-80'>
                  ({s.panelError})
                </span>
              )}
            </div>
          </div>
        )}

        {s?.settings?.salesPaused && (
          <div className='mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500'>
            <AlertTriangle className='size-4 shrink-0' />
            Vendas de <strong>App + Lista</strong> estão <strong>PAUSADAS</strong>{' '}
            (interruptor). Os clientes veem a mensagem de suporte.
          </div>
        )}

        <PendingProvisionsBanner />

        {/* KPIs */}
        <div className='mb-6 grid grid-cols-2 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:grid-cols-4 dark:*:data-[slot=card]:bg-muted/50'>
          <StatCard
            description='Fichas no painel'
            value={credits === null ? '—' : String(credits)}
            badge={
              <Badge variant='outline' className={cn('gap-1', creditBadge.cls)}>
                <Coins className='size-3' />
                {creditBadge.txt}
              </Badge>
            }
            footer='1 ficha = 1 mês'
            desc={
              credits !== null && credits <= 0
                ? 'Vendas App+Lista pausam sem ficha'
                : `alerta em ${threshold} fichas`
            }
          />
          <StatCard
            description='Linhas ativas'
            value={String(s?.lines.active ?? 0)}
            badge={<Badge variant='outline'>{s?.lines.total ?? 0} total</Badge>}
            footer='funcionando agora'
            desc={`${s?.lines.expired ?? 0} vencidas/inativas`}
          />
          <StatCard
            description='Testes 6h'
            value={String(s?.lines.test ?? 0)}
            badge={<Badge variant='outline'>grátis</Badge>}
            footer='linhas de teste'
            desc='não consomem ficha'
          />
          <StatCard
            description='Assinaturas (pagas)'
            value={String(s?.lines.full ?? 0)}
            badge={<Badge variant='outline'>App+Lista</Badge>}
            footer='linhas pagas'
            desc='consomem ficha'
          />
        </div>

        {/* Abas */}
        <div className='mb-4 flex w-fit gap-0.5 rounded-lg border p-0.5'>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type='button'
              onClick={() => setTab(k)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === k
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'lines' && <LinesTab />}
        {tab === 'consumption' && <ConsumptionTab />}
        {tab === 'conversion' && <ConversionTab />}
        {tab === 'settings' && <SettingsTab />}
        </div>
      </Main>
    </>
  )
}

// ───────────────────────── Aba: Linhas ─────────────────────────
function LinesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'test' | 'full'>('all')
  const linesQuery = useQuery({
    queryKey: ['iptv-lines'],
    queryFn: () => listIptvLines(),
    refetchInterval: 20_000,
  })
  const lines = linesQuery.data ?? []
  const filtered = lines.filter((l) =>
    filter === 'all' ? true : l.type === filter
  )

  const disableMut = useMutation({
    mutationFn: (userId: string) => iptvDisable(userId),
    onSuccess: () => {
      toast.success('Linha desativada.')
      qc.invalidateQueries({ queryKey: ['iptv-lines'] })
      qc.invalidateQueries({ queryKey: ['iptv-stats'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao desativar.'),
  })
  const provisionMut = useMutation({
    mutationFn: (l: IptvLine) => iptvProvision(l.accountId, { adult: l.adult }),
    onSuccess: () => {
      toast.success('Linha gerada/renovada.')
      qc.invalidateQueries({ queryKey: ['iptv-lines'] })
      qc.invalidateQueries({ queryKey: ['iptv-stats'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar.'),
  })

  return (
    <>
      <div className='mb-2 flex items-center justify-between gap-2'>
        <div className='flex gap-0.5 rounded-lg border p-0.5'>
          {(
            [
              ['all', 'Todas'],
              ['test', 'Testes'],
              ['full', 'Pagas'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type='button'
              onClick={() => setFilter(k)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                filter === k
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <SpendCreditsDialog />
      </div>

      <div className='overflow-hidden rounded-xl border bg-muted/50'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Login IPTV</TableHead>
              <TableHead>Servidor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className='text-end'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linesQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className='py-10 text-center'>
                  <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
                </TableCell>
              </TableRow>
            )}
            {!linesQuery.isLoading &&
              filtered.map((l) => (
                <LineRow
                  key={`${l.accountId}-${l.type}`}
                  l={l}
                  onDisable={() => disableMut.mutate(l.accountId)}
                  onProvision={() => provisionMut.mutate(l)}
                  busy={disableMut.isPending || provisionMut.isPending}
                />
              ))}
            {!linesQuery.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground py-10 text-center'
                >
                  Nenhuma linha ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

// ───────────────────────── Aba: Consumo ─────────────────────────
function ConsumptionTab() {
  const q = useQuery({
    queryKey: ['iptv-consumption'],
    queryFn: iptvConsumption,
    refetchInterval: 30_000,
  })
  const items = q.data?.items ?? []
  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardDescription>Fichas usadas (total)</CardDescription>
          <CardTitle className='text-3xl font-bold tabular-nums'>
            {q.data?.totalCreditsUsed ?? 0}
          </CardTitle>
        </CardHeader>
      </Card>
      <div className='overflow-hidden rounded-xl border bg-muted/50'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Fichas</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className='text-end'>Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className='py-10 text-center'>
                  <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading &&
              items.map((it, i) => (
                <TableRow key={`${it.accountId}-${i}`}>
                  <TableCell className='text-sm'>
                    <p className='font-medium'>{it.name || '(sem nome)'}</p>
                    <p className='text-muted-foreground text-xs'>
                      {it.email || it.accountId}
                    </p>
                  </TableCell>
                  <TableCell className='font-mono text-sm'>
                    {it.creditsUsed}
                  </TableCell>
                  <TableCell className='text-sm'>{planLabel(it.planId)}</TableCell>
                  <TableCell>
                    <Badge variant='outline' className='text-xs'>
                      {it.source || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-end text-sm'>
                    {format(new Date(it.createdAt), 'dd/MM/yy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            {!q.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground py-10 text-center'
                >
                  Nenhuma ficha usada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ───────────────────────── Aba: Conversão ─────────────────────────
function ConversionTab() {
  const q = useQuery({
    queryKey: ['iptv-conversion'],
    queryFn: iptvConversion,
    refetchInterval: 30_000,
  })
  const c = q.data
  return (
    <div className='grid gap-4 sm:grid-cols-3'>
      <Card>
        <CardHeader>
          <CardDescription className='flex items-center gap-1'>
            <TrendingUp className='size-4' /> Teste via cupom → comprou
          </CardDescription>
          <CardTitle className='text-4xl font-bold tabular-nums'>
            {c?.coupon.rate ?? 0}%
          </CardTitle>
          <CardAction>
            <Badge variant='outline'>
              {c?.coupon.converted ?? 0}/{c?.coupon.tested ?? 0}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='text-muted-foreground text-sm'>
          converteram em compra paga
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Qualquer teste → comprou</CardDescription>
          <CardTitle className='text-4xl font-bold tabular-nums'>
            {c?.all.rate ?? 0}%
          </CardTitle>
          <CardAction>
            <Badge variant='outline'>
              {c?.all.converted ?? 0}/{c?.all.tested ?? 0}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='text-muted-foreground text-sm'>
          inclui teste do app
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Contas com lista paga</CardDescription>
          <CardTitle className='text-4xl font-bold tabular-nums'>
            {c?.paid ?? 0}
          </CardTitle>
        </CardHeader>
        <CardFooter className='text-muted-foreground text-sm'>
          total de clientes pagantes
        </CardFooter>
      </Card>
    </div>
  )
}

// ───────────────────────── Aba: Configurações ─────────────────────────
function SettingsTab() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['iptv-settings'], queryFn: getIptvSettings })
  const [threshold, setThreshold] = useState<number | null>(null)

  const mut = useMutation({
    mutationFn: setIptvSettings,
    onSuccess: () => {
      toast.success('Configuração salva.')
      qc.invalidateQueries({ queryKey: ['iptv-settings'] })
      qc.invalidateQueries({ queryKey: ['iptv-stats'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const reconcileMut = useMutation({
    mutationFn: () => reconcileSubscriptions(7),
    onSuccess: (r) => {
      if (r.fixed > 0) {
        toast.success(
          `${r.fixed} assinatura(s) reativada(s) de ${r.checked} verificada(s).`
        )
      } else {
        toast.success(
          `Tudo certo — nenhuma assinatura presa (${r.checked} verificada(s)).`
        )
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao reconciliar.'),
  })

  const s = q.data
  const thr = threshold ?? s?.alertThreshold ?? 5

  if (q.isLoading || !s) {
    return (
      <div className='py-10 text-center'>
        <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
      </div>
    )
  }

  return (
    <div className='grid max-w-xl gap-4'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Interruptor geral</CardTitle>
          <CardDescription>
            Pausa as vendas de App + Lista (mesmo com fichas). O teste 6h grátis
            continua funcionando.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-between'>
          <span className='text-sm'>
            {s.salesPaused ? 'Vendas PAUSADAS' : 'Vendas ativas'}
          </span>
          <Switch
            checked={s.salesPaused}
            onCheckedChange={(v) => mut.mutate({ salesPaused: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Alerta de estoque</CardTitle>
          <CardDescription>
            Te avisa (painel + mensagem no app) quando as fichas chegarem nesse
            número.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-end gap-3'>
          <div className='grid gap-1.5'>
            <Label>Avisar quando restar</Label>
            <Input
              type='number'
              min={0}
              className='w-28'
              value={thr}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          <Button
            onClick={() => mut.mutate({ alertThreshold: thr })}
            disabled={mut.isPending}
          >
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card className='opacity-80'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Zap className='size-4' /> Comprar fichas automático
            <Badge variant='outline' className='text-xs'>
              em breve
            </Badge>
          </CardTitle>
          <CardDescription>
            Quando ligado, o sistema compra fichas sozinho ao acabar (via saldo
            Pix / Mercado Pago — pré-encaminhado, ativa depois da integração).
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-between'>
          <span className='text-sm'>
            {s.autoReplenish ? 'Ligado' : 'Desligado'}
          </span>
          <Switch
            checked={s.autoReplenish}
            onCheckedChange={(v) => mut.mutate({ autoReplenish: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Reconciliar assinaturas</CardTitle>
          <CardDescription>
            Rede de segurança: procura pagamentos <strong>pagos</strong> que não
            ativaram a assinatura (webhook falho) e ativa. Roda sozinho de tempos
            em tempos; aqui você força na hora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant='outline'
            onClick={() => reconcileMut.mutate()}
            disabled={reconcileMut.isPending}
          >
            {reconcileMut.isPending && <Loader2 className='animate-spin' />}
            Reconciliar agora
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ───────────────────────── Gastar fichas (gerar lista manual) ────────────────
function SpendCreditsDialog() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState('')
  const [userLabel, setUserLabel] = useState('')
  const [telas, setTelas] = useState(1)
  const [months, setMonths] = useState(1)
  const [adult, setAdult] = useState(false)

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
    enabled: open,
  })
  const users = usersQuery.data ?? []
  const filteredUsers = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return users.slice(0, 8)
    return users
      .filter(
        (u) =>
          (u.name || '').toLowerCase().includes(t) ||
          (u.email || '').toLowerCase().includes(t)
      )
      .slice(0, 8)
  }, [users, search])

  const mut = useMutation({
    mutationFn: () => {
      const planId = buildPlanCode('list', telas, months)
      return iptvProvision(userId, {
        planId,
        planTitle: planTitleFor('list', telas, months),
        months,
        adult,
      })
    },
    onSuccess: () => {
      toast.success('Lista gerada — fichas gastas!')
      setOpen(false)
      setUserId('')
      setUserLabel('')
      qc.invalidateQueries({ queryKey: ['iptv-lines'] })
      qc.invalidateQueries({ queryKey: ['iptv-stats'] })
      qc.invalidateQueries({ queryKey: ['iptv-consumption'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar.'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <Coins className='size-4' /> Gastar fichas
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Gerar lista paga (gasta fichas)</DialogTitle>
          <DialogDescription>
            Ativa App + Lista pra um cliente manualmente (venda por fora /
            brinde). Consome {months} ficha(s).
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Cliente</Label>
            {userId ? (
              <div className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'>
                <span className='truncate'>{userLabel}</span>
                <button
                  type='button'
                  className='text-muted-foreground hover:text-foreground text-xs'
                  onClick={() => {
                    setUserId('')
                    setUserLabel('')
                  }}
                >
                  trocar
                </button>
              </div>
            ) : (
              <>
                <div className='relative'>
                  <Search className='text-muted-foreground absolute start-2.5 top-2.5 size-4' />
                  <Input
                    className='ps-8'
                    placeholder='Buscar por nome ou e-mail…'
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className='max-h-44 overflow-y-auto rounded-lg border'>
                  {usersQuery.isLoading && (
                    <div className='py-4 text-center'>
                      <Loader2 className='text-muted-foreground mx-auto size-4 animate-spin' />
                    </div>
                  )}
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type='button'
                      onClick={() => {
                        setUserId(u.id)
                        setUserLabel(`${u.name || '(sem nome)'} · ${u.email}`)
                      }}
                      className='hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-start text-sm'
                    >
                      <Avatar className='size-6'>
                        <AvatarImage src={u.avatarUrl || '/default-avatar.jpg'} />
                        <AvatarFallback>
                          {getDisplayNameInitials(u.name || u.email || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <span className='min-w-0'>
                        <span className='block truncate font-medium'>
                          {u.name || '(sem nome)'}
                        </span>
                        <span className='text-muted-foreground block truncate text-xs'>
                          {u.email}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!usersQuery.isLoading && filteredUsers.length === 0 && (
                    <p className='text-muted-foreground py-4 text-center text-xs'>
                      Nenhum usuário.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-2'>
              <Label>Telas</Label>
              <Select
                value={String(telas)}
                onValueChange={(v) => setTelas(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TELAS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t} {t === 1 ? 'tela' : 'telas'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <Label>Duração</Label>
              <Select
                value={String(months)}
                onValueChange={(v) => setMonths(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 6, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? 'mês' : 'meses'} ({m} ficha
                      {m > 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <Checkbox
              checked={adult}
              onCheckedChange={(v) => setAdult(v === true)}
            />
            Com adultos 🔞
          </label>

          <Button
            onClick={() => mut.mutate()}
            disabled={!userId || mut.isPending}
          >
            {mut.isPending && <Loader2 className='animate-spin' />}
            Gerar lista ({months} ficha{months > 1 ? 's' : ''})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Pendências: pagou mas a lista não gerou → Regerar (zero falha silenciosa).
function PendingProvisionsBanner() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['iptv-pending'],
    queryFn: iptvPendingProvisions,
    refetchInterval: 20_000,
  })
  const items = q.data ?? []
  const retryMut = useMutation({
    mutationFn: (jobId: string) => iptvRetryProvision(jobId),
    onSuccess: () => {
      toast.success('Lista gerada!')
      qc.invalidateQueries({ queryKey: ['iptv-pending'] })
      qc.invalidateQueries({ queryKey: ['iptv-lines'] })
      qc.invalidateQueries({ queryKey: ['iptv-stats'] })
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : 'Ainda não deu — verifique o estoque.'
      ),
  })
  if (items.length === 0) return null
  return (
    <div className='mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4'>
      <div className='mb-2 flex items-center gap-2 text-sm font-semibold text-rose-500'>
        <AlertTriangle className='size-4' />
        {items.length} cliente(s) pagaram e a lista NÃO gerou — regere:
      </div>
      <div className='space-y-1.5'>
        {items.map((p) => (
          <div
            key={p.jobId}
            className='flex items-center justify-between gap-2 rounded-md bg-background/50 px-3 py-2 text-sm'
          >
            <div className='min-w-0'>
              <span className='font-medium'>{p.name || '(sem nome)'}</span>
              <span className='text-muted-foreground'> · {p.email || p.accountId}</span>
              <span className='text-muted-foreground text-xs'>
                {' '}
                — {p.reason}
                {p.attempts > 0 ? ` (${p.attempts} tentativa(s))` : ''}
              </span>
            </div>
            <Button
              size='sm'
              variant='outline'
              disabled={retryMut.isPending}
              onClick={() => retryMut.mutate(p.jobId)}
            >
              <RefreshCw className='size-3.5' /> Regerar
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineRow({
  l,
  onDisable,
  onProvision,
  busy,
}: {
  l: IptvLine
  onDisable: () => void
  onProvision: () => void
  busy: boolean
}) {
  const st = lineStatus(l)
  return (
    <TableRow>
      <TableCell>
        <div className='flex items-center gap-3'>
          <Avatar className='size-8'>
            <AvatarImage src='/default-avatar.jpg' alt={l.name || ''} />
            <AvatarFallback>
              {getDisplayNameInitials(l.name || l.email || '?')}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>
              {l.name || '(sem nome)'}
            </p>
            <p className='text-muted-foreground truncate text-xs'>
              {l.email || l.accountId}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className='flex flex-col gap-0.5 font-mono text-xs'>
          <button
            type='button'
            onClick={() => copy(l.username || '')}
            className='hover:text-foreground flex items-center gap-1'
            title='Copiar usuário'
          >
            {l.username || '—'} <Copy className='size-3 opacity-40' />
          </button>
          <button
            type='button'
            onClick={() => copy(l.password || '')}
            className='text-muted-foreground hover:text-foreground flex items-center gap-1'
            title='Copiar senha'
          >
            {l.password || '—'} <Copy className='size-3 opacity-40' />
          </button>
        </div>
      </TableCell>
      <TableCell
        className='max-w-[160px] truncate text-xs'
        title={l.serverUrl || ''}
      >
        {l.serverUrl || '—'}
      </TableCell>
      <TableCell>
        {l.type === 'test' ? (
          <Badge
            variant='outline'
            className='border-violet-500/40 text-violet-500'
          >
            teste
          </Badge>
        ) : (
          <Badge variant='outline'>
            pago{l.connections ? ` · ${l.connections}📺` : ''}
          </Badge>
        )}
        {l.adult && (
          <span className='ms-1' title='Com adultos'>
            🔞
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant='outline' className={st.cls}>
          {st.label}
        </Badge>
      </TableCell>
      <TableCell className='text-sm'>
        {l.expiresAt ? (
          <span className={cn(isExpired(l.expiresAt) && 'text-rose-500')}>
            {format(new Date(l.expiresAt), 'dd/MM/yy HH:mm')}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className='text-end'>
        {l.type === 'full' ? (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-foreground size-8'
              title='Gerar/Renovar'
              disabled={busy}
              onClick={onProvision}
            >
              <RefreshCw className='size-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-destructive size-8'
              title='Desativar'
              disabled={busy || l.status === 'disabled'}
              onClick={onDisable}
            >
              <Ban className='size-4' />
            </Button>
          </div>
        ) : (
          <span className='text-muted-foreground text-xs'>auto</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function StatCard({
  description,
  value,
  badge,
  footer,
  desc,
}: {
  description: string
  value: string
  badge: React.ReactNode
  footer: React.ReactNode
  desc: string
}) {
  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
          {value}
        </CardTitle>
        <CardAction>{badge}</CardAction>
      </CardHeader>
      <CardFooter className='flex-col items-start gap-1.5 text-sm'>
        <div className='line-clamp-1 flex gap-2 font-medium'>{footer}</div>
        <div className='text-muted-foreground'>{desc}</div>
      </CardFooter>
    </Card>
  )
}
