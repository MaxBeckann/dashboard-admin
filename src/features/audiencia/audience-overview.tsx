import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CalendarClock,
  Clapperboard,
  Clock,
  Eye,
  Gauge,
  Layers,
  Loader2,
  PlayCircle,
  TrendingDown,
  Tv2,
  UserRound,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  getAudienceOverview,
  getUserAudience,
  type AudienceCategory,
  type AudienceOverview as AudienceOverviewData,
  type AudienceViewer,
  type UserAudience,
} from '@/lib/admin-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const MOVIE_COLOR = '#6366f1'
const SERIES_COLOR = '#ec4899'
const WINDOWS = [7, 30, 90] as const
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Painel Início da Audiência — KPIs + quem mais assiste + filmes×séries +
 *  atividade + horário de pico + conclusão + largados + categorias. */
export function AudienceOverview() {
  const [windowDays, setWindowDays] = useState<number>(30)
  const { data, isLoading } = useQuery({
    queryKey: ['audience-overview', windowDays],
    queryFn: () => getAudienceOverview(windowDays),
    refetchInterval: 60_000,
  })

  return (
    <div className='space-y-4'>
      {/* Filtro de janela */}
      <div className='inline-flex items-center gap-1 rounded-lg border bg-card p-0.5 text-sm'>
        {WINDOWS.map((d) => (
          <button
            key={d}
            type='button'
            onClick={() => setWindowDays(d)}
            className={
              windowDays === d
                ? 'rounded-md bg-accent px-3 py-1 font-medium text-accent-foreground'
                : 'rounded-md px-3 py-1 text-muted-foreground hover:text-foreground'
            }
          >
            {d} dias
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className='py-10 text-center text-muted-foreground'>Carregando…</p>
      ) : (
        <AudienceBody data={data} />
      )}
    </div>
  )
}

function AudienceBody({ data }: { data: AudienceOverviewData }) {
  const { totals, byType, topViewers, activity } = data

  return (
    <div className='space-y-4'>
      {/* KPIs */}
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Kpi
          icon={<PlayCircle className='size-4' />}
          label='Reproduções'
          value={totals.plays.toLocaleString('pt-BR')}
          hint={`últimos ${data.window} dias`}
        />
        <Kpi
          icon={<Eye className='size-4' />}
          label='Espectadores'
          value={totals.viewers.toLocaleString('pt-BR')}
          hint='contas que assistiram'
        />
        <Kpi
          icon={<Clock className='size-4' />}
          label='Tempo assistido'
          value={fmtHours(totals.watchedSec)}
          hint='soma do progresso'
        />
        <Kpi
          icon={<Gauge className='size-4' />}
          label='Conclusão média'
          value={`${Math.round(totals.avgCompletion * 100)}%`}
          hint='quanto assistem'
        />
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        {/* Quem mais assiste */}
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Eye className='size-4' /> Quem mais assiste
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topViewers.length === 0 ? (
              <Empty>Ainda sem espectadores no período.</Empty>
            ) : (
              <div className='space-y-1'>
                {topViewers.map((v, i) => (
                  <ViewerRow
                    key={v.accountId}
                    v={v}
                    rank={i + 1}
                    max={topViewers[0].watchedSec || 1}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filmes × Séries */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Filmes × Séries</CardTitle>
          </CardHeader>
          <CardContent>
            <TypeDonut movie={byType.movie.plays} series={byType.series.plays} />
          </CardContent>
        </Card>
      </div>

      {/* Atividade */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            Atividade — reproduções por dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart data={activity} />
        </CardContent>
      </Card>

      {/* Categorias */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Layers className='size-4' /> Categorias mais assistidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CategoriesWidget
            all={data.categories}
            byType={data.categoriesByType}
            hasData={data.hasCategoryData}
          />
        </CardContent>
      </Card>

      {/* Horário de pico */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <CalendarClock className='size-4' /> Horário de pico
          </CardTitle>
          <p className='text-xs text-muted-foreground'>
            Quando sua base assiste (dia da semana × hora).
          </p>
        </CardHeader>
        <CardContent>
          <PeakHeatmap heat={data.peakHours} />
        </CardContent>
      </Card>

      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Distribuição de conclusão */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Gauge className='size-4' /> Distribuição de conclusão
            </CardTitle>
            <p className='text-xs text-muted-foreground'>
              Quanto do conteúdo as pessoas assistem.
            </p>
          </CardHeader>
          <CardContent>
            <CompletionBars completion={data.completion} />
          </CardContent>
        </Card>

        {/* Largados cedo */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <TrendingDown className='size-4' /> Largados cedo
            </CardTitle>
            <p className='text-xs text-muted-foreground'>
              Menor conclusão média — stream ruim ou conteúdo fraco.
            </p>
          </CardHeader>
          <CardContent>
            <AbandonedList items={data.abandoned} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Heatmap 7×24 (dia da semana × hora), rampa sequencial (1 cor: emerald). */
function PeakHeatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat())
  const total = heat.flat().reduce((a, b) => a + b, 0)
  if (total === 0) return <Empty>Sem reproduções no período.</Empty>
  return (
    <div className='overflow-x-auto'>
      <div className='min-w-[560px]'>
        {/* régua de horas */}
        <div className='mb-1 flex ps-9 text-[9px] text-muted-foreground'>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className='flex-1 text-center'>
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {heat.map((row, dow) => (
          <div key={dow} className='mb-0.5 flex items-center'>
            <div className='w-9 shrink-0 text-[10px] text-muted-foreground'>
              {DOW[dow]}
            </div>
            <div className='flex flex-1 gap-0.5'>
              {row.map((v, h) => (
                <div
                  key={h}
                  title={`${DOW[dow]} ${h}h · ${v} reproduç${v === 1 ? 'ão' : 'ões'}`}
                  className='h-4 flex-1 rounded-[2px]'
                  style={{
                    backgroundColor:
                      v === 0
                        ? 'rgba(255,255,255,.04)'
                        : `rgba(16,185,129,${0.15 + 0.85 * (v / max)})`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const COMP_COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e']

/** Distribuição de conclusão (4 faixas), barras horizontais. */
function CompletionBars({
  completion,
}: {
  completion: { labels: string[]; buckets: number[] }
}) {
  const total = completion.buckets.reduce((a, b) => a + b, 0)
  if (total === 0) return <Empty>Sem dados de conclusão.</Empty>
  return (
    <div className='space-y-2'>
      {completion.labels.map((label, i) => {
        const v = completion.buckets[i]
        const pct = Math.round((v / total) * 100)
        return (
          <div key={label} className='space-y-1'>
            <div className='flex items-center justify-between text-sm'>
              <span>{label}</span>
              <span className='font-medium'>
                {v}
                <span className='ms-1 text-xs text-muted-foreground'>
                  ({pct}%)
                </span>
              </span>
            </div>
            <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full'
                style={{ width: `${pct}%`, backgroundColor: COMP_COLORS[i] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Conteúdos com MENOR conclusão média. */
function AbandonedList({
  items,
}: {
  items: AudienceOverviewData['abandoned']
}) {
  if (items.length === 0)
    return <Empty>Sem amostras suficientes ainda.</Empty>
  return (
    <div className='space-y-2'>
      {items.map((it) => {
        const pct = Math.round(it.avgCompletion * 100)
        return (
          <div key={it.title} className='space-y-1'>
            <div className='flex items-center justify-between gap-2 text-sm'>
              <span className='truncate' title={it.title}>
                {it.title}
                <span className='ms-1 text-xs text-muted-foreground'>
                  ({it.type === 'series' ? 'Série' : 'Filme'})
                </span>
              </span>
              <span className='shrink-0 font-medium'>{pct}%</span>
            </div>
            <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
              <div
                className='h-full rounded-full bg-rose-500'
                style={{ width: `${Math.max(4, pct)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className='rounded-xl border bg-muted/40 p-3'>
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        {icon}
        {label}
      </div>
      <p className='mt-1 text-2xl font-bold tracking-tight'>{value}</p>
      <p className='text-[11px] text-muted-foreground'>{hint}</p>
    </div>
  )
}

function ViewerRow({
  v,
  rank,
  max,
}: {
  v: AudienceViewer
  rank: number
  max: number
}) {
  const pct = Math.max(4, Math.round((v.watchedSec / max) * 100))
  const name = v.name || v.email || v.profileName || 'Usuário'
  return (
    <UserAudienceDialog viewer={v}>
      <button
        type='button'
        className='flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted/50'
      >
        <span className='w-4 shrink-0 text-center text-xs font-bold text-muted-foreground'>
          {rank}
        </span>
        <Avatar className='size-8 shrink-0'>
          {v.avatarUrl && <AvatarImage src={v.avatarUrl} alt={v.name} />}
          <AvatarFallback className='text-xs'>
            {getDisplayNameInitials(v.name || v.profileName || '?')}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-medium'>{name}</p>
          <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-primary'
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className='shrink-0 text-end text-xs'>
          <p className='font-semibold'>{fmtHours(v.watchedSec)}</p>
          <p className='text-muted-foreground'>
            {v.titles} {v.titles === 1 ? 'título' : 'títulos'}
          </p>
        </div>
      </button>
    </UserAudienceDialog>
  )
}

/** Dialog com a AUDIÊNCIA do usuário (dados agregados) + botão "Abrir perfil". */
function UserAudienceDialog({
  viewer,
  children,
}: {
  viewer: AudienceViewer
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['user-audience', viewer.accountId],
    queryFn: () => getUserAudience(viewer.accountId),
    enabled: open,
    staleTime: 60_000,
  })
  const name = viewer.name || viewer.profileName || viewer.email || 'Usuário'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='max-w-lg bg-card'>
        <DialogHeader>
          <div className='flex items-center gap-3'>
            <Avatar className='size-11 shrink-0'>
              {viewer.avatarUrl && (
                <AvatarImage src={viewer.avatarUrl} alt={name} />
              )}
              <AvatarFallback>{getDisplayNameInitials(name)}</AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <DialogTitle className='truncate text-base'>{name}</DialogTitle>
              {(viewer.email || viewer.profileName) && (
                <p className='truncate text-xs text-muted-foreground'>
                  {viewer.profileName ? `Perfil: ${viewer.profileName}` : ''}
                  {viewer.profileName && viewer.email ? ' · ' : ''}
                  {viewer.email}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading || !data ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='size-5 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <UserAudienceContent data={data} />
        )}

        <div className='flex justify-end border-t pt-3'>
          <Button asChild size='sm'>
            <Link to='/user-admin/$userId' params={{ userId: viewer.accountId }}>
              <UserRound className='size-4' /> Abrir perfil completo
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Conteúdo da audiência do usuário (dentro do dialog). */
function UserAudienceContent({ data }: { data: UserAudience }) {
  const { totals, byType, topWatched, categories } = data
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <MiniStat label='Filmes' value={`${byType.movie.plays}`} />
        <MiniStat label='Séries' value={`${byType.series.plays}`} />
        <MiniStat label='Tempo' value={fmtHours(totals.watchedSec)} />
        <MiniStat
          label='Conclusão'
          value={`${Math.round(totals.avgCompletion * 100)}%`}
        />
      </div>

      <div>
        <p className='mb-1.5 text-sm font-medium'>Mais assistidos</p>
        {topWatched.length === 0 ? (
          <Empty>Sem dados.</Empty>
        ) : (
          <div className='max-h-48 space-y-1 overflow-y-auto'>
            {topWatched.map((t, i) => (
              <div
                key={t.title + i}
                className='flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm'
              >
                <span className='truncate'>
                  <span className='me-1 text-xs text-muted-foreground'>
                    {i + 1}.
                  </span>
                  {t.title}
                  <span className='ms-1 text-xs text-muted-foreground'>
                    ({t.type === 'series' ? 'Série' : 'Filme'})
                  </span>
                </span>
                <span className='shrink-0 text-xs text-muted-foreground'>
                  {fmtHours(t.watchedSec)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div>
          <p className='mb-1.5 text-sm font-medium'>Categorias que mais assiste</p>
          <div className='flex flex-wrap gap-1.5'>
            {categories.map((c) => (
              <span
                key={c.name}
                className='rounded-full bg-muted px-2.5 py-1 text-xs'
              >
                {c.name} <span className='text-muted-foreground'>· {c.plays}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg bg-muted/50 p-2.5'>
      <p className='text-[11px] text-muted-foreground'>{label}</p>
      <p className='text-base font-bold'>{value}</p>
    </div>
  )
}

function TypeDonut({ movie, series }: { movie: number; series: number }) {
  const total = movie + series
  if (total === 0) return <Empty>Sem dados.</Empty>
  const data = [
    { name: 'Filmes', value: movie, color: MOVIE_COLOR, icon: Clapperboard },
    { name: 'Séries', value: series, color: SERIES_COLOR, icon: Tv2 },
  ]
  return (
    <div className='flex flex-col items-center gap-3'>
      <ResponsiveContainer width='100%' height={150}>
        <PieChart>
          <Pie
            data={data.filter((d) => d.value > 0)}
            dataKey='value'
            nameKey='name'
            innerRadius={42}
            outerRadius={66}
            paddingAngle={2}
            stroke='none'
          >
            {data
              .filter((d) => d.value > 0)
              .map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              fontSize: 12,
              color: '#fafafa',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className='grid w-full gap-1.5 text-sm'>
        {data.map((d) => (
          <div key={d.name} className='flex items-center justify-between'>
            <span className='flex items-center gap-2 text-muted-foreground'>
              <d.icon className='size-3.5' style={{ color: d.color }} />
              {d.name}
            </span>
            <span className='font-medium'>
              {d.value.toLocaleString('pt-BR')}
              <span className='ms-1 text-xs text-muted-foreground'>
                ({Math.round((d.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityChart({ data }: { data: { date: string; plays: number }[] }) {
  const total = data.reduce((a, d) => a + d.plays, 0)
  if (total === 0) return <Empty>Sem reproduções no período.</Empty>
  return (
    <ResponsiveContainer width='100%' height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,.05)' }}
          contentStyle={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            fontSize: 12,
            color: '#fafafa',
          }}
          labelFormatter={(l) => fmtDay(String(l))}
          formatter={(val) => [`${val} reproduções`, '']}
        />
        <Bar dataKey='plays' fill={MOVIE_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoriesWidget({
  all,
  byType,
  hasData,
}: {
  all: AudienceCategory[]
  byType: { movie: AudienceCategory[]; series: AudienceCategory[] }
  hasData: boolean
}) {
  const [tab, setTab] = useState<'all' | 'movie' | 'series'>('all')
  const list = tab === 'all' ? all : byType[tab]
  const max = useMemo(
    () => Math.max(1, ...list.map((c) => c.plays)),
    [list]
  )

  if (!hasData) {
    return (
      <div className='rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground'>
        As categorias aparecem aqui conforme o app registra <b>de onde</b> o
        conteúdo foi assistido (ex.: <b>Netflix</b>, <b>Lançamentos</b>). Já está
        ligado no servidor — começa a popular assim que os apps atualizarem para
        a versão nova.
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='inline-flex items-center gap-1 rounded-lg border bg-card p-0.5 text-sm'>
        {(
          [
            { k: 'all', l: 'Todos' },
            { k: 'movie', l: 'Filmes' },
            { k: 'series', l: 'Séries' },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type='button'
            onClick={() => setTab(t.k)}
            className={
              tab === t.k
                ? 'rounded-md bg-accent px-3 py-1 font-medium text-accent-foreground'
                : 'rounded-md px-3 py-1 text-muted-foreground hover:text-foreground'
            }
          >
            {t.l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty>Sem categorias neste filtro.</Empty>
      ) : (
        <div className='space-y-2'>
          {list.map((c) => (
            <div key={c.name} className='space-y-1'>
              <div className='flex items-center justify-between text-sm'>
                <span className='truncate' title={c.name}>
                  {c.name}
                </span>
                <span className='shrink-0 font-medium'>{c.plays}</span>
              </div>
              <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full rounded-full bg-emerald-500'
                  style={{ width: `${(c.plays / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className='py-6 text-center text-sm text-muted-foreground'>{children}</p>
  )
}

function fmtHours(sec: number): string {
  if (!sec || sec < 0) return '0 min'
  if (sec >= 3600) return `${(sec / 3600).toFixed(1).replace('.', ',')} h`
  return `${Math.round(sec / 60)} min`
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
