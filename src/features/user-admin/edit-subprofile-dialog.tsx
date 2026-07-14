import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  type SubProfile,
  type UpdateSubprofileInput,
} from '@/lib/admin-api'
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
import { Switch } from '@/components/ui/switch'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subProfile: SubProfile | null
  onSubmit: (profileId: string, fields: UpdateSubprofileInput) => void
  isSaving: boolean
}

export function EditSubprofileDialog({
  open,
  onOpenChange,
  subProfile,
  onSubmit,
  isSaving,
}: Props) {
  const [name, setName] = useState('')
  const [isKids, setIsKids] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open && subProfile) {
      setName(subProfile.name ?? '')
      setIsKids(subProfile.isKids)
      setServerUrl(subProfile.serverUrl ?? '')
      setUsername(subProfile.username ?? '')
      setPassword(subProfile.password ?? '')
    }
  }, [open, subProfile])

  function handleSave() {
    if (!subProfile) return
    onSubmit(subProfile.id, {
      name: name.trim(),
      isKids,
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar sub-perfil</DialogTitle>
          <DialogDescription>
            Nome, modo kids e credenciais IPTV deste sub-perfil.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <Label htmlFor='sub-kids'>Modo Kids</Label>
            <Switch id='sub-kids' checked={isKids} onCheckedChange={setIsKids} />
          </div>
          <div className='grid gap-2'>
            <Label>Servidor IPTV</Label>
            <Input
              value={serverUrl}
              placeholder='http://…'
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='grid gap-2'>
              <Label>Usuário IPTV</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>Senha IPTV</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
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
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className='animate-spin' />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
