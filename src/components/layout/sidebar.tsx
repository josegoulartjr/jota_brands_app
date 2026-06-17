'use client'
import Image from 'next/image'
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
    <aside className="w-16 lg:w-56 flex flex-col py-5 shrink-0" style={{ backgroundColor: '#1C1C1C', borderRight: '1px solid #2A2A2A' }}>
      {/* Logo */}
      <div className="flex justify-center mb-8 px-2">
        <Image src="/logo.svg" alt="Jota Brands" width={52} height={52} className="rounded-full" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'text-white'
                  : 'hover:bg-white/5'
              )}
              style={active ? { backgroundColor: '#B72818', color: '#fff' } : { color: '#888' }}
            >
              <Icon size={17} className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 hidden lg:block">
        <p className="text-xs" style={{ color: '#444' }}>v1.0.0</p>
      </div>
    </aside>
  )
}
