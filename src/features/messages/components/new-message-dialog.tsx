import { Megaphone } from 'lucide-react'
import { type AdminUserRow } from '@/lib/admin-api'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { usePresenceMap } from '@/features/presence/use-account-presence'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type MessageTarget =
  | { type: 'broadcast' }
  | { type: 'user'; user: AdminUserRow }

type NewMessageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: AdminUserRow[]
  loading: boolean
  onPick: (target: MessageTarget) => void
}

export function NewMessageDialog({
  open,
  onOpenChange,
  users,
  loading,
  onPick,
}: NewMessageDialogProps) {
  const presenceMap = usePresenceMap()

  function pick(target: MessageTarget) {
    onPick(target)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-150'>
        <DialogHeader>
          <DialogTitle>Nova mensagem</DialogTitle>
          <DialogDescription>Para quem você quer enviar?</DialogDescription>
        </DialogHeader>

        <Command className='rounded-lg border'>
          <CommandInput placeholder='Buscar pessoas...' />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Carregando…' : 'Ninguém encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value='todos broadcast toda a base'
                onSelect={() => pick({ type: 'broadcast' })}
                className='gap-2'
              >
                <div className='flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary'>
                  <Megaphone className='size-4' />
                </div>
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>Todos (broadcast)</span>
                  <span className='text-xs text-muted-foreground'>
                    Enviar para toda a base
                  </span>
                </div>
              </CommandItem>

              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.name} ${u.email} ${u.id}`}
                  onSelect={() => pick({ type: 'user', user: u })}
                  className='gap-2'
                >
                  <div className='relative shrink-0'>
                    <Avatar className='size-8'>
                      <AvatarImage
                        src={u.avatarUrl || '/default-avatar.jpg'}
                        alt={u.name}
                      />
                      <AvatarFallback>
                        {getDisplayNameInitials(u.name || u.email || '?')}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background',
                        presenceMap.get(u.id)?.online
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground/50'
                      )}
                    />
                  </div>
                  <div className='flex min-w-0 flex-col'>
                    <span className='truncate text-sm font-medium'>
                      {u.name || '(sem nome)'}
                    </span>
                    <span className='truncate text-xs text-muted-foreground'>
                      {u.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
