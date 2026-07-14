import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Loader2, Search as SearchIcon, ShieldCheck } from 'lucide-react'
import {
  compareVersion,
  effectivelyBanned,
  listUsers,
  newestVersion,
  platformLabel,
} from '@/lib/admin-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { usePresenceMap } from '@/features/presence/use-account-presence'
import { PlatformIcon } from './platform-icon'
import { UserActionsBar, useUserActions } from './user-actions'

function expiryInfo(iso: string | null) {
  if (!iso) return { label: '—', expired: false }
  const d = new Date(iso)
  return { label: format(d, 'dd/MM/yyyy'), expired: d.getTime() < Date.now() }
}

/** Rótulo curto do último acesso ao app (carimbo do último boot reportado). */
function lastSeenLabel(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return format(d, 'dd/MM/yyyy')
}

export function UserAdmin() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const actions = useUserActions()
  const presenceMap = usePresenceMap()

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = usersQuery.data ?? []
    if (!q) return all
    return all.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.plan ?? '').toLowerCase().includes(q)
    )
  }, [usersQuery.data, search])

  // Versão mais nova vista entre TODOS os usuários (referência de "desatualizado").
  const newest = useMemo(
    () => newestVersion((usersQuery.data ?? []).map((u) => u.appVersion)),
    [usersQuery.data]
  )

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Usuários</h1>
            <p className='text-muted-foreground'>
              Gerencie assinatura e acesso dos usuários.
            </p>
          </div>
          <div className='relative w-full sm:w-64'>
            <SearchIcon className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Buscar…'
              className='ps-8'
            />
          </div>
        </div>

        <div className='overflow-x-auto rounded-2xl border bg-card'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className='text-end'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className='py-10 text-center'>
                    <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
                  </TableCell>
                </TableRow>
              )}
              {usersQuery.isError && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='py-10 text-center text-destructive'
                  >
                    Erro ao carregar. Verifique o box-handler/CORS.
                  </TableCell>
                </TableRow>
              )}
              {!usersQuery.isLoading &&
                filtered.map((u) => {
                  const exp = expiryInfo(u.subscriptionExpiresAt)
                  const banned = effectivelyBanned(u.banned, u.banUntil)
                  const online = presenceMap.get(u.id)?.online ?? false
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          <div className='relative shrink-0'>
                            <Avatar className='size-9'>
                              <AvatarImage
                                src={u.avatarUrl || '/default-avatar.jpg'}
                                alt={u.name}
                              />
                              <AvatarFallback>
                                {getDisplayNameInitials(
                                  u.name || u.email || '?'
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={
                                'absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background ' +
                                (online
                                  ? 'bg-emerald-500'
                                  : 'bg-muted-foreground/50')
                              }
                              title={online ? 'online' : 'offline'}
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
                      </TableCell>
                      <TableCell className='text-sm'>{u.plan || '—'}</TableCell>
                      <TableCell>
                        <span
                          className={
                            exp.expired ? 'text-sm text-destructive' : 'text-sm'
                          }
                        >
                          {exp.label}
                          {exp.expired && exp.label !== '—' ? ' (vencido)' : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-1'>
                          {u.isAdmin && (
                            <Badge variant='secondary' className='gap-1'>
                              <ShieldCheck className='size-3' /> admin
                            </Badge>
                          )}
                          {banned ? (
                            <Badge variant='destructive'>
                              {u.banUntil
                                ? `banido até ${format(new Date(u.banUntil), 'dd/MM/yyyy')}`
                                : 'banido'}
                            </Badge>
                          ) : (
                            <Badge variant='outline'>ativo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.appVersion ? (
                          <div className='flex min-w-0 items-center gap-2'>
                            <PlatformIcon
                              code={u.platform}
                              className='size-4 shrink-0 text-muted-foreground'
                            />
                            <div className='min-w-0'>
                              <p
                                className={
                                  'truncate text-sm ' +
                                  (newest &&
                                  compareVersion(u.appVersion, newest) < 0
                                    ? 'font-medium text-amber-600 dark:text-amber-500'
                                    : '')
                                }
                                title={
                                  newest &&
                                  compareVersion(u.appVersion, newest) < 0
                                    ? `Desatualizado (última versão: ${newest})`
                                    : undefined
                                }
                              >
                                {u.appVersion}
                                {newest &&
                                compareVersion(u.appVersion, newest) < 0
                                  ? ' ⚠'
                                  : ''}
                              </p>
                              <p className='truncate text-xs text-muted-foreground'>
                                {[
                                  platformLabel(u.platform),
                                  lastSeenLabel(u.clientSeenAt),
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className='text-xs text-muted-foreground'>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end'>
                          <UserActionsBar
                            user={u}
                            banned={banned}
                            actions={actions}
                            onViewProfile={() =>
                              navigate({
                                to: '/user-admin/$userId',
                                params: { userId: u.id },
                              })
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              {!usersQuery.isLoading &&
                !usersQuery.isError &&
                filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className='py-10 text-center text-muted-foreground'
                    >
                      Nenhum usuário.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      </Main>

      {actions.dialogs}
    </>
  )
}
