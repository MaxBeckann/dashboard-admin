import { createFileRoute } from '@tanstack/react-router'
import { AplicativoLayout } from '@/features/aplicativo'

export const Route = createFileRoute('/_authenticated/aplicativo')({
  component: AplicativoLayout,
})
