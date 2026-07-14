import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Copy,
  Infinity as InfinityIcon,
  Loader2,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { CampanhasRoi } from './campanhas-roi'
import {
  couponRedemptions,
  createCoupons,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  type Coupon,
} from '@/lib/admin-api'
import { PLAN_PRESETS } from '@/lib/plans'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
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

/** Modelos prontos de mensagem de boas-vindas (mostrada no app após resgatar). */
const MESSAGE_PRESETS: { label: string; text: string }[] = [
  { label: 'Sem mensagem', text: '' },
  {
    label: 'Padrão',
    text: 'Oi {NOME}! 🎉 Seu código foi ativado — você ganhou {DIAS} dias de acesso, válido até {VALIDADE}. Aproveite!',
  },
  {
    label: 'Empolgada',
    text: 'Eaí {NOME}! 🍿 Tá liberado! São {DIAS} dias de filmes, séries e canais te esperando. Bom divertimento!',
  },
  {
    label: 'Formal',
    text: 'Olá {NOME}. Seu acesso {PLANO} foi ativado com sucesso, válido até {VALIDADE}. Boa experiência!',
  },
  {
    label: 'Promoção',
    text: 'Boas-vindas, {NOME}! 🎁 Você resgatou {DIAS} dias grátis no {PLANO}. Corre que o catálogo é enorme!',
  },
  {
    label: 'Acesso total',
    text: 'Você desbloqueou o ACESSO TOTAL. Explore todo o catálogo sem restrições!',
  },
]

/** Selos prontos pra pílula azul da tela cheia. */
const BADGE_PRESETS = [
  'PRESENTE DE BOAS-VINDAS 🎁',
  'BEM-VINDO! 👋',
  'ACESSO LIBERADO ✅',
  'OFERTA ESPECIAL 🔥',
  'CÓDIGO ATIVADO 🎟️',
]

const PLACEHOLDERS = ['{NOME}', '{DIAS}', '{VALIDADE}', '{PLANO}', '{TELAS}']

/** Substitui placeholders por valores de exemplo, pra o preview. */
function previewMessage(
  tpl: string,
  sample: { days: number; plan: string; screens: number; expiry: string }
) {
  return tpl
    .replace(/\{NOME\}/gi, 'João')
    .replace(/\{DIAS\}/gi, String(sample.days))
    .replace(/\{VALIDADE\}/gi, sample.expiry)
    .replace(/\{PLANO\}/gi, sample.plan)
    .replace(/\{TELAS\}/gi, String(sample.screens))
}

function isExpired(c: Coupon) {
  return !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()
}

function statusOf(c: Coupon): { label: string; cls: string } {
  if (!c.active)
    return { label: 'Inativo', cls: 'border-amber-500/40 text-amber-500' }
  if (isExpired(c))
    return { label: 'Expirado', cls: 'border-rose-500/40 text-rose-500' }
  if (c.exhausted)
    return { label: 'Esgotado', cls: 'border-rose-500/40 text-rose-500' }
  return { label: 'Disponível', cls: 'border-emerald-500/40 text-emerald-500' }
}

type FilterKey = 'all' | 'available' | 'exhausted' | 'inactive'

export function Coupons() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'codigos' | 'roi'>('codigos')
  const [filter, setFilter] = useState<FilterKey>('all')

  const [couponType, setCouponType] = useState<'free_days' | 'discount'>(
    'free_days'
  )
  const [codeMode, setCodeMode] = useState<'auto' | 'custom'>('auto')
  const [customCode, setCustomCode] = useState('')
  const [discountPercent, setDiscountPercent] = useState(20)
  const [perUserLimit, setPerUserLimit] = useState(1)
  const [discountTarget, setDiscountTarget] = useState('') // '' = qualquer plano

  const [planCode, setPlanCode] = useState(PLAN_PRESETS[0].code)
  const [days, setDays] = useState(PLAN_PRESETS[0].days)
  const [quantity, setQuantity] = useState(10)
  const [maxUses, setMaxUses] = useState(1)
  const [unlimited, setUnlimited] = useState(false)
  const [expires, setExpires] = useState('') // 'YYYY-MM-DD'
  const [note, setNote] = useState('')
  const [welcomeMsg, setWelcomeMsg] = useState('')
  const [welcomeStyle, setWelcomeStyle] = useState<'pop' | 'fullscreen'>('pop')
  const [badge, setBadge] = useState(BADGE_PRESETS[0])
  const [lastCodes, setLastCodes] = useState<string[]>([])

  const listQuery = useQuery({
    queryKey: ['coupons'],
    queryFn: () => listCoupons(),
    refetchInterval: 10_000, // auto-atualiza sem F5
    refetchOnWindowFocus: true,
  })
  const coupons = listQuery.data ?? []

  const availableCount = coupons.filter(
    (c) => c.active && !c.exhausted && !isExpired(c)
  ).length
  const usedCount = coupons.length - availableCount

  const filtered = coupons.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'available')
      return c.active && !c.exhausted && !isExpired(c)
    if (filter === 'exhausted') return c.exhausted || isExpired(c)
    if (filter === 'inactive') return !c.active
    return true
  })

  const createMut = useMutation({
    mutationFn: () => {
      const expiresAt = expires
        ? new Date(`${expires}T23:59:59`).toISOString()
        : undefined
      const maxUsesVal = unlimited ? 0 : Math.max(maxUses, 1)
      const custom =
        codeMode === 'custom' ? customCode.trim() || undefined : undefined
      const qty = codeMode === 'custom' ? 1 : quantity
      if (couponType === 'discount') {
        const p = discountTarget
          ? PLAN_PRESETS.find((x) => x.code === discountTarget)
          : null
        return createCoupons({
          type: 'discount',
          customCode: custom,
          discountPercent: Math.min(Math.max(discountPercent, 1), 95),
          perUserLimit: Math.max(perUserLimit, 1),
          planName: p?.code, // undefined = qualquer plano
          planTitle: p?.title,
          maxProfiles: p?.maxProfiles,
          days: 0,
          quantity: qty,
          maxUses: maxUsesVal,
          expiresAt,
          note: note.trim() || undefined,
        })
      }
      const p = PLAN_PRESETS.find((x) => x.code === planCode)
      return createCoupons({
        customCode: custom,
        planName: p?.code,
        planTitle: p?.title,
        maxProfiles: p?.maxProfiles,
        days,
        quantity: qty,
        maxUses: maxUsesVal,
        expiresAt,
        note: note.trim() || undefined,
        welcomeMessage: welcomeMsg.trim() || undefined,
        welcomeStyle: welcomeMsg.trim() ? welcomeStyle : undefined,
        welcomeBadge:
          welcomeMsg.trim() && welcomeStyle === 'fullscreen' ? badge : undefined,
      })
    },
    onSuccess: (r) => {
      setLastCodes(r.codes)
      toast.success(`${r.created} código(s) gerado(s).`)
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar.'),
  })

  const deleteMut = useMutation({
    mutationFn: (code: string) => deleteCoupon(code),
    onSuccess: () => {
      toast.success('Cupom apagado.')
      qc.invalidateQueries({ queryKey: ['coupons'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao apagar.'),
  })

  const toggleMut = useMutation({
    mutationFn: (c: Coupon) => updateCoupon(c.code, { active: !c.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar.'),
  })

  const plan = PLAN_PRESETS.find((x) => x.code === planCode)
  const sampleExpiry = format(
    new Date(Date.now() + Math.max(days, 1) * 86400000),
    'dd/MM/yyyy'
  )

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
            <Ticket className='size-6' /> Cupons
          </h1>
          <p className='text-muted-foreground'>
            Gere códigos de acesso com limite de usos, validade e liga/desliga.
            O cliente ativa no app.
          </p>
        </div>

        {/* Abas: Códigos | Campanhas (ROI) */}
        <nav className='mb-5 inline-flex items-center gap-1 rounded-xl border bg-card p-1'>
          {(
            [
              ['codigos', 'Códigos'],
              ['roi', 'Campanhas (ROI)'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type='button'
              onClick={() => setTab(k)}
              className={
                tab === k
                  ? 'rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground shadow-sm'
                  : 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              }
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'roi' && (
          <div className='rounded-2xl border bg-card p-4 sm:p-5'>
            <CampanhasRoi />
          </div>
        )}

        <div
          className='rounded-2xl border bg-card p-4 sm:p-5'
          hidden={tab !== 'codigos'}
        >
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* ===== Gerar ===== */}
          <Card className='lg:col-span-1 bg-muted/50'>
            <CardHeader>
              <CardTitle className='text-base'>Gerar códigos</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              {/* Tipo de cupom */}
              <div className='grid gap-2'>
                <Label>Tipo de cupom</Label>
                <div className='flex gap-2'>
                  {(
                    [
                      ['free_days', 'Dias grátis'],
                      ['discount', 'Desconto %'],
                    ] as const
                  ).map(([t, l]) => (
                    <button
                      key={t}
                      type='button'
                      onClick={() => setCouponType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        couponType === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo do código */}
              <div className='grid gap-2'>
                <Label>Código</Label>
                <div className='flex gap-2'>
                  {(
                    [
                      ['auto', 'Automático'],
                      ['custom', 'Personalizado'],
                    ] as const
                  ).map(([m, l]) => (
                    <button
                      key={m}
                      type='button'
                      onClick={() => setCodeMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        codeMode === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {codeMode === 'custom' && (
                  <>
                    <Input
                      placeholder='EX.: BLACKFRIDAY50'
                      value={customCode}
                      onChange={(e) =>
                        setCustomCode(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9._-]/g, '')
                        )
                      }
                    />
                    <p className='text-muted-foreground text-xs'>
                      Você digita o código (letras/números). Gera <strong>1</strong>{' '}
                      código só. Se já existir, avisa.
                    </p>
                  </>
                )}
              </div>

              {couponType === 'free_days' ? (
                <>
                  <div className='grid gap-2'>
                    <Label>Plano</Label>
                    <Select
                      value={planCode}
                      onValueChange={(v) => {
                        setPlanCode(v)
                        const p = PLAN_PRESETS.find((x) => x.code === v)
                        if (p) setDays(p.days)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_PRESETS.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='grid gap-2'>
                      <Label>Dias grátis</Label>
                      <Input
                        type='number'
                        min={1}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label>Qtd. de códigos</Label>
                      <Input
                        type='number'
                        min={1}
                        max={500}
                        value={codeMode === 'custom' ? 1 : quantity}
                        disabled={codeMode === 'custom'}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='grid gap-2'>
                      <Label>% de desconto</Label>
                      <Input
                        type='number'
                        min={1}
                        max={95}
                        value={discountPercent}
                        onChange={(e) =>
                          setDiscountPercent(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className='grid gap-2'>
                      <Label>Usos por pessoa</Label>
                      <Input
                        type='number'
                        min={1}
                        value={perUserLimit}
                        onChange={(e) => setPerUserLimit(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className='grid gap-2'>
                    <Label>Plano alvo</Label>
                    <Select
                      value={discountTarget || '__any__'}
                      onValueChange={(v) =>
                        setDiscountTarget(v === '__any__' ? '' : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__any__'>Qualquer plano</SelectItem>
                        {PLAN_PRESETS.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                      Só funciona no plano escolhido (ou em qualquer um). O plano
                      ainda precisa "aceitar desconto" na aba Planos.
                    </p>
                  </div>
                  <div className='grid gap-2'>
                    <Label>Qtd. de códigos</Label>
                    <Input
                      type='number'
                      min={1}
                      max={500}
                      value={codeMode === 'custom' ? 1 : quantity}
                      disabled={codeMode === 'custom'}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </div>
                </>
              )}

              {/* Limite de usos por código */}
              <div className='grid gap-2'>
                <Label>Limite de usos (por código)</Label>
                <div className='flex items-center gap-3'>
                  <Input
                    type='number'
                    min={1}
                    value={maxUses}
                    disabled={unlimited}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className='flex-1'
                  />
                  <label className='flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap'>
                    <Checkbox
                      checked={unlimited}
                      onCheckedChange={(v) => setUnlimited(v === true)}
                    />
                    Ilimitado
                  </label>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Quantas contas diferentes podem resgatar cada código. Ex.:{' '}
                  <strong>1 código pra 10 pessoas</strong> = qtd. 1 · limite 10.
                </p>
              </div>

              <div className='grid gap-2'>
                <Label>
                  Validade{' '}
                  <span className='text-xs font-normal text-muted-foreground'>
                    (opcional)
                  </span>
                </Label>
                <Input
                  type='date'
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </div>

              <div className='grid gap-2'>
                <Label>
                  Nota{' '}
                  <span className='text-xs font-normal text-muted-foreground'>
                    (opcional)
                  </span>
                </Label>
                <Input
                  value={note}
                  placeholder='ex: campanha julho'
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Mensagem de boas-vindas (só p/ cupom de dias grátis) */}
              {couponType === 'free_days' && (
              <div className='grid gap-2'>
                <Label>
                  Mensagem de boas-vindas{' '}
                  <span className='text-xs font-normal text-muted-foreground'>
                    (opcional)
                  </span>
                </Label>
                <Select
                  value={
                    MESSAGE_PRESETS.find((m) => m.text === welcomeMsg)?.label ??
                    'custom'
                  }
                  onValueChange={(label) => {
                    const p = MESSAGE_PRESETS.find((m) => m.label === label)
                    if (p) setWelcomeMsg(p.text)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Escolher um modelo…' />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_PRESETS.map((m) => (
                      <SelectItem key={m.label} value={m.label}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={welcomeMsg}
                  placeholder='Oi {NOME}! Você ganhou {DIAS} dias…'
                  rows={3}
                  onChange={(e) => setWelcomeMsg(e.target.value)}
                />
                <div className='flex flex-wrap gap-1'>
                  {PLACEHOLDERS.map((ph) => (
                    <button
                      key={ph}
                      type='button'
                      onClick={() => setWelcomeMsg((m) => `${m}${ph}`)}
                      className='text-muted-foreground hover:text-foreground rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]'
                      title={`Inserir ${ph}`}
                    >
                      {ph}
                    </button>
                  ))}
                </div>
                {welcomeMsg.trim() && (
                  <>
                    <div className='rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5'>
                      <p className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase'>
                        Prévia no app
                      </p>
                      <p className='text-sm'>
                        {previewMessage(welcomeMsg, {
                          days,
                          plan: plan?.title || 'BOX+',
                          screens: plan?.maxProfiles || 1,
                          expiry: sampleExpiry,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs'>
                        Como aparece no app
                      </p>
                      <div className='flex gap-0.5 rounded-lg border p-0.5'>
                        {(
                          [
                            ['pop', '💬 Pop (card)'],
                            ['fullscreen', '🎉 Tela cheia'],
                          ] as const
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type='button'
                            onClick={() => setWelcomeStyle(k)}
                            className={cn(
                              'flex-1 rounded-md px-2 py-1.5 text-xs transition-colors',
                              welcomeStyle === k
                                ? 'bg-muted text-foreground font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selo (pílula azul) — só na tela cheia */}
                    {welcomeStyle === 'fullscreen' && (
                      <div className='grid gap-2'>
                        <Label>
                          Selo{' '}
                          <span className='text-xs font-normal text-muted-foreground'>
                            (a pílula azul)
                          </span>
                        </Label>
                        <Input
                          value={badge}
                          placeholder='PRESENTE DE BOAS-VINDAS 🎁'
                          onChange={(e) => setBadge(e.target.value)}
                        />
                        <div className='flex flex-wrap gap-1'>
                          {BADGE_PRESETS.map((b) => (
                            <button
                              key={b}
                              type='button'
                              onClick={() => setBadge(b)}
                              className='text-muted-foreground hover:text-foreground rounded border bg-muted/40 px-1.5 py-0.5 text-[11px]'
                            >
                              {b}
                            </button>
                          ))}
                          <button
                            type='button'
                            onClick={() => setBadge('')}
                            className='text-muted-foreground hover:text-foreground rounded border bg-muted/40 px-1.5 py-0.5 text-[11px]'
                          >
                            Sem selo
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

              <Button
                onClick={() => createMut.mutate()}
                disabled={
                  createMut.isPending ||
                  (codeMode === 'custom'
                    ? customCode.trim().length < 3
                    : quantity < 1) ||
                  (couponType === 'free_days'
                    ? !plan || days < 1
                    : discountPercent < 1)
                }
              >
                {createMut.isPending && <Loader2 className='animate-spin' />}
                Gerar {codeMode === 'custom' ? 1 : quantity} código(s)
              </Button>

              {lastCodes.length > 0 && (
                <div className='rounded-lg border bg-muted/40 p-3'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {lastCodes.length} gerado(s)
                    </p>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        copy(lastCodes.join('\n'), 'Códigos copiados!')
                      }
                    >
                      <Copy className='size-3.5' /> Copiar todos
                    </Button>
                  </div>
                  <div className='flex max-h-40 flex-col gap-1 overflow-y-auto font-mono text-sm'>
                    {lastCodes.map((c) => (
                      <button
                        key={c}
                        type='button'
                        onClick={() => copy(c)}
                        className='rounded px-1 text-start hover:bg-muted'
                        title='Copiar'
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Lista ===== */}
          <Card className='lg:col-span-2 bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between gap-2'>
              <CardTitle className='text-base'>
                Códigos ({availableCount} disp. · {usedCount} usados/inativos)
              </CardTitle>
              <div className='flex gap-0.5 rounded-lg border p-0.5'>
                {(
                  [
                    ['all', 'Todos'],
                    ['available', 'Disponíveis'],
                    ['exhausted', 'Esgotados'],
                    ['inactive', 'Inativos'],
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
            </CardHeader>
            <CardContent>
              <div className='overflow-hidden rounded-lg border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-end'>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className='py-10 text-center'>
                          <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
                        </TableCell>
                      </TableRow>
                    )}
                    {!listQuery.isLoading &&
                      filtered.map((c) => (
                        <CouponRow
                          key={c.code}
                          c={c}
                          onDelete={() => deleteMut.mutate(c.code)}
                          deleting={deleteMut.isPending}
                          onToggle={() => toggleMut.mutate(c)}
                          toggling={toggleMut.isPending}
                        />
                      ))}
                    {!listQuery.isLoading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className='text-muted-foreground py-10 text-center'
                        >
                          Nenhum código.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </Main>
    </>
  )
}

function CouponRow({
  c,
  onDelete,
  deleting,
  onToggle,
  toggling,
}: {
  c: Coupon
  onDelete: () => void
  deleting: boolean
  onToggle: () => void
  toggling: boolean
}) {
  const status = statusOf(c)
  return (
    <TableRow className={cn(!c.active && 'opacity-60')}>
      <TableCell>
        <button
          type='button'
          onClick={() => copy(c.code)}
          className='hover:text-foreground flex items-center gap-1 font-mono text-sm'
          title='Copiar'
        >
          {c.code}
          <Copy className='size-3 opacity-50' />
        </button>
      </TableCell>
      <TableCell className='text-sm'>
        {c.planTitle ||
          (c.type === 'discount' ? 'Qualquer plano' : '—')}
      </TableCell>
      <TableCell className='text-sm'>
        {c.type === 'discount' ? (
          <span className='font-medium text-emerald-600 dark:text-emerald-400'>
            -{c.discountPercent}%
          </span>
        ) : (
          `${c.days}d`
        )}
      </TableCell>
      <TableCell className='text-sm'>
        <span className='inline-flex items-center gap-1 font-mono'>
          {c.uses}
          <span className='text-muted-foreground'>/</span>
          {c.maxUses > 0 ? (
            c.maxUses
          ) : (
            <InfinityIcon className='text-muted-foreground size-3.5' />
          )}
        </span>
      </TableCell>
      <TableCell className='text-sm'>
        {c.expiresAt ? (
          <span className={cn(isExpired(c) && 'text-rose-500')}>
            {format(new Date(c.expiresAt), 'dd/MM/yy')}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <Badge variant='outline' className={status.cls}>
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className='flex items-center justify-end gap-1'>
          <Switch
            checked={c.active}
            disabled={toggling}
            onCheckedChange={onToggle}
            title={c.active ? 'Desligar' : 'Ligar'}
            className='mr-1 scale-90'
          />
          <RedemptionsDialog code={c.code} count={c.uses} />
          <Button
            variant='ghost'
            size='icon'
            className='text-muted-foreground hover:text-destructive size-8'
            disabled={deleting}
            onClick={onDelete}
            title='Apagar'
          >
            <Trash2 className='size-4' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function RedemptionsDialog({ code, count }: { code: string; count: number }) {
  const [open, setOpen] = useState(false)
  const q = useQuery({
    queryKey: ['coupon-redemptions', code],
    queryFn: () => couponRedemptions(code),
    enabled: open,
    refetchInterval: open ? 10_000 : false, // atualiza enquanto aberto
  })
  const rows = q.data ?? []
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='text-muted-foreground hover:text-foreground size-8'
          title='Ver quem resgatou'
        >
          <Users className='size-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='font-mono text-base'>{code}</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `${count} resgate(s) — quem ativou este código`
              : 'Ninguém resgatou este código ainda.'}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className='py-8 text-center'>
            <Loader2 className='text-muted-foreground mx-auto size-5 animate-spin' />
          </div>
        ) : rows.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            Nenhum resgate.
          </p>
        ) : (
          <div className='max-h-80 overflow-y-auto rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className='text-end'>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className='text-sm'>
                      <div className='flex items-center gap-3'>
                        <Avatar className='size-8'>
                          <AvatarImage
                            src={r.avatarUrl || '/default-avatar.jpg'}
                            alt={r.name || ''}
                          />
                          <AvatarFallback>
                            {getDisplayNameInitials(r.name || r.email || '?')}
                          </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0'>
                          <p className='truncate font-medium'>
                            {r.name || '(sem nome)'}
                          </p>
                          <p className='text-muted-foreground truncate text-xs'>
                            {r.email || r.userId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {r.days != null ? `${r.days}d` : '—'}
                    </TableCell>
                    <TableCell className='text-end text-sm'>
                      {format(new Date(r.redeemedAt), 'dd/MM/yy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
