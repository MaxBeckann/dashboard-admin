import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAppConfig,
  setAppConfig,
  type AppConfig,
  type ImageSource,
  type PlatformKey,
} from '@/lib/admin-api'
import { Label } from '@/components/ui/label'

/** Parte do app que HOJE usa sempre a lista (IPTV) e ainda não é configurável.
 * Informativo: mostra o que usa + selo "Em breve". */
function InfoRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2'>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{name}</p>
        <p className='text-xs text-muted-foreground'>
          {desc} · usa <b>Sua lista (IPTV)</b>
        </p>
      </div>
      <span className='inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
        <Lock className='size-3' /> Em breve
      </span>
    </div>
  )
}

/** Config de imagem de card de UMA tela de catálogo (Filmes ou Séries) numa
 * plataforma. Salva na hora ao escolher. */
export function CardScreenConfig({
  platform,
  screen,
  title,
}: {
  platform: PlatformKey
  screen: 'filmes' | 'series'
  title: string
}) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['app-config'], queryFn: getAppConfig })
  const mut = useMutation({
    mutationFn: setAppConfig,
    onSuccess: () => {
      toast.success('Salvo. Vale no próximo boot do app.')
      qc.invalidateQueries({ queryKey: ['app-config'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  if (!q.data) {
    return <p className='py-8 text-center text-muted-foreground'>Carregando…</p>
  }
  const cfg = q.data
  const current = cfg[platform][screen].imageSource

  const pick = (imageSource: ImageSource) => {
    if (imageSource === current || mut.isPending) return
    mut.mutate({
      ...cfg,
      [platform]: {
        ...cfg[platform],
        [screen]: { imageSource },
      },
    })
  }

  const Option = ({
    value,
    heading,
    desc,
  }: {
    value: ImageSource
    heading: string
    desc: string
  }) => {
    const active = current === value
    return (
      <button
        type='button'
        onClick={() => pick(value)}
        disabled={mut.isPending}
        className={`flex-1 rounded-xl border p-4 text-left transition-colors ${
          active ? 'border-primary bg-accent' : 'bg-muted/40 hover:bg-muted/70'
        }`}
      >
        <div className='flex items-center gap-2'>
          <span
            className={`size-3 rounded-full ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}
          />
          <span className='font-medium'>{heading}</span>
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>{desc}</p>
      </button>
    )
  }

  const plat = platform === 'tv' ? 'TV / PC' : 'Smartphones'

  return (
    <div className='max-w-3xl space-y-6'>
      <div className='space-y-1'>
        <Label className='text-sm font-medium'>
          {title} — imagem dos cards das fileiras
        </Label>
        <p className='text-xs text-muted-foreground'>
          Vale nas <b>fileiras (carrosséis horizontais)</b> de{' '}
          {title.toLowerCase()} em <b>{plat}</b>: aquelas <b>várias categorias</b>
          , cada uma com ~10 cards que passam de lado — no INÍCIO e na aba{' '}
          {title}. É a <b>capa desses cards</b> que muda aqui.
        </p>
        <p className='text-xs text-muted-foreground'>
          Não vale nas <b>grades cheias</b> (busca, "Ver Todos", favoritos), que
          estão listadas abaixo.
        </p>
      </div>
      <div className='flex flex-col gap-3 sm:flex-row'>
        <Option
          value='tmdb'
          heading='TMDB (padrão)'
          desc='Poster/backdrop limpo do TMDB, com fallback pra imagem da lista. Mais bonito, depende de rede.'
        />
        <Option
          value='iptv'
          heading='Sua lista (IPTV)'
          desc='Usa a capa da própria lista do usuário, sem buscar no TMDB. Instantâneo e igual ao provedor.'
        />
      </div>

      {/* Outras partes: hoje sempre a lista (IPTV), por otimização. Só informativo. */}
      <div className='space-y-3 border-t pt-5'>
        <div>
          <Label className='text-sm font-medium'>
            Outras partes de {title.toLowerCase()}
          </Label>
          <p className='text-xs text-muted-foreground'>
            Estas partes usam <b>sempre a imagem da lista (IPTV)</b> e ainda não
            são configuráveis (em breve).
          </p>
        </div>
        <InfoRow name='Busca' desc='Grade de resultados da busca' />
        <InfoRow
          name='"Ver Todos" / categorias'
          desc='Grade completa de uma categoria'
        />
        <InfoRow name='Favoritos' desc='Grade dos favoritos do usuário' />
        <p className='rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground'>
          <b>Por que a lista (IPTV) nessas partes?</b> São <b>grades</b> que
          mostram MUITOS cards de uma vez e com rolagem rápida. Buscar cada capa
          no TMDB deixaria a busca/grade pesada e lenta — então elas usam a capa
          da lista, que é instantânea. Nas <b>fileiras da home</b> (acima), como
          são poucos cards por vez, dá pra usar o TMDB sem custo. Depois dá pra
          liberar a escolha aqui também.
        </p>
      </div>
    </div>
  )
}
