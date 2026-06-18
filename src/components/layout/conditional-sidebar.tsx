'use client'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (pathname.startsWith('/fatura')) return null
  return <Sidebar />
}
