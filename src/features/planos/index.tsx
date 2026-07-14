import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  applyPlanChange,
  getPlanChangeImpact,
  getPlanConfig,
  getPlanSales,
  setPlanConfig,
  type PlanChangeImpact,
  type PlanChangeUser,
  type PlanConfig,
} from '@/lib/admin-api'
import { buildPlanCode, planLabel } from '@/lib/plans'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const DEFAULT_NOTICE_LOCK =
  'Olá {NOME}! O valor do plano {PLANO} vai passar de {PRECO_ANTIGO} para ' +
  '{PRECO_NOVO}. Como você já é cliente, garantimos o seu preço atual na ' +
  'próxima renovação. 💚'
const DEFAULT_NOTICE_CHANGE =
  'Olá {NOME}! Informamos que o valor do plano {PLANO} vai mudar de ' +
  '{PRECO_ANTIGO} para {PRECO_NOVO} a partir da sua próxima renovação. ' +
  'Infelizmente não será possível manter o preço anterior. Obrigado pela ' +
  'compreensão! 💙'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

function brl(n: number) {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** ISO → valor do <input type="datetime-local"> (horário local). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const EMPTY_PROMO: NonNullable<PlanConfig['promo']> = {
  enabled: false,
  percent: 0,
  startsAt: null,
  endsAt: null,
  scope: 'all',
}
function round2(n: number) {
  return Math.round(n * 100) / 100
}
function priceOf(
  cfg: PlanConfig,
  fam: string,
  telas: number,
  months: number
): number {
  const v = cfg.prices?.[fam]?.[String(telas)]?.[String(months)]
  return typeof v === 'number' ? v : 0
}

type Warning = { level: 'error' | 'warn'; msg: string }

export function Planos() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['plan-config'], queryFn: getPlanConfig })
  const [cfg, setCfg] = useState<PlanConfig | null>(null)

  // Assistente de preenchimento (desconto % por duração).
  const [fill3, setFill3] = useState(5)
  const [fill6, setFill6] = useState(12)
  const [fill12, setFill12] = useState(20)
  // Telas escolhidas na prévia de cada família.
  const [previewTelas, setPreviewTelas] = useState<Record<string, number>>({})
  // Período do relatório de vendas (0 = tudo).
  const [salesDays, setSalesDays] = useState(0)
  const salesQuery = useQuery({
    queryKey: ['plan-sales', salesDays],
    queryFn: () => getPlanSales(salesDays),
  })
  // Fluxo de mudança de preço (impacto + travar/avisar clientes).
  const [changeInfo, setChangeInfo] = useState<{
    impacts: PlanChangeImpact[]
    priceMap: Record<string, { old: number; new: number }>
  } | null>(null)
  const [computing, setComputing] = useState(false)
  const [doLock, setDoLock] = useState(true)
  const [lockDays, setLockDays] = useState(0) // 0 = para sempre
  const [doNotify, setDoNotify] = useState(false)
  const [noticeTitle, setNoticeTitle] = useState('Aviso sobre o seu plano')
  const [noticeBody, setNoticeBody] = useState(DEFAULT_NOTICE_LOCK)
  const [applyMode, setApplyMode] = useState<'all' | 'some'>('all')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (q.data) {
      setCfg(structuredClone(q.data))
      setNoticeBody(q.data.noticeTemplate || DEFAULT_NOTICE_LOCK)
    }
  }, [q.data])

  const mut = useMutation({
    mutationFn: (c: PlanConfig) => setPlanConfig(c),
    onSuccess: () => {
      toast.success('Planos salvos. O app e o checkout já usam os novos valores.')
      qc.invalidateQueries({ queryKey: ['plan-config'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  // Códigos de plano cujo PREÇO mudou (comparando o salvo vs o editado).
  function changedPriceCodes(): {
    codes: string[]
    priceMap: Record<string, { old: number; new: number }>
  } {
    const priceMap: Record<string, { old: number; new: number }> = {}
    if (!q.data || !cfg) return { codes: [], priceMap }
    for (const fam of cfg.families) {
      for (const t of cfg.telas) {
        for (const d of cfg.durations) {
          const oldP = q.data.prices?.[fam.code]?.[String(t.n)]?.[String(d.months)]
          const newP = cfg.prices?.[fam.code]?.[String(t.n)]?.[String(d.months)]
          if (typeof oldP === 'number' && typeof newP === 'number' && oldP !== newP) {
            priceMap[buildPlanCode(fam.code, t.n, d.months)] = { old: oldP, new: newP }
          }
        }
      }
    }
    return { codes: Object.keys(priceMap), priceMap }
  }

  // Salvar: se mudou preço, mostra impacto nos clientes; senão salva direto.
  async function handleSave() {
    if (!cfg || hasError) return
    const { codes, priceMap } = changedPriceCodes()
    if (codes.length === 0) {
      mut.mutate(cfg)
      return
    }
    setComputing(true)
    try {
      const { impacts } = await getPlanChangeImpact(codes)
      setChangeInfo({ impacts, priceMap })
      setApplyMode('all')
      setSelectedUsers(new Set(impacts.flatMap((i) => i.users.map((u) => u.id))))
    } catch (e) {
      mut.mutate(cfg) // se o impacto falhar, salva mesmo assim
    } finally {
      setComputing(false)
    }
  }

  const applyMut = useMutation({
    mutationFn: () => {
      const codes = changeInfo ? changeInfo.impacts.map((i) => i.code) : []
      const c = structuredClone(cfg!)
      // Persiste a mensagem editada como novo padrão do cenário certo.
      if (doNotify) {
        if (doLock) c.noticeTemplate = noticeBody
        else c.noticeTemplateChange = noticeBody
      }
      return applyPlanChange({
        config: c,
        lockCodes: doLock ? codes : [],
        lockDurationDays: doLock ? lockDays : 0,
        userIds: applyMode === 'some' ? Array.from(selectedUsers) : undefined,
        notify: doNotify
          ? { title: noticeTitle, body: noticeBody, popup: 'full', codes }
          : null,
      })
    },
    onSuccess: (r) => {
      toast.success(
        `Salvo. Preço travado p/ ${r.locked} cliente(s), ${r.notified} avisado(s).`
      )
      qc.invalidateQueries({ queryKey: ['plan-config'] })
      setChangeInfo(null)
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao aplicar.'),
  })

  const fichaCost = cfg?.fichaCost ?? 9

  function patchFamily(i: number, patch: Partial<PlanConfig['families'][0]>) {
    setCfg((p) =>
      p
        ? { ...p, families: p.families.map((f, x) => (x === i ? { ...f, ...patch } : f)) }
        : p
    )
  }
  function patchTela(i: number, patch: Partial<PlanConfig['telas'][0]>) {
    setCfg((p) =>
      p ? { ...p, telas: p.telas.map((t, x) => (x === i ? { ...t, ...patch } : t)) } : p
    )
  }
  function patchDuration(i: number, patch: Partial<PlanConfig['durations'][0]>) {
    setCfg((p) =>
      p
        ? { ...p, durations: p.durations.map((d, x) => (x === i ? { ...d, ...patch } : d)) }
        : p
    )
  }
  function setPrice(fam: string, telas: number, months: number, value: number) {
    setCfg((p) => {
      if (!p) return p
      const prices = structuredClone(p.prices)
      if (!prices[fam]) prices[fam] = {}
      if (!prices[fam][String(telas)]) prices[fam][String(telas)] = {}
      prices[fam][String(telas)][String(months)] = value
      return { ...p, prices }
    })
  }

  // Preenche 3/6/12 meses a partir do preço mensal, aplicando os descontos.
  function applyFill() {
    setCfg((p) => {
      if (!p) return p
      const prices = structuredClone(p.prices)
      const disc: Record<number, number> = { 3: fill3, 6: fill6, 12: fill12 }
      for (const f of p.families) {
        for (const t of p.telas) {
          const base = prices[f.code]?.[String(t.n)]?.[String(1)]
          if (typeof base !== 'number' || base <= 0) continue
          for (const m of [3, 6, 12]) {
            if (!prices[f.code]) prices[f.code] = {}
            if (!prices[f.code][String(t.n)]) prices[f.code][String(t.n)] = {}
            prices[f.code][String(t.n)][String(m)] = round2(
              base * m * (1 - (disc[m] || 0) / 100)
            )
          }
        }
      }
      return { ...p, prices }
    })
    toast.success('Preços de 3/6/12 meses gerados a partir do mensal.')
  }

  // Aceita cupom de desconto por plano (default true).
  const acceptsDisc = (fam: string, telas: number, months: number) =>
    cfg?.acceptsDiscount?.[fam]?.[String(telas)]?.[String(months)] !== false
  function setAcceptsDisc(
    fam: string,
    telas: number,
    months: number,
    v: boolean
  ) {
    setCfg((p) => {
      if (!p) return p
      const acceptsDiscount = structuredClone(p.acceptsDiscount ?? {})
      if (!acceptsDiscount[fam]) acceptsDiscount[fam] = {}
      if (!acceptsDiscount[fam][String(telas)])
        acceptsDiscount[fam][String(telas)] = {}
      acceptsDiscount[fam][String(telas)][String(months)] = v
      return { ...p, acceptsDiscount }
    })
  }

  // Promoção agendada.
  const promo = cfg?.promo ?? EMPTY_PROMO
  function setPromo(patch: Partial<typeof EMPTY_PROMO>) {
    setCfg((p) => {
      if (!p) return p
      return { ...p, promo: { ...(p.promo ?? EMPTY_PROMO), ...patch } }
    })
  }
  const promoActive =
    promo.enabled &&
    (() => {
      const now = Date.now()
      const s = promo.startsAt ? new Date(promo.startsAt).getTime() : -Infinity
      const e = promo.endsAt ? new Date(promo.endsAt).getTime() : Infinity
      return now >= s && now <= e
    })()

  // Fichas/mês por telas (modelo do painel). SEVEN = 1 sempre.
  const fichasPer = (telas: number) => Number(cfg?.fichasPerTela?.[String(telas)] ?? 1)
  function setFichas(telas: number, value: number) {
    setCfg((p) => {
      if (!p) return p
      const fichasPerTela = { ...(p.fichasPerTela ?? {}) }
      fichasPerTela[String(telas)] = value
      return { ...p, fichasPerTela }
    })
  }

  // Margem: custo = fichas consumidas (meses × fichas/mês da telas) × custo-ficha.
  function marginOf(fam: string, telas: number, months: number) {
    const total = cfg ? priceOf(cfg, fam, telas, months) : 0
    const isList = fam === 'list'
    const cost = isList ? months * fichasPer(telas) * fichaCost : 0
    const profit = total - cost
    const pct = total > 0 ? (profit / total) * 100 : 0
    return { cost, profit, pct, isList }
  }

  // Guard-rails.
  const warnings = useMemo<Warning[]>(() => {
    if (!cfg) return []
    const out: Warning[] = []
    const fams = cfg.families.filter((f) => f.enabled)
    const tel = cfg.telas.filter((t) => t.enabled)
    const dur = cfg.durations.filter((d) => d.enabled)
    if (!fams.length)
      out.push({ level: 'warn', msg: 'Nenhuma família ativa — o cliente não vê plano nenhum.' })
    if (!tel.length) out.push({ level: 'warn', msg: 'Nenhuma tela ativa.' })
    if (!dur.length) out.push({ level: 'warn', msg: 'Nenhuma duração ativa.' })
    cfg.durations.forEach((d) => {
      if (d.popular && !d.enabled)
        out.push({ level: 'warn', msg: `"${d.label}" está em destaque, mas desligada.` })
    })
    for (const f of fams)
      for (const t of tel)
        for (const d of dur) {
          if (priceOf(cfg, f.code, t.n, d.months) <= 0)
            out.push({
              level: 'error',
              msg: `${f.title} · ${t.n} tela(s) · ${d.label} está ativo com preço R$ 0.`,
            })
        }
    for (const f of fams)
      for (const t of tel) {
        const ds = dur.slice().sort((a, b) => a.months - b.months)
        for (let i = 1; i < ds.length; i++) {
          const prev = priceOf(cfg, f.code, t.n, ds[i - 1].months) / ds[i - 1].months
          const cur = priceOf(cfg, f.code, t.n, ds[i].months) / ds[i].months
          if (cur > prev + 0.001)
            out.push({
              level: 'warn',
              msg: `${f.title} · ${t.n} tela(s): ${ds[i].label} sai mais caro por mês (R$ ${brl(cur)}) que ${ds[i - 1].label} (R$ ${brl(prev)}).`,
            })
        }
      }
    return out
  }, [cfg])
  const hasError = warnings.some((w) => w.level === 'error')

  if (q.isLoading || !cfg) {
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
          <div className='py-16 text-center'>
            <Loader2 className='text-muted-foreground mx-auto size-6 animate-spin' />
          </div>
        </Main>
      </>
    )
  }

  const saveBtn = (
    <Button
      onClick={handleSave}
      disabled={mut.isPending || computing || hasError}
    >
      {(mut.isPending || computing) && <Loader2 className='animate-spin' />}
      Salvar tudo
    </Button>
  )

  const totalAffected =
    changeInfo?.impacts.reduce((s, i) => s + i.count, 0) ?? 0

  // Lista única de clientes afetados (dedup entre planos) p/ seleção.
  // (cálculo simples, NÃO um hook — fica depois do early return de loading).
  const uniqueUsers: PlanChangeUser[] = (() => {
    const seen = new Map<string, PlanChangeUser>()
    changeInfo?.impacts.forEach((i) =>
      (i.users ?? []).forEach((u) => {
        if (!seen.has(u.id)) seen.set(u.id, u)
      })
    )
    return Array.from(seen.values())
  })()
  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Modelos de mensagem: garantido (travado) vs vai-mudar (sem travar).
  const lockTpl = cfg?.noticeTemplate || DEFAULT_NOTICE_LOCK
  const changeTpl = cfg?.noticeTemplateChange || DEFAULT_NOTICE_CHANGE
  const knownTpls = [lockTpl, changeTpl, DEFAULT_NOTICE_LOCK, DEFAULT_NOTICE_CHANGE]

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
        <div className='rounded-2xl border bg-card p-4 sm:p-5'>
        <div className='mb-6 flex items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Tags className='size-6' /> Planos
            </h1>
            <p className='text-muted-foreground'>
              Controle preços, nomes, telas, durações e selos. O app lê estes
              valores e o checkout cobra por eles.
            </p>
          </div>
          {saveBtn}
        </div>

        <div className='grid gap-6'>
          {/* Desempenho de vendas (lucro por plano) */}
          <Card>
            <CardHeader>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <TrendingUp className='size-4' /> Desempenho de vendas
                </CardTitle>
                <div className='flex gap-1'>
                  {[
                    [0, 'Tudo'],
                    [30, '30 dias'],
                    [7, '7 dias'],
                  ].map(([d, label]) => (
                    <button
                      key={d}
                      type='button'
                      onClick={() => setSalesDays(d as number)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        salesDays === d
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <CardDescription>
                Qual plano mais vende e mais lucra (faturamento − custo de fichas
                a R$ {brl(salesQuery.data?.fichaCost ?? 9)}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesQuery.isLoading ? (
                <div className='py-8 text-center'>
                  <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
                </div>
              ) : !salesQuery.data || salesQuery.data.plans.length === 0 ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  Nenhuma venda registrada no período.
                </p>
              ) : (
                <div className='grid gap-4'>
                  <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                    <div className='rounded-lg border bg-muted/50 p-3'>
                      <p className='text-muted-foreground text-xs'>Vendas</p>
                      <p className='text-xl font-bold'>
                        {salesQuery.data.totals.sales}
                      </p>
                    </div>
                    <div className='rounded-lg border bg-muted/50 p-3'>
                      <p className='text-muted-foreground text-xs'>Faturamento</p>
                      <p className='text-xl font-bold'>
                        R$ {brl(salesQuery.data.totals.revenue)}
                      </p>
                    </div>
                    <div className='rounded-lg border bg-muted/50 p-3'>
                      <p className='text-muted-foreground text-xs'>Custo fichas</p>
                      <p className='text-xl font-bold'>
                        R$ {brl(salesQuery.data.totals.cost)}
                      </p>
                    </div>
                    <div className='rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3'>
                      <p className='text-muted-foreground text-xs'>Lucro</p>
                      <p className='text-xl font-bold text-emerald-600 dark:text-emerald-400'>
                        R$ {brl(salesQuery.data.totals.profit)}
                      </p>
                    </div>
                  </div>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plano</TableHead>
                          <TableHead className='text-center'>Vendas</TableHead>
                          <TableHead className='text-end'>Faturamento</TableHead>
                          <TableHead className='text-end'>Custo</TableHead>
                          <TableHead className='text-end'>Lucro</TableHead>
                          <TableHead className='text-end'>Margem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesQuery.data.plans.map((p, i) => (
                          <TableRow key={p.planId}>
                            <TableCell className='font-medium'>
                              {i === 0 && (
                                <span className='mr-1 rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-600 dark:text-amber-400'>
                                  TOP
                                </span>
                              )}
                              {planLabel(p.planId)}
                            </TableCell>
                            <TableCell className='text-center'>{p.sales}</TableCell>
                            <TableCell className='text-end'>
                              R$ {brl(p.revenue)}
                            </TableCell>
                            <TableCell className='text-muted-foreground text-end'>
                              R$ {brl(p.cost)}
                            </TableCell>
                            <TableCell
                              className={`text-end font-medium ${p.profit < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}
                            >
                              R$ {brl(p.profit)}
                            </TableCell>
                            <TableCell className='text-end'>{p.marginPct}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avisos (guard-rails) */}
          {warnings.length > 0 && (
            <div className='grid gap-2'>
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                    w.level === 'error'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <AlertTriangle className='size-4 shrink-0' />
                  {w.msg}
                </div>
              ))}
              {hasError && (
                <p className='text-muted-foreground text-xs'>
                  Corrija os erros em vermelho para poder salvar.
                </p>
              )}
            </div>
          )}

          {/* Assistente + custo da ficha */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Wand2 className='size-4' /> Assistente de preços
              </CardTitle>
              <CardDescription>
                Preencha o preço <strong>mensal</strong> de cada plano abaixo e
                gere 3/6/12 meses com desconto num clique. Depois ajuste o que
                quiser.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap items-end gap-4'>
              <div className='grid gap-1'>
                <Label className='text-xs'>Desconto 3 meses (%)</Label>
                <Input
                  type='number'
                  min={0}
                  max={90}
                  className='h-9 w-24'
                  value={fill3}
                  onChange={(e) => setFill3(Number(e.target.value))}
                />
              </div>
              <div className='grid gap-1'>
                <Label className='text-xs'>Desconto 6 meses (%)</Label>
                <Input
                  type='number'
                  min={0}
                  max={90}
                  className='h-9 w-24'
                  value={fill6}
                  onChange={(e) => setFill6(Number(e.target.value))}
                />
              </div>
              <div className='grid gap-1'>
                <Label className='text-xs'>Desconto 12 meses (%)</Label>
                <Input
                  type='number'
                  min={0}
                  max={90}
                  className='h-9 w-24'
                  value={fill12}
                  onChange={(e) => setFill12(Number(e.target.value))}
                />
              </div>
              <Button variant='secondary' onClick={applyFill}>
                <Wand2 className='size-4' /> Preencher a partir do mensal
              </Button>
              <div className='ms-auto grid gap-1'>
                <Label className='text-xs'>Custo por ficha/crédito (R$)</Label>
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  className='h-9 w-28'
                  value={fichaCost}
                  onChange={(e) =>
                    setCfg((p) =>
                      p ? { ...p, fichaCost: Number(e.target.value) } : p
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Promoção agendada */}
          <Card
            className={promoActive ? 'border-amber-500/50 bg-amber-500/5' : ''}
          >
            <CardHeader>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  🔥 Promoção agendada
                  {promoActive && (
                    <span className='rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white'>
                      ATIVA AGORA
                    </span>
                  )}
                </CardTitle>
                <label className='flex items-center gap-2 text-sm'>
                  <Switch
                    checked={promo.enabled}
                    onCheckedChange={(v) => setPromo({ enabled: v })}
                  />
                  {promo.enabled ? 'Ligada' : 'Desligada'}
                </label>
              </div>
              <CardDescription>
                Desconto <strong>automático</strong> (sem cupom) numa janela de
                datas — liga e desliga sozinho (ex.: Black Friday). Vale pro app
                e pro checkout durante o período.
              </CardDescription>
            </CardHeader>
            {promo.enabled && (
              <CardContent className='flex flex-wrap items-end gap-4'>
                <div className='grid gap-1'>
                  <Label className='text-xs'>Desconto (%)</Label>
                  <Input
                    type='number'
                    min={0}
                    max={95}
                    className='h-9 w-24'
                    value={promo.percent}
                    onChange={(e) =>
                      setPromo({ percent: Number(e.target.value) })
                    }
                  />
                </div>
                <div className='grid gap-1'>
                  <Label className='text-xs'>Começa em</Label>
                  <Input
                    type='datetime-local'
                    className='h-9'
                    value={toLocalInput(promo.startsAt)}
                    onChange={(e) =>
                      setPromo({ startsAt: fromLocalInput(e.target.value) })
                    }
                  />
                </div>
                <div className='grid gap-1'>
                  <Label className='text-xs'>Termina em</Label>
                  <Input
                    type='datetime-local'
                    className='h-9'
                    value={toLocalInput(promo.endsAt)}
                    onChange={(e) =>
                      setPromo({ endsAt: fromLocalInput(e.target.value) })
                    }
                  />
                </div>
                <div className='grid gap-1'>
                  <Label className='text-xs'>Aplica a</Label>
                  <select
                    className='border-input bg-background h-9 rounded-md border px-2 text-sm'
                    value={promo.scope}
                    onChange={(e) =>
                      setPromo({
                        scope: e.target.value as 'all' | 'app' | 'list',
                      })
                    }
                  >
                    <option value='all'>Todos os planos</option>
                    <option value='list'>Só BOX COMPLETO</option>
                    <option value='app'>Só BOX PLAYER</option>
                  </select>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Consumo de fichas do painel */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Consumo de fichas (painel IPTV)</CardTitle>
              <CardDescription>
                Quantas fichas o painel gasta <strong>por mês</strong>, por telas.
                No SEVEN é <strong>1 ficha/mês</strong> seja qual for a tela — deixe
                tudo <strong>1</strong>. Se trocar de servidor e ele cobrar por
                conexão, ajuste aqui: a trava de estoque e a margem se adaptam
                sozinhas.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap items-end gap-4'>
              {cfg.telas.map((t) => (
                <div key={t.n} className='grid gap-1'>
                  <Label className='text-xs'>
                    {t.n} {t.n === 1 ? 'tela' : 'telas'} — fichas/mês
                  </Label>
                  <Input
                    type='number'
                    min={0}
                    step='1'
                    className='h-9 w-24'
                    value={fichasPer(t.n)}
                    onChange={(e) => setFichas(t.n, Number(e.target.value))}
                  />
                </div>
              ))}
              <p className='text-muted-foreground max-w-xs text-xs'>
                Ex.: linha de 3 telas por 3 meses = 3 × {fichasPer(3)} ={' '}
                <strong>{3 * fichasPer(3)} fichas</strong> → custo R${' '}
                {brl(3 * fichasPer(3) * fichaCost)}.
              </p>
            </CardContent>
          </Card>

          {/* Telas disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Telas disponíveis</CardTitle>
              <CardDescription>
                Quantas telas (dispositivos simultâneos) o cliente pode escolher.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-6'>
              {cfg.telas.map((t, i) => (
                <div key={t.n} className='flex items-center gap-2'>
                  <Switch
                    checked={t.enabled}
                    onCheckedChange={(v) => patchTela(i, { enabled: v })}
                  />
                  <span className='text-sm'>
                    {t.n} {t.n === 1 ? 'tela' : 'telas'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Durações */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Durações</CardTitle>
              <CardDescription>
                Ligue/desligue cada duração, edite o nome e o selo. Marque a que
                aparece em destaque.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid gap-3'>
                {cfg.durations.map((d, i) => (
                  <div
                    key={d.months}
                    className='flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3'
                  >
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) => patchDuration(i, { enabled: v })}
                    />
                    <span className='text-muted-foreground w-20 text-sm font-medium'>
                      {d.months} {d.months === 1 ? 'mês' : 'meses'}
                    </span>
                    <div className='grid gap-1'>
                      <Label className='text-xs'>Nome</Label>
                      <Input
                        className='h-8 w-36'
                        value={d.label}
                        onChange={(e) => patchDuration(i, { label: e.target.value })}
                      />
                    </div>
                    <div className='grid gap-1'>
                      <Label className='text-xs'>Selo (badge)</Label>
                      <Input
                        className='h-8 w-44'
                        placeholder='ex.: MAIS POPULAR'
                        value={d.badge}
                        onChange={(e) => patchDuration(i, { badge: e.target.value })}
                      />
                    </div>
                    <label className='flex items-center gap-2 text-sm'>
                      <Switch
                        checked={d.popular}
                        onCheckedChange={(v) => patchDuration(i, { popular: v })}
                      />
                      Destaque
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Uma tabela de preços + prévia por família */}
          {cfg.families.map((fam, fi) => {
            const pTelas = previewTelas[fam.code] ?? cfg.telas.find((t) => t.enabled)?.n ?? 1
            return (
              <Card key={fam.code}>
                <CardHeader>
                  <div className='flex flex-wrap items-end justify-between gap-4'>
                    <div className='flex flex-wrap items-end gap-4'>
                      <div className='grid gap-1'>
                        <Label className='text-xs'>Nome da família</Label>
                        <Input
                          className='h-9 w-52 font-semibold'
                          value={fam.title}
                          onChange={(e) => patchFamily(fi, { title: e.target.value })}
                        />
                      </div>
                      <div className='grid gap-1'>
                        <Label className='text-xs'>Subtítulo</Label>
                        <Input
                          className='h-9 w-72'
                          value={fam.subtitle}
                          onChange={(e) => patchFamily(fi, { subtitle: e.target.value })}
                        />
                      </div>
                    </div>
                    <label className='flex items-center gap-2 text-sm'>
                      <Switch
                        checked={fam.enabled}
                        onCheckedChange={(v) => patchFamily(fi, { enabled: v })}
                      />
                      {fam.enabled ? 'Ativa' : 'Oculta'}
                    </label>
                  </div>
                  <CardDescription className='pt-2'>
                    {fam.code === 'list'
                      ? 'App + lista IPTV inclusa — consome fichas do painel (ver seção de consumo).'
                      : 'Só app — o cliente usa a própria lista (sem custo de ficha).'}
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-5'>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telas \ Duração</TableHead>
                          {cfg.durations.map((d) => (
                            <TableHead key={d.months} className='text-center'>
                              {d.label}
                              <span className='text-muted-foreground block text-xs font-normal'>
                                {d.months} {d.months === 1 ? 'mês' : 'meses'}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cfg.telas.map((t) => (
                          <TableRow key={t.n}>
                            <TableCell className='font-medium whitespace-nowrap'>
                              {t.n} {t.n === 1 ? 'tela' : 'telas'}
                            </TableCell>
                            {cfg.durations.map((d) => {
                              const total = priceOf(cfg, fam.code, t.n, d.months)
                              const monthly = d.months > 0 ? total / d.months : total
                              const base1 = priceOf(cfg, fam.code, t.n, 1)
                              const pct =
                                d.months > 1 && base1 > 0
                                  ? Math.round((1 - monthly / base1) * 100)
                                  : 0
                              const m = marginOf(fam.code, t.n, d.months)
                              return (
                                <TableCell key={d.months} className='text-center'>
                                  <div className='flex flex-col items-center gap-1'>
                                    <div className='flex items-center gap-1'>
                                      <span className='text-muted-foreground text-xs'>
                                        R$
                                      </span>
                                      <Input
                                        type='number'
                                        min={0}
                                        step='0.01'
                                        className='h-8 w-24 text-center'
                                        value={total}
                                        onChange={(e) =>
                                          setPrice(
                                            fam.code,
                                            t.n,
                                            d.months,
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                    </div>
                                    <span className='text-muted-foreground text-[11px]'>
                                      R$ {brl(monthly)}/mês
                                      {pct > 0 ? ` · -${pct}%` : ''}
                                    </span>
                                    {m.isList && (
                                      <span
                                        className={`text-[11px] font-medium ${m.profit < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}
                                      >
                                        lucro R$ {brl(m.profit)} ({Math.round(m.pct)}%)
                                      </span>
                                    )}
                                    <button
                                      type='button'
                                      onClick={() =>
                                        setAcceptsDisc(
                                          fam.code,
                                          t.n,
                                          d.months,
                                          !acceptsDisc(fam.code, t.n, d.months)
                                        )
                                      }
                                      title='Aceita cupom de desconto?'
                                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                                        acceptsDisc(fam.code, t.n, d.months)
                                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-muted text-muted-foreground line-through'
                                      }`}
                                    >
                                      desconto
                                    </button>
                                  </div>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Prévia do card (como o cliente vê) */}
                  <div>
                    <div className='mb-2 flex items-center gap-3'>
                      <span className='text-muted-foreground text-xs font-medium uppercase'>
                        Prévia (como o cliente vê)
                      </span>
                      <div className='flex gap-1'>
                        {cfg.telas
                          .filter((t) => t.enabled)
                          .map((t) => (
                            <button
                              key={t.n}
                              type='button'
                              onClick={() =>
                                setPreviewTelas((prev) => ({ ...prev, [fam.code]: t.n }))
                              }
                              className={`rounded-full border px-3 py-1 text-xs ${
                                pTelas === t.n
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {t.n} {t.n === 1 ? 'tela' : 'telas'}
                            </button>
                          ))}
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-3'>
                      {cfg.durations
                        .filter((d) => d.enabled)
                        .map((d) => {
                          const total = priceOf(cfg, fam.code, pTelas, d.months)
                          const monthly = d.months > 0 ? total / d.months : total
                          return (
                            <div
                              key={d.months}
                              className={`w-40 rounded-xl border p-3 ${d.popular ? 'border-emerald-500/60 bg-emerald-500/5' : 'bg-muted/30'}`}
                            >
                              <div className='mb-1 h-5'>
                                {d.badge && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${d.popular ? 'bg-emerald-500 text-white' : 'bg-foreground/10'}`}
                                  >
                                    {d.badge}
                                  </span>
                                )}
                              </div>
                              <div className='text-xs font-semibold'>{fam.title}</div>
                              <div className='text-muted-foreground text-[10px]'>
                                {pTelas} {pTelas === 1 ? 'tela' : 'telas'} · {d.label}
                              </div>
                              <div className='mt-1 flex items-baseline gap-1'>
                                <span className='text-[11px]'>R$</span>
                                <span className='text-xl font-black'>
                                  {brl(monthly)}
                                </span>
                                <span className='text-muted-foreground text-[10px]'>
                                  /mês
                                </span>
                              </div>
                              <div className='text-muted-foreground text-[10px]'>
                                {d.months > 1
                                  ? `Total R$ ${brl(total)} em ${d.months} meses`
                                  : 'Cobrança única'}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <div className='flex items-center justify-end gap-3 pb-8'>
            <Button
              variant='outline'
              onClick={() => q.data && setCfg(structuredClone(q.data))}
              disabled={mut.isPending}
            >
              Reverter
            </Button>
            {saveBtn}
          </div>
        </div>
        </div>
      </Main>

      {/* Diálogo: mudança de preço → impacto nos clientes + travar/avisar */}
      <Dialog
        open={!!changeInfo}
        onOpenChange={(o) => !o && setChangeInfo(null)}
      >
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Users className='size-5' /> Você mudou preços
            </DialogTitle>
            <DialogDescription>
              {totalAffected === 0
                ? 'Nenhum cliente está nos planos alterados ainda — pode salvar tranquilo.'
                : `${totalAffected} cliente(s) estão nos planos que você alterou. O que fazer com eles?`}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='grid max-h-52 gap-2 overflow-y-auto'>
              {changeInfo?.impacts.map((imp) => {
                const pm = changeInfo.priceMap[imp.code]
                return (
                  <div key={imp.code} className='rounded-lg border bg-muted/50 p-3'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-sm font-medium'>
                        {planLabel(imp.code)}
                      </span>
                      <span className='text-xs whitespace-nowrap'>
                        R$ {brl(pm?.old ?? 0)} →{' '}
                        <strong>R$ {brl(pm?.new ?? 0)}</strong>
                      </span>
                    </div>
                    <div className='mt-2 flex items-center gap-2'>
                      <div className='flex -space-x-2'>
                        {imp.users.slice(0, 5).map((s, i) => (
                          <Avatar key={i} className='size-6 border'>
                            <AvatarImage src={s.avatarUrl || '/default-avatar.jpg'} />
                            <AvatarFallback>
                              {(s.name || '?').slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className='text-muted-foreground text-xs'>
                        {imp.count === 0
                          ? 'nenhum cliente'
                          : `${imp.count} cliente(s)`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {uniqueUsers.length > 0 && (
              <div className='grid gap-2'>
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <span className='text-muted-foreground'>Aplicar a:</span>
                  {(['all', 'some'] as const).map((m) => (
                    <button
                      key={m}
                      type='button'
                      onClick={() => setApplyMode(m)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        applyMode === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {m === 'all' ? 'Todos os clientes' : 'Escolher'}
                    </button>
                  ))}
                  {applyMode === 'some' && (
                    <span className='text-muted-foreground text-xs'>
                      {selectedUsers.size}/{uniqueUsers.length} selecionados
                    </span>
                  )}
                </div>
                {applyMode === 'some' && (
                  <div className='grid gap-1'>
                    <div className='flex gap-3 text-xs'>
                      <button
                        type='button'
                        onClick={() =>
                          setSelectedUsers(new Set(uniqueUsers.map((u) => u.id)))
                        }
                        className='text-muted-foreground hover:text-foreground'
                      >
                        marcar todos
                      </button>
                      <button
                        type='button'
                        onClick={() => setSelectedUsers(new Set())}
                        className='text-muted-foreground hover:text-foreground'
                      >
                        limpar
                      </button>
                    </div>
                    <div className='grid max-h-40 gap-0.5 overflow-y-auto rounded-lg border p-2'>
                      {uniqueUsers.map((u) => (
                        <label
                          key={u.id}
                          className='hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm'
                        >
                          <Checkbox
                            checked={selectedUsers.has(u.id)}
                            onCheckedChange={() => toggleUser(u.id)}
                          />
                          <Avatar className='size-6'>
                            <AvatarImage src={u.avatarUrl || '/default-avatar.jpg'} />
                            <AvatarFallback>
                              {(u.name || '?').slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className='truncate'>{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className='flex items-start gap-2 text-sm'>
              <Checkbox
                checked={doLock}
                onCheckedChange={(v) => {
                  const nv = !!v
                  setDoLock(nv)
                  // Troca o modelo da mensagem se ainda não foi customizada.
                  setNoticeBody((cur) =>
                    knownTpls.includes(cur) ? (nv ? lockTpl : changeTpl) : cur
                  )
                }}
                className='mt-0.5'
              />
              <span>
                <ShieldCheck className='inline size-4 text-emerald-500' />{' '}
                <strong>Travar o preço anterior</strong> pra esses clientes —
                fidelidade: eles renovam pelo preço antigo, só os novos pagam o
                preço novo.
              </span>
            </label>

            {doLock && (
              <div className='ms-6 flex flex-wrap items-center gap-2 text-xs'>
                <span className='text-muted-foreground'>Garantir por:</span>
                {[
                  [0, 'Sempre'],
                  [90, '3 meses'],
                  [180, '6 meses'],
                  [365, '12 meses'],
                ].map(([d, l]) => (
                  <button
                    key={l}
                    type='button'
                    onClick={() => setLockDays(d as number)}
                    className={`rounded-full border px-2.5 py-0.5 ${
                      lockDays === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <span className='text-muted-foreground'>ou</span>
                <Input
                  type='number'
                  min={0}
                  className='h-7 w-20'
                  placeholder='dias'
                  value={[0, 90, 180, 365].includes(lockDays) ? '' : lockDays}
                  onChange={(e) => setLockDays(Number(e.target.value) || 0)}
                />
                <span className='text-muted-foreground'>dias</span>
              </div>
            )}

            {!doLock && (
              <div className='flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400'>
                <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                Sem travar, <strong>&nbsp;o preço sobe também para quem já é
                cliente&nbsp;</strong> na próxima renovação. Marque "Avisar" para
                enviar o comunicado de que o valor vai mudar.
              </div>
            )}

            <label className='flex items-start gap-2 text-sm'>
              <Checkbox
                checked={doNotify}
                onCheckedChange={(v) => setDoNotify(!!v)}
                className='mt-0.5'
              />
              <span>
                <strong>Avisar por mensagem</strong> no app{' '}
                {doLock ? '(preço garantido)' : '(preço vai mudar)'}.
              </span>
            </label>

            {doNotify && (
              <div className='grid gap-2 rounded-lg border bg-muted/50 p-3'>
                <div className='grid gap-1'>
                  <Label className='text-xs'>Título</Label>
                  <Input
                    className='h-8'
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                  />
                </div>
                <div className='grid gap-1'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs'>Mensagem</Label>
                    <div className='flex gap-1'>
                      <button
                        type='button'
                        onClick={() => setNoticeBody(lockTpl)}
                        className='text-muted-foreground hover:text-foreground rounded border px-2 py-0.5 text-[10px]'
                      >
                        Modelo: preço garantido
                      </button>
                      <button
                        type='button'
                        onClick={() => setNoticeBody(changeTpl)}
                        className='text-muted-foreground hover:text-foreground rounded border px-2 py-0.5 text-[10px]'
                      >
                        Modelo: preço vai mudar
                      </button>
                    </div>
                  </div>
                  <Textarea
                    rows={4}
                    value={noticeBody}
                    onChange={(e) => setNoticeBody(e.target.value)}
                  />
                  <p className='text-muted-foreground text-[11px]'>
                    Placeholders: {'{NOME}'} {'{PLANO}'} {'{PRECO_ANTIGO}'}{' '}
                    {'{PRECO_NOVO}'}. Esta mensagem vira o padrão pras próximas.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              onClick={() => {
                setChangeInfo(null)
                if (cfg) mut.mutate(cfg)
              }}
              disabled={applyMut.isPending}
            >
              Salvar sem travar
            </Button>
            <Button onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              {applyMut.isPending && <Loader2 className='animate-spin' />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
