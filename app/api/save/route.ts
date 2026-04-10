import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { commitFile, generateSlug } from '@/lib/github'
import type { Recipe, ProcessedRecipe } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      recipe: ProcessedRecipe
      audio?: string // base64 webm
    }

    const slug = generateSlug(body.recipe.title)
    const now = new Date().toISOString()

    const fullRecipe: Recipe = {
      ...body.recipe,
      id: slug,
      createdAt: now,
      audioPath: body.audio ? `/recordings/${slug}.webm` : undefined,
    }

    await commitFile({
      path: `data/recipes/${slug}.json`,
      content: Buffer.from(JSON.stringify(fullRecipe, null, 2)).toString('base64'),
      message: `feat: add recipe "${body.recipe.title}"`,
    })

    if (body.audio) {
      await commitFile({
        path: `public/recordings/${slug}.webm`,
        content: body.audio,
        message: `feat: add recording for "${body.recipe.title}"`,
      })
    }

    revalidateTag('recipes', 'max')

    return NextResponse.json({ success: true, id: slug })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[/api/save] Error saving recipe:', e?.message, err)
    return NextResponse.json(
      { error: 'save_error', message: e?.message || 'שגיאה בשמירת המתכון' },
      { status: 500 }
    )
  }
}
