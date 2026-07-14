import { createFileRoute } from '@tanstack/react-router'
import { UserDetailPage } from '@/features/user-admin/user-detail-page'

export const Route = createFileRoute('/_authenticated/user-admin/$userId')({
  component: UserDetailPage,
})
