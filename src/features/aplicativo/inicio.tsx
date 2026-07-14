import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Clapperboard, Film, GripVertical, Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAppConfig,
  listReportedCategories,
  setAppConfig,
  type AppConfig,
  type FeaturedSource,
  type PlatformKey,
} from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/** Chip arrastável (dnd-kit) de UMA palavra-chave. Numerado; o #1 fica verde
 * (é a prioridade — o app tenta essa primeiro) quando `greenFirst`. */
function SortableChip({
  id,
  index,
  onRemove,
  greenFirst,
}: {
  id: string
  index: number
  onRemove: () => void
  greenFirst: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const green = greenFirst && index === 0
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-md border py-1 pe-1 ps-1 text-sm ${
        green
          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
          : 'border-border bg-muted/60 text-foreground'
      } ${isDragging ? 'opacity-80 shadow-lg' : ''}`}
    >
      <button
        type='button'
        className='cursor-grab touch-none rounded-sm p-0.5 text-muted-foreground hover:bg-background/60 active:cursor-grabbing'
        {...attributes}
        {...listeners}
        aria-label='Arrastar'
      >
        <GripVertical className='size-3.5' />
      </button>
      <span
        className={`min-w-4 text-center text-xs font-bold ${green ? 'text-emerald-300' : 'text-muted-foreground'}`}
      >
        {index + 1}
      </span>
      <span className='font-medium'>{id}</span>
      {green && (
        <span className='rounded bg-emerald-500/25 px-1.5 text-[10px] font-semibold text-emerald-200'>
          no banner
        </span>
      )}
      <button
        type='button'
        onClick={onRemove}
        className='rounded-sm p-0.5 hover:bg-background/60'
        aria-label={`Remover ${id}`}
      >
        <X className='size-3' />
      </button>
    </div>
  )
}

/** Editor de palavras-chave: chips ARRASTÁVEIS (reordenar) + numerados +
 * campo pra adicionar + sugestões. `greenFirst` pinta o #1 de verde. */
function KeywordEditor({
  label,
  hint,
  value,
  onChange,
  suggestions,
  greenFirst = false,
}: {
  label: string
  hint: string
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  greenFirst?: boolean
}) {
  const [draft, setDraft] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const add = (raw: string) => {
    const k = raw.trim()
    if (!k) return
    if (value.some((v) => v.toLowerCase() === k.toLowerCase())) return
    onChange([...value, k])
    setDraft('')
  }
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(active.id as string)
      const newIndex = value.indexOf(over.id as string)
      if (oldIndex >= 0 && newIndex >= 0) {
        onChange(arrayMove(value, oldIndex, newIndex))
      }
    }
  }
  const fresh = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())
  )

  return (
    <div className='space-y-2'>
      <div>
        <Label className='text-sm font-medium'>{label}</Label>
        <p className='text-xs text-muted-foreground'>{hint}</p>
      </div>

      {value.length === 0 ? (
        <span className='text-xs text-muted-foreground'>
          (nenhuma — o app usa o primeiro grupo com conteúdo)
        </span>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          modifiers={[restrictToParentElement]}
        >
          <SortableContext items={value} strategy={rectSortingStrategy}>
            <div className='flex flex-wrap gap-2'>
              {value.map((k, i) => (
                <SortableChip
                  key={k}
                  id={k}
                  index={i}
                  greenFirst={greenFirst}
                  onRemove={() => onChange(value.filter((v) => v !== k))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className='flex gap-2'>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder='Ex.: LANÇAMENTOS, NETFLIX…'
          className='h-9 max-w-xs'
        />
        <Button type='button' size='sm' variant='outline' onClick={() => add(draft)}>
          <Plus className='size-4' /> Adicionar
        </Button>
      </div>
      {fresh.length > 0 && (
        <div className='space-y-1'>
          <p className='text-xs text-muted-foreground'>
            Categorias vistas nos apps (clique pra usar):
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {fresh.slice(0, 24).map((s) => (
              <button
                key={s}
                type='button'
                onClick={() => add(s)}
                className='rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SOURCES: { v: FeaturedSource; title: string; desc: string }[] = [
  { v: 'category', title: 'Nenhum', desc: 'Só a capa, sem selo especial.' },
  {
    v: 'top10',
    title: 'Top 10 (nosso)',
    desc: 'Selo "#N em Séries/Filmes" + ícone TOP nos mini-cards.',
  },
  { v: 'tmdb', title: 'TMDB', desc: 'Nota do TMDB no banner + chip TMDB.' },
]

export function AplicativoInicio({ platform }: { platform: PlatformKey }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['app-config'], queryFn: getAppConfig })
  const cats = useQuery({
    queryKey: ['reported-categories'],
    queryFn: listReportedCategories,
  })
  const [cfg, setCfg] = useState<AppConfig | null>(null)

  useEffect(() => {
    if (q.data) setCfg(structuredClone(q.data))
  }, [q.data])

  const mut = useMutation({
    mutationFn: setAppConfig,
    onSuccess: () => {
      toast.success('Config salva. Vale no próximo boot do app.')
      qc.invalidateQueries({ queryKey: ['app-config'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  if (!cfg) {
    return <p className='py-8 text-center text-muted-foreground'>Carregando…</p>
  }

  const ini = cfg[platform].inicio
  const patch = (p: Partial<AppConfig['tv']['inicio']>) =>
    setCfg({
      ...cfg,
      [platform]: { ...cfg[platform], inicio: { ...ini, ...p } },
    })

  const movieNames = (cats.data?.movie ?? []).map((c) => c.name)
  const seriesNames = (cats.data?.series ?? []).map((c) => c.name)
  const suggestions = Array.from(new Set([...movieNames, ...seriesNames]))
  // Sugestões do destaque = categorias do TIPO escolhido (nomes diferentes).
  const featuredSuggestions =
    ini.featuredType === 'series' ? seriesNames : movieNames

  const typeTabs = [
    { v: 'movies' as const, label: 'Filmes', icon: Film },
    { v: 'series' as const, label: 'Séries', icon: Clapperboard },
  ]

  return (
    <div className='max-w-3xl space-y-8'>
      {/* Categoria em destaque: tipo (Filmes/Séries) + palavras-chave. */}
      <div className='space-y-3'>
        <div>
          <Label className='text-sm font-medium'>Categoria em destaque (banner)</Label>
          <p className='text-xs text-muted-foreground'>
            O banner do INÍCIO destaca o TIPO escolhido abaixo, e escolhe a 1ª
            categoria cujo NOME casa com uma das palavras (arraste pra reordenar
            — a 1ª tem prioridade).
          </p>
        </div>

        {/* Switch Filmes/Séries (o lado ativo fica verde). */}
        <div className='inline-flex items-center gap-1 rounded-xl border bg-muted/40 p-1'>
          {typeTabs.map((t) => {
            const active = ini.featuredType === t.v
            return (
              <button
                key={t.v}
                type='button'
                onClick={() => patch({ featuredType: t.v })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className='size-4' />
                {t.label}
              </button>
            )
          })}
        </div>

        <KeywordEditor
          key={ini.featuredType}
          label={`Palavras-chave — ${ini.featuredType === 'series' ? 'Séries' : 'Filmes'}`}
          hint='Cada tipo tem suas palavras (as categorias de Filmes e Séries têm nomes diferentes). Ordem importa; arraste pra reordenar; o #1 (verde) é o que tenta primeiro.'
          value={ini.featuredKeywords[ini.featuredType]}
          onChange={(v) =>
            patch({
              featuredKeywords: {
                ...ini.featuredKeywords,
                [ini.featuredType]: v,
              },
            })
          }
          suggestions={featuredSuggestions}
          greenFirst
        />
      </div>

      {/* Selo/info do destaque. */}
      <div className='space-y-2'>
        <div>
          <Label className='text-sm font-medium'>Selo do destaque</Label>
          <p className='text-xs text-muted-foreground'>
            Não muda o conteúdo — só a INFO no banner e o ícone dos mini-cards.
          </p>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row'>
          {SOURCES.map((s) => {
            const active = ini.featuredSource === s.v
            return (
              <button
                key={s.v}
                type='button'
                onClick={() => patch({ featuredSource: s.v })}
                className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-primary bg-accent'
                    : 'bg-muted/40 hover:bg-muted/70'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <span
                    className={`size-3 rounded-full ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                  />
                  <span className='font-medium'>{s.title}</span>
                </div>
                <p className='mt-1 text-xs text-muted-foreground'>{s.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <KeywordEditor
        label='Ordem das fileiras (Filmes/Séries)'
        hint='As categorias cujo nome contém estas palavras sobem pro topo, nesta ordem (arraste pra reordenar). A 1ª vira a fileira de destaque.'
        value={ini.rowPriorityKeywords}
        onChange={(v) => patch({ rowPriorityKeywords: v })}
        suggestions={suggestions}
      />

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label className='text-sm font-medium'>
            Tempo do carrossel (segundos)
          </Label>
          <Input
            type='number'
            min={5}
            value={ini.carouselSeconds}
            onChange={(e) => patch({ carouselSeconds: Number(e.target.value) })}
            className='h-9 max-w-[10rem]'
          />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-sm font-medium'>Nº de destaques</Label>
          <Input
            type='number'
            min={1}
            max={30}
            value={ini.featuredCount}
            onChange={(e) => patch({ featuredCount: Number(e.target.value) })}
            className='h-9 max-w-[10rem]'
          />
        </div>
      </div>

      {/* Prévia no destaque (trailer + fallback conteúdo). */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between rounded-xl border bg-muted/40 p-4'>
          <div>
            <Label className='text-sm font-medium'>Trailer automático</Label>
            <p className='text-xs text-muted-foreground'>
              Ao focar o destaque, toca o trailer na hora (se houver no TMDB).
            </p>
          </div>
          <Switch
            checked={ini.trailerAutoplay}
            onCheckedChange={(v) => patch({ trailerAutoplay: v })}
          />
        </div>

        <div className='flex items-center justify-between rounded-xl border bg-muted/40 p-4'>
          <div>
            <Label className='text-sm font-medium'>
              Abrir conteúdo se não tiver trailer
            </Label>
            <p className='text-xs text-muted-foreground'>
              Sem trailer no TMDB, toca o PRÓPRIO conteúdo (mudo) na prévia do
              banner — filme direto; série = 1º episódio.
            </p>
          </div>
          <Switch
            checked={ini.autoOpenOnNoTrailer}
            onCheckedChange={(v) => patch({ autoOpenOnNoTrailer: v })}
          />
        </div>
      </div>

      <div className='flex items-center gap-3'>
        <Button onClick={() => mut.mutate(cfg)} disabled={mut.isPending}>
          <Save className='size-4' /> Salvar
        </Button>
        <Button
          variant='ghost'
          onClick={() => q.data && setCfg(structuredClone(q.data))}
          disabled={mut.isPending}
        >
          Reverter
        </Button>
      </div>
    </div>
  )
}
