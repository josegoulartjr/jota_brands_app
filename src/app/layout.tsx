import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ConditionalSidebar } from '@/components/layout/conditional-sidebar'
import { Toaster } from 'react-hot-toast'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

export const metadata: Metadata = {
  title: 'Jota Brands — Financeiro',
  description: 'Gestão financeira da agência',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jota Brands',
  },
}

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex h-screen overflow-hidden" style={{ backgroundColor: '#111111' }}>
        <ServiceWorkerRegister />
        <ConditionalSidebar />
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
