import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroRenovacoes } from '@/features/financeiro/renovacoes'

export const Route = createFileRoute('/_authenticated/financeiro/renovacoes')({
  component: FinanceiroRenovacoes,
})
