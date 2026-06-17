'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Download, ExternalLink, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getMonthName, calculateJobValue, MONTHS } from '@/lib/utils'
import type { Job, Client, Settings } from '@/types/database'
import toast from 'react-hot-toast'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

interface JobWithClient extends Job { client?: Client }

export default function RelatorioPage() {
  const [jobs, setJobs] = useState<JobWithClient[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [filterClient, setFilterClient] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const qrRef = useRef<HTMLCanvasElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [jobsRes, clientsRes, settingsRes] = await Promise.all([
      supabase.from('jobs').select('*, client:clients(*)').order('created_at'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('settings').select('*').limit(1).single(),
    ])
    if (jobsRes.data) setJobs(jobsRes.data as JobWithClient[])
    if (clientsRes.data) setClients(clientsRes.data)
    if (settingsRes.data) setSettings(settingsRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Gerar QR Code Pix quando settings carregarem
  useEffect(() => {
    if (!settings?.pix_key) return
    generatePixQr(settings.pix_key, totalValue, settings.company_name)
  }, [settings, month, year, filterClient, jobs])

  const filtered = jobs.filter(j => {
    if (j.period_month !== month || j.period_year !== year) return false
    if (filterClient && j.client_id !== filterClient) return false
    return true
  })

  const totalValue = filtered.reduce((sum, j) => sum + calculateJobValue(j), 0)

  // Agrupar por cliente
  const byClient = clients
    .map(c => ({
      client: c,
      jobs: filtered.filter(j => j.client_id === c.id),
    }))
    .filter(g => g.jobs.length > 0)

  async function generatePixQr(pixKey: string, amount: number, name: string) {
    try {
      const QRCode = (await import('qrcode')).default
      const pixPayload = buildPixPayload(pixKey, amount, name)
      const url = await QRCode.toDataURL(pixPayload, { width: 200, margin: 1 })
      setQrDataUrl(url)
    } catch {}
  }

  function buildPixPayload(key: string, amount: number, merchantName: string): string {
    const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, '').substring(0, 25)
    const name = clean(merchantName) || 'AGENCIA JOTA'

    function tlv(id: string, value: string) {
      const len = value.length.toString().padStart(2, '0')
      return `${id}${len}${value}`
    }

    const merchantAccountInfo = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key)
    const payload = [
      tlv('00', '01'),
      tlv('26', merchantAccountInfo),
      tlv('52', '0000'),
      tlv('53', '986'),
      ...(amount > 0 ? [tlv('54', amount.toFixed(2))] : []),
      tlv('58', 'BR'),
      tlv('59', name),
      tlv('60', 'SAO PAULO'),
      tlv('62', tlv('05', '***')),
    ].join('')

    // CRC16
    const crcInput = payload + '6304'
    let crc = 0xFFFF
    for (const char of crcInput) {
      crc ^= char.charCodeAt(0) << 8
      for (let i = 0; i < 8; i++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      }
    }
    return payload + '6304' + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  }

  async function exportPDF() {
    if (filtered.length === 0) return toast.error('Nenhum job para exportar')
    try {
      // Gerar token da fatura (upsert por client+month+year)
      let faturaUrl = ''
      if (filterClient) {
        const existing = await supabase
          .from('invoices')
          .select('token')
          .eq('client_id', filterClient)
          .eq('month', month)
          .eq('year', year)
          .maybeSingle()

        let token = existing.data?.token
        if (!token) {
          const { data: inv } = await supabase
            .from('invoices')
            .insert({ client_id: filterClient, month, year })
            .select('token')
            .single()
          token = inv?.token
        }
        if (token) faturaUrl = `${window.location.origin}/fatura/${token}`
      }

      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const clientName = filterClient
        ? clients.find(c => c.id === filterClient)?.name || 'Cliente'
        : 'Todos os Clientes'

      const W = 210
      const H = 297

      // Fundo escuro total
      doc.setFillColor(17, 17, 17)
      doc.rect(0, 0, W, H, 'F')

      // Header vermelho
      doc.setFillColor(183, 40, 24)
      doc.rect(0, 0, W, 42, 'F')

      // Título
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('A sua fatura chegou!', 14, 18)

      // Subtítulo
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(255, 255, 255)
      doc.text('Agradecemos a nossa parceria.', 14, 27)

      // Info cliente/período
      doc.setFontSize(9)
      doc.setTextColor(255, 220, 215)
      doc.text(`${clientName}  ·  ${getMonthName(month)}/${year}`, 14, 36)

      // Card da tabela — fundo ligeiramente mais claro
      doc.setFillColor(26, 26, 26)
      doc.roundedRect(10, 50, W - 20, 8 + filtered.length * 10 + 24, 3, 3, 'F')

      // Cabeçalho da tabela
      let y = 60
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(136, 136, 136)
      doc.text('JOB', 16, y)
      doc.text('TIPO', 120, y)
      doc.text('VALOR', W - 16, y, { align: 'right' })

      // Linha separadora
      doc.setDrawColor(42, 42, 42)
      doc.setLineWidth(0.3)
      doc.line(10, y + 3, W - 10, y + 3)
      y += 10

      // Linhas dos jobs
      doc.setFont('helvetica', 'normal')
      filtered.forEach((job, i) => {
        if (y > 250) {
          doc.addPage()
          doc.setFillColor(17, 17, 17)
          doc.rect(0, 0, W, H, 'F')
          y = 20
        }

        doc.setFontSize(9)
        doc.setTextColor(255, 255, 255)
        doc.text(job.name.substring(0, 42), 16, y)

        doc.setTextColor(136, 136, 136)
        const tipoText = job.type === 'hora'
          ? `${job.hours || 0}h x R$${job.hourly_rate}/h`
          : 'Valor fechado'
        doc.text(tipoText, 120, y)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text(formatCurrency(calculateJobValue(job)), W - 16, y, { align: 'right' })
        doc.setFont('helvetica', 'normal')

        if (i < filtered.length - 1) {
          doc.setDrawColor(42, 42, 42)
          doc.setLineWidth(0.2)
          doc.line(16, y + 3, W - 16, y + 3)
        }
        y += 10
      })

      // Linha total
      y += 2
      doc.setDrawColor(183, 40, 24)
      doc.setLineWidth(0.4)
      doc.line(10, y, W - 10, y)
      y += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(229, 50, 30)
      doc.text('TOTAL', 16, y)
      doc.text(formatCurrency(totalValue), W - 16, y, { align: 'right' })
      y += 16

      // Botão / link da fatura
      if (faturaUrl) {
        doc.setFillColor(183, 40, 24)
        doc.roundedRect(14, y, 80, 12, 3, 3, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.textWithLink('Acessar fatura online', 54, y + 7.5, { url: faturaUrl, align: 'center' })
        y += 20
      }

      // Seção Pix
      if (qrDataUrl && settings?.pix_key) {
        doc.setFillColor(26, 26, 26)
        doc.roundedRect(10, y, W - 20, 48, 3, 3, 'F')

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text('Pagamento via Pix', 16, y + 10)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(170, 170, 170)
        doc.text(`Chave: `, 16, y + 20)
        doc.setTextColor(255, 255, 255)
        doc.text(settings.pix_key, 30, y + 20)

        if (settings.payment_link) {
          doc.setTextColor(229, 50, 30)
          doc.textWithLink('Link de pagamento', 16, y + 30, { url: settings.payment_link })
        }

        doc.addImage(qrDataUrl, 'PNG', W - 54, y + 4, 40, 40)
        y += 56
      }

      // Rodapé
      doc.setFontSize(8)
      doc.setTextColor(68, 68, 68)
      doc.text(
        `${settings?.company_name || 'Jota Agência'}  ·  Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
        W / 2, H - 10, { align: 'center' }
      )

      doc.save(`fatura-${clientName.toLowerCase().replace(/\s+/g, '-')}-${getMonthName(month).toLowerCase()}-${year}.pdf`)
      if (faturaUrl) {
        toast.success('PDF exportado com link da fatura!')
      } else {
        toast.success('PDF exportado!')
      }
    } catch (e) {
      toast.error('Erro ao gerar PDF')
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatório Mensal</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Exporte recibos com QR Code Pix</p>
        </div>
        <Button onClick={exportPDF} disabled={filtered.length === 0}>
          <Download size={16} /> Exportar PDF
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select className="w-36" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </Select>
        <Select className="w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select className="w-48" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {/* Preview do relatório */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Header do recibo */}
        <div className="px-6 py-5" style={{ backgroundColor: '#B72818' }}>
          <p className="text-white/80 text-sm">
            Relatório de Jobs — {getMonthName(month)}/{year}
          </p>
        </div>

        {/* Tabela de jobs */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-zinc-400 font-medium">Job</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Link</th>
                <th className="text-right px-5 py-3 text-zinc-400 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-10 text-zinc-500">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-zinc-500">Nenhum job neste período</td></tr>
              )}
              {filtered.map(job => (
                <tr key={job.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20">
                  <td className="px-5 py-3 text-white">{job.name}</td>
                  <td className="px-4 py-3">
                    {job.client && <Badge color={job.client.color}>{job.client.name}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {job.type === 'hora' ? `${job.hours || 0}h × R$${job.hourly_rate}/h` : 'Valor fechado'}
                  </td>
                  <td className="px-4 py-3">
                    {job.clickup_url && (
                      <a href={job.clickup_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-red-500">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-white">
                    {formatCurrency(calculateJobValue(job))}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t border-red-900/30 bg-red-900/5">
                  <td colSpan={4} className="px-5 py-4 text-red-400 font-bold">Total do período</td>
                  <td className="px-5 py-4 text-right text-red-400 font-bold text-lg">
                    {formatCurrency(totalValue)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pix */}
        {settings?.pix_key && filtered.length > 0 && (
          <div className="border-t border-zinc-800 px-6 py-5 flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <QrCode size={16} className="text-red-500" />
                <span className="text-white font-semibold text-sm">Pagamento via Pix</span>
              </div>
              <p className="text-zinc-400 text-xs mb-1">Chave CNPJ: <span className="text-white">{settings.pix_key}</span></p>
              {settings.payment_link && (
                <a href={settings.payment_link} target="_blank" rel="noopener noreferrer" className="text-red-500 text-xs hover:underline flex items-center gap-1">
                  <ExternalLink size={10} /> Link de pagamento
                </a>
              )}
            </div>
            {qrDataUrl && (
              <div className="shrink-0">
                <img src={qrDataUrl} alt="QR Code Pix" className="w-24 h-24 rounded-lg bg-white p-1" />
              </div>
            )}
          </div>
        )}

        {!settings?.pix_key && (
          <div className="border-t border-zinc-800 px-6 py-4">
            <p className="text-zinc-500 text-sm">Configure sua chave Pix em <a href="/configuracoes" className="text-red-500 hover:underline">Configurações</a> para exibir QR Code no PDF.</p>
          </div>
        )}
      </div>

      {/* Resumo por cliente */}
      {byClient.length > 1 && (
        <div className="mt-6">
          <h3 className="text-zinc-400 text-sm font-medium mb-3">Resumo por cliente</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {byClient.map(({ client, jobs: cJobs }) => (
              <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <Badge color={client.color} className="mb-2">{client.name}</Badge>
                <p className="text-white font-bold text-lg mt-1">
                  {formatCurrency(cJobs.reduce((s, j) => s + calculateJobValue(j), 0))}
                </p>
                <p className="text-zinc-500 text-xs">{cJobs.length} job{cJobs.length !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
