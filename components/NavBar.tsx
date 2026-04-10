'use client'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'

export default function NavBar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e5ddd5] px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
      <a href="/" className="font-bold text-[#3d2c1e] text-base hover:opacity-80 transition-opacity">
        ✦ <span className="text-[#c9703a]">מזל</span>
      </a>
      <div className="flex items-center gap-4 sm:gap-6 text-sm text-[#7a6555]">
        <a href="/" className="hidden sm:block hover:text-[#3d2c1e] font-medium transition-colors">הספר</a>
        <a href="/upload" className="hover:text-[#3d2c1e] font-medium transition-colors">+ מתכון</a>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="px-4 py-1.5 rounded-full bg-[#3d2c1e] text-white text-xs font-semibold hover:bg-[#c9703a] transition-colors">
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
