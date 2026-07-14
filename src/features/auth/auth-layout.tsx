import { BoxPlusLogo } from '@/assets/boxplus-logo'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className='relative grid h-svh w-full items-center justify-center bg-cover bg-center bg-no-repeat'
      style={{ backgroundImage: 'url(/boxplusbemvindo.jpg)' }}
    >
      {/* Scrim escuro pra dar contraste e legibilidade sobre a foto. */}
      <div className='absolute inset-0 bg-black/60' />

      <div className='relative z-10 mx-auto flex w-full flex-col items-center justify-center space-y-2 px-4 py-8 sm:p-8'>
        {/* Logo BOX+ centralizada. */}
        <BoxPlusLogo className='mb-6 h-20 w-auto text-white drop-shadow-lg' />
        {children}
      </div>
    </div>
  )
}
