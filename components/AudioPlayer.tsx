'use client'
import { useRef, useState } from 'react'

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const onTimeUpdate = () => {
    if (!audioRef.current) return
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100
    setProgress(isNaN(pct) ? 0 : pct)
  }

  const onEnded = () => setPlaying(false)

  return (
    <div className="flex items-center gap-3 bg-[#f5f0eb] border-t border-[#e5ddd5] px-5 py-3">
      <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-[#c9703a] text-white flex items-center justify-center text-xs shrink-0 hover:bg-[#b5622e] transition-colors"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <span className="text-xs text-[#7a6555] shrink-0">הקלטה קולית</span>
      <div className="flex-1 h-1 bg-[#e5ddd5] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#c9703a] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
