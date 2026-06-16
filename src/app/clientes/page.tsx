'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { CLIENT_COLORS } from '@/lib/utils'
import type { Client } from '@/types/database'
import toast from 'react-hot-toast'

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(CLIENT_COLORS[0])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    if (data) setClients(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setName('')
    setColor(CLIENT_COLORS[0])
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setName(c.name)
    setColor(c.color)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Informe o nome do cliente')
    setSaving(true)
    const payload = { name: name.trim(), color }
    const { error } = editing
      ? await supabase.from('clients').update(payload).eq('id', editing.id)
      : await supabase.from('clients').insert(payload)

    if (error) toast.error('Erro ao salvar')
    else {
      toast.success(editing ? 'Cliente atualizado!' : 'Cliente criado!')
      setModalOpen(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente? Os jobs vinculados também serão excluídos.')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Cliente excluído'); load() }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Gerencie seus clientes e suas tags coloridas</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      {loading && <p className="text-zinc-500">Carregando...</p>}

      <div className="space-y-2">
        {clients.map(c => (
          <div
            key={c.id}
            className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 group hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-white font-medium">{c.name}</span>
              <Badge color={c.color}>{c.name}</Badge>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(c)} className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {!loading && clients.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <p>Nenhum cliente cadastrado ainda.</p>
            <p className="text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Cliente' : 'Novo Cliente'}
      >
        <div className="space-y-5">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nome do cliente *</label>
            <Input
              placeholder="Ex: Empresa XYZ"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Cor da tag</label>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#ffffff' : 'transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Preview:</span>
              <Badge color={color}>{name || 'Cliente'}</Badge>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Cor personalizada (hex)</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-9 rounded-lg border border-zinc-700 bg-zinc-900 cursor-pointer p-1"
              />
              <Input
                placeholder="#6366f1"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
