'use client'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'

export default function NavBar() {
  return (
    <nav className="bg-white border-b border-[#e5ddd5] px-6 py-3 flex items-center justify-between">
      <span className="font-semibold text-[#3d2c1e]">
        ספר המתכונים של <span className="text-[#c9703a]">מזל</span>
      </span>
      <div className="flex items-center gap-6 text-sm text-[#7a6555]">
        <a href="/" className="hover:text-[#3d2c1e] transition-colors">הספר</a>
        <a href="/upload" className="hover:text-[#3d2c1e] transition-colors">הוספת מתכון</a>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="px-3 py-1.5 rounded-lg bg-[#3d2c1e] text-white text-xs hover:bg-[#2d1e10] transition-colors">
              התחברות
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </nav>
  )
}
