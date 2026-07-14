import { createFileRoute } from '@tanstack/react-router'
import { type PlatformKey } from '@/lib/admin-api'
import { AplicativoInicio } from '@/features/aplicativo/inicio'

export const Route = createFileRoute(
  '/_authenticated/aplicativo/$platform/inicio'
)({
  component: Comp,
})

function Comp() {
  const { platform } = Route.useParams()
  return <AplicativoInicio platform={platform as PlatformKey} />
}
