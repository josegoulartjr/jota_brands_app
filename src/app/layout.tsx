import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Jota Financeiro',
  description: 'Gestão financeira da agência',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex h-screen overflow-hidden bg-zinc-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#fafafa',
              border: '1px solid #3f3f46',
            },
          }}
        />
      </body>
    </html>
  )
}
