import { createFileRoute } from '@tanstack/react-router'
import { type PlatformKey } from '@/lib/admin-api'
import { AplicativoAoVivo } from '@/features/aplicativo/aovivo'

export const Route = createFileRoute(
  '/_authenticated/aplicativo/$platform/aovivo'
)({
  component: Comp,
})

function Comp() {
  const { platform } = Route.useParams()
  return <AplicativoAoVivo platform={platform as PlatformKey} />
}
