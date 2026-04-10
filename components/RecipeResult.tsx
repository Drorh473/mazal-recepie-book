'use client'
import { useState } from 'react'
import { CATEGORIES, type ProcessedRecipe } from '@/lib/types'

interface Props {
  recipe: ProcessedRecipe
  onChange: (recipe: ProcessedRecipe) => void
}

export default function RecipeResult({ recipe, onChange }: Props) {
  const [ingredientsText, setIngredientsText] = useState(
    recipe.ingredients.join('\n')
  )

  const handleIngredientsChange = (val: string) => {
    setIngredientsText(val)
    onChange({
      ...recipe,
      ingredients: val.split('\n').filter((l) => l.trim()),
    })
  }

  return (
    <div className="bg-white border border-[#d5e8d0] rounded-xl overflow-hidden">
      <div className="bg-[#f0f7ee] px-4 py-2.5 flex items-center gap-2 text-sm text-[#4a7c40] font-medium border-b border-[#d5e8d0]">
        <span>✓</span>
        <span>המתכון זוהה — ניתן לערוך לפני שמירה</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            שם המתכון
          </label>
          <input
            value={recipe.title}
            onChange={(e) => onChange({ ...recipe, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a]"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            קטגוריה
          </label>
          <select
            value={recipe.category}
            onChange={(e) =>
              onChange({ ...recipe, category: e.target.value as ProcessedRecipe['category'] })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            מצרכים (שורה אחת לכל מצרך)
          </label>
          <textarea
            value={ingredientsText}
            onChange={(e) => handleIngredientsChange(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] resize-y"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            הוראות הכנה
          </label>
          <textarea
            value={recipe.instructions}
            onChange={(e) => onChange({ ...recipe, instructions: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] resize-y"
          />
        </div>
      </div>
    </div>
  )
}
