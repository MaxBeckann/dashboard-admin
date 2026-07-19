import { createFileRoute } from '@tanstack/react-router'
import { AplicativoOcultar } from '@/features/aplicativo/ocultar'

export const Route = createFileRoute('/_authenticated/aplicativo/ocultar')({
  component: AplicativoOcultar,
})
