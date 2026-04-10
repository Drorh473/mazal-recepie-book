import { Suspense } from 'react'
import { connection } from 'next/server'
import { getAllRecipes } from '@/lib/recipes'
import { CATEGORIES } from '@/lib/types'
import PrintClient from './PrintClient'

async function PrintContent({
  searchParams,
}: {
  searchParams: Promise<{ voice?: string }>
}) {
  const params = await searchParams
  await connection()
  const withVoice = params.voice === 'true'
  const recipes = await getAllRecipes()

  const grouped = CATEGORIES.reduce<Record<string, typeof recipes>>((acc, cat) => {
    const items = recipes.filter((r) => r.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return <PrintClient grouped={grouped} withVoice={withVoice} totalCount={recipes.length} />
}

export default function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ voice?: string }>
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#9e8474]">טוען...</div>}>
      <PrintContent searchParams={searchParams} />
    </Suspense>
  )
}
