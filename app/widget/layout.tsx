import type { Metadata } from 'next'
import { GHLIframeProvider } from '@/lib/ghl-iframe-context'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Book Your Service',
  description: 'Book your cleaning service',
}

export default function WidgetLayout({
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
