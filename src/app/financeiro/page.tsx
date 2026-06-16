'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingUp, TrendingDown, DollarSign, Pencil, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import type { Transaction, Client } from '@/types/database'
import toast from 'react-hot-toast'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const CATEGORIES_ENTRADA = ['Serviços', 'Recebimento de Job', 'Outro']
const CATEGORIES_SAIDA = ['Ferramentas', 'Salários', 'Marketing', 'Impostos', 'Infraestrutura', 'Fornecedores', 'Outro']

interface TransactionForm {
  description: string
  type: 'entrada' | 'saida'
  amount: string
  category: string
  date: string
  client_id: string
  notes: string
}

const emptyForm = (): TransactionForm => ({
  description: '',
  type: 'entrada',
  amount: '',
  category: 'Serviços',
  date: new Date().toISOString().split('T')[0],
  client_id: '',
  notes: '',
})

interface TxWithClient extends Transaction { client?: Client }

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-400 text-sm">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{formatCurrency(value)}</p>
    </div>
  )
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<TxWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TxWithClient | null>(null)
  const [form, setForm] = useState<TransactionForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterType, setFilterType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, clientsRes] = await Promise.all([
      supabase.from('transactions').select('*, client:clients(*)').order('date', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
    ])
    if (txRes.data) setTransactions(txRes.data as TxWithClient[])
    if (clientsRes.data) setClients(clientsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00')
    if (d.getMonth() + 1 !== filterMonth || d.getFullYear() !== filterYear) return false
    if (filterType && t.type !== filterType) return false
    return true
  })

  const totalEntradas = filtered.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0)
  const totalSaidas = filtered.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0)
  const saldo = totalEntradas - totalSaidas

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(tx: TxWithClient) {
    setEditing(tx)
    setForm({
      description: tx.description,
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date,
      client_id: tx.client_id || '',
      notes: tx.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.description.trim()) return toast.error('Informe a descrição')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Informe o valor')
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      client_id: form.client_id || null,
      notes: form.notes.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('transactions').update(payload).eq('id', editing.id)
      : await supabase.from('transactions').insert(payload)
    if (error) toast.error('Erro ao salvar')
    else { toast.success(editing ? 'Atualizado!' : 'Lançamento criado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('transactions').delete().eq('id', id)
    toast.success('Excluído'); load()
  }

  const categories = form.type === 'entrada' ? CATEGORIES_ENTRADA : CATEGORIES_SAIDA

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Controle de entradas e saídas da agência</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo Lançamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select className="w-36" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </Select>
        <Select className="w-28" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select className="w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Entradas" value={totalEntradas} icon={TrendingUp} color="#10b981" />
        <StatCard label="Saídas" value={totalSaidas} icon={TrendingDown} color="#ef4444" />
        <StatCard label="Saldo" value={saldo} icon={DollarSign} color={saldo >= 0 ? '#6366f1' : '#f59e0b'} />
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Data</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Descrição</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Categoria</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-10 text-zinc-500">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-zinc-500">Nenhum lançamento neste período</td></tr>
              )}
              {filtered.map(tx => (
                <tr key={tx.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 group">
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <span className="text-white">{tx.description}</span>
                    {tx.notes && <p className="text-zinc-500 text-xs">{tx.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{tx.category}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{tx.client?.name || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'entrada' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(tx)} className="text-zinc-400 hover:text-white p-1 rounded">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(tx.id)} className="text-zinc-400 hover:text-red-400 p-1 rounded">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Lançamento' : 'Novo Lançamento'}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'entrada', category: 'Serviços' }))}
              className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                form.type === 'entrada' ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'saida', category: 'Ferramentas' }))}
              className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                form.type === 'saida' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              Saída
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Descrição *</label>
            <Input placeholder="Ex: Pagamento de job — Cliente X" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Valor (R$) *</label>
              <Input type="number" step="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Categoria</label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Cliente (opcional)</label>
              <Select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Nenhum</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Observações</label>
            <Input placeholder="Notas adicionais..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
