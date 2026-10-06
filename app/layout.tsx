import { Metadata } from 'next'
import { Manrope } from 'next/font/google'

import '@/app/globals.css'
import '@/components/shop/shop.css'
import { Toaster } from '@/components/toaster'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: 'Car Shop',
    template: '%s · Car Shop'
  },
  description: 'Stock, billing and reports for your car accessory shop.',
  themeColor: '#f6f8fb',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover'
  },
  appleWebApp: {
    capable: true,
    title: 'Car Shop',
    statusBarStyle: 'default'
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png'
  }
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <div className="shop">{children}</div>
        <Toaster
          position="bottom-center"
          containerStyle={{ bottom: 96 }}
          toastOptions={{
            style: {
              background: '#141a26',
              color: '#fff',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 14
            }
          }}
        />
      </body>
    </html>
  )
}
