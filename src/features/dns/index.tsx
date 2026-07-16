import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  bulkSetDns,
  getDnsOverview,
  saveKnownDns,
  type DnsOverview,
  type KnownDns,
} from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Breakdown, Stat } from '@/features/financeiro/ui'

const ALL = '__all__'

export function Dns() {
  const qc = useQueryClient()
  const overviewQuery = useQuery({
    queryKey: ['dns-overview'],
    queryFn: getDnsOverview,
  })
  const data = overviewQuery.data
  const refresh = () => qc.invalidateQueries({ queryKey: ['dns-overview'] })

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
              Servidor da lista dos clientes. Troque o DNS de todos os planos de
              uma vez quando um mirror cair.
            </p>
          </div>
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

        <div className='space-y-6 rounded-2xl border bg-card p-4 sm:p-5'>
          {/* KPIs */}
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            <Stat
              label='Usuários de plano'
              value={data ? String(data.totals.planUsers) : '—'}
              sub='listas que nós geramos'
            />
            <Stat
              label='DNS em uso (planos)'
              value={data ? String(data.totals.distinctPlanDns) : '—'}
              sub='servidores distintos'
            />
            <Stat
              label='Usuários só-app'
              value={data ? String(data.totals.appUsers) : '—'}
              sub='lista própria (não trocar)'
            />
            <Stat
              label='DNS conhecidos'
              value={data ? String(data.known.length) : '—'}
              sub='lista curada'
            />
          </div>

          {/* Troca em massa */}
          <BulkSwapCard data={data} onDone={refresh} />

          {/* DNS em uso */}
          <div className='grid gap-4 lg:grid-cols-2'>
            <Breakdown
              title='Em uso — Planos (mais usados)'
              rows={(data?.planDns ?? []).map(
                (d) => [d.url, d.count] as [string, number]
              )}
            />
            <div>
              <Breakdown
                title='Em uso — Só-app (listas próprias)'
                rows={(data?.appDns ?? []).map(
                  (d) => [d.url, d.count] as [string, number]
                )}
              />
              <p className='mt-2 text-xs text-muted-foreground'>
                Só leitura — são listas dos próprios clientes; não trocamos.
              </p>
            </div>
          </div>

          {/* DNS conhecidos */}
          <KnownDnsEditor known={data?.known ?? []} onSaved={refresh} />
        </div>
      </Main>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function BulkSwapCard({
  data,
  onDone,
}: {
  data?: DnsOverview
  onDone: () => void
}) {
  const [fromUrl, setFromUrl] = useState<string>(ALL)
  const [toUrl, setToUrl] = useState<string>('')
  const [notify, setNotify] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const planDns = data?.planDns ?? []
  const knownActive = (data?.known ?? []).filter((k) => k.active)

  // Impacto vem direto do panorama (sem round-trip): quem está no DNS de origem.
  const impact = useMemo(() => {
    if (!data) return 0
    if (fromUrl === ALL) return data.totals.planUsers
    return planDns.find((d) => d.url === fromUrl)?.count ?? 0
  }, [data, fromUrl, planDns])

  const mut = useMutation({
    mutationFn: () =>
      bulkSetDns({
        fromUrl: fromUrl === ALL ? undefined : fromUrl,
        toUrl: toUrl.trim(),
        notify,
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
  const canApply = target.length > 3 && impact > 0
  const fromLabel = fromUrl === ALL ? 'todos os planos' : fromUrl

  return (
    <div className='rounded-2xl border bg-muted/40 p-5'>
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <ArrowRight className='size-4' /> Trocar DNS em massa
      </p>
      <p className='mt-1 text-xs text-muted-foreground'>
        Só afeta usuários de <strong>plano-com-lista</strong>. O novo DNS precisa
        ser um <strong>mirror válido do mesmo painel</strong> (as credenciais são
        as mesmas), senão a lista não abre.
      </p>

      <div className='mt-4 grid gap-4 sm:grid-cols-2'>
        {/* Origem */}
        <div>
          <Label className='text-xs'>Trocar de</Label>
          <Select value={fromUrl} onValueChange={setFromUrl}>
            <SelectTrigger className='mt-1'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os planos</SelectItem>
              {planDns.map((d) => (
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
        </div>
      </div>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox
            checked={notify}
            onCheckedChange={(v) => setNotify(v === true)}
          />
          Avisar os usuários afetados
        </label>
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>
            afeta <strong className='text-foreground'>{impact}</strong> usuário(s)
          </span>
          <Button
            disabled={!canApply}
            onClick={() => setConfirmOpen(true)}
          >
            Trocar DNS
          </Button>
        </div>
      </div>

      {/* Confirmação (digite TROCAR) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='size-5 text-amber-500' /> Confirmar troca
              de DNS
            </DialogTitle>
            <DialogDescription asChild>
              <div className='space-y-2 text-sm'>
                <p>
                  Vai trocar o DNS de{' '}
                  <strong className='text-foreground'>{impact}</strong>{' '}
                  usuário(s) de <strong>{fromLabel}</strong> para:
                </p>
                <p className='rounded-md bg-muted px-3 py-2 font-mono text-xs break-all'>
                  {target}
                </p>
                {notify && (
                  <p className='text-xs text-muted-foreground'>
                    Os usuários receberão um aviso no app.
                  </p>
                )}
                <p className='text-xs text-muted-foreground'>
                  Digite <strong>TROCAR</strong> para confirmar.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='TROCAR'
            autoFocus
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              disabled={confirmText.trim() !== 'TROCAR' || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending && <Loader2 className='size-4 animate-spin' />}
              Trocar de {impact} usuário(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // Sincroniza quando o panorama carrega/atualiza.
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
