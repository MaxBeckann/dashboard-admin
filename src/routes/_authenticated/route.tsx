import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentAdmin } from '@/lib/appwrite-auth'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  // Guard real: exige sessão Appwrite + is_admin. Sem isso, manda pro login.
  // (A segurança de verdade está no box-handler; aqui é o gate da UI.)
  beforeLoad: async ({ location }) => {
    const admin = await getCurrentAdmin()
    if (!admin) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
    useAuthStore.getState().auth.setUser({
      accountNo: admin.id,
      email: admin.email,
      role: ['admin'],
      exp: Date.now() + 24 * 60 * 60 * 1000,
    })
  },
  component: AuthenticatedLayout,
})
