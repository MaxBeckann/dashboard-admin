import { createFileRoute } from '@tanstack/react-router'
import { type PlatformKey } from '@/lib/admin-api'
import { CardScreenConfig } from '@/features/aplicativo/cards-screen'

export const Route = createFileRoute(
  '/_authenticated/aplicativo/$platform/series'
)({
  component: Comp,
})

function Comp() {
  const { platform } = Route.useParams()
  return (
    <CardScreenConfig
      platform={platform as PlatformKey}
      screen='series'
      title='Séries'
    />
  )
}
