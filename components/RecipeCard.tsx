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
      className={`bg-white border border-[#e5ddd5] rounded-xl overflow-hidden transition-shadow ${
        isExpanded ? 'shadow-md' : 'hover:shadow-sm hover:border-[#d9cfc5]'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-right px-4 py-4 flex items-start justify-between gap-2 group"
      >
        <div className="flex-1">
          <h3 className="font-semibold text-[#3d2c1e] text-sm leading-snug">
            {recipe.title}
          </h3>
          <span className="inline-block mt-1 text-[10px] font-semibold bg-[#fff0eb] text-[#c9703a] px-2 py-0.5 rounded-full">
            {recipe.category}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {isSignedIn && (
            <button
              onClick={toggleFav}
              className={`text-lg leading-none transition-transform hover:scale-110 ${
                isFav ? 'text-red-500' : 'text-[#d9cfc5] hover:text-red-400'
              }`}
              title={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              {isFav ? '♥' : '♡'}
            </button>
          )}
          <span className="text-[#9e8474] text-xs group-hover:text-[#3d2c1e] transition-colors">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div>
          <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-[#f0ebe6]">
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-2">
                מצרכים
              </p>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="text-sm text-[#3d2c1e] border-b border-[#f5f0eb] pb-1 last:border-0"
                  >
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-2">
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
