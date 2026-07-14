import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/aplicativo/')({
  beforeLoad: () => {
    throw redirect({
      to: '/aplicativo/$platform/inicio',
      params: { platform: 'tv' },
    })
  },
})
