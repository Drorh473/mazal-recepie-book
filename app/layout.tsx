import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import NavBar from '@/components/NavBar'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ספר המתכונים של מזל',
  description: 'אוסף מתכונים משפחתי',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="he" dir="rtl" className={heebo.variable}>
        <body className="bg-[#f5f0eb] text-[#1a1a1a] min-h-screen font-[family-name:var(--font-heebo)]">
          <NavBar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
