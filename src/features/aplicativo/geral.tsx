import { useEffect, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAppConfig,
  recomputeRankings,
  setAppConfig,
  type AppConfig,
  type ImageSource,
} from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/** Aba GERAL (app inteiro, não é por plataforma): Top 10 + Cache do TMDB. */
export function AplicativoGeral() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['app-config'], queryFn: getAppConfig })
  const [cfg, setCfg] = useState<AppConfig | null>(null)

  useEffect(() => {
    if (q.data) setCfg(structuredClone(q.data))
  }, [q.data])

  const mut = useMutation({
    mutationFn: setAppConfig,
    onSuccess: () => {
      toast.success('Salvo. Vale no próximo boot do app.')
      qc.invalidateQueries({ queryKey: ['app-config'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const recompute = useMutation({
    mutationFn: recomputeRankings,
    onSuccess: (r) =>
      toast.success(
        `Top 10 recalculado — ${r.movies} filmes, ${r.series} séries.`
      ),
    onError: () => toast.error('Não deu pra recalcular o Top 10.'),
  })

  if (!cfg) {
    return <p className='py-8 text-center text-muted-foreground'>Carregando…</p>
  }

  const g = cfg.geral
  const patchRanking = (p: Partial<AppConfig['geral']['ranking']>) =>
    setCfg({ ...cfg, geral: { ...g, ranking: { ...g.ranking, ...p } } })

  return (
    <div className='max-w-3xl space-y-8'>
      {/* Top 10 */}
      <section className='space-y-4'>
        <div>
          <h2 className='text-sm font-semibold'>Top 10 (mais assistidos)</h2>
          <p className='text-xs text-muted-foreground'>
            Ranking da sua audiência (do histórico do app), usado nos selos do
            destaque. Vale pro app inteiro.
          </p>
        </div>

        <div className='flex items-center justify-between rounded-xl border bg-muted/40 p-4'>
          <div>
            <Label className='text-sm font-medium'>Ranking ligado</Label>
            <p className='text-xs text-muted-foreground'>
              Calcula/serve o Top 10 (necessário pro selo "#N" do destaque).
            </p>
          </div>
          <Switch
            checked={g.ranking.enabled}
            onCheckedChange={(v) => patchRanking({ enabled: v })}
          />
        </div>

        <div className='space-y-1.5'>
          <Label className='text-sm font-medium'>Janela do ranking (dias)</Label>
          <p className='text-xs text-muted-foreground'>
            Considera as reproduções dos últimos N dias pra montar o Top 10.
          </p>
          <Input
            type='number'
            min={1}
            max={90}
            value={g.ranking.windowDays}
            onChange={(e) => patchRanking({ windowDays: Number(e.target.value) })}
            className='h-9 max-w-[10rem]'
          />
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <Button onClick={() => mut.mutate(cfg)} disabled={mut.isPending}>
            <Save className='size-4' /> Salvar
          </Button>
          <Button
            variant='outline'
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            title='Recalcula o Top 10 agora (sem esperar o cron de hora em hora).'
          >
            <RefreshCw
              className={recompute.isPending ? 'size-4 animate-spin' : 'size-4'}
            />
            Recalcular Top 10 agora
          </Button>
        </div>
      </section>

      {/* Continue assistindo — imagem do card do histórico (GLOBAL). */}
      <section className='space-y-2 border-t pt-6'>
        <div>
          <Label className='text-sm font-medium'>
            "Continue assistindo" — imagem
          </Label>
          <p className='text-xs text-muted-foreground'>
            Fonte da capa dos cards do histórico na home (mistura Filmes e
            Séries) — vale pro app todo. Salva na hora.
          </p>
        </div>
        <div className='flex max-w-md gap-2'>
          {(['tmdb', 'iptv'] as ImageSource[]).map((v) => {
            const active = g.historyImageSource === v
            return (
              <button
                key={v}
                type='button'
                disabled={mut.isPending}
                onClick={() => {
                  if (v !== g.historyImageSource) {
                    mut.mutate({
                      ...cfg,
                      geral: { ...g, historyImageSource: v },
                    })
                  }
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'border-primary bg-accent font-medium'
                    : 'bg-muted/40 hover:bg-muted/70'
                }`}
              >
                {v === 'tmdb' ? 'TMDB' : 'Sua lista'}
              </button>
            )
          })}
        </div>
      </section>

      {/* Reprodução — merge com fallback */}
      <section className='space-y-4 border-t pt-6'>
        <div>
          <h2 className='text-sm font-semibold'>Reprodução</h2>
          <p className='text-xs text-muted-foreground'>
            Como o player reage quando uma fonte da lista está morta.
          </p>
        </div>
        <div className='flex items-center justify-between rounded-xl border bg-muted/40 p-4'>
          <div>
            <Label className='text-sm font-medium'>
              Merge com fallback (fonte alternativa)
            </Label>
            <p className='text-xs text-muted-foreground'>
              Se a fonte morrer ao tocar, o app tenta automaticamente outra fonte
              do mesmo título (quando a lista tem duplicado). Lembre de{' '}
              <b>Salvar</b> (acima).
            </p>
          </div>
          <Switch
            checked={g.mergeFallback}
            onCheckedChange={(v) =>
              setCfg({ ...cfg, geral: { ...g, mergeFallback: v } })
            }
          />
        </div>
      </section>

      {/* Cache do TMDB */}
      <section className='space-y-1.5 border-t pt-6'>
        <Label className='text-sm font-medium'>Cache do TMDB (dias)</Label>
        <p className='text-xs text-muted-foreground'>
          Quantos dias o app reusa os dados/imagens do TMDB do cache antes de
          revalidar. <b>Mais dias</b> = mais rápido (usa cache, menos rede);{' '}
          <b>menos</b> = dados mais atualizados. Padrão 7.
        </p>
        <Input
          type='number'
          min={1}
          max={90}
          value={g.cacheDays}
          disabled={mut.isPending}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n >= 1) {
              setCfg({
                ...cfg,
                geral: { ...g, cacheDays: Math.min(90, Math.round(n)) },
              })
            }
          }}
          className='h-9 max-w-[10rem]'
        />
        <p className='pt-1 text-xs text-muted-foreground'>
          Lembre de clicar <b>Salvar</b> (acima) pra aplicar o cache.
        </p>
      </section>
    </div>
  )
}
