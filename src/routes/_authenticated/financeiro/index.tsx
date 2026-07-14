import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroOverview } from '@/features/financeiro/overview'

export const Route = createFileRoute('/_authenticated/financeiro/')({
  component: FinanceiroOverview,
})
