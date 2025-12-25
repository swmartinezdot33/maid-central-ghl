import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}








