'use client'
import { useEffect, useState, use, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getMonthName, calculateJobValue, getPackTag } from '@/lib/utils'
import type { Job, Client, Settings, PackItem } from '@/types/database'

interface JobWithClient extends Job { client?: Client; pack_items?: PackItem[] }


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
        .from('jobs').select('*, client:clients(*), pack_items(*)')
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
                <Fragment key={job.id}>
                  <tr style={{ borderBottom: job.type === 'pacote' && job.pack_items?.length ? 'none' : (i < jobs.length - 1 ? '1px solid #222' : 'none') }}>
                    <td style={{ padding: '14px 20px', color: '#fff' }}>{job.name}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {job.client && (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#fff', background: job.client.color || '#444' }}>
                          {job.client.name}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#888', fontSize: 13 }}>
                      {job.type === 'hora' && `${job.hours || 0}h × R$${job.hourly_rate}/h`}
                      {job.type === 'fechado' && 'Valor fechado'}
                      {job.type === 'pacote' && getPackTag(job)}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                      {formatCurrency(calculateJobValue(job))}
                    </td>
                  </tr>
                  {job.type === 'pacote' && !!job.pack_items?.length && (
                    <tr style={{ borderBottom: i < jobs.length - 1 ? '1px solid #222' : 'none' }}>
                      <td colSpan={4} style={{ padding: '0 20px 16px 20px' }}>
                        <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 8, padding: '10px 14px' }}>
                          <p style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>Conteúdos entregues:</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {job.pack_items!.map((item, n) => (
                              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#E5321E', fontSize: 12, textDecoration: 'none', wordBreak: 'break-all' }}>
                                {n + 1}. {item.url}
                              </a>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

          <div style={{ borderTop: '1px solid #2a2a2a', padding: '24px 28px', display: 'flex', justifyContent: 'center' }}>
              <img src="/qr-code.png" alt="QR Code Pix" width={340} height={340}
                style={{ borderRadius: 8, background: '#fff', padding: 8 }} />
            </div>
        </div>

      </div>
    </div>
  )
}
