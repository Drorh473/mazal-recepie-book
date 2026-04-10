import { NextRequest, NextResponse } from 'next/server'
import { processImages, processTranscription } from '@/lib/claude'
import type { ApiError } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const transcription = formData.get('transcription') as string | null

    if (transcription) {
      const recipe = await processTranscription(transcription)
      return NextResponse.json(recipe)
    }

    const images = formData.getAll('images') as File[]
    if (!images.length) {
      const err: ApiError = { error: 'invalid_input', message: 'לא נשלחו תמונות' }
      return NextResponse.json(err, { status: 400 })
    }

    if (images.length > 20) {
      const err: ApiError = { error: 'invalid_input', message: 'ניתן להעלות עד 20 תמונות בפעם אחת' }
      return NextResponse.json(err, { status: 400 })
    }

    const imageBase64List = await Promise.all(
      images.map(async (img) => {
        const buffer = await img.arrayBuffer()
        return Buffer.from(buffer).toString('base64')
      })
    )
    const mimeTypes = images.map((img) => img.type || 'image/jpeg')

    const recipe = await processImages(imageBase64List, mimeTypes)
    return NextResponse.json(recipe)
  } catch (err: unknown) {
    const e = err as { status?: number; headers?: Record<string, string>; message?: string }
    if (e?.status === 429) {
      const retryAfter = e?.headers?.['retry-after']
        ? parseInt(e.headers['retry-after'])
        : 60
      console.warn('[/api/process] Claude rate limit hit, retry-after:', retryAfter)
      const apiErr: ApiError = {
        error: 'rate_limit',
        message: 'הגעת למגבלת הבקשות של Claude',
        retryAfter,
      }
      return NextResponse.json(apiErr, { status: 429 })
    }
    console.error('[/api/process] Unexpected error:', e?.message, err)
    const apiErr: ApiError = {
      error: 'api_error',
      message: e?.message || 'שגיאה בעיבוד המתכון',
    }
    return NextResponse.json(apiErr, { status: 500 })
  }
}
