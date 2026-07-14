import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/aplicativo/$platform/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/aplicativo/$platform/inicio', params })
  },
})
