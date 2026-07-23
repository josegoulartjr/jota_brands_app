'use client'
import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { RefreshCw, ExternalLink, Settings2, Clock, DollarSign, Check, X, Trash2, Link } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency, getMonthName, calculateJobValue, MONTHS } from '@/lib/utils'
import type { Job, Client, Settings } from '@/types/database'
import toast from 'react-hot-toast'
import { notifyPush } from '@/lib/push'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

interface JobWithClient extends Job { client?: Client }

const COLUMNS = {
  backlog:   { label: 'Backlog',   statuses: ['concluido'], targetStatus: 'concluido', accent: '#3A3A3A' },
  faturados: { label: 'Faturados', statuses: ['faturado'],  targetStatus: 'faturado',  accent: '#B72818' },
  pagos:     { label: 'Pagos',     statuses: ['pago'],      targetStatus: 'pago',      accent: '#059669' },
} as const
type ColKey = keyof typeof COLUMNS

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  concluido: { label: 'Backlog',   color: '#888888' },
  faturado:  { label: 'Faturado',  color: '#B72818' },
  pago:      { label: 'Pago',      color: '#059669' },
}

interface JobForm {
  name: string; client_id: string; period_month: number; period_year: number
  type: 'hora' | 'fechado'; hours: string; hourly_rate: string; fixed_value: string
  clickup_url: string; status: string; notes: string
}

function emptyForm(status = 'concluido'): JobForm {
  return {
    name: '', client_id: '', period_month: new Date().getMonth() + 1, period_year: CURRENT_YEAR,
    type: 'fechado', hours: '', hourly_rate: '40', fixed_value: '',
    clickup_url: '', status, notes: '',
  }
}

// -------- Card --------
function JobCard({
  job, index, onEdit, onDelete, selected, onSelect,
}: {
  job: JobWithClient; index: number
  onEdit: (j: JobWithClient) => void
  onDelete: (id: string) => void
  selected: boolean
  onSelect: (id: string, value: boolean) => void
}) {
  const value = calculateJobValue(job)
  const sb = STATUS_BADGE[job.status]
  return (
    <Draggable draggableId={job.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(job)}
          className="rounded-xl p-4 cursor-pointer select-none transition-shadow"
          style={{
            backgroundColor: snapshot.isDragging ? '#2A2A2A' : selected ? '#221010' : '#1E1E1E',
            border: selected ? '1px solid #B72818' : '1px solid #2E2E2E',
            boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
            marginBottom: 8,
            ...provided.draggableProps.style,
          }}
        >
          {/* Título com checkbox */}
          <div className="flex items-start gap-2 mb-2">
            <div
              onClick={e => { e.stopPropagation(); onSelect(job.id, !selected) }}
              className="shrink-0 w-4 h-4 mt-0.5 rounded flex items-center justify-center cursor-pointer transition-all"
              style={{
                backgroundColor: selected ? '#B72818' : 'transparent',
                border: selected ? '1.5px solid #B72818' : '1.5px solid #555',
              }}
            >
              {selected && <Check size={10} className="text-white" strokeWidth={3} />}
            </div>
            <p className="text-white text-sm font-semibold leading-snug">{job.name}</p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3 pl-6">
            {job.client && <Badge color={job.client.color}>{job.client.name}</Badge>}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${sb.color}20`, color: sb.color }}
            >
              {sb.label}
            </span>
          </div>

          {/* Info row */}
          <div className="flex items-center justify-between pl-6">
            <div className="flex items-center gap-3 text-xs" style={{ color: '#888' }}>
              <span>{getMonthName(job.period_month)}/{job.period_year}</span>
              {job.type === 'hora' ? (
                <span className="flex items-center gap-1"><Clock size={11} />{job.hours || 0}h</span>
              ) : (
                <span className="flex items-center gap-1"><DollarSign size={11} />Fechado</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {value > 0 && (
                <span className="text-xs font-bold text-white">{formatCurrency(value)}</span>
              )}
              <div className="flex items-center gap-1">
                {job.clickup_url && (
                  <a
                    href={job.clickup_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onDelete(job.id) }}
                  className="text-zinc-600 hover:text-red-500 transition-colors p-0.5 rounded"
                  title="Excluir job"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}

// -------- Main --------
export default function KanbanPage() {
  const [jobs, setJobs] = useState<JobWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Edit modal
  const [editModal, setEditModal] = useState(false)
  const [editingJob, setEditingJob] = useState<JobWithClient | null>(null)
  const [form, setForm] = useState<JobForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  // ClickUp config modal
  const [cuModal, setCuModal] = useState(false)
  const [cuLists, setCuLists] = useState<{ id: string; name: string; space: string; folder?: string }[]>([])
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState(false)

  // ClickUp staging modal
  const [stageModal, setStageModal] = useState(false)
  const [stageTasks, setStageTasks] = useState<{ name: string; url: string; client_id: string; selected: boolean }[]>([])

  // Import by link
  const [linkModal, setLinkModal] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [jobsRes, clientsRes, settingsRes] = await Promise.all([
      supabase.from('jobs').select('*, client:clients(*)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('settings').select('*').limit(1).single(),
    ])
    if (jobsRes.data) setJobs(jobsRes.data as JobWithClient[])
    if (clientsRes.data) setClients(clientsRes.data)
    if (settingsRes.data) {
      setSettings(settingsRes.data)
      if (settingsRes.data.clickup_list_ids) {
        setSelectedLists(settingsRes.data.clickup_list_ids.split(',').filter(Boolean))
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function colJobs(col: ColKey) {
    const ss = COLUMNS[col].statuses as readonly string[]
    return jobs.filter(j => ss.includes(j.status))
  }

  function jobCol(job: JobWithClient): ColKey {
    for (const [k, c] of Object.entries(COLUMNS)) {
      if ((c.statuses as readonly string[]).includes(job.status)) return k as ColKey
    }
    return 'backlog'
  }

  function toggleSelect(id: string, value: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (value) next.add(id); else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(col: ColKey) {
    const ids = colJobs(col).map(j => j.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  async function bulkMove(targetCol: ColKey) {
    if (!selectedIds.size) return
    const newStatus = COLUMNS[targetCol].targetStatus
    const ids = Array.from(selectedIds)
    setJobs(prev => prev.map(j => selectedIds.has(j.id) ? { ...j, status: newStatus } : j))
    setSelectedIds(new Set())
    const { error } = await supabase.from('jobs').update({ status: newStatus }).in('id', ids)
    if (error) { toast.error('Erro ao mover'); loadData() }
    else {
      toast.success(`${ids.length} job${ids.length !== 1 ? 's' : ''} movido${ids.length !== 1 ? 's' : ''} para ${COLUMNS[targetCol].label}`)
      notifyPush('Jobs atualizados', `${ids.length} job${ids.length !== 1 ? 's' : ''} movido${ids.length !== 1 ? 's' : ''} para ${COLUMNS[targetCol].label}`)
    }
  }

  async function onDragEnd(result: DropResult) {
    const { destination, draggableId } = result
    if (!destination) return
    const dest = destination.droppableId as ColKey
    const job = jobs.find(j => j.id === draggableId)
    if (!job || jobCol(job) === dest) return
    const newStatus = COLUMNS[dest].targetStatus
    setJobs(prev => prev.map(j => j.id === draggableId ? { ...j, status: newStatus } : j))
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', draggableId)
    if (error) { toast.error('Erro ao mover'); loadData() }
    else {
      toast.success(`Movido para ${COLUMNS[dest].label}`)
      notifyPush('Job atualizado', `"${job.name}" movido para ${COLUMNS[dest].label}`)
    }
  }

  function openEdit(job: JobWithClient) {
    setEditingJob(job)
    setForm({
      name: job.name, client_id: job.client_id,
      period_month: job.period_month, period_year: job.period_year,
      type: job.type, hours: job.hours?.toString() || '',
      hourly_rate: job.hourly_rate.toString(), fixed_value: job.fixed_value?.toString() || '',
      clickup_url: job.clickup_url || '', status: job.status, notes: job.notes || '',
    })
    setEditModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este job?')) return
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Job excluído'); loadData() }
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Informe o nome do job')
    if (!form.client_id) return toast.error('Selecione um cliente')
    setSaving(true)
    const payload = {
      name: form.name.trim(), client_id: form.client_id,
      period_month: Number(form.period_month), period_year: Number(form.period_year),
      type: form.type,
      hours: form.type === 'hora' ? (Number(form.hours) || null) : null,
      hourly_rate: Number(form.hourly_rate) || 40,
      fixed_value: form.type === 'fechado' ? (Number(form.fixed_value) || null) : null,
      clickup_url: form.clickup_url.trim() || null,
      status: form.status, notes: form.notes.trim() || null,
    }
    const statusChanged = editingJob && editingJob.status !== payload.status
    const { error } = editingJob
      ? await supabase.from('jobs').update(payload).eq('id', editingJob.id)
      : await supabase.from('jobs').insert(payload)
    if (error) toast.error('Erro ao salvar')
    else {
      toast.success('Job salvo!')
      setEditModal(false)
      loadData()
      if (statusChanged) {
        notifyPush('Job atualizado', `"${payload.name}" mudou para ${STATUS_BADGE[payload.status]?.label || payload.status}`)
      }
    }
    setSaving(false)
  }

  async function loadCuLists() {
    const token = settings?.clickup_token
    if (!token) return toast.error('Token do ClickUp não configurado. Vá em Configurações.')
    setLoadingLists(true)
    try {
      const r1 = await fetch(`/api/clickup?action=teams&token=${encodeURIComponent(token)}`)
      const d1 = await r1.json()
      if (!r1.ok) throw new Error(d1.error)
      const team = d1.teams?.[0]
      if (!team) throw new Error('Nenhum workspace encontrado')
      const r2 = await fetch(`/api/clickup?action=lists&token=${encodeURIComponent(token)}&teamId=${team.id}`)
      const d2 = await r2.json()
      if (!r2.ok) throw new Error(d2.error)
      setCuLists(d2.lists || [])
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoadingLists(false)
  }

  function openCuConfig() {
    setCuModal(true)
    loadCuLists()
  }

  async function saveLists() {
    if (!settings) return
    await supabase.from('settings').update({ clickup_list_ids: selectedLists.join(',') }).eq('id', settings.id)
    toast.success('Listas salvas!')
    setCuModal(false)
    loadData()
  }

  async function syncClickUp() {
    const token = settings?.clickup_token
    if (!token) return toast.error('Token do ClickUp não configurado. Vá em Configurações.')
    if (!selectedLists.length) { openCuConfig(); return }
    setSyncing(true)
    try {
      const res = await fetch(`/api/clickup?action=tasks&token=${encodeURIComponent(token)}&listIds=${selectedLists.join(',')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const tasks: { name: string; url: string }[] = data.tasks || []
      if (!tasks.length) { toast('Nenhuma tarefa em APROVAÇÃO'); setSyncing(false); return }
      const existingUrls = new Set(jobs.map(j => j.clickup_url).filter(Boolean))
      const newTasks = tasks.filter(t => !existingUrls.has(t.url))
      if (!newTasks.length) { toast('Todas as tarefas já foram importadas'); setSyncing(false); return }
      setStageTasks(newTasks.map(t => ({ name: t.name, url: t.url, client_id: clients[0]?.id || '', selected: true })))
      setStageModal(true)
    } catch (e: any) {
      toast.error(e.message)
    }
    setSyncing(false)
  }

  async function importByLink() {
    const token = settings?.clickup_token
    if (!token) return toast.error('Token do ClickUp não configurado. Vá em Configurações.')
    if (!linkInput.trim()) return toast.error('Cole a URL do card')
    setLinkLoading(true)
    try {
      const res = await fetch(`/api/clickup?action=task&token=${encodeURIComponent(token)}&url=${encodeURIComponent(linkInput.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const task = data.task
      const existingUrl = jobs.find(j => j.clickup_url === task.url)
      if (existingUrl) { toast('Este card já foi importado'); setLinkLoading(false); return }
      setStageTasks([{ name: task.name, url: task.url, client_id: clients[0]?.id || '', selected: true }])
      setStageModal(true)
      setLinkModal(false)
      setLinkInput('')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar o card')
    }
    setLinkLoading(false)
  }

  async function confirmImport() {
    const selected = stageTasks.filter(t => t.selected)
    if (!selected.length) return toast.error('Selecione ao menos um job para importar')
    if (selected.some(t => !t.client_id)) return toast.error('Atribua um cliente a todos os jobs selecionados')
    const inserts = selected.map(t => ({
      name: t.name, clickup_url: t.url, client_id: t.client_id,
      status: 'concluido', period_month: new Date().getMonth() + 1, period_year: CURRENT_YEAR,
      type: 'fechado' as const, hourly_rate: settings?.hourly_rate || 40,
    }))
    const { error } = await supabase.from('jobs').insert(inserts)
    if (error) return toast.error('Erro ao importar: ' + error.message)
    toast.success(`${inserts.length} job${inserts.length !== 1 ? 's' : ''} importado${inserts.length !== 1 ? 's' : ''}!`)
    setStageModal(false)
    loadData()
  }

  const totalByCol = (col: ColKey) => colJobs(col).reduce((s, j) => s + calculateJobValue(j), 0)

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Arraste os cards ou selecione para mover em grupo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCuConfig}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Configurar listas do ClickUp"
          >
            <Settings2 size={18} />
          </button>
          <Button onClick={() => setLinkModal(true)} variant="outline">
            <Link size={15} /> Importar por link
          </Button>
          <Button onClick={syncClickUp} disabled={syncing} variant="outline">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ClickUp'}
          </Button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">Carregando...</div>
      ) : (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 flex-1 overflow-x-auto pb-2">
              {(Object.entries(COLUMNS) as [ColKey, typeof COLUMNS[ColKey]][]).map(([key, col]) => {
                const colItems = colJobs(key)
                const total = totalByCol(key)
                const allColSelected = colItems.length > 0 && colItems.every(j => selectedIds.has(j.id))
                const someColSelected = colItems.some(j => selectedIds.has(j.id))
                return (
                  <div key={key} className="flex flex-col w-80 shrink-0">
                    {/* Column header */}
                    <div
                      className="flex items-center justify-between px-4 py-3 rounded-t-xl"
                      style={{ backgroundColor: `${col.accent}22`, borderBottom: `2px solid ${col.accent}` }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Select-all checkbox */}
                        <div
                          onClick={() => toggleSelectAll(key)}
                          className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all shrink-0"
                          title={allColSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                          style={{
                            backgroundColor: allColSelected ? col.accent : someColSelected ? `${col.accent}55` : 'transparent',
                            border: `1.5px solid ${allColSelected || someColSelected ? col.accent : '#555'}`,
                          }}
                        >
                          {allColSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                          {!allColSelected && someColSelected && <div className="w-2 h-0.5 rounded" style={{ backgroundColor: col.accent }} />}
                        </div>
                        <span className="text-white font-semibold text-sm">{col.label}</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${col.accent}33`, color: col.accent }}
                        >
                          {colItems.length}
                        </span>
                      </div>
                      {total > 0 && (
                        <span className="text-xs font-medium" style={{ color: col.accent }}>
                          {formatCurrency(total)}
                        </span>
                      )}
                    </div>

                    {/* Droppable */}
                    <Droppable droppableId={key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 p-2 rounded-b-xl min-h-32 overflow-y-auto"
                          style={{
                            backgroundColor: snapshot.isDraggingOver ? '#1F1F1F' : '#161616',
                            border: `1px solid ${snapshot.isDraggingOver ? col.accent : '#222'}`,
                            borderTop: 'none',
                            transition: 'background-color 0.15s',
                            maxHeight: 'calc(100vh - 260px)',
                          }}
                        >
                          {colItems.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-center text-zinc-600 text-xs py-8">Sem jobs aqui</p>
                          )}
                          {colItems.map((job, index) => (
                            <JobCard
                              key={job.id}
                              job={job}
                              index={index}
                              onEdit={openEdit}
                              onDelete={handleDelete}
                              selected={selectedIds.has(job.id)}
                              onSelect={toggleSelect}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl mt-3 shrink-0"
              style={{ backgroundColor: '#1C1C1C', border: '1px solid #2E2E2E' }}
            >
              <span className="text-white text-sm font-semibold">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <span style={{ color: '#333' }}>|</span>
              <span className="text-zinc-400 text-sm">Mover para:</span>
              {(Object.entries(COLUMNS) as [ColKey, typeof COLUMNS[ColKey]][]).map(([key, col]) => (
                <button
                  key={key}
                  onClick={() => bulkMove(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: `${col.accent}25`,
                    color: col.accent,
                    border: `1px solid ${col.accent}55`,
                  }}
                >
                  {col.label}
                </button>
              ))}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto flex items-center gap-1 text-xs transition-colors"
                style={{ color: '#666' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#666')}
              >
                <X size={13} /> Cancelar seleção
              </button>
            </div>
          )}
        </>
      )}

      {/* ---- Edit Modal ---- */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={editingJob ? 'Editar Job' : 'Novo Job'} className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nome do Job *</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do job" />
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
                <option value="concluido">Backlog</option>
                <option value="faturado">Faturado</option>
                <option value="pago">Pago</option>
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
            <label className="text-xs text-zinc-400 mb-2 block">Tipo de cobrança</label>
            <div className="flex gap-2">
              {(['hora', 'fechado'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="flex-1 py-2 rounded-lg text-sm border transition-colors"
                  style={form.type === t
                    ? { borderColor: '#B72818', backgroundColor: '#B7281820', color: '#E5321E' }
                    : { borderColor: '#3A3A3A', color: '#888' }}>
                  {t === 'hora' ? 'Por hora' : 'Valor fechado'}
                </button>
              ))}
            </div>
          </div>
          {form.type === 'hora' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Horas</label>
                <Input type="number" step="0.5" placeholder="0" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Valor/hora (R$)</label>
                <Input type="number" placeholder="40" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} />
              </div>
            </div>
          )}
          {form.type === 'fechado' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Valor fixo (R$)</label>
              <Input type="number" placeholder="0,00" value={form.fixed_value} onChange={e => setForm(f => ({ ...f, fixed_value: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Link ClickUp</label>
            <Input placeholder="https://app.clickup.com/..." value={form.clickup_url} onChange={e => setForm(f => ({ ...f, clickup_url: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}><Check size={16} />{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* ---- Import by Link Modal ---- */}
      <Modal open={linkModal} onClose={() => { setLinkModal(false); setLinkInput('') }} title="Importar card por link" className="max-w-md">
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Cole o link direto do card no ClickUp:</p>
          <Input
            placeholder="https://app.clickup.com/t/..."
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') importByLink() }}
            autoFocus
          />
          <p className="text-zinc-600 text-xs">Abra o card no ClickUp → copie a URL do navegador</p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => { setLinkModal(false); setLinkInput('') }}>Cancelar</Button>
            <Button onClick={importByLink} disabled={linkLoading || !linkInput.trim()}>
              {linkLoading ? 'Buscando...' : <><Check size={15} /> Importar</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- ClickUp Config Modal ---- */}
      <Modal open={cuModal} onClose={() => setCuModal(false)} title="Configurar Listas do ClickUp" className="max-w-lg">
        <div className="space-y-4">
          {loadingLists ? (
            <p className="text-zinc-400 text-sm text-center py-6">Carregando listas do ClickUp...</p>
          ) : cuLists.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">Nenhuma lista encontrada. Verifique o token em Configurações.</p>
          ) : (
            <>
              <p className="text-zinc-400 text-sm">Selecione as listas que serão sincronizadas:</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cuLists.map(l => (
                  <label key={l.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors" style={{ border: '1px solid #2E2E2E' }}>
                    <input
                      type="checkbox"
                      checked={selectedLists.includes(l.id)}
                      onChange={e => setSelectedLists(prev =>
                        e.target.checked ? [...prev, l.id] : prev.filter(x => x !== l.id)
                      )}
                      className="accent-red-600 w-4 h-4"
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{l.name}</p>
                      <p className="text-zinc-500 text-xs">{l.space}{l.folder ? ` › ${l.folder}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setCuModal(false)}>Cancelar</Button>
            <Button onClick={saveLists} disabled={!selectedLists.length}><Check size={16} />Salvar seleção</Button>
          </div>
        </div>
      </Modal>

      {/* ---- Staging Modal ---- */}
      <Modal open={stageModal} onClose={() => setStageModal(false)} title="Importar do ClickUp" className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Selecione as tarefas que deseja importar e atribua um cliente:</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {stageTasks.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: t.selected ? '#1A1A1A' : '#141414', border: `1px solid ${t.selected ? '#2E2E2E' : '#1e1e1e'}`, opacity: t.selected ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={e => setStageTasks(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                  style={{ width: 16, height: 16, accentColor: '#E5321E', cursor: 'pointer', flexShrink: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.name}</p>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white text-xs flex items-center gap-1 mt-0.5">
                      <ExternalLink size={10} /> ClickUp
                    </a>
                  )}
                </div>
                {t.selected && (
                  <Select
                    className="w-40"
                    value={t.client_id}
                    onChange={e => setStageTasks(prev => prev.map((x, j) => j === i ? { ...x, client_id: e.target.value } : x))}
                  >
                    <option value="">Cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setStageModal(false)}><X size={15} />Cancelar</Button>
            <Button onClick={confirmImport} disabled={!stageTasks.some(t => t.selected)}>
              <Check size={15} />Importar {stageTasks.filter(t => t.selected).length} job{stageTasks.filter(t => t.selected).length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
