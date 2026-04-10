import type { Metadata } from 'next'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'ספר המתכונים של מזל',
  description: 'אוסף מתכונים משפחתי',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="he" dir="rtl">
        <body className="bg-[#f5f0eb] text-[#1a1a1a] min-h-screen">
          <NavBar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
