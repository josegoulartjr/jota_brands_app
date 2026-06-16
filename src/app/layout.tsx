import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Jota Brands — Financeiro',
  description: 'Gestão financeira da agência',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex h-screen overflow-hidden" style={{ backgroundColor: '#111111' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1C1C1C',
              color: '#fff',
              border: '1px solid #2E2E2E',
              borderRadius: '10px',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  )
}
