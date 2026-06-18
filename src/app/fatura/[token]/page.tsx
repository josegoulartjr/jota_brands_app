'use client'
import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getMonthName, calculateJobValue } from '@/lib/utils'
import type { Job, Client, Settings } from '@/types/database'

interface JobWithClient extends Job { client?: Client }

function buildPixPayload(key: string, amount: number, merchantName: string) {
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, '').substring(0, 25)
  const name = clean(merchantName) || 'AGENCIA JOTA'
  function tlv(id: string, value: string) {
    const len = value.length.toString().padStart(2, '0')
    return `${id}${len}${value}`
  }
  const merchantAccountInfo = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', key)
  const payload = [
    tlv('00', '01'), tlv('26', merchantAccountInfo), tlv('52', '0000'), tlv('53', '986'),
    ...(amount > 0 ? [tlv('54', amount.toFixed(2))] : []),
    tlv('58', 'BR'), tlv('59', name), tlv('60', 'SAO PAULO'), tlv('62', tlv('05', '***')),
  ].join('')
  const crcInput = payload + '6304'
  let crc = 0xFFFF
  for (const char of crcInput) {
    crc ^= char.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
  }
  return payload + '6304' + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

export default function FaturaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [jobs, setJobs] = useState<JobWithClient[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: inv } = await supabase
        .from('invoices').select('*').eq('token', token).maybeSingle()

      if (!inv) { setNotFound(true); setLoading(false); return }
      setInvoice(inv)

      const jobQuery = supabase
        .from('jobs').select('*, client:clients(*)')
        .eq('period_month', inv.month).eq('period_year', inv.year).order('created_at')

      const [jobsRes, settingsRes] = await Promise.all([
        inv.client_id ? jobQuery.eq('client_id', inv.client_id) : jobQuery,
        supabase.from('settings').select('*').limit(1).single(),
      ])

      setJobs((jobsRes.data || []) as JobWithClient[])
      setSettings(settingsRes.data)
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) return (
    <div style={{ background: '#111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#888', fontFamily: 'sans-serif' }}>Carregando...</div>
    </div>
  )

  if (notFound) return (
    <div style={{ background: '#111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 48, color: '#fff', marginBottom: 16 }}>404</p>
        <p style={{ color: '#888' }}>Fatura não encontrada ou link inválido.</p>
      </div>
    </div>
  )

  const total = jobs.reduce((sum, j) => sum + calculateJobValue(j), 0)
  const clientName = invoice.client_id ? (jobs[0]?.client?.name || 'Cliente') : 'Todos os Clientes'
  const monthName = getMonthName(invoice.month)
  const pixPayload = settings?.pix_key ? buildPixPayload(settings.pix_key, total, settings.company_name || 'Jota') : null

  return (
    <div style={{ background: '#111111', minHeight: '100vh', padding: '40px 16px 64px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: '#B72818', borderRadius: '12px 12px 0 0', padding: '24px 28px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>A sua fatura chegou!</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            {monthName}/{invoice.year} · Agradecemos a parceria.
          </div>
        </div>

        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                {['Job', 'Cliente', 'Tipo', 'Valor'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Valor' ? 'right' : 'left', padding: '12px 20px', color: '#888', fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#555', padding: '40px 20px' }}>Nenhum job encontrado.</td></tr>
              )}
              {jobs.map((job, i) => (
                <tr key={job.id} style={{ borderBottom: i < jobs.length - 1 ? '1px solid #222' : 'none' }}>
                  <td style={{ padding: '14px 20px', color: '#fff' }}>{job.name}</td>
                  <td style={{ padding: '14px 20px' }}>
                    {job.client && (
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#fff', background: job.client.color || '#444' }}>
                        {job.client.name}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#888', fontSize: 13 }}>
                    {job.type === 'hora' ? `${job.hours || 0}h × R$${job.hourly_rate}/h` : 'Valor fechado'}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                    {formatCurrency(calculateJobValue(job))}
                  </td>
                </tr>
              ))}
            </tbody>
            {jobs.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(183,40,24,0.25)', background: 'rgba(183,40,24,0.06)' }}>
                  <td colSpan={3} style={{ padding: '16px 20px', color: '#E5321E', fontWeight: 700, fontSize: 15 }}>Total do período</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', color: '#E5321E', fontWeight: 700, fontSize: 15 }}>{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {pixPayload && (
            <div style={{ borderTop: '1px solid #2a2a2a', padding: '24px 28px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`}
                alt="QR Code Pix" width={180} height={180}
                style={{ borderRadius: 8, background: '#fff', padding: 8 }}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
