import { createFileRoute } from '@tanstack/react-router'
import { AplicativoGeral } from '@/features/aplicativo/geral'

export const Route = createFileRoute('/_authenticated/aplicativo/geral')({
  component: AplicativoGeral,
})
