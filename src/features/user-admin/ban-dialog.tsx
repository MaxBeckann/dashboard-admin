import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { type AdminUserRow, type SetBanInput } from '@/lib/admin-api'
import { toast } from 'sonner'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUserRow | null
  onSubmit: (opts: SetBanInput) => void
  isSaving: boolean
}

type Mode = 'permanent' | 'until'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10) // yyyy-mm-dd
}

export function BanDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isSaving,
}: Props) {
  const [mode, setMode] = useState<Mode>('permanent')
  const [dateStr, setDateStr] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open) {
      setMode('permanent')
      setDateStr('')
      setMessage('')
    }
  }, [open])

  function preset(days: number) {
    setMode('until')
    setDateStr(toDateInput(new Date(Date.now() + days * 86400000)))
  }

  function handleSave() {
    let banUntil: string | null = null
    if (mode === 'until') {
      if (!dateStr) {
        toast.error('Escolha uma data.')
        return
      }
      // Fim do dia selecionado (local) → ISO/UTC.
      banUntil = new Date(`${dateStr}T23:59:59`).toISOString()
    }
    onSubmit({ banUntil, banMessage: message.trim() || null })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banir — {user?.name || user?.email}</DialogTitle>
          <DialogDescription>
            O usuário verá uma tela de bloqueio com a mensagem abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Duração</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className='flex gap-6'
            >
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='permanent' id='ban-perm' />
                <label htmlFor='ban-perm' className='text-sm'>
                  Permanente
                </label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='until' id='ban-until' />
                <label htmlFor='ban-until' className='text-sm'>
                  Até uma data
                </label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'until' && (
            <div className='grid gap-2'>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => preset(7)}
                >
                  7 dias
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => preset(30)}
                >
                  30 dias
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => preset(90)}
                >
                  90 dias
                </Button>
              </div>
              <Input
                type='date'
                value={dateStr}
                min={toDateInput(new Date())}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
          )}

          <div className='grid gap-2'>
            <Label>Mensagem (opcional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder='Ex: Sua conta foi suspensa por violação dos Termos. Fale com o suporte.'
            />
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
          <Button
            variant='destructive'
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className='animate-spin' />}
            Banir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
