import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { type AdminUserRow, type SetSubscriptionInput } from '@/lib/admin-api'
import { PLAN_PRESETS } from '@/lib/plans'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUserRow | null
  onSubmit: (input: SetSubscriptionInput) => void
  isSaving: boolean
}

/** ISO → `yyyy-MM-dd` (para o input type=date, em horário local). */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inDaysInput(days: number): string {
  return toDateInput(new Date(Date.now() + days * 86400000).toISOString())
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isSaving,
}: Props) {
  const [planCode, setPlanCode] = useState(PLAN_PRESETS[0].code)
  const [maxProfiles, setMaxProfiles] = useState(PLAN_PRESETS[0].maxProfiles)
  const [expiresDate, setExpiresDate] = useState('')
  const [activatedDate, setActivatedDate] = useState('')

  useEffect(() => {
    if (open && user) {
      const preset =
        PLAN_PRESETS.find((p) => p.code === user.planName) ?? PLAN_PRESETS[0]
      setPlanCode(preset.code)
      setMaxProfiles(user.maxProfiles ?? preset.maxProfiles)
      setExpiresDate(
        toDateInput(user.subscriptionExpiresAt) || inDaysInput(preset.days)
      )
      setActivatedDate('') // vazio = mantém a data de ativação atual
    }
  }, [open, user])

  const preset = PLAN_PRESETS.find((p) => p.code === planCode)

  function handleSave() {
    if (!user || !expiresDate) return
    onSubmit({
      userId: user.id,
      planName: preset?.code,
      planTitle: preset?.title,
      maxProfiles,
      // Fim do dia escolhido (válido até o final daquela data).
      expiresAt: new Date(`${expiresDate}T23:59:59`).toISOString(),
      activatedAt: activatedDate
        ? new Date(`${activatedDate}T12:00:00`).toISOString()
        : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinatura — {user?.name || user?.email}</DialogTitle>
          <DialogDescription>
            Edite o plano, a data de expiração e (opcional) a ativação.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Plano</Label>
            <Select
              value={planCode}
              onValueChange={(v) => {
                setPlanCode(v)
                const p = PLAN_PRESETS.find((x) => x.code === v)
                if (p) {
                  setMaxProfiles(p.maxProfiles)
                  setExpiresDate(inDaysInput(p.days))
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_PRESETS.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-2'>
              <Label>Expira em</Label>
              <Input
                type='date'
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>Máx. telas</Label>
              <Input
                type='number'
                min={1}
                value={maxProfiles}
                onChange={(e) => setMaxProfiles(Number(e.target.value))}
              />
            </div>
          </div>

          <div className='grid gap-2'>
            <Label>
              Ativada em{' '}
              <span className='text-xs font-normal text-muted-foreground'>
                (opcional)
              </span>
            </Label>
            <Input
              type='date'
              value={activatedDate}
              onChange={(e) => setActivatedDate(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Deixe em branco para manter a data de ativação atual.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !expiresDate}>
            {isSaving && <Loader2 className='animate-spin' />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
