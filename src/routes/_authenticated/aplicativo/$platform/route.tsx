import { createFileRoute, redirect } from '@tanstack/react-router'
import { type PlatformKey } from '@/lib/admin-api'
import { PlatformLayout } from '@/features/aplicativo/platform-layout'

export const Route = createFileRoute('/_authenticated/aplicativo/$platform')({
  beforeLoad: ({ params }) => {
    // Só 'tv' | 'mobile' — qualquer outro cai no TV.
    if (params.platform !== 'tv' && params.platform !== 'mobile') {
      throw redirect({
        to: '/aplicativo/$platform/inicio',
        params: { platform: 'tv' },
      })
    }
  },
  component: PlatformRoute,
})

function PlatformRoute() {
  const { platform } = Route.useParams()
  return <PlatformLayout platform={platform as PlatformKey} />
}
