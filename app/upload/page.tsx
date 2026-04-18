'use client'
import { useState, useRef } from 'react'
import UploadZone from '@/components/UploadZone'
import VoiceRecorder from '@/components/VoiceRecorder'
import RecipeResult from '@/components/RecipeResult'
import { compressAll } from '@/lib/compress'
import type { ProcessedRecipe, ApiError } from '@/lib/types'

type Stage = 'idle' | 'processing' | 'result' | 'saving' | 'saved' | 'error' | 'batch-results'

type BatchItem = {
  id: string
  recipe: ProcessedRecipe
  status: 'ready' | 'saving' | 'saved' | 'error'
  error?: string
}

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [recipe, setRecipe] = useState<ProcessedRecipe | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const [batchMode, setBatchMode] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const audioBase64Ref = useRef<string | null>(null)
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRetryCountdown = (seconds: number) => {
    setRetrySeconds(seconds)
    retryIntervalRef.current = setInterval(() => {
      setRetrySeconds((s) => {
        if (s <= 1) {
          clearInterval(retryIntervalRef.current!)
          setStage('idle')
          setError(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  /** Call /api/process for a single File and return the recipe */
  const processSingleFile = async (file: File): Promise<ProcessedRecipe> => {
    const formData = new FormData()
    formData.append('images', file)
    const res = await fetch('/api/process', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw data as ApiError
    return data as ProcessedRecipe
  }

  const processFiles = async (files: File[]) => {
    setError(null)
    audioBase64Ref.current = null

    // Compress images client-side first (speeds up upload + Claude processing)
    const compressed = await compressAll(files)

    // BATCH MODE: each image → separate recipe, processed in parallel
    if (batchMode && compressed.length > 1) {
      setBatchProgress({ done: 0, total: compressed.length })
      setStage('processing')

      const results = await Promise.allSettled(
        compressed.map(async (file, i) => {
          const recipe = await processSingleFile(file)
          setBatchProgress((p) => ({ ...p, done: p.done + 1 }))
          return { id: String(i), recipe }
        })
      )

      const items: BatchItem[] = results.map((r, i) =>
        r.status === 'fulfilled'
          ? { id: String(i), recipe: r.value.recipe, status: 'ready' }
          : {
              id: String(i),
              recipe: { title: `תמונה ${i + 1}`, category: 'סלטים', ingredients: [], instructions: '' } as ProcessedRecipe,
              status: 'error',
              error: (r.reason as ApiError)?.message || 'שגיאה בעיבוד',
            }
      )
      setBatchItems(items)
      setStage('batch-results')
      return
    }

    // SINGLE MODE: all images → one recipe
    setStage('processing')
    const formData = new FormData()
    compressed.forEach((f) => formData.append('images', f))

    const res = await fetch('/api/process', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data as ApiError)
      setStage('error')
      if ((data as ApiError).error === 'rate_limit' && (data as ApiError).retryAfter) {
        startRetryCountdown((data as ApiError).retryAfter!)
      }
      return
    }

    setRecipe(data as ProcessedRecipe)
    setStage('result')
  }

  const processVoice = async (audioBase64: string, transcription: string) => {
    setStage('processing')
    setError(null)
    audioBase64Ref.current = audioBase64

    const formData = new FormData()
    formData.append('transcription', transcription)

    const res = await fetch('/api/process', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data as ApiError)
      setStage('error')
      if ((data as ApiError).error === 'rate_limit' && (data as ApiError).retryAfter) {
        startRetryCountdown((data as ApiError).retryAfter!)
      }
      return
    }

    setRecipe(data as ProcessedRecipe)
    setStage('result')
  }

  const save = async () => {
    if (!recipe) return
    setStage('saving')
    setError(null)

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe, audio: audioBase64Ref.current }),
    })
    const data = await res.json()

    if (!res.ok) {
      const apiErr = data as ApiError
      setError(apiErr)
      setStage(apiErr.error === 'duplicate' ? 'result' : 'error')
      return
    }

    setStage('saved')
  }

  const saveBatchItem = async (id: string, recipe: ProcessedRecipe) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'saving' } : item))
    )

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe }),
    })
    const data = await res.json()

    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: res.ok ? 'saved' : 'error',
              error: res.ok ? undefined : (data as ApiError).message,
            }
          : item
      )
    )
  }

  const reset = () => {
    setStage('idle')
    setRecipe(null)
    setError(null)
    setBatchItems([])
    audioBase64Ref.current = null
  }

  const isRateLimit = error?.error === 'rate_limit'
  const isDuplicate = error?.error === 'duplicate'

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#3d2c1e] mb-1">הוספת מתכון חדש</h1>
      <p className="text-sm text-[#9e8474] mb-6">
        העלי תמונה של דף המתכון הכתוב, תיקייה של תמונות, או הקליטי בקול
      </p>

      {/* ── Saved ── */}
      {stage === 'saved' ? (
        <div className="bg-[#f0f7ee] border border-[#d5e8d0] rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <p className="font-semibold text-[#3d2c1e] mb-1">המתכון נשמר!</p>
          <p className="text-sm text-[#7a6555] mb-4">
            הוא יופיע בספר תוך כ-2 דקות לאחר פרסום אוטומטי
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="px-4 py-2 text-sm rounded-lg bg-[#3d2c1e] text-white hover:bg-[#2d1e10] transition-colors"
            >
              לספר המתכונים
            </a>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm rounded-lg border border-[#d9cfc5] text-[#3d2c1e] hover:bg-[#f5f0eb] transition-colors"
            >
              הוסיפי עוד מתכון
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Error banner ── */}
      {(stage === 'error' || (stage === 'result' && error)) && error ? (
        <div className={`border rounded-xl p-4 mb-6 text-sm ${isDuplicate ? 'bg-[#fff8e5] border-[#f0dfa0] text-[#7a6520]' : 'bg-[#fff8f5] border-[#f0cdb8] text-[#8b3a1a]'}`}>
          <p className="font-semibold mb-1">
            {isDuplicate ? '📋 מתכון כפול' : isRateLimit ? '⏳ Claude אינו זמין כרגע' : '⚠️ שגיאה'}
          </p>
          <p>{error.message}</p>
          {isRateLimit && retrySeconds > 0 ? (
            <p className="mt-1 text-xs">ניתן לנסות שוב בעוד {retrySeconds} שניות</p>
          ) : null}
          {!isRateLimit ? (
            <button onClick={reset} className="mt-2 text-xs underline">
              {isDuplicate ? 'חזרה להוספת מתכון' : 'נסי שוב'}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Idle / Error: show upload form ── */}
      {(stage === 'idle' || (stage === 'error' && !isRateLimit)) ? (
        <>
          {/* Batch mode toggle */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-[#faf7f4] rounded-xl border border-[#e5ddd5]">
            <button
              type="button"
              onClick={() => setBatchMode(false)}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                !batchMode
                  ? 'bg-[#3d2c1e] text-white'
                  : 'text-[#7a6555] hover:bg-[#f0ebe4]'
              }`}
            >
              תמונות = מתכון אחד
            </button>
            <button
              type="button"
              onClick={() => setBatchMode(true)}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                batchMode
                  ? 'bg-[#3d2c1e] text-white'
                  : 'text-[#7a6555] hover:bg-[#f0ebe4]'
              }`}
            >
              תמונה = מתכון נפרד
            </button>
          </div>

          <UploadZone onFiles={processFiles} disabled={false} />
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#e5ddd5]" />
            <span className="text-xs text-[#b5a59a]">או</span>
            <div className="flex-1 h-px bg-[#e5ddd5]" />
          </div>
          <VoiceRecorder onRecordingComplete={processVoice} disabled={false} />
        </>
      ) : null}

      {/* ── Processing spinner ── */}
      {stage === 'processing' ? (
        <div className="text-center py-16 text-[#9e8474]">
          <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
          {batchMode && batchProgress.total > 1 ? (
            <p className="text-sm">
              מעבד מתכון {batchProgress.done + 1} מתוך {batchProgress.total}...
            </p>
          ) : (
            <p className="text-sm">Claude מעבד את המתכון...</p>
          )}
        </div>
      ) : null}

      {/* ── Single result ── */}
      {stage === 'result' && recipe ? (
        <div className="space-y-4">
          <RecipeResult recipe={recipe} onChange={setRecipe} />
          <div className="flex gap-3">
            <button
              onClick={save}
              className="flex-1 py-3 rounded-xl bg-[#3d2c1e] text-white font-semibold text-sm hover:bg-[#2d1e10] transition-colors"
            >
              💾 שמור לספר המתכונים
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 rounded-xl border border-[#d9cfc5] text-[#3d2c1e] text-sm hover:bg-[#f5f0eb] transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Saving single ── */}
      {stage === 'saving' ? (
        <div className="text-center py-16 text-[#9e8474]">
          <p className="text-sm">שומר לספר המתכונים...</p>
        </div>
      ) : null}

      {/* ── Batch results queue ── */}
      {stage === 'batch-results' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#3d2c1e]">
              {batchItems.length} מתכונים זוהו
            </p>
            <button onClick={reset} className="text-xs text-[#9e8474] underline">
              התחל מחדש
            </button>
          </div>

          {batchItems.map((item, idx) => (
            <div
              key={item.id}
              className={`border rounded-xl p-4 ${
                item.status === 'saved'
                  ? 'bg-[#f0f7ee] border-[#d5e8d0]'
                  : item.status === 'error'
                  ? 'bg-[#fff8f5] border-[#f0cdb8]'
                  : 'bg-white border-[#e5ddd5]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#9e8474]">מתכון {idx + 1}</span>
                {item.status === 'saved' && (
                  <span className="text-xs text-green-700 font-medium">✓ נשמר</span>
                )}
                {item.status === 'error' && (
                  <span className="text-xs text-red-700 font-medium">⚠️ שגיאה</span>
                )}
              </div>

              {item.status === 'error' && item.error ? (
                <p className="text-sm text-[#8b3a1a]">{item.error}</p>
              ) : (
                <>
                  <p className="font-semibold text-[#3d2c1e] mb-1">{item.recipe.title}</p>
                  <p className="text-xs text-[#9e8474] mb-3">
                    {item.recipe.ingredients.length} מרכיבים · {item.recipe.category}
                  </p>
                  {item.status !== 'saved' && (
                    <button
                      onClick={() => saveBatchItem(item.id, item.recipe)}
                      disabled={item.status === 'saving'}
                      className="w-full py-2 rounded-lg bg-[#3d2c1e] text-white text-sm font-medium hover:bg-[#2d1e10] disabled:opacity-50 transition-colors"
                    >
                      {item.status === 'saving' ? 'שומר...' : '💾 שמור מתכון זה'}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="pt-2 text-center">
            <a href="/" className="text-sm text-[#c9703a] underline">
              לספר המתכונים
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}
