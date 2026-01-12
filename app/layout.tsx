'use client';

import './globals.css'
import { GHLIframeProvider } from '@/lib/ghl-iframe-context'
import { Navigation } from '@/components/Navigation'
import { Header } from '@/components/Header'
import { usePathname } from 'next/navigation'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const isWidgetPage = pathname?.startsWith('/widget');

  return (
    <html lang="en">
      <body>
        <GHLIframeProvider>
          {isWidgetPage ? (
            // Widget page - no navigation or header
            <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
              {children}
            </div>
          ) : (
            // Dashboard pages - with navigation and header
            <div className="flex h-screen overflow-hidden bg-gray-50">
              <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                  <Navigation />
                </div>
              </div>
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto">
                  <div className="p-4 md:p-6">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          )}
        </GHLIframeProvider>
      </body>
    </html>
  )
}
