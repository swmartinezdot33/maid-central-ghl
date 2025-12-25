import type { Metadata } from 'next'
import './globals.css'
import { GHLIframeProvider } from '@/lib/ghl-iframe-context'

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
          {children}
        </GHLIframeProvider>
      </body>
    </html>
  )
}








