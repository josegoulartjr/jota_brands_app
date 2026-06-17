import { supabase } from '@/lib/supabase'
import { formatCurrency, getMonthName, calculateJobValue } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
import type { Job, Client, Settings } from '@/types/database'

interface JobWithClient extends Job { client?: Client }

export const dynamic = 'force-dynamic'

async function buildPixPayload(key: string, amount: number, merchantName: string) {
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

export default async function FaturaPage({ params }: { params: { token: string } }) {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('token', params.token)
    .single()

  if (!invoice) {
    return (
      <html lang="pt-BR">
        <body style={{ background: '#111', color: '#fff', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>404</p>
            <p style={{ color: '#888' }}>Fatura não encontrada ou link inválido.</p>
          </div>
        </body>
      </html>
    )
  }

  const [jobsRes, settingsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, client:clients(*)')
      .eq('period_month', invoice.month)
      .eq('period_year', invoice.year)
      .eq('client_id', invoice.client_id)
      .order('created_at'),
    supabase.from('settings').select('*').limit(1).single(),
  ])

  const jobs = (jobsRes.data || []) as JobWithClient[]
  const settings = settingsRes.data as Settings | null
  const total = jobs.reduce((sum, j) => sum + calculateJobValue(j), 0)
  const clientName = jobs[0]?.client?.name || 'Cliente'
  const pixPayload = settings?.pix_key ? await buildPixPayload(settings.pix_key, total, settings.company_name || 'Jota') : null

  const monthName = getMonthName(invoice.month)

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fatura — {clientName} — {monthName}/{invoice.year}</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #111111;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100vh;
            padding: 32px 16px 64px;
          }
          .container { max-width: 760px; margin: 0 auto; }
          .header {
            background: #B72818;
            border-radius: 12px 12px 0 0;
            padding: 24px 28px;
          }
          .header-greeting { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .header-sub { font-size: 13px; color: rgba(255,255,255,0.75); }
          .card {
            background: #1a1a1a;
            border: 1px solid #2a2a2a;
            border-top: none;
            border-radius: 0 0 12px 12px;
            overflow: hidden;
          }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          thead tr { border-bottom: 1px solid #2a2a2a; }
          th {
            text-align: left;
            padding: 12px 20px;
            color: #888;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          th.right { text-align: right; }
          tbody tr { border-bottom: 1px solid #222; transition: background 0.15s; }
          tbody tr:last-child { border-bottom: none; }
          td { padding: 14px 20px; color: #fff; vertical-align: middle; }
          td.muted { color: #888; font-size: 13px; }
          td.right { text-align: right; font-weight: 600; }
          .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            color: #fff;
          }
          tfoot tr { background: rgba(183,40,24,0.06); border-top: 1px solid rgba(183,40,24,0.25); }
          tfoot td { padding: 16px 20px; color: #E5321E; font-weight: 700; font-size: 15px; }
          .pix-section {
            border-top: 1px solid #2a2a2a;
            padding: 24px 28px;
            display: flex;
            align-items: center;
            gap: 24px;
          }
          .pix-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
          .pix-key { font-size: 13px; color: #aaa; }
          .pix-key span { color: #fff; }
          .pix-link { color: #E5321E; font-size: 13px; text-decoration: none; margin-top: 6px; display: inline-block; }
          .pix-link:hover { text-decoration: underline; }
          qr-img { border-radius: 8px; background: #fff; padding: 4px; }
          .footer {
            text-align: center;
            margin-top: 32px;
            font-size: 12px;
            color: #444;
          }
          .ext-link { color: #555; text-decoration: none; }
          .ext-link:hover { color: #E5321E; }
          @media (max-width: 600px) {
            .hide-mobile { display: none; }
            th, td { padding: 10px 12px; }
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <div className="header-greeting">A sua fatura chegou!</div>
            <div className="header-sub">
              {clientName} &nbsp;·&nbsp; {monthName}/{invoice.year} &nbsp;·&nbsp; Agradecemos a parceria.
            </div>
          </div>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th className="hide-mobile">Tipo</th>
                  <th className="hide-mobile">Link</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#555', padding: '40px 20px' }}>
                      Nenhum job encontrado.
                    </td>
                  </tr>
                )}
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td>{job.name}</td>
                    <td className="muted hide-mobile">
                      {job.type === 'hora'
                        ? `${job.hours || 0}h × R$${job.hourly_rate}/h`
                        : 'Valor fechado'}
                    </td>
                    <td className="hide-mobile">
                      {job.clickup_url && (
                        <a href={job.clickup_url} target="_blank" rel="noopener noreferrer" className="ext-link">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}
                    </td>
                    <td className="right">{formatCurrency(calculateJobValue(job))}</td>
                  </tr>
                ))}
              </tbody>
              {jobs.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total do período</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {settings?.pix_key && jobs.length > 0 && (
              <div className="pix-section">
                <div style={{ flex: 1 }}>
                  <div className="pix-label">Pagamento via Pix</div>
                  <div className="pix-key">Chave: <span>{settings.pix_key}</span></div>
                  {settings.payment_link && (
                    <a href={settings.payment_link} target="_blank" rel="noopener noreferrer" className="pix-link">
                      Acessar link de pagamento →
                    </a>
                  )}
                </div>
                {pixPayload && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(pixPayload)}`}
                      alt="QR Code Pix"
                      width={96}
                      height={96}
                      style={{ borderRadius: 8, background: '#fff', padding: 4, display: 'block' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="footer">
            {settings?.company_name || 'Jota Agência'} &nbsp;·&nbsp; Fatura gerada em {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>
      </body>
    </html>
  )
}
