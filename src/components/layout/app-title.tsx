import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { BoxPlusLogo } from '@/assets/boxplus-logo'
import { cn } from '@/lib/utils'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '../ui/button'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className='flex items-center gap-1'>
          <SidebarMenuButton
            size='lg'
            asChild
            className='flex-1 data-[slot=sidebar-menu-button]:!p-1.5'
          >
            <Link to='/' onClick={() => setOpenMobile(false)}>
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
                <BoxPlusLogo className='w-6' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>BOX+</span>
                <span className='truncate text-xs text-muted-foreground'>
                  Painel Admin
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
          <ToggleSidebar className='group-data-[collapsible=icon]:hidden' />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function ToggleSidebar({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar='trigger'
      data-slot='sidebar-trigger'
      variant='ghost'
      size='icon'
      className={cn('aspect-square size-8 max-md:scale-125', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <X className='md:hidden' />
      <Menu className='max-md:hidden' />
      <span className='sr-only'>Toggle Sidebar</span>
    </Button>
  )
}
