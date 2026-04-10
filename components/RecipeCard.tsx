'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import AudioPlayer from './AudioPlayer'
import type { Recipe } from '@/lib/types'

interface Props {
  recipe: Recipe
  isExpanded: boolean
  onToggle: () => void
}

function getFavKey(email: string) {
  return `favorites_${email}`
}

function loadFavorites(email: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(getFavKey(email)) || '[]')
  } catch {
    return []
  }
}

function saveFavorites(email: string, ids: string[]) {
  localStorage.setItem(getFavKey(email), JSON.stringify(ids))
}

export default function RecipeCard({ recipe, isExpanded, onToggle }: Props) {
  const { user, isSignedIn } = useUser()
  const [isFav, setIsFav] = useState(false)

  useEffect(() => {
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return
    const favs = loadFavorites(user.primaryEmailAddress.emailAddress)
    setIsFav(favs.includes(recipe.id))
  }, [isSignedIn, user, recipe.id])

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return
    const email = user.primaryEmailAddress.emailAddress
    const favs = loadFavorites(email)
    const next = isFav ? favs.filter((id) => id !== recipe.id) : [...favs, recipe.id]
    saveFavorites(email, next)
    setIsFav(!isFav)
  }

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
        isExpanded
          ? 'border-[#c9703a]/30 shadow-md shadow-[#c9703a]/5'
          : 'border-[#e5ddd5] hover:shadow-md hover:shadow-black/5 hover:border-[#d9cfc5]'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-right px-4 py-4 flex items-start justify-between gap-2 group"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#3d2c1e] text-sm leading-snug group-hover:text-[#c9703a] transition-colors">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] font-semibold bg-[#fff0eb] text-[#c9703a] px-2 py-0.5 rounded-full">
              {recipe.category}
            </span>
            <span className="text-[10px] text-[#b5a59a]">
              {recipe.ingredients.length} מצרכים
            </span>
            {recipe.audioPath && (
              <span className="text-[10px] text-[#b5a59a]">🎙️</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {isSignedIn && (
            <button
              onClick={toggleFav}
              className={`text-base leading-none transition-all hover:scale-125 active:scale-95 ${
                isFav ? 'text-red-500' : 'text-[#d9cfc5] hover:text-red-400'
              }`}
              title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              {isFav ? '♥' : '♡'}
            </button>
          )}
          <span className={`text-[10px] font-medium transition-all duration-200 ${isExpanded ? 'text-[#c9703a] rotate-180' : 'text-[#b5a59a] group-hover:text-[#7a6555]'}`}
            style={{ display: 'inline-block' }}>
            ▼
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-[#f0ebe6]">
          <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-3">
                מצרכים
              </p>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="text-sm text-[#3d2c1e] flex items-start gap-2"
                  >
                    <span className="text-[#c9703a] text-xs mt-0.5 shrink-0">•</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-3">
                הכנה
              </p>
              <p className="text-sm text-[#3d2c1e] leading-relaxed whitespace-pre-line">
                {recipe.instructions}
              </p>
            </div>
          </div>
          {recipe.audioPath ? <AudioPlayer src={recipe.audioPath} /> : null}
        </div>
      ) : null}
    </div>
  )
}
