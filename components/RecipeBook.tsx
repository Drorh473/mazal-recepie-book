'use client'
import { useState, useMemo, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import RecipeCard from './RecipeCard'
import { CATEGORIES, type Recipe } from '@/lib/types'

type SearchMode = 'name' | 'ingredients'

export default function RecipeBook({ recipes }: { recipes: Recipe[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('הכל')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('name')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const { user, isSignedIn } = useUser()

  function syncFavorites() {
    if (!isSignedIn || !user?.primaryEmailAddress?.emailAddress) return
    const key = `favorites_${user.primaryEmailAddress.emailAddress}`
    try {
      setFavoriteIds(JSON.parse(localStorage.getItem(key) || '[]'))
    } catch { /* noop */ }
  }

  // Load favorites when user signs in
  useEffect(() => {
    syncFavorites()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user])

  // Re-sync favorites when switching to favorites tab
  useEffect(() => {
    if (activeCategory === 'מועדפים') syncFavorites()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  // Listen for heart-toggle events from RecipeCard — instant update without page refresh
  useEffect(() => {
    const handler = () => syncFavorites()
    window.addEventListener('favoritesUpdated', handler)
    return () => window.removeEventListener('favoritesUpdated', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user])

  const filtered = useMemo(() => {
    let list = activeCategory === 'מועדפים'
      ? recipes.filter((r) => favoriteIds.includes(r.id))
      : activeCategory === 'הכל'
        ? recipes
        : recipes.filter((r) => r.category === activeCategory)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) => {
        if (searchMode === 'name') return r.title.toLowerCase().includes(q)
        if (searchMode === 'ingredients') return r.ingredients.some((i) => i.toLowerCase().includes(q))
        return false
      })
    }
    return list
  }, [recipes, activeCategory, search, searchMode, favoriteIds])

  const grouped = CATEGORIES.reduce<Record<string, Recipe[]>>((acc, cat) => {
    const items = filtered.filter((r) => r.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      {/* Hero */}
      <div className="relative bg-[#3d2c1e] text-white text-center py-14 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #c9703a 0%, transparent 60%), radial-gradient(circle at 80% 20%, #c9703a 0%, transparent 50%)' }} />
        <div className="relative">
          <p className="text-[#c9703a] text-xs font-semibold tracking-[0.25em] uppercase mb-3">אוסף מתכונים משפחתי</p>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
            ספר המתכונים של{' '}
            <span className="text-[#c9703a]">מזל</span>
          </h1>
          <p className="text-[#b5a59a] text-sm mb-6">{recipes.length} מתכונים</p>

          {/* Search with mode toggle */}
          <div className="max-w-sm mx-auto space-y-2">
            <div className="flex justify-center gap-1">
              <button
                onClick={() => setSearchMode('name')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  searchMode === 'name'
                    ? 'bg-[#c9703a] text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
                }`}
              >
                לפי שם
              </button>
              <button
                onClick={() => setSearchMode('ingredients')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  searchMode === 'ingredients'
                    ? 'bg-[#c9703a] text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
                }`}
              >
                לפי מצרכים
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchMode === 'name' ? 'חיפוש לפי שם מתכון...' : 'חיפוש לפי מצרך...'}
                  className="w-full pr-9 pl-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-[#c9703a] focus:bg-white/15 transition-all"
                />
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="w-10 h-10 rounded-full bg-white/10 text-white/70 hover:bg-white/20 text-sm flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Download button */}
          <div className="flex justify-center mt-5">
            <a
              href="/recipe-book.docx"
              download="ספר מתכונים מזל.docx"
              className="px-4 py-2 text-xs font-medium rounded-full bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 transition-all hover:border-white/40 flex items-center gap-1.5"
            >
              <span>⬇️</span> הורדת ספר המתכונים
            </a>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b border-[#e5ddd5] overflow-x-auto scrollbar-hide shadow-sm">
        <div className="flex whitespace-nowrap px-4 min-w-max">
          {([
            'הכל',
            ...(isSignedIn ? ['מועדפים ♥'] : []),
            ...CATEGORIES,
          ] as string[]).map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat === 'מועדפים ♥' ? 'מועדפים' : cat); setSearch('') }}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                (cat === 'מועדפים ♥' ? 'מועדפים' : cat) === activeCategory
                  ? 'text-[#c9703a] border-[#c9703a]'
                  : 'text-[#7a6555] border-transparent hover:text-[#3d2c1e] hover:border-[#e5ddd5]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {search && (
          <p className="text-sm text-[#9e8474] mb-5">
            {filtered.length === 0
              ? `אין מתכונים עבור "${search}"`
              : `נמצאו ${filtered.length} מתכונים עבור "${search}"`}
          </p>
        )}

        {Object.keys(grouped).length === 0 && !search && activeCategory === 'מועדפים' ? (
          <div className="text-center py-24 text-[#9e8474]">
            <p className="text-5xl mb-4 opacity-30">♡</p>
            <p className="font-medium text-[#7a6555]">עדיין לא שמרת מתכונים מועדפים</p>
            <p className="text-sm mt-1">לחצי על הלב ליד מתכון כדי לשמור אותו</p>
          </div>
        ) : Object.keys(grouped).length === 0 && !search ? (
          <div className="text-center py-24 text-[#9e8474]">
            <p className="text-lg mb-3 font-medium">עדיין אין מתכונים</p>
            <a href="/upload" className="text-[#c9703a] hover:underline text-sm font-medium">
              הוסיפי מתכון ראשון ←
            </a>
          </div>
        ) : null}

        {Object.entries(grouped).map(([cat, catRecipes]) => (
          <div key={cat} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-[#3d2c1e] shrink-0 tracking-wide">{cat}</h2>
              <div className="flex-1 h-px bg-[#e5ddd5]" />
              <span className="text-xs text-[#b5a59a] bg-[#ede8e3] px-2 py-0.5 rounded-full shrink-0">{catRecipes.length}</span>
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
