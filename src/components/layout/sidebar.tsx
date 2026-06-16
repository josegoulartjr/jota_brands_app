'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, Users, FileText, TrendingUp, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs', icon: Briefcase, label: 'Jobs' },
  { href: '/clientes', icon: Users, label: 'Clientes' },
  { href: '/relatorio', icon: FileText, label: 'Relatório' },
  { href: '/financeiro', icon: TrendingUp, label: 'Financeiro' },
  { href: '/configuracoes', icon: Settings, label: 'Config.' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-16 lg:w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col py-6 shrink-0">
      <div className="px-3 lg:px-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">J</span>
          </div>
          <span className="hidden lg:block text-white font-semibold text-sm truncate">Jota Financeiro</span>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-violet-600/20 text-violet-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 hidden lg:block">
        <p className="text-xs text-zinc-600">v1.0.0</p>
      </div>
    </aside>
  )
}
