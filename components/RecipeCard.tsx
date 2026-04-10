'use client'
import AudioPlayer from './AudioPlayer'
import type { Recipe } from '@/lib/types'

interface Props {
  recipe: Recipe
  isExpanded: boolean
  onToggle: () => void
}

export default function RecipeCard({ recipe, isExpanded, onToggle }: Props) {
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
        <div>
          <h3 className="font-semibold text-[#3d2c1e] text-sm leading-snug">
            {recipe.title}
          </h3>
          <span className="inline-block mt-1 text-[10px] font-semibold bg-[#fff0eb] text-[#c9703a] px-2 py-0.5 rounded-full">
            {recipe.category}
          </span>
        </div>
        <span className="text-[#9e8474] text-xs mt-1 shrink-0 group-hover:text-[#3d2c1e] transition-colors">
          {isExpanded ? '▲' : '▼'}
        </span>
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
