import type { Metadata } from 'next'
import './globals.css'
import { GHLIframeProvider } from '@/lib/ghl-iframe-context'
import { Navigation } from '@/components/Navigation'
import { Header } from '@/components/Header'

export const metadata: Metadata = {
  title: 'Maid Central → GoHighLevel Integration',
  description: 'Sync quotes from Maid Central to GoHighLevel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <GHLIframeProvider>
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
        </GHLIframeProvider>
      </body>
    </html>
  )
}
