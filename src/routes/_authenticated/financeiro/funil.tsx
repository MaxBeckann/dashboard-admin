import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroFunil } from '@/features/financeiro/funil'

export const Route = createFileRoute('/_authenticated/financeiro/funil')({
  component: FinanceiroFunil,
})
