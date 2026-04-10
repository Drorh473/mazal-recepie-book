import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ספר המתכונים של מזל',
  description: 'אוסף מתכונים משפחתי',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-[#f5f0eb] text-[#1a1a1a] min-h-screen">
        <nav className="bg-white border-b border-[#e5ddd5] px-6 py-3 flex items-center justify-between">
          <span className="font-semibold text-[#3d2c1e]">
            ספר המתכונים של <span className="text-[#c9703a]">מזל</span>
          </span>
          <div className="flex gap-6 text-sm text-[#7a6555]">
            <a href="/" className="hover:text-[#3d2c1e] transition-colors">הספר</a>
            <a href="/upload" className="hover:text-[#3d2c1e] transition-colors">הוספת מתכון</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
