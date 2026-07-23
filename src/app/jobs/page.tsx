'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, Check, X, Clock, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, getMonthName, calculateJobValue, MONTHS } from '@/lib/utils'
import type { Job, Client } from '@/types/database'
import toast from 'react-hot-toast'
import { notifyPush } from '@/lib/push'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  concluido: { label: 'Backlog',   color: '#888888' },
  faturado:  { label: 'Faturado',  color: '#B72818' },
  pago:      { label: 'Pago',      color: '#059669' },
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

interface JobWithClient extends Job {
  client?: Client
}

interface JobForm {
  name: string
  client_id: string
  period_month: number
  period_year: number
  type: 'hora' | 'fechado'
  hours: string
  hourly_rate: string
  fixed_value: string
  clickup_url: string
  status: string
  notes: string
}

const emptyForm = (): JobForm => ({
  name: '',
  client_id: '',
  period_month: new Date().getMonth() + 1,
  period_year: CURRENT_YEAR,
  type: 'hora',
  hours: '',
  hourly_rate: '40',
  fixed_value: '',
  clickup_url: '',
  status: 'concluido',
  notes: '',
})

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobWithClient | null>(null)
  const [form, setForm] = useState<JobForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  // Filtros
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [jobsRes, clientsRes] = await Promise.all([
      supabase.from('jobs').select('*, client:clients(*)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
    ])
    if (jobsRes.data) setJobs(jobsRes.data as JobWithClient[])
    if (clientsRes.data) setClients(clientsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = jobs.filter(j => {
    if (filterMonth && j.period_month !== filterMonth) return false
    if (filterYear && j.period_year !== filterYear) return false
    if (filterClient && j.client_id !== filterClient) return false
    if (filterStatus && j.status !== filterStatus) return false
    return true
  })

  const totalValue = filtered.reduce((sum, j) => sum + calculateJobValue(j), 0)

  function openNew() {
    setEditingJob(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(job: JobWithClient) {
    setEditingJob(job)
    setForm({
      name: job.name,
      client_id: job.client_id,
      period_month: job.period_month,
      period_year: job.period_year,
      type: job.type,
      hours: job.hours?.toString() || '',
      hourly_rate: job.hourly_rate.toString(),
      fixed_value: job.fixed_value?.toString() || '',
      clickup_url: job.clickup_url || '',
      status: job.status,
      notes: job.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Informe o nome do job')
    if (!form.client_id) return toast.error('Selecione um cliente')

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      client_id: form.client_id,
      period_month: Number(form.period_month),
      period_year: Number(form.period_year),
      type: form.type,
      hours: form.type === 'hora' ? (Number(form.hours) || null) : null,
      hourly_rate: Number(form.hourly_rate) || 40,
      fixed_value: form.type === 'fechado' ? (Number(form.fixed_value) || null) : null,
      clickup_url: form.clickup_url.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    const statusChanged = editingJob && editingJob.status !== payload.status
    const { error } = editingJob
      ? await supabase.from('jobs').update(payload).eq('id', editingJob.id)
      : await supabase.from('jobs').insert(payload)

    if (error) {
      toast.error('Erro ao salvar job')
    } else {
      toast.success(editingJob ? 'Job atualizado!' : 'Job criado!')
      setModalOpen(false)
      loadData()
      if (statusChanged) {
        notifyPush('Job atualizado', `"${payload.name}" mudou para ${STATUS_LABELS[payload.status]?.label || payload.status}`)
      }
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este job?')) return
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Job excluído'); loadData() }
  }

  async function quickStatus(job: JobWithClient, status: string) {
    await supabase.from('jobs').update({ status }).eq('id', job.id)
    loadData()
    notifyPush('Job atualizado', `"${job.name}" mudou para ${STATUS_LABELS[status]?.label || status}`)
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Gerencie todos os trabalhos e serviços</p>
        </div>
        <Button onClick={openNew} size="md">
          <Plus size={16} /> Novo Job
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select
          className="w-36"
          value={filterMonth}
          onChange={e => setFilterMonth(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </Select>
        <Select
          className="w-28"
          value={filterYear}
          onChange={e => setFilterYear(Number(e.target.value))}
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select
          className="w-44"
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select
          className="w-36"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-6 mb-4">
        <span className="text-zinc-400 text-sm">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-zinc-400 text-sm">Total: <span className="text-white font-semibold">{formatCurrency(totalValue)}</span></span>
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Job</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Período</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Tipo</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Link</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-12 text-zinc-500">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-zinc-500">Nenhum job encontrado</td></tr>
              )}
              {filtered.map(job => (
                <tr key={job.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{job.name}</span>
                    {job.notes && <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">{job.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {job.client && (
                      <Badge color={job.client.color}>{job.client.name}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {getMonthName(job.period_month)}/{job.period_year}
                  </td>
                  <td className="px-4 py-3">
                    {job.type === 'hora' ? (
                      <span className="flex items-center gap-1 text-zinc-400 text-xs">
                        <Clock size={12} />
                        {job.hours || 0}h
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-400 text-xs">
                        <DollarSign size={12} />
                        Fechado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    {formatCurrency(calculateJobValue(job))}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={job.status}
                      onChange={e => quickStatus(job, e.target.value)}
                      className="bg-transparent text-xs border-0 outline-none cursor-pointer"
                      style={{ color: STATUS_LABELS[job.status]?.color }}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k} style={{ color: v.color, background: '#18181b' }}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {job.clickup_url && (
                      <a
                        href={job.clickup_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-red-500 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(job)} className="text-zinc-400 hover:text-white p-1 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(job.id)} className="text-zinc-400 hover:text-red-400 p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-700">
                  <td colSpan={4} className="px-4 py-3 text-zinc-400 text-sm font-medium">Total</td>
                  <td className="px-4 py-3 text-right text-white font-bold">{formatCurrency(totalValue)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Novo/Editar Job */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingJob ? 'Editar Job' : 'Novo Job'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nome do Job *</label>
            <Input
              placeholder="Ex: Criação de posts para Instagram"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Cliente *</label>
              <Select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Selecionar cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Status</label>
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Mês</label>
              <Select value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: Number(e.target.value) }))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Ano</label>
              <Select value={form.period_year} onChange={e => setForm(f => ({ ...f, period_year: Number(e.target.value) }))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo de cobrança</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type: 'hora' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  form.type === 'hora'
                    ? 'border-red-700 bg-red-900/20 text-red-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                Por hora (R$40/h)
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type: 'fechado' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  form.type === 'fechado'
                    ? 'border-red-700 bg-red-900/20 text-red-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                Valor fechado
              </button>
            </div>
          </div>

          {form.type === 'hora' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Horas trabalhadas</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Valor por hora (R$)</label>
                <Input
                  type="number"
                  placeholder="40"
                  value={form.hourly_rate}
                  onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                />
              </div>
            </div>
          )}

          {form.type === 'fechado' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Valor fixo (R$)</label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.fixed_value}
                onChange={e => setForm(f => ({ ...f, fixed_value: e.target.value }))}
              />
            </div>
          )}

          {form.type === 'hora' && form.hours && (
            <div className="bg-red-900/10 border border-red-900/20 rounded-lg px-4 py-2">
              <span className="text-red-400 text-sm">
                Total: <strong>{formatCurrency(Number(form.hours) * Number(form.hourly_rate || 40))}</strong>
              </span>
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Link do card no ClickUp</label>
            <Input
              placeholder="https://app.clickup.com/..."
              value={form.clickup_url}
              onChange={e => setForm(f => ({ ...f, clickup_url: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Observações</label>
            <textarea
              rows={2}
              placeholder="Detalhes adicionais..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="flex w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar Job'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
