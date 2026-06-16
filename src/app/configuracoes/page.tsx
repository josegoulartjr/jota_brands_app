'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Settings } from '@/types/database'
import toast from 'react-hot-toast'

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [form, setForm] = useState({
    company_name: '',
    pix_key: '',
    pix_key_type: 'cnpj',
    payment_link: '',
    hourly_rate: '40',
  })
  const [saving, setSaving] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).single()
    if (data) {
      setSettings(data)
      setForm({
        company_name: data.company_name,
        pix_key: data.pix_key,
        pix_key_type: data.pix_key_type,
        payment_link: data.payment_link || '',
        hourly_rate: data.hourly_rate.toString(),
      })
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (form.pix_key) generatePreviewQr(form.pix_key, form.company_name)
    else setQrUrl('')
  }, [form.pix_key, form.company_name])

  async function generatePreviewQr(key: string, name: string) {
    try {
      const QRCode = (await import('qrcode')).default
      const url = await QRCode.toDataURL(key, { width: 150, margin: 1 })
      setQrUrl(url)
    } catch {}
  }

  async function handleSave() {
    if (!form.company_name.trim()) return toast.error('Informe o nome da empresa')
    setSaving(true)
    const payload = {
      company_name: form.company_name.trim(),
      pix_key: form.pix_key.trim(),
      pix_key_type: form.pix_key_type,
      payment_link: form.payment_link.trim() || null,
      hourly_rate: Number(form.hourly_rate) || 40,
    }

    const { error } = settings
      ? await supabase.from('settings').update(payload).eq('id', settings.id)
      : await supabase.from('settings').insert(payload)

    if (error) toast.error('Erro ao salvar')
    else { toast.success('Configurações salvas!'); load() }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Dados da agência e pagamento</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Nome da agência / empresa</label>
          <Input
            placeholder="Jota Agência"
            value={form.company_name}
            onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Valor por hora padrão (R$)</label>
          <Input
            type="number"
            placeholder="40"
            value={form.hourly_rate}
            onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
          />
          <p className="text-zinc-600 text-xs mt-1">Usado como padrão em novos jobs por hora</p>
        </div>

        <hr className="border-zinc-800" />

        <div>
          <div className="flex items-center gap-2 mb-4">
            <QrCode size={16} className="text-violet-400" />
            <h3 className="text-white font-medium text-sm">Dados de pagamento Pix</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo de chave</label>
              <Select
                value={form.pix_key_type}
                onChange={e => setForm(f => ({ ...f, pix_key_type: e.target.value }))}
              >
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave aleatória</option>
              </Select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Chave Pix *</label>
              <Input
                placeholder={form.pix_key_type === 'cnpj' ? '00.000.000/0001-00' : 'Sua chave Pix'}
                value={form.pix_key}
                onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Link de pagamento (opcional)</label>
              <Input
                placeholder="https://..."
                value={form.payment_link}
                onChange={e => setForm(f => ({ ...f, payment_link: e.target.value }))}
              />
              <p className="text-zinc-600 text-xs mt-1">Aparece no PDF do relatório</p>
            </div>

            {qrUrl && (
              <div className="flex items-center gap-4 bg-zinc-800/50 rounded-xl p-4">
                <img src={qrUrl} alt="QR Code preview" className="w-20 h-20 bg-white rounded-lg p-1" />
                <div>
                  <p className="text-white text-sm font-medium">Preview do QR Code</p>
                  <p className="text-zinc-400 text-xs mt-1">Aparecerá nos PDFs exportados</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
