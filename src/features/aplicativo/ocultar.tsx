import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  EyeOff,
  RefreshCw,
  Save,
  Search,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getAppConfig,
  getHiddenContent,
  listBroken,
  listReportedCategories,
  probeCategories,
  setHiddenContent,
  type HiddenContent,
  type HiddenType,
} from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const TIPOS: { key: HiddenType; label: string }[] = [
  { key: 'movie', label: 'Filmes' },
  { key: 'series', label: 'Séries' },
  { key: 'live', label: 'Ao Vivo' },
]

/** Mesma normalização do backend e do app — se divergir, nada casa. */
const norm = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)

export function AplicativoOcultar() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['hidden-content'], queryFn: getHiddenContent })
  const [cfg, setCfg] = useState<HiddenContent | null>(null)
  const [tipo, setTipo] = useState<HiddenType>('movie')
  const [busca, setBusca] = useState('')
  const [manual, setManual] = useState('')
  const [idsColados, setIdsColados] = useState('')
  const [catAberta, setCatAberta] = useState<string | null>(null)

  useEffect(() => {
    if (q.data) setCfg(structuredClone(q.data))
  }, [q.data])

  // Sondagem da nossa lista: nomes + IDs + contagem real de itens.
  const probe = useQuery({
    queryKey: ['probe-categories', tipo],
    queryFn: () => probeCategories(tipo),
  })
  // Fallback e complemento: o que os apps reportaram.
  const reportadas = useQuery({
    queryKey: ['reported-categories'],
    queryFn: listReportedCategories,
  })
  const quebrados = useQuery({ queryKey: ['broken'], queryFn: listBroken })
  // Só pra avisar se estamos ocultando algo que alimenta o banner da Início.
  const appCfg = useQuery({ queryKey: ['app-config'], queryFn: getAppConfig })

  const itensDaCat = useQuery({
    queryKey: ['probe-items', tipo, catAberta],
    queryFn: () => probeCategories(tipo, { categoryId: catAberta! }),
    enabled: !!catAberta,
  })

  const mut = useMutation({
    mutationFn: setHiddenContent,
    onSuccess: () => {
      toast.success('Salvo. Vale no próximo boot do app.')
      qc.invalidateQueries({ queryKey: ['hidden-content'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const refresh = useMutation({
    mutationFn: () => probeCategories(tipo, { refresh: true }),
    onSuccess: (r) => {
      qc.setQueryData(['probe-categories', tipo], r)
      toast.success(
        r.ok ? `Lista atualizada — ${r.categories?.length ?? 0} categorias.` : (r.message ?? 'Não deu pra sondar.')
      )
    },
    onError: () => toast.error('Falha ao sondar a lista.'),
  })

  // Catálogo mostrado: sondagem quando disponível, telemetria como fallback.
  const catalogo = useMemo(() => {
    const sondadas = probe.data?.categories
    if (sondadas?.length) {
      return sondadas.map((c) => ({ id: c.id, name: c.name, count: c.count }))
    }
    return (reportadas.data?.[tipo] ?? []).map((c) => ({
      id: undefined as string | undefined,
      name: c.name,
      count: null as number | null,
    }))
  }, [probe.data, reportadas.data, tipo])

  const filtrado = useMemo(() => {
    const t = norm(busca)
    return t ? catalogo.filter((c) => norm(c.name).includes(t)) : catalogo
  }, [catalogo, busca])

  if (!cfg) {
    return <p className='py-8 text-center text-muted-foreground'>Carregando…</p>
  }

  const cats = cfg.categories[tipo] ?? []
  const itens = cfg.items[tipo] ?? []
  const ocultas = new Set(cats.map((c) => norm(c.n)))

  const patch = (p: Partial<HiddenContent>) => setCfg({ ...cfg, ...p })

  const toggleCat = (name: string, id?: string) => {
    const n = norm(name)
    const novas = ocultas.has(n)
      ? cats.filter((c) => norm(c.n) !== n)
      : [...cats, { n: name.trim().slice(0, 80), ...(id ? { id } : {}) }]
    patch({ categories: { ...cfg.categories, [tipo]: novas } })
  }

  const addIds = (brutos: string[]) => {
    const existentes = new Set(itens.map((i) => i.id))
    const novos = brutos
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9_-]{1,24}$/.test(s) && !existentes.has(s))
      .map((id) => ({ id }))
    if (!novos.length) return
    patch({ items: { ...cfg.items, [tipo]: [...itens, ...novos] } })
  }

  // Quantos conteúdos as categorias marcadas escondem (soma do que a sondagem
  // contou). Categoria sem contagem não entra — daí o "≈".
  const totalOcultos = cats.reduce((acc, c) => {
    const achada = catalogo.find((x) => norm(x.name) === norm(c.n))
    return acc + (achada?.count ?? 0)
  }, 0)

  const coberturaAlta =
    catalogo.length >= 5 && cats.length > catalogo.length * 0.8

  // Ocultar uma categoria usada no destaque deixaria o banner da Início vazio.
  const kwDestaque = new Set(
    [
      ...(appCfg.data?.tv?.inicio?.featuredKeywords?.movies ?? []),
      ...(appCfg.data?.tv?.inicio?.featuredKeywords?.series ?? []),
      ...(appCfg.data?.tv?.inicio?.rowPriorityKeywords ?? []),
    ].map(norm)
  )
  const conflitoDestaque = cats.some((c) =>
    [...kwDestaque].some((k) => k && norm(c.n).includes(k))
  )

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4'>
        <AlertTriangle className='mt-0.5 size-5 shrink-0 text-red-500' />
        <div className='text-sm'>
          <p className='font-semibold text-red-500'>
            Isto some com conteúdo no app de clientes reais.
          </p>
          <p className='text-muted-foreground'>
            As mudanças chegam no próximo boot do app. Nada é apagado da lista —
            desligar a chave abaixo devolve tudo na hora.
          </p>
        </div>
      </div>

      {/* Chave mestra */}
      <section className='rounded-xl bg-muted/40 p-4'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <p className='font-medium'>Ocultação ativa</p>
            <p className='text-sm text-muted-foreground'>
              Desligado, o app mostra tudo — as regras ficam guardadas.
            </p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => patch({ enabled: v })}
          />
        </div>

        <div className='mt-4 grid gap-2 sm:grid-cols-2'>
          {(
            [
              {
                v: 'ours' as const,
                t: 'Só quem usa a NOSSA lista',
                d: 'Inclui o teste grátis. Planos só-app usam lista própria do cliente e não são filtrados.',
              },
              {
                v: 'all' as const,
                t: 'Todos os planos',
                d: 'Filtra também a lista particular de clientes só-app.',
              },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type='button'
              onClick={() => patch({ scope: o.v })}
              className={`rounded-lg border p-3 text-start transition-colors ${
                cfg.scope === o.v
                  ? 'border-primary bg-accent'
                  : 'hover:bg-muted/60'
              }`}
            >
              <p className='text-sm font-medium'>{o.t}</p>
              <p className='mt-0.5 text-xs text-muted-foreground'>{o.d}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Tipo */}
      <div className='inline-flex items-center gap-1 rounded-xl border bg-background/40 p-1'>
        {TIPOS.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => {
              setTipo(t.key)
              setCatAberta(null)
            }}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tipo === t.key
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Categorias */}
      <section className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='font-semibold'>Categorias</h2>
            <p className='text-sm text-muted-foreground'>
              {probe.data?.categories?.length
                ? `Sondadas direto da nossa lista${probe.data.cached ? ' (cache)' : ''}.`
                : 'Sem sondagem — mostrando as categorias vistas nos apps.'}
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw
              className={`size-4 ${refresh.isPending ? 'animate-spin' : ''}`}
            />
            Atualizar da lista
          </Button>
        </div>

        <div className='relative'>
          <Search className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder='Buscar categoria…'
            className='ps-9'
          />
        </div>

        <div className='max-h-80 divide-y overflow-y-auto rounded-xl border'>
          {filtrado.length === 0 && (
            <p className='p-4 text-sm text-muted-foreground'>
              Nada por aqui. Use "Atualizar da lista" ou adicione o nome à mão.
            </p>
          )}
          {filtrado.map((c) => {
            const marcada = ocultas.has(norm(c.name))
            return (
              <div
                key={`${c.id ?? ''}${c.name}`}
                className='flex items-center gap-3 p-2.5 hover:bg-muted/40'
              >
                <input
                  type='checkbox'
                  checked={marcada}
                  onChange={() => toggleCat(c.name, c.id)}
                  className='size-4 accent-red-600'
                />
                <span className='min-w-0 flex-1 truncate text-sm'>{c.name}</span>
                {c.count != null && (
                  <span className='shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
                    {c.count} itens
                  </span>
                )}
                {c.id && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setCatAberta(catAberta === c.id ? null : c.id!)}
                  >
                    {catAberta === c.id ? 'Fechar' : 'Ver itens'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {/* Adicionar nome à mão (categoria que nem a sondagem nem os apps viram) */}
        <div className='flex gap-2'>
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder='Adicionar categoria pelo nome exato…'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manual.trim()) {
                toggleCat(manual)
                setManual('')
              }
            }}
          />
          <Button
            variant='outline'
            onClick={() => {
              if (manual.trim()) {
                toggleCat(manual)
                setManual('')
              }
            }}
          >
            Adicionar
          </Button>
        </div>

        {cats.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {cats.map((c) => (
              <span
                key={c.n}
                className='inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs'
              >
                {c.n}
                <button
                  type='button'
                  onClick={() => toggleCat(c.n)}
                  className='text-muted-foreground hover:text-foreground'
                >
                  <X className='size-3' />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Itens da categoria aberta */}
      {catAberta && (
        <section className='space-y-2 rounded-xl bg-muted/40 p-4'>
          <h3 className='text-sm font-semibold'>
            Conteúdos desta categoria
            {itensDaCat.isFetching && ' — carregando…'}
          </h3>
          <div className='max-h-64 divide-y overflow-y-auto rounded-lg border bg-background'>
            {(itensDaCat.data?.items ?? []).map((it) => {
              const marcado = itens.some((x) => x.id === it.id)
              return (
                <label
                  key={it.id}
                  className='flex cursor-pointer items-center gap-3 p-2 text-sm hover:bg-muted/40'
                >
                  <input
                    type='checkbox'
                    checked={marcado}
                    onChange={() =>
                      marcado
                        ? patch({
                            items: {
                              ...cfg.items,
                              [tipo]: itens.filter((x) => x.id !== it.id),
                            },
                          })
                        : addIds([it.id])
                    }
                    className='size-4 accent-red-600'
                  />
                  <span className='min-w-0 flex-1 truncate'>{it.name}</span>
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    {it.id}
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      )}

      {/* IDs colados à mão */}
      <section className='space-y-2'>
        <h2 className='font-semibold'>Conteúdos por ID</h2>
        <Textarea
          value={idsColados}
          onChange={(e) => setIdsColados(e.target.value)}
          placeholder='Cole IDs separados por vírgula ou quebra de linha…'
          rows={3}
        />
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              addIds(idsColados.split(/[\s,;]+/))
              setIdsColados('')
            }}
          >
            Adicionar IDs
          </Button>
          <span className='text-xs text-muted-foreground'>
            {itens.length} oculto(s) em {TIPOS.find((t) => t.key === tipo)?.label}
          </span>
        </div>
        {itens.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {itens.map((i) => (
              <span
                key={i.id}
                className='inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs'
              >
                {i.id}
                <button
                  type='button'
                  onClick={() =>
                    patch({
                      items: {
                        ...cfg.items,
                        [tipo]: itens.filter((x) => x.id !== i.id),
                      },
                    })
                  }
                  className='text-muted-foreground hover:text-foreground'
                >
                  <X className='size-3' />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Conteúdo que os apps reportaram como quebrado */}
      <section className='space-y-2'>
        <h2 className='font-semibold'>Conteúdo com falha</h2>
        <p className='text-sm text-muted-foreground'>
          Títulos em que o player esgotou TODAS as fontes, nos apps dos
          clientes. É a lista objetiva do que está morto.
        </p>
        {(quebrados.data?.broken ?? []).length === 0 ? (
          <p className='rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground'>
            Nada reportado ainda. Chega conforme os clientes usarem a versão
            nova do app.
          </p>
        ) : (
          <div className='max-h-64 divide-y overflow-y-auto rounded-xl border'>
            {(quebrados.data?.broken ?? [])
              .filter((b) => b.type === tipo)
              .map((b) => {
                const marcado = itens.some((x) => x.id === b.id)
                return (
                  <div
                    key={`${b.type}${b.id}`}
                    className='flex items-center gap-3 p-2.5 text-sm hover:bg-muted/40'
                  >
                    <input
                      type='checkbox'
                      checked={marcado}
                      onChange={() =>
                        marcado
                          ? patch({
                              items: {
                                ...cfg.items,
                                [tipo]: itens.filter((x) => x.id !== b.id),
                              },
                            })
                          : addIds([b.id])
                      }
                      className='size-4 accent-red-600'
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {b.name || b.id}
                    </span>
                    <span className='shrink-0 rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-500'>
                      {b.users} cliente(s)
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </section>

      {conflitoDestaque && (
        <div className='flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-500' />
          <p className='text-muted-foreground'>
            Uma das categorias ocultas casa com as palavras-chave do destaque da
            Início. O banner pode ficar vazio — confira a aba Início.
          </p>
        </div>
      )}

      {coberturaAlta && (
        <div className='flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0 text-red-500' />
          <p className='text-muted-foreground'>
            Você marcou mais de 80% das categorias conhecidas. O app tem uma
            trava que ignora filtros assim (para não deixar o catálogo vazio),
            então provavelmente não vai surtir o efeito esperado.
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
        <p className='text-sm text-muted-foreground'>
          <EyeOff className='me-1.5 inline size-4' />
          {cats.length} categoria(s)
          {totalOcultos > 0 && <> ≈ {totalOcultos.toLocaleString('pt-BR')} conteúdos</>}
          {' · '}
          {itens.length} ID(s) individuais
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => q.data && setCfg(structuredClone(q.data))}
            disabled={mut.isPending}
          >
            <Undo2 className='size-4' />
            Reverter
          </Button>
          <Button onClick={() => mut.mutate(cfg)} disabled={mut.isPending}>
            <Save className='size-4' />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}
