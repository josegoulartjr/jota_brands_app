import Link from 'next/link'
import { Briefcase, Users, FileText, TrendingUp, Settings, ArrowRight } from 'lucide-react'

const cards = [
  { href: '/jobs', icon: Briefcase, label: 'Jobs', desc: 'Cadastre e acompanhe seus jobs', color: '#B72818' },
  { href: '/clientes', icon: Users, label: 'Clientes', desc: 'Gerencie suas tags de clientes', color: '#E5321E' },
  { href: '/relatorio', icon: FileText, label: 'Relatório', desc: 'Exporte PDF com QR Code Pix', color: '#942013' },
  { href: '/financeiro', icon: TrendingUp, label: 'Financeiro', desc: 'Entradas, saídas e saldo', color: '#B72818' },
  { href: '/configuracoes', icon: Settings, label: 'Configurações', desc: 'Dados da agência e Pix', color: '#595959' },
]

export default function Home() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white">Bem-vindo</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Gestão de jobs e finanças da Jota Brands</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-xl p-5 transition-all duration-150 hover:scale-[1.01] nav-card"
            style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#666' }}>{desc}</p>
            </div>
            <ArrowRight size={15} style={{ color: '#444' }} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl p-5" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B72818' }} />
          <p className="text-white text-sm font-medium">Primeiro acesso?</p>
        </div>
        <p className="text-sm" style={{ color: '#666' }}>
          Comece em{' '}
          <Link href="/configuracoes" className="hover:underline" style={{ color: '#B72818' }}>Configurações</Link>{' '}
          para cadastrar seus dados de Pix, depois em{' '}
          <Link href="/clientes" className="hover:underline" style={{ color: '#B72818' }}>Clientes</Link>{' '}
          para criar suas tags, e então registre seus jobs em{' '}
          <Link href="/jobs" className="hover:underline" style={{ color: '#B72818' }}>Jobs</Link>.
        </p>
      </div>
    </div>
  )
}
