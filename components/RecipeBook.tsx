'use client'
import { useState, useMemo, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import RecipeCard from './RecipeCard'
import { CATEGORIES, type Recipe } from '@/lib/types'

export default function RecipeBook({ recipes }: { recipes: Recipe[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('הכל')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const { user, isSignedIn } = useUser()

  useEffect(() => {
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return
    const key = `favorites_${user.primaryEmailAddress.emailAddress}`
    try {
      setFavoriteIds(JSON.parse(localStorage.getItem(key) || '[]'))
    } catch { /* noop */ }
  }, [isSignedIn, user])

  // Re-sync favorites when activeCategory changes to 'מועדפים'
  useEffect(() => {
    if (activeCategory !== 'מועדפים') return
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return
    const key = `favorites_${user.primaryEmailAddress.emailAddress}`
    try {
      setFavoriteIds(JSON.parse(localStorage.getItem(key) || '[]'))
    } catch { /* noop */ }
  }, [activeCategory, isSignedIn, user])

  const filtered = useMemo(() => {
    let list = activeCategory === 'מועדפים'
      ? recipes.filter((r) => favoriteIds.includes(r.id))
      : activeCategory === 'הכל'
        ? recipes
        : recipes.filter((r) => r.category === activeCategory)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.ingredients.some((i) => i.toLowerCase().includes(q))
      )
    }
    return list
  }, [recipes, activeCategory, search])

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
        <p className="text-[#b5a59a] text-sm mb-5">{recipes.length} מתכונים</p>
        <div className="max-w-md mx-auto flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מצרך..."
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-[#c9703a]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex justify-center gap-3 mt-4">
          <a
            href="/print?voice=false"
            target="_blank"
            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 transition-colors"
          >
            🖨️ הדפסה ללא קול
          </a>
          <a
            href="/print?voice=true"
            target="_blank"
            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 transition-colors"
          >
            🔊 הדפסה עם קול
          </a>
        </div>
      </div>

      <div className="bg-white border-b border-[#e5ddd5] overflow-x-auto">
        <div className="flex whitespace-nowrap px-4">
          {([
            'הכל',
            ...(isSignedIn ? ['מועדפים ♥'] : []),
            ...CATEGORIES,
          ] as string[]).map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat === 'מועדפים ♥' ? 'מועדפים' : cat); setSearch('') }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                (cat === 'מועדפים ♥' ? 'מועדפים' : cat) === activeCategory
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
        {search && (
          <p className="text-sm text-[#9e8474] mb-4">
            {filtered.length === 0
              ? `אין מתכונים עבור "${search}"`
              : `נמצאו ${filtered.length} מתכונים עבור "${search}"`}
          </p>
        )}

        {Object.keys(grouped).length === 0 && !search && activeCategory === 'מועדפים' ? (
          <div className="text-center py-20 text-[#9e8474]">
            <p className="text-2xl mb-3">♡</p>
            <p className="text-sm">עדיין לא שמרת מתכונים מועדפים</p>
            <p className="text-xs mt-1">לחצי על הלב ליד מתכון כדי לשמור אותו</p>
          </div>
        ) : Object.keys(grouped).length === 0 && !search ? (
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
