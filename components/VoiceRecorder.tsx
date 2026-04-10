'use client'
import { useState, useRef } from 'react'

interface Props {
  onRecordingComplete: (audioBase64: string, transcription: string) => void
  disabled?: boolean
}

export default function VoiceRecorder({ onRecordingComplete, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [liveText, setLiveText] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const liveTextRef = useRef('')

  const startRecording = async () => {
    setLiveText('')
    liveTextRef.current = ''
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorder.start(100)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition

    if (SpeechRecognitionAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new SpeechRecognitionAPI() as any
      recognition.lang = 'he-IL'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        liveTextRef.current = transcript
        setLiveText(transcript)
      }
      recognition.start()
      recognitionRef.current = recognition
    }

    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder) return

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        onRecordingComplete(base64, liveTextRef.current)
      }
      reader.readAsDataURL(blob)
      mediaRecorder.stream.getTracks().forEach((t) => t.stop())
    }
    mediaRecorder.stop()
    setRecording(false)
  }

  return (
    <div className={`bg-white border border-[#e5ddd5] rounded-xl p-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="text-3xl">🎙️</div>
        <div className="flex-1">
          <p className="font-semibold text-[#3d2c1e] text-sm">הקלטת מתכון בקול</p>
          <p className="text-xs text-[#9e8474]">ספרי את המתכון — Claude יארגן אותו אוטומטית</p>
        </div>
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 text-sm rounded-lg bg-[#fff0eb] text-[#c9703a] border border-[#f0cdb8] hover:bg-[#ffe4d4] transition-colors font-semibold shrink-0"
          >
            ● הקלטה
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="px-4 py-2 text-sm rounded-lg bg-[#c9703a] text-white border border-[#c9703a] hover:bg-[#b5622e] transition-colors font-semibold shrink-0 animate-pulse"
          >
            ■ עצור
          </button>
        )}
      </div>
      {liveText ? (
        <div className="mt-3 p-3 bg-[#f5f0eb] rounded-lg text-sm text-[#3d2c1e] leading-relaxed max-h-28 overflow-y-auto">
          {liveText}
        </div>
      ) : null}
    </div>
  )
}
