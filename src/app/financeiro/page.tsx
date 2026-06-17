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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

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

function StatCard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: number; icon: React.ElementType; accent: string; sub?: string
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#666' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18` }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(value)}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#555' }}>{sub}</p>}
    </div>
  )
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1C1C1C',
  border: '1px solid #2E2E2E',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
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

  // Dados para gráfico de barras — últimos 6 meses
  const barData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(filterYear, filterMonth - 1 - (5 - i))
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const txs = transactions.filter(t => {
      const td = new Date(t.date + 'T00:00:00')
      return td.getMonth() + 1 === m && td.getFullYear() === y
    })
    return {
      name: MONTHS[m - 1].slice(0, 3),
      Entradas: txs.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0),
      Saídas: txs.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0),
    }
  })

  // Dados para gráfico de pizza — categorias do mês filtrado
  const catMap: Record<string, number> = {}
  filtered.filter(t => t.type === 'saida').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount
  })
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }))
  const PIE_COLORS = ['#B72818', '#942013', '#E5321E', '#6B170E', '#D4D4D4', '#595959', '#2B2B2B']

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
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Financeiro</h1>
          <p className="text-xs mt-0.5" style={{ color: '#666' }}>Controle de entradas e saídas</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={15} /> Novo Lançamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Entradas" value={totalEntradas} icon={TrendingUp} accent="#22c55e" sub={`${filtered.filter(t => t.type === 'entrada').length} lançamentos`} />
        <StatCard label="Saídas" value={totalSaidas} icon={TrendingDown} accent="#ef4444" sub={`${filtered.filter(t => t.type === 'saida').length} lançamentos`} />
        <StatCard
          label="Saldo"
          value={saldo}
          icon={DollarSign}
          accent={saldo >= 0 ? '#B72818' : '#f59e0b'}
          sub={saldo >= 0 ? 'resultado positivo' : 'resultado negativo'}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Barras — 6 meses */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
          <p className="text-sm font-semibold text-white mb-4">Evolução — últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v) => formatCurrency(Number(v))}
                cursor={{ fill: '#ffffff08' }}
              />
              <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill="#B72818" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pizza — categorias de saída */}
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
          <p className="text-sm font-semibold text-white mb-4">Saídas por categoria</p>
          {pieData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs" style={{ color: '#444' }}>Sem saídas no período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => formatCurrency(Number(v))} />
                <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ color: '#888', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#2A2A2A' }}>
          <p className="text-sm font-semibold text-white">
            Lançamentos — {MONTHS[filterMonth - 1]} {filterYear}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Data</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Descrição</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Categoria</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Cliente</th>
                <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Valor</th>
                <th className="px-5 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#444' }}>Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#444' }}>Nenhum lançamento neste período</td></tr>
              )}
              {filtered.map(tx => (
                <tr key={tx.id} className="group transition-colors" style={{ borderBottom: '1px solid #1E1E1E' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1F1F1F')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap tabular-nums" style={{ color: '#555' }}>{formatDate(tx.date)}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-white text-sm">{tx.description}</span>
                    {tx.notes && <p className="text-xs mt-0.5" style={{ color: '#555' }}>{tx.notes}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: '#666' }}>{tx.category}</td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: '#666' }}>{tx.client?.name || '—'}</td>
                  <td className={`px-5 py-3.5 text-right font-semibold text-sm tabular-nums ${tx.type === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'entrada' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#555' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(tx.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400" style={{ color: '#555' }}>
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
          <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: '#111' }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'entrada', category: 'Serviços' }))}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
              style={form.type === 'entrada'
                ? { backgroundColor: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40' }
                : { color: '#555', border: '1px solid transparent' }}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'saida', category: 'Ferramentas' }))}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
              style={form.type === 'saida'
                ? { backgroundColor: '#B7281820', color: '#E5321E', border: '1px solid #B7281840' }
                : { color: '#555', border: '1px solid transparent' }}
            >
              Saída
            </button>
          </div>

          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Descrição *</label>
            <Input placeholder="Ex: Pagamento de job — Cliente X" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Valor (R$) *</label>
              <Input type="number" step="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Categoria</label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Cliente (opcional)</label>
              <Select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Nenhum</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: '#888' }}>Observações</label>
            <Input placeholder="Notas adicionais..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
