import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroContratacoes } from '@/features/financeiro/contratacoes'

export const Route = createFileRoute('/_authenticated/financeiro/contratacoes')({
  component: FinanceiroContratacoes,
})
