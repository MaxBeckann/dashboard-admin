import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { effectivelyBanned, listUsers, type AdminUserRow } from '@/lib/admin-api'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePresenceMap } from '@/features/presence/use-account-presence'

function SortHead({
  label,
  onClick,
}: {
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex items-center gap-1 hover:text-foreground'
    >
      {label}
      <ArrowUpDown className='size-3.5 opacity-60' />
    </button>
  )
}

export function UsersTable() {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])
  const presenceMap = usePresenceMap()

  const q = useQuery({ queryKey: ['admin-users'], queryFn: () => listUsers() })
  const users = q.data ?? []

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortHead
            label='Usuário'
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          />
        ),
        cell: ({ row }) => {
          const u = row.original
          const online = presenceMap.get(u.id)?.online ?? false
          return (
            <div className='flex items-center gap-3'>
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
                    online ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                  )}
                />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  {u.name || '(sem nome)'}
                </p>
                <p className='truncate text-xs text-muted-foreground'>
                  {u.email}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'plan',
        header: ({ column }) => (
          <SortHead
            label='Plano'
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          />
        ),
        cell: ({ row }) => (
          <span className='text-sm'>{row.original.plan || '—'}</span>
        ),
      },
      {
        accessorKey: 'subscriptionExpiresAt',
        header: ({ column }) => (
          <SortHead
            label='Expira'
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          />
        ),
        cell: ({ row }) => {
          const iso = row.original.subscriptionExpiresAt
          if (!iso) return <span className='text-sm'>—</span>
          const d = new Date(iso)
          const expired = d.getTime() < Date.now()
          return (
            <span
              className={cn('text-sm', expired && 'text-destructive')}
            >
              {format(d, 'dd/MM/yyyy')}
              {expired ? ' (vencido)' : ''}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original
          const banned = effectivelyBanned(u.banned, u.banUntil)
          return (
            <div className='flex flex-wrap gap-1'>
              {u.isAdmin && (
                <Badge variant='secondary' className='gap-1'>
                  <ShieldCheck className='size-3' /> admin
                </Badge>
              )}
              {banned ? (
                <Badge variant='destructive'>banido</Badge>
              ) : (
                <Badge variant='outline'>ativo</Badge>
              )}
            </div>
          )
        },
      },
    ],
    [presenceMap]
  )

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  })

  return (
    <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length} className='py-10 text-center'>
                    <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
                  </TableCell>
                </TableRow>
              )}
              {!q.isLoading &&
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className='cursor-pointer'
                    onClick={() =>
                      navigate({
                        to: '/user-admin/$userId',
                        params: { userId: row.original.id },
                      })
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!q.isLoading && users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className='py-10 text-center text-muted-foreground'
                  >
                    Nenhum usuário.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

        {table.getPageCount() > 1 && (
          <div className='flex items-center justify-between border-t px-4 py-3'>
            <span className='text-xs text-muted-foreground'>
              Página {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </span>
            <div className='flex gap-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className='size-4' />
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
        )}
    </div>
  )
}
