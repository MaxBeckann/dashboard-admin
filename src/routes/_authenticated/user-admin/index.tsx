import { createFileRoute } from '@tanstack/react-router'
import { UserAdmin } from '@/features/user-admin'

export const Route = createFileRoute('/_authenticated/user-admin/')({
  component: UserAdmin,
})
