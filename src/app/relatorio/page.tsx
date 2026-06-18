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

      const { PDFDocument, PDFName, PDFString } = await import('pdf-lib')

      const clientName = filterClient
        ? clients.find(c => c.id === filterClient)?.name || 'Cliente'
        : 'Todos os Clientes'

      // Carregar o PDF base (capa-fatura.pdf)
      const baseRes = await fetch('/capa-fatura.pdf')
      const baseBytes = await baseRes.arrayBuffer()
      const pdfDoc = await PDFDocument.load(baseBytes)
      const page = pdfDoc.getPage(0)
      const { width, height } = page.getSize()

      // Adicionar link clicável sobre o botão "Acessar fatura"
      // PDF é 1920x1080 pts. Botão está ~14% da esquerda, ~42% do topo, ~24% largo, ~7% alto
      // pdf-lib usa y=0 na base, então invertemos: y = height - top - btnH
      if (faturaUrl) {
        const btnX = width * 0.14
        const btnW = width * 0.24
        const btnH = height * 0.075
        const btnY = height - (height * 0.42) - btnH

        const linkDict = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [btnX, btnY, btnX + btnW, btnY + btnH],
          Border: [0, 0, 0],
          A: pdfDoc.context.obj({
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(faturaUrl),
          }),
        })
        const linkRef = pdfDoc.context.register(linkDict)
        const annots = pdfDoc.context.obj([linkRef])
        page.node.set(PDFName.of('Annots'), annots)
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fatura-${clientName.toLowerCase().replace(/\s+/g, '-')}-${getMonthName(month).toLowerCase()}-${year}.pdf`
      a.click()
      URL.revokeObjectURL(url)

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
