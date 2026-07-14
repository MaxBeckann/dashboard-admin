import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { SectionCards } from '@/components/section-cards'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { CouponsSummary } from './coupons-summary'
import { OverviewExtras } from './overview-extras'
import { RecentTransactions } from './recent-transactions'
import { UsersTable } from './users-table'

export function Overview() {
  return (
    <>
      <Header>
        <h1 className='text-base font-semibold'>Início</h1>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fluid className='!p-0'>
        <div className='@container/main flex flex-1 flex-col gap-2'>
          <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
            <SectionCards />
            <div className='px-4 lg:px-6'>
              <CouponsSummary />
            </div>
            <div className='px-4 lg:px-6'>
              <RecentTransactions />
            </div>
            <div className='px-4 lg:px-6'>
              <ChartAreaInteractive />
            </div>
            <div className='px-4 lg:px-6'>
              <UsersTable />
            </div>
            <div className='px-4 lg:px-6'>
              <OverviewExtras />
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
