'use client'
import { useState, useRef } from 'react'
import UploadZone from '@/components/UploadZone'
import VoiceRecorder from '@/components/VoiceRecorder'
import RecipeResult from '@/components/RecipeResult'
import type { ProcessedRecipe, ApiError } from '@/lib/types'

type Stage = 'idle' | 'processing' | 'result' | 'saving' | 'saved' | 'error'

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [recipe, setRecipe] = useState<ProcessedRecipe | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [retrySeconds, setRetrySeconds] = useState(0)
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

  const processFiles = async (files: File[]) => {
    setStage('processing')
    setError(null)
    audioBase64Ref.current = null

    const formData = new FormData()
    files.forEach((f) => formData.append('images', f))

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

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe, audio: audioBase64Ref.current }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data as ApiError)
      setStage('error')
      return
    }

    setStage('saved')
  }

  const reset = () => {
    setStage('idle')
    setRecipe(null)
    setError(null)
    audioBase64Ref.current = null
  }

  const isRateLimit = error?.error === 'rate_limit'

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#3d2c1e] mb-1">הוספת מתכון חדש</h1>
      <p className="text-sm text-[#9e8474] mb-8">
        העלי תמונה של דף המתכון הכתוב, תיקייה של תמונות, או הקליטי בקול
      </p>

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

      {stage === 'error' && error ? (
        <div className="bg-[#fff8f5] border border-[#f0cdb8] rounded-xl p-4 mb-6 text-sm text-[#8b3a1a]">
          <p className="font-semibold mb-1">
            {isRateLimit ? '⏳ Claude אינו זמין כרגע' : '⚠️ שגיאה'}
          </p>
          <p>{error.message}</p>
          {isRateLimit && retrySeconds > 0 ? (
            <p className="mt-1 text-xs">ניתן לנסות שוב בעוד {retrySeconds} שניות</p>
          ) : null}
          {!isRateLimit ? (
            <button onClick={reset} className="mt-2 text-xs underline">
              נסי שוב
            </button>
          ) : null}
        </div>
      ) : null}

      {(stage === 'idle' || (stage === 'error' && !isRateLimit)) ? (
        <>
          <UploadZone onFiles={processFiles} disabled={stage === 'processing'} />
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#e5ddd5]" />
            <span className="text-xs text-[#b5a59a]">או</span>
            <div className="flex-1 h-px bg-[#e5ddd5]" />
          </div>
          <VoiceRecorder
            onRecordingComplete={processVoice}
            disabled={stage === 'processing'}
          />
        </>
      ) : null}

      {stage === 'processing' ? (
        <div className="text-center py-16 text-[#9e8474]">
          <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
          <p className="text-sm">Claude מעבד את המתכון...</p>
        </div>
      ) : null}

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

      {stage === 'saving' ? (
        <div className="text-center py-16 text-[#9e8474]">
          <p className="text-sm">שומר לספר המתכונים...</p>
        </div>
      ) : null}
    </div>
  )
}
