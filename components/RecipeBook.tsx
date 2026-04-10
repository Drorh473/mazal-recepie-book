'use client'
import { useState } from 'react'
import RecipeCard from './RecipeCard'
import { CATEGORIES, type Recipe } from '@/lib/types'

export default function RecipeBook({ recipes }: { recipes: Recipe[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('הכל')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered =
    activeCategory === 'הכל'
      ? recipes
      : recipes.filter((r) => r.category === activeCategory)

  const grouped = CATEGORIES.reduce<Record<string, Recipe[]>>((acc, cat) => {
    const items = filtered.filter((r) => r.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      <div className="bg-[#3d2c1e] text-white text-center py-12 px-6">
        <h1 className="text-3xl font-bold mb-1">
          ספר המתכונים של{' '}
          <span className="text-[#c9703a]">מזל</span>
        </h1>
        <p className="text-[#b5a59a] text-sm">{recipes.length} מתכונים</p>
      </div>

      <div className="bg-white border-b border-[#e5ddd5] overflow-x-auto">
        <div className="flex whitespace-nowrap px-4">
          {(['הכל', ...CATEGORIES] as string[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeCategory === cat
                  ? 'text-[#c9703a] border-[#c9703a]'
                  : 'text-[#7a6555] border-transparent hover:text-[#3d2c1e]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-20 text-[#9e8474]">
            <p className="text-lg mb-3">עדיין אין מתכונים</p>
            <a href="/upload" className="text-[#c9703a] underline text-sm">
              הוסיפי מתכון ראשון
            </a>
          </div>
        ) : null}

        {Object.entries(grouped).map(([cat, catRecipes]) => (
          <div key={cat} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-[#3d2c1e] shrink-0">{cat}</h2>
              <div className="flex-1 h-px bg-[#e5ddd5]" />
              <span className="text-xs text-[#9e8474] shrink-0">{catRecipes.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isExpanded={expandedId === recipe.id}
                  onToggle={() =>
                    setExpandedId(expandedId === recipe.id ? null : recipe.id)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
