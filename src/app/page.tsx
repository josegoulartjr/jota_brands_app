import Link from 'next/link'
import { Briefcase, Users, FileText, TrendingUp, Settings, ArrowRight } from 'lucide-react'

const cards = [
  { href: '/jobs', icon: Briefcase, label: 'Jobs', desc: 'Cadastre e acompanhe seus jobs', color: '#6366f1' },
  { href: '/clientes', icon: Users, label: 'Clientes', desc: 'Gerencie suas tags de clientes', color: '#f59e0b' },
  { href: '/relatorio', icon: FileText, label: 'Relatório', desc: 'Exporte PDF com QR Code Pix', color: '#10b981' },
  { href: '/financeiro', icon: TrendingUp, label: 'Financeiro', desc: 'Entradas, saídas e saldo', color: '#3b82f6' },
  { href: '/configuracoes', icon: Settings, label: 'Configurações', desc: 'Dados da agência e Pix', color: '#8b5cf6' },
]

export default function Home() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white">Jota Financeiro</h1>
        <p className="text-zinc-400 mt-2">Gestão de jobs e finanças da agência</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all hover:bg-zinc-800/50"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22` }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">{label}</p>
              <p className="text-zinc-500 text-sm">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      <div className="mt-10 bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
        <p className="text-violet-300 text-sm font-medium mb-1">Primeiro acesso?</p>
        <p className="text-zinc-400 text-sm">
          Comece em <Link href="/configuracoes" className="text-violet-400 hover:underline">Configurações</Link> para cadastrar seus dados de Pix,
          depois em <Link href="/clientes" className="text-violet-400 hover:underline">Clientes</Link> para criar suas tags,
          e então registre seus jobs em <Link href="/jobs" className="text-violet-400 hover:underline">Jobs</Link>.
        </p>
      </div>
    </div>
  )
}
