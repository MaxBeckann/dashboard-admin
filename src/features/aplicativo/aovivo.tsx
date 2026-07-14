import { Lock, Radio } from 'lucide-react'
import { type PlatformKey } from '@/lib/admin-api'

/** Ao Vivo não tem config de imagem: canais não existem no TMDB, então o card
 * sempre usa a logo do canal (da lista do usuário). Tela informativa. */
export function AplicativoAoVivo({ platform }: { platform: PlatformKey }) {
  return (
    <div className='max-w-3xl space-y-4'>
      <div className='flex items-start gap-3 rounded-xl border border-dashed bg-muted/20 p-5'>
        <Lock className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div className='space-y-1'>
          <p className='flex items-center gap-2 text-sm font-medium'>
            <Radio className='size-4' /> Ao Vivo (canais) —{' '}
            {platform === 'tv' ? 'TV / PC' : 'Smartphones'}
          </p>
          <p className='text-sm text-muted-foreground'>
            Os canais ao vivo <b>não existem no TMDB</b>, então o card sempre usa
            a <b>logo do canal</b> da própria lista do usuário. Não há o que
            configurar aqui — é sempre a imagem da lista.
          </p>
        </div>
      </div>
    </div>
  )
}
